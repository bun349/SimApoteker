"""Mesin Evaluasi Komprehensif VIKIE (5 Dimensi -> tabel rapor_penilaian).

Dimensi yang dihitung:
1. Komunikasi PaCT (Tool A sampai E, skala 0-100, rata-rata 5 tool + anti-halusinasi + kamus jargon).
2. Konten Klinis (3 Pilar: Prosedur, Penanganan DDI [nullable + normalisasi bobot], Kelengkapan + penalti & KK).
3. Nilai Gabungan Sistem (rata-rata tertimbang Komunikasi & Konten sesuai bobot skenario atau 40%/60%).
4. Pengamatan Vokal (observasional / non-penalti dari pengamatan_vokal.py).
5. Umpan Balik Kualitatif (3 kelompok), Detail Pemicu, Audit Log, Metadata, & Status Rapor.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import re
import time
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.services.evaluation.pengamatan_vokal import evaluate_vocal_observation
from app.services.simulation.evaluation_mapper import (
    build_initial_trigger_traces,
    update_trigger_traces_from_transcript,
)
from app.services.simulation.finish_service import _has_follow_up_plan
from app.services.simulation.gemini_patient import (
    FLASH_FALLBACK_MODELS,
    _dedupe_models,
    _is_thinking_config_error,
    _should_fallback_model,
)

logger = logging.getLogger(__name__)

MIN_VALID_STUDENT_TURNS = 5
ENGINE_VERSION = "vikie-eval-2.0"

PACT_TOOL_META: dict[str, dict[str, str]] = {
    "A": {
        "kode": "A",
        "nama": "Membangun Koneksi & Hubungan Awal",
        "indikator": "Salam, perkenalan diri sebagai apoteker, menyapa nama pasien, dan membangun suasana nyaman.",
    },
    "B": {
        "kode": "B",
        "nama": "Eksplorasi Perspektif Pasien",
        "indikator": "Menggali keluhan, pemahaman awal (Three Prime Questions pada resep), kekhawatiran, dan ekspektasi pasien.",
    },
    "C": {
        "kode": "C",
        "nama": "Respons Empatik & Dukungan",
        "indikator": "Merespons isyarat emosional (cue_triggers), memvalidasi kecemasan pasien, dan menunjukkan active listening.",
    },
    "D": {
        "kode": "D",
        "nama": "Edukasi Kolaboratif & Berbagi Keputusan",
        "indikator": "Menyampaikan edukasi dengan bahasa awam (bebas jargon tanpa penjelasan) dan melibatkan pasien dalam rencana terapi.",
    },
    "E": {
        "kode": "E",
        "nama": "Komunikasi Efektif & Penstrukturan",
        "indikator": "Alur komunikasi terstruktur, tidak membingungkan, melakukan teach-back, dan menutup sesi secara profesional.",
    },
}


def _clamp(val: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, float(val)))


def _normalisasi_teks(teks: str) -> str:
    if not teks:
        return ""
    return re.sub(r"[^\w\s]", " ", teks.lower()).strip()


def _compact_spaces(teks: str) -> str:
    return re.sub(r"\s+", " ", teks).strip()


def _kutipan_sah(kutipan: str, daftar_ucapan_mahasiswa_bersih: list[str]) -> bool:
    """Aturan anti-halusinasi: kutipan minimal 2 kata dan cocok pada transkrip mahasiswa."""
    if not kutipan:
        return False
    kutipan_bersih = _compact_spaces(_normalisasi_teks(kutipan))
    if len(kutipan_bersih.split()) < 2:
        return False
    gabungan = " ".join(_compact_spaces(u) for u in daftar_ucapan_mahasiswa_bersih)
    return kutipan_bersih in gabungan


def _find_turn_for_quote(
    kutipan: str,
    student_rows: list[dict[str, Any]],
) -> tuple[str | None, int | None, int | None]:
    """Cari (kode_giliran, nomor_giliran_pembicara, waktu_mulai_detik) dari kutipan mahasiswa."""
    if not kutipan:
        return None, None, None
    needle = _compact_spaces(_normalisasi_teks(kutipan))
    if len(needle.split()) < 2:
        return None, None, None
    for row in student_rows:
        haystack = _compact_spaces(_normalisasi_teks(str(row.get("teks") or "")))
        if needle in haystack:
            kode = str(row.get("kode_giliran") or f"MHS-{int(row.get('nomor_giliran_pembicara') or 1):02d}")
            num = int(row.get("nomor_giliran_pembicara") or 0) or None
            waktu = int(row.get("waktu_mulai_detik") or 0)
            return kode, num, waktu
    return None, None, None


def _pact_level_info(score: float) -> tuple[int, str]:
    """Konversi skor 0-100 ke skala 5 tingkat PaCT."""
    if score >= 90:
        return 5, "Exemplary"
    if score >= 75:
        return 4, "Capable"
    if score >= 50:
        return 3, "Adequate"
    if score >= 25:
        return 2, "Needs Improvement"
    return 1, "Novice"


def _normalize_pillar(raw_category: str) -> str:
    low = (raw_category or "").strip().lower()
    if "global" in low or "seluruh" in low:
        return "global"
    if "ddi" in low or "interaksi" in low or "keamanan" in low:
        return "ddi"
    if "kelengkapan" in low or "edukasi" in low or "informasi" in low or "konseling" in low:
        return "kelengkapan"
    return "prosedur"


def _has_meaningful_json(val: Any) -> bool:
    """Cek apakah kolom jsonb (mis. interaksi_ditanam) benar-benar berisi data (bukan None/{}/[])."""
    if val is None or isinstance(val, bool):
        return bool(val)
    if isinstance(val, str):
        return bool(val.strip())
    if isinstance(val, list):
        return any(_has_meaningful_json(item) for item in val)
    if isinstance(val, dict):
        return any(_has_meaningful_json(v) for v in val.values())
    return True


def _extract_kamus_entries(
    raw_kamus_tambahan: Any,
    kamus_umum_rows: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Gabungkan kamus_istilah_umum (tabel global) dan kamus_tambahan (per skenario)."""
    merged: dict[str, dict[str, Any]] = {}

    # 1. Kamus umum dari tabel public.kamus_istilah_umum (aktif = true)
    for row in kamus_umum_rows or []:
        if not isinstance(row, dict):
            continue
        istilah = str(row.get("istilah") or "").strip()
        if not istilah:
            continue
        variasi = [str(v).strip().lower() for v in (row.get("variasi_ejaan") or []) if str(v).strip()]
        padanan = [str(p).strip().lower() for p in (row.get("padanan_awam") or []) if str(p).strip()]
        if padanan:
            merged[istilah.lower()] = {
                "istilah": istilah,
                "pencarian": list(dict.fromkeys([istilah.lower(), *variasi])),
                "padanan": padanan,
            }

    # 2. Kamus tambahan khusus skenario (menimpa/melengkapi kamus umum)
    if isinstance(raw_kamus_tambahan, dict):
        for k, v in raw_kamus_tambahan.items():
            key = str(k).strip()
            if not key:
                continue
            vals = (
                [str(x).strip().lower() for x in v if str(x).strip()]
                if isinstance(v, list)
                else [s.strip().lower() for s in str(v).split(",") if s.strip()]
            )
            if vals:
                merged[key.lower()] = {
                    "istilah": key,
                    "pencarian": [key.lower()],
                    "padanan": vals,
                }
    elif isinstance(raw_kamus_tambahan, list):
        for item in raw_kamus_tambahan:
            if not isinstance(item, dict):
                continue
            k = str(item.get("istilah_medis") or item.get("istilah") or "").strip()
            v = item.get("padanan_awam") or item.get("padanan") or ""
            if not k:
                continue
            vals = (
                [str(x).strip().lower() for x in v if str(x).strip()]
                if isinstance(v, list)
                else [s.strip().lower() for s in str(v).split(",") if s.strip()]
            )
            if vals:
                merged[k.lower()] = {
                    "istilah": k,
                    "pencarian": [k.lower()],
                    "padanan": vals,
                }

    return list(merged.values())


def _extract_kunci_konten(scenario: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Mendukung format Wizard ({'butir': [...]}) maupun format dict lama ({'K-01': {...}})."""
    raw = scenario.get("kunci_konten") or {}
    result: dict[str, dict[str, Any]] = {}

    if isinstance(raw, dict) and isinstance(raw.get("butir"), list):
        for idx, entry in enumerate(raw["butir"], start=1):
            if not isinstance(entry, dict):
                continue
            item_id = str(entry.get("id") or f"K-{idx:02d}").strip()
            result[item_id] = {
                "id": item_id,
                "kategori": str(entry.get("kategori") or "Prosedur"),
                "nama_butir": str(entry.get("butir") or entry.get("nama_butir") or item_id),
                "bobot": float(entry.get("bobot") or 1),
                "syarat_berlaku": str(entry.get("syarat_berlaku") or "Selalu berlaku"),
                "wajib": entry.get("komponen") or entry.get("wajib") or [],
                "alternatif_diterima": entry.get("alternatif") or entry.get("alternatif_diterima") or [],
                "keliru_atau_tidak_aman": entry.get("keliru") or entry.get("keliru_atau_tidak_aman") or [],
                "rujukan": str(entry.get("rujukan") or ""),
            }
    elif isinstance(raw, dict):
        for item_id, entry in raw.items():
            if not isinstance(entry, dict):
                continue
            result[str(item_id)] = {
                "id": str(item_id),
                "kategori": str(entry.get("kategori") or "Prosedur"),
                "nama_butir": str(entry.get("nama_butir") or entry.get("butir") or item_id),
                "bobot": float(entry.get("bobot") or 1),
                "syarat_berlaku": str(entry.get("syarat_berlaku") or "Selalu berlaku"),
                "wajib": entry.get("wajib") or entry.get("komponen") or [],
                "alternatif_diterima": entry.get("alternatif_diterima") or entry.get("alternatif") or [],
                "keliru_atau_tidak_aman": entry.get("keliru_atau_tidak_aman") or entry.get("keliru") or [],
                "rujukan": str(entry.get("rujukan") or ""),
            }

    # Fallback deterministik jika skenario belum mendefinisikan butir kunci_konten secara eksplisit
    if not result:
        memuat_ddi = bool(scenario.get("memuat_ddi")) or _has_meaningful_json(scenario.get("interaksi_ditanam"))
        result["K-01"] = {
            "id": "K-01",
            "kategori": "Prosedur",
            "nama_butir": "Penggalian Identitas, Keluhan, Alergi, dan Obat Penyerta",
            "bobot": 2.0,
            "syarat_berlaku": "Selalu berlaku",
            "wajib": ["Menggali keluhan/kondisi pasien", "Menanyakan riwayat alergi obat atau obat lain yang dikonsumsi"],
            "alternatif_diterima": [],
            "keliru_atau_tidak_aman": [],
            "rujukan": "",
        }
        result["K-02"] = {
            "id": "K-02",
            "kategori": "Prosedur",
            "nama_butir": "Verifikasi Pemahaman (Teach-Back) & Rencana Tindak Lanjut",
            "bobot": 2.0,
            "syarat_berlaku": "Selalu berlaku",
            "wajib": ["Memastikan pemahaman pasien", "Menyampaikan kapan harus kontrol/kembali ke dokter"],
            "alternatif_diterima": [],
            "keliru_atau_tidak_aman": [],
            "rujukan": "",
        }
        result["K-03"] = {
            "id": "K-03",
            "kategori": "Kelengkapan Informasi",
            "nama_butir": "Ketepatan Terapi, Dosis, Aturan Pakai, dan Cara Penggunaan Obat",
            "bobot": 3.0,
            "syarat_berlaku": "Selalu berlaku",
            "wajib": ["Menyampaikan dosis dan frekuensi dengan benar", "Menyampaikan cara pakai/durasi terapi yang tepat"],
            "alternatif_diterima": [],
            "keliru_atau_tidak_aman": [],
            "rujukan": "",
        }
        result["K-04"] = {
            "id": "K-04",
            "kategori": "Kelengkapan Informasi",
            "nama_butir": "Edukasi Efek Samping, Penyimpanan Obat, dan Tanda Bahaya (Red Flags)",
            "bobot": 2.0,
            "syarat_berlaku": "Selalu berlaku",
            "wajib": ["Menyebutkan efek samping/tanda bahaya yang perlu diwaspadai", "Menyebutkan cara penyimpanan atau edukasi non-farmakologi"],
            "alternatif_diterima": [],
            "keliru_atau_tidak_aman": [],
            "rujukan": "",
        }
        if memuat_ddi:
            interaksi = str(scenario.get("interaksi_ditanam") or "Interaksi obat atau kontraindikasi pada kasus")
            result["K-05"] = {
                "id": "K-05",
                "kategori": "Penanganan Interaksi Obat (DDI)",
                "nama_butir": "Identifikasi dan Solusi Keamanan Terapi / DDI",
                "bobot": 3.0,
                "syarat_berlaku": "Selalu berlaku",
                "wajib": [f"Mengidentifikasi dan menangani {interaksi} secara aman"],
                "alternatif_diterima": [],
                "keliru_atau_tidak_aman": [],
                "rujukan": "",
            }

    return result


def _extract_kesalahan_kritis(scenario: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Mendukung format Wizard ({'butir': [...]}) maupun format dict lama ({'KK-01': {...}})."""
    raw = scenario.get("kesalahan_kritis") or {}
    result: dict[str, dict[str, Any]] = {}

    if isinstance(raw, dict) and isinstance(raw.get("butir"), list):
        for idx, entry in enumerate(raw["butir"], start=1):
            if not isinstance(entry, dict):
                continue
            kk_id = str(entry.get("id") or f"KK-{idx:02d}").strip()
            gagal = bool(entry.get("gagal", False))
            result[kk_id] = {
                "id": kk_id,
                "judul": str(entry.get("judul") or kk_id),
                "kategori": str(entry.get("kategori") or ("Global (Seluruh Nilai)" if gagal else "Prosedur")),
                "gagal": gagal,
                "penalti": float(100 if gagal else (entry.get("poin") or entry.get("penalti") or 25)),
                "deskripsi": str(entry.get("deskripsi") or ""),
                "kriteria": str(entry.get("kriteria") or entry.get("dianggap_terjadi_bila") or ""),
                "bisa_dikoreksi": False if gagal else bool(entry.get("koreksi", entry.get("bisa_dikoreksi", True))),
                "koreksi_maks_giliran": int(entry.get("koreksi_maks_giliran") or 2),
                "butir_terkait": list(entry.get("butir_terkait") or []),
            }
    elif isinstance(raw, dict):
        for kk_id, entry in raw.items():
            if not isinstance(entry, dict):
                continue
            gagal = bool(entry.get("gagal", False))
            result[str(kk_id)] = {
                "id": str(kk_id),
                "judul": str(entry.get("judul") or entry.get("nama") or kk_id),
                "kategori": str(entry.get("kategori_dikenai_penalti") or entry.get("kategori") or "Prosedur"),
                "gagal": gagal,
                "penalti": float(100 if gagal else (entry.get("penalti") or entry.get("poin") or 25)),
                "deskripsi": str(entry.get("deskripsi") or ""),
                "kriteria": str(entry.get("dianggap_terjadi_bila") or entry.get("kriteria") or ""),
                "bisa_dikoreksi": False if gagal else bool(entry.get("bisa_dikoreksi", entry.get("koreksi", True))),
                "koreksi_maks_giliran": int(entry.get("koreksi_maks_giliran") or 2),
                "butir_terkait": list(entry.get("butir_terkait") or []),
            }

    return result


def _resolve_weights(scenario: dict[str, Any]) -> tuple[float, float]:
    """Ambil bobot komunikasi & konten dari skenario (default 40% / 60% bila belum diset)."""
    raw_kom = scenario.get("bobot_komunikasi")
    raw_kon = scenario.get("bobot_konten")
    try:
        if raw_kom is not None and float(raw_kom) > 0:
            kom = float(raw_kom)
            kon = float(raw_kon) if raw_kon is not None and float(raw_kon) > 0 else (100.0 - kom)
            total = kom + kon
            if total > 0:
                return round(kom / total, 4), round(kon / total, 4)
    except (TypeError, ValueError):
        pass
    return 0.40, 0.60


def _parse_json_response(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        return {}
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}


class GeminiEvaluationJudge:
    """Wrapper Gemini JSON structured output dengan fallback otomatis lintas model Flash."""

    def __init__(self, model_name: str | None = None) -> None:
        http_options = (
            types.HttpOptions(api_version="v1beta")
            if hasattr(types, "HttpOptions")
            else None
        )
        client_kwargs: dict[str, object] = {"api_key": settings.GEMINI_API_KEY}
        if http_options is not None:
            client_kwargs["http_options"] = http_options
        self.client = genai.Client(**client_kwargs)  # type: ignore[arg-type]
        primary = model_name or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        self.models = _dedupe_models(primary, FLASH_FALLBACK_MODELS)

    async def generate_json(self, prompt: str) -> tuple[dict[str, Any], str]:
        last_error: Exception | None = None
        for idx, candidate_model in enumerate(self.models):
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            )
            try:
                response = await self.client.aio.models.generate_content(
                    model=candidate_model,
                    contents=prompt,
                    config=config,
                )
                return _parse_json_response(getattr(response, "text", "") or ""), candidate_model
            except Exception as exc:
                if _is_thinking_config_error(exc):
                    try:
                        response = await self.client.aio.models.generate_content(
                            model=candidate_model,
                            contents=prompt,
                            config=types.GenerateContentConfig(temperature=0.0),
                        )
                        return _parse_json_response(getattr(response, "text", "") or ""), candidate_model
                    except Exception as retry_exc:
                        exc = retry_exc

                if _should_fallback_model(exc):
                    last_error = exc
                    next_model = self.models[idx + 1] if idx + 1 < len(self.models) else None
                    logger.warning(
                        "Evaluator Gemini '%s' gagal (%s). %s",
                        candidate_model,
                        exc,
                        f"Pindah ke '{next_model}'." if next_model else "Tidak ada model cadangan tersisa.",
                    )
                    continue
                raise

        raise RuntimeError(
            f"Semua model Gemini evaluator gagal ({', '.join(self.models)}): {last_error}"
        ) from last_error


def _build_clinical_and_pact_prompt(
    *,
    scenario: dict[str, Any],
    butir_aktif: dict[str, dict[str, Any]],
    kesalahan_kritis: dict[str, dict[str, Any]],
    transcript_text: str,
) -> str:
    profil = scenario.get("profil_pasien") or {}
    pemicu = scenario.get("konfigurasi_pemicu") or {}
    klinis = scenario.get("data_klinis_khusus") or {}

    return f"""Anda adalah evaluator objektif OSCE KIE Farmasi Klinis pada sistem VIKIE.
Tugas Anda menilai transkrip konseling mahasiswa farmasi berdasarkan rubrik PaCT (Tool A-E), Kunci Konten Klinis, Kesalahan Kritis, dan menghasilkan Umpan Balik Kualitatif terstruktur dalam SATU respons JSON murni.

[KONTEKS SKENARIO]
Judul: {scenario.get("judul") or "-"}
Jenis Kasus: {scenario.get("jenis") or "swamedikasi"}
Profil Pasien: {json.dumps(profil, ensure_ascii=False)}
Riwayat Alergi: {scenario.get("riwayat_alergi") or "Tidak ada"}
Obat Lain / Suplemen: {json.dumps(scenario.get("obat_lain_suplemen") or [], ensure_ascii=False)}
Kondisi Penyerta: {scenario.get("kondisi_penyerta") or "Tidak ada"}
Interaksi Ditanam (DDI): {scenario.get("interaksi_ditanam") or "Tidak ada"}
Data Klinis Khusus: {json.dumps(klinis, ensure_ascii=False)}
Pemicu Skenario (Info Kunci / Cue / Probe): {json.dumps(pemicu, ensure_ascii=False)}

[KUNCI KONTEN KLINIS AKTIF]
{json.dumps(butir_aktif, indent=2, ensure_ascii=False)}

[DAFTAR KESALAHAN KRITIS]
{json.dumps(kesalahan_kritis, indent=2, ensure_ascii=False)}

[TRANSKRIP PERCAKAPAN]
{transcript_text}

INSTRUKSI WAJIB:
1. **Dimensi Komunikasi PaCT (Tool A sampai E)** — masing-masing nilai 0 hingga 100:
   - Tool A (Establish a Connection): salam, perkenalan sebagai apoteker, sapaan nama pasien, suasana nyaman.
   - Tool B (Explore & Integrate Patient's Perspective): menggali keluhan, pemahaman awal (Three Prime Questions pada resep), kekhawatiran, ekspektasi pasien.
   - Tool C (Demonstrate Interest & Empathy): merespons isyarat emosi pasien, validasi kecemasan, active listening.
   - Tool D (Collaborate & Educate): edukasi jelas dengan bahasa awam & melibatkan pasien dalam keputusan terapi.
   - Tool E (Communicate with Finesse): alur terstruktur, tidak membingungkan, melakukan teach-back, dan penutupan profesional.
   Untuk setiap tool sertakan: "skor" (0-100), "alasan" (1 kalimat ringkas dalam bahasa Indonesia), "kutipan" (kutipan eksak minimal 2 kata dari ucapan MAHASISWA, atau "" jika tidak ada), "kode_giliran" (misal "MHS-01", atau null).
   Juga sertakan 5-8 rincian sub-kriteria komunikasi ("kriteria_pact") berkode A-1, A-2, B-1, C-1, D-1, E-1 dengan status ("terpenuhi" | "parsial" | "tidak_terpenuhi"), skor_poin (0-25), alasan, kutipan, kode_giliran.

2. **Dimensi Konten Klinis ("hasil_butir")**:
   Evaluasi setiap ID pada [KUNCI KONTEN KLINIS AKTIF]:
   - "berlaku": true/false (cek syarat_berlaku).
   - "skor": 1 (sempurna), 0.5 (parsial), atau 0 (tidak disampaikan/keliru).
   - "ambigu": true jika ucapan mahasiswa meragukan/bermakna ganda, else false.
   - "kutipan": kutipan EKSAK (minimal 2 kata persis ucapan MAHASISWA di transkrip) sebagai bukti; kosongkan "" jika skor 0.
   - "kode_giliran": kode giliran mahasiswa (misal "MHS-03") atau null.
   - "alasan": penjelasan singkat 1 kalimat.

3. **Kesalahan Kritis ("kesalahan_kritis")**:
   Evaluasi setiap ID pada [DAFTAR KESALAHAN KRITIS]:
   - "terjadi": true/false.
   - "nomor_giliran_terjadi": angka nomor giliran mahasiswa (integer) saat kesalahan pertama terjadi, atau null.
   - "kode_giliran_terjadi": misal "MHS-03", atau null.
   - "dikoreksi": true jika mahasiswa menyadari dan meralat kesalahan itu di giliran selanjutnya, else false.
   - "nomor_giliran_koreksi": angka nomor giliran mahasiswa saat koreksi, atau null.
   - "kode_giliran_koreksi": misal "MHS-05", atau null.
   - "kutipan": kutipan eksak ucapan MAHASISWA saat kesalahan terjadi.
   - "alasan": penjelasan singkat 1-2 kalimat.

4. **Umpan Balik Kualitatif ("umpan_balik")** berisi tepat 3 kelompok:
   - "kekuatan_utama": {{"ringkasan": "...", "kutipan": "<kutipan eksak mahasiswa>", "kode_giliran": "MHS-01", "tag": "Sikap profesional terjaga"}}
   - "area_perbaikan": {{"ringkasan": "...", "kutipan": "<kutipan eksak mahasiswa atau kosong>", "kode_giliran": "MHS-03", "tag": "Disiplin alur KIE"}}
   - "saran_praktik": {{"poin": [{{"judul": "...", "deskripsi": "..."}}, {{"judul": "...", "deskripsi": "..."}}, {{"judul": "...", "deskripsi": "..."}}], "tag": "Rencana remediasi mandiri"}}

KELUARAN WAJIB JSON MURNI TANPA MARKDOWN:
{{
  "pact": {{
    "A": {{"skor": 80, "alasan": "...", "kutipan": "...", "kode_giliran": "MHS-01"}},
    "B": {{"skor": 70, "alasan": "...", "kutipan": "...", "kode_giliran": "MHS-02"}},
    "C": {{"skor": 75, "alasan": "...", "kutipan": "...", "kode_giliran": "MHS-03"}},
    "D": {{"skor": 70, "alasan": "...", "kutipan": "...", "kode_giliran": "MHS-04"}},
    "E": {{"skor": 75, "alasan": "...", "kutipan": "...", "kode_giliran": "MHS-05"}}
  }},
  "kriteria_pact": [
    {{"kode": "A-1", "pilar": "A", "parameter": "Sapaan & Pengenalan Diri", "status": "terpenuhi", "skor_poin": 25, "maks_poin": 25, "kutipan": "...", "kode_giliran": "MHS-01", "alasan": "..."}}
  ],
  "hasil_butir": {{
    "<ID_BUTIR>": {{"berlaku": true, "skor": 1, "ambigu": false, "kutipan": "...", "kode_giliran": "MHS-02", "alasan": "..."}}
  }},
  "kesalahan_kritis": {{
    "<ID_KK>": {{"terjadi": false, "nomor_giliran_terjadi": null, "kode_giliran_terjadi": null, "dikoreksi": false, "nomor_giliran_koreksi": null, "kode_giliran_koreksi": null, "kutipan": "", "alasan": ""}}
  }},
  "umpan_balik": {{
    "kekuatan_utama": {{"ringkasan": "...", "kutipan": "", "kode_giliran": null, "tag": "Sikap profesional terjaga"}},
    "area_perbaikan": {{"ringkasan": "...", "kutipan": "", "kode_giliran": null, "tag": "Disiplin alur KIE"}},
    "saran_praktik": {{"poin": [{{"judul": "...", "deskripsi": "..."}}], "tag": "Rencana remediasi mandiri"}}
  }}
}}"""


def _build_detail_pemicu(
    scenario: dict[str, Any],
    transcript_rows: list[dict[str, Any]],
    student_texts: list[str],
) -> dict[str, Any]:
    initial_traces = build_initial_trigger_traces(scenario.get("konfigurasi_pemicu"))
    traces = update_trigger_traces_from_transcript(initial_traces, transcript_rows)
    follow_up_ok = _has_follow_up_plan(student_texts)

    trace_items = [t.model_dump() for t in traces]
    total_triggers = len(trace_items)
    covered_count = sum(1 for t in trace_items if t.get("status_pemicu") == "tergali_dan_direspons")

    return {
        "items": trace_items,
        "follow_up_plan": {
            "terpenuhi": follow_up_ok,
            "label": "Rencana Tindak Lanjut & Pemantauan",
        },
        "ringkasan": {
            "total_pemicu": total_triggers,
            "pemicu_terpenuhi": covered_count,
            "semua_pemicu_tergali": (covered_count == total_triggers) if total_triggers > 0 else len(student_texts) >= 1,
            "follow_up_terpenuhi": follow_up_ok,
        },
    }


def _build_default_feedback(
    *,
    status_rapor: str,
    valid_turns: int,
    skor_kom: float | None,
    skor_kon: float | None,
    kk_findings: list[dict[str, Any]],
    missing_items: list[str],
) -> list[dict[str, Any]]:
    if status_rapor in ("tidak_dapat_dinilai", "tidak_cukup_data"):
        return [
            {
                "kategori": "kekuatan_utama",
                "judul": "Yang Sudah Baik",
                "ringkasan": (
                    f"Anda telah memulai sesi percakapan dengan {valid_turns} giliran komunikasi valid."
                    if valid_turns > 0
                    else "Sesi berhasil tercatat di sistem untuk ditinjau kembali."
                ),
                "kutipan": "",
                "kode_giliran": None,
                "tag": "Partisipasi awal",
            },
            {
                "kategori": "area_perbaikan",
                "judul": "Perlu Ditingkatkan",
                "ringkasan": (
                    f"Jumlah giliran bicara mahasiswa ({valid_turns} giliran) belum mencapai ambang kelayakan minimal 5 giliran "
                    "sehingga sistem belum dapat memberikan nilai akhir yang sahih."
                ),
                "kutipan": "",
                "kode_giliran": None,
                "tag": "Kelengkapan sesi",
            },
            {
                "kategori": "saran_praktik",
                "judul": "Fokus Latihan Berikut",
                "poin": [
                    {
                        "judul": "Lengkapi Alur Konseling",
                        "deskripsi": "Lakukan minimal 5 giliran percakapan mencakup sapaan, penggalian riwayat, edukasi terapi, dan penutupan.",
                    },
                    {
                        "judul": "Verifikasi Pemahaman Pasien",
                        "deskripsi": "Akhiri sesi dengan teknik teach-back dan rencana tindak lanjut sebelum menekan tombol selesai.",
                    },
                ],
                "tag": "Rencana remediasi mandiri",
            },
        ]

    return [
        {
            "kategori": "kekuatan_utama",
            "judul": "Yang Sudah Baik",
            "ringkasan": (
                f"Capaian komunikasi berada di skor {round(skor_kom or 0)} dan substansi klinis di skor {round(skor_kon or 0)}. "
                "Pertahankan struktur konseling yang jelas dan ramah terhadap pasien."
            ),
            "kutipan": "",
            "kode_giliran": None,
            "tag": "Sikap profesional terjaga",
        },
        {
            "kategori": "area_perbaikan",
            "judul": "Perlu Ditingkatkan",
            "ringkasan": (
                f"Terdapat {len(kk_findings)} temuan kesalahan kritis yang perlu perhatian segera sebelum rekomendasi terapi."
                if kk_findings
                else (
                    f"Masih ada {len(missing_items)} butir klinis yang belum tuntas disampaikan kepada pasien."
                    if missing_items
                    else "Tingkatkan kedalaman eksplorasi kekhawatiran pasien dan konfirmasi teach-back di akhir sesi."
                )
            ),
            "kutipan": kk_findings[0].get("kutipan", "") if kk_findings else "",
            "kode_giliran": kk_findings[0].get("kode_giliran_terjadi") if kk_findings else None,
            "tag": "Disiplin alur KIE",
        },
        {
            "kategori": "saran_praktik",
            "judul": "Fokus Latihan Berikut",
            "poin": [
                {
                    "judul": "Protokol Penggalian Riwayat",
                    "deskripsi": "Pastikan alergi obat, obat rutin, dan kondisi penyerta digali tuntas sebelum memberi rekomendasi.",
                },
                {
                    "judul": "Penjelasan Bahasa Awam",
                    "deskripsi": "Terjemahkan setiap istilah medis ke bahasa sehari-hari yang mudah dipahami pasien.",
                },
                {
                    "judul": "Metode Teach-Back",
                    "deskripsi": "Minta pasien mengulang aturan pakai dan tanda bahaya (red flags) sebelum menutup konseling.",
                },
            ],
            "tag": "Rencana remediasi mandiri",
        },
    ]


async def evaluate_session_comprehensive(
    *,
    session: dict[str, Any],
    scenario: dict[str, Any],
    transcript_rows: list[dict[str, Any]],
    existing_rapor: dict[str, Any] | None = None,
    kamus_umum: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Jalankan evaluasi penuh 5 dimensi dan kembalikan payload siap simpan ke rapor_penilaian."""
    started_perf = time.perf_counter()
    now_iso = datetime.now(timezone.utc).isoformat()

    session_id = str(session["id"])
    mode = str(session.get("mode") or "mandiri").lower()
    kode_skenario = str(scenario.get("kode_skenario") or "-")
    versi_skenario = str(scenario.get("versi") or "0.1")
    judul_skenario = str(scenario.get("judul") or "Skenario KIE")
    jenis_skenario = str(scenario.get("jenis") or "swamedikasi")
    memuat_ddi = bool(scenario.get("memuat_ddi")) or _has_meaningful_json(scenario.get("interaksi_ditanam"))
    w_kom, w_kon = _resolve_weights(scenario)

    log_audit: list[str] = [
        f"[INIT] Evaluasi sesi {session_id} | Mode: {mode} | Skenario: {kode_skenario} v{versi_skenario} ({jenis_skenario})",
        f"[BOBOT] Komunikasi={int(round(w_kom * 100))}% | Konten Klinis={int(round(w_kon * 100))}%",
    ]

    student_rows = [
        r for r in transcript_rows
        if str(r.get("pembicara") or "").lower() == "mahasiswa" and str(r.get("teks") or "").strip()
    ]
    valid_student_rows = [
        r for r in student_rows if r.get("status_asr_valid", True) is not False
    ]
    student_texts = [str(r.get("teks") or "").strip() for r in valid_student_rows]
    student_texts_norm = [_normalisasi_teks(t) for t in student_texts]
    urutan_giliran_mhs = [
        int(r.get("nomor_giliran_pembicara") or idx)
        for idx, r in enumerate(valid_student_rows, start=1)
    ]

    # Dimensi 4: Pengamatan Vokal (selalu dihitung, non-penalti)
    vocal_result = evaluate_vocal_observation(transcript_rows, session=session)
    log_audit.append(
        f"[VOKAL] layak_tampil_vokal={vocal_result['layak_tampil_vokal']} | "
        f"audio_turns={vocal_result['ringkasan_vokal']['audio_turns']}"
    )

    # Detail Pemicu (selalu dihitung)
    detail_pemicu = _build_detail_pemicu(scenario, transcript_rows, student_texts)

    # =========================================================================
    # GERBANG KELAYAKAN (0 giliran -> tidak_dapat_dinilai, < 5 -> tidak_cukup_data)
    # =========================================================================
    if len(valid_student_rows) == 0 or len(valid_student_rows) < MIN_VALID_STUDENT_TURNS:
        status_rapor = "tidak_dapat_dinilai" if len(valid_student_rows) == 0 else "tidak_cukup_data"
        log_audit.append(
            f"[GERBANG] Giliran valid mahasiswa={len(valid_student_rows)} (< {MIN_VALID_STUDENT_TURNS}). "
            f"Status rapor ditetapkan: {status_rapor}."
        )
        elapsed_ms = int((time.perf_counter() - started_perf) * 1000)
        feedback = _build_default_feedback(
            status_rapor=status_rapor,
            valid_turns=len(valid_student_rows),
            skor_kom=None,
            skor_kon=None,
            kk_findings=[],
            missing_items=[],
        )
        return {
            "id_sesi": session_id,
            "skor_tool_a": None,
            "skor_tool_b": None,
            "skor_tool_c": None,
            "skor_tool_d": None,
            "skor_tool_e": None,
            "skor_komunikasi_mentah": None,
            "skor_komunikasi_tampil": None,
            "detail_pact": {
                "tools": {},
                "kriteria": [],
                "pelanggaran_jargon": [],
                "catatan": "Belum memenuhi syarat minimal 5 giliran valid mahasiswa.",
            },
            "skor_prosedur": None,
            "skor_penanganan_ddi": None,
            "skor_kelengkapan": None,
            "skor_konten_mentah": None,
            "skor_konten_tampil": None,
            "detail_butir_konten": {"items": [], "ringkasan_pilar": {}},
            "detail_kesalahan_kritis": {"items": [], "jumlah_temuan": 0, "jumlah_penalti_aktif": 0},
            "total_penalti_prosedur": 0.0,
            "total_penalti_ddi": 0.0,
            "total_penalti_kelengkapan": 0.0,
            "nilai_gabungan_sistem_mentah": None,
            "nilai_gabungan_sistem_tampil": None,
            "nilai_resmi_akhir": None,
            "layak_tampil_vokal": vocal_result["layak_tampil_vokal"],
            "data_pengamatan_vokal": vocal_result["data_pengamatan_vokal"],
            "narasi_pengamatan_vokal": vocal_result["narasi_pengamatan_vokal"],
            "umpan_balik_rapor": feedback,
            "log_audit_sistem": log_audit,
            "detail_pemicu": detail_pemicu,
            "metadata_evaluasi": {
                "model_llm": None,
                "versi_rubrik": versi_skenario,
                "versi_mesin": ENGINE_VERSION,
                "bobot_komunikasi": w_kom,
                "bobot_konten": w_kon,
                "jumlah_giliran_valid": len(valid_student_rows),
                "dievaluasi_at": now_iso,
                "durasi_proses_ms": elapsed_ms,
                "alasan_tinjau_dosen": [],
            },
            "status_rapor": status_rapor,
            "dievaluasi_at": now_iso,
            "updated_at": now_iso,
        }

    # =========================================================================
    # PERSIAPAN RUBRIK AKTIF & FILTER EXCLUDED ITEMS
    # =========================================================================
    raw_klinis = scenario.get("data_klinis_khusus") or {}
    excluded_ids = set(str(x) for x in (scenario.get("butir_tidak_berlaku") or []))
    if isinstance(raw_klinis, dict) and isinstance(raw_klinis.get("butir_tidak_berlaku"), list):
        excluded_ids.update(str(x) for x in raw_klinis["butir_tidak_berlaku"])

    all_kunci = _extract_kunci_konten(scenario)
    butir_aktif: dict[str, dict[str, Any]] = {}
    for item_id, detail in all_kunci.items():
        if item_id in excluded_ids:
            log_audit.append(f"[FILTER] Butir {item_id} dikecualikan melalui butir_tidak_berlaku.")
            continue
        pilar = _normalize_pillar(detail.get("kategori", ""))
        if not memuat_ddi and pilar == "ddi":
            log_audit.append(f"[FILTER] Butir {item_id} (DDI) diabaikan karena skenario non-DDI.")
            continue
        butir_aktif[item_id] = detail

    kesalahan_kritis_rules = _extract_kesalahan_kritis(scenario)

    # Format transkrip untuk LLM judge
    transcript_lines: list[str] = []
    for idx, row in enumerate(transcript_rows, start=1):
        speaker = "MAHASISWA" if str(row.get("pembicara") or "").lower() == "mahasiswa" else "PASIEN"
        kode = str(row.get("kode_giliran") or f"{'MHS' if speaker == 'MAHASISWA' else 'PSN'}-{idx:02d}")
        num = int(row.get("nomor_giliran_pembicara") or idx)
        waktu = int(row.get("waktu_mulai_detik") or 0)
        teks = str(row.get("teks") or "").strip()
        if teks:
            transcript_lines.append(f"[{kode} | Giliran #{num} | {waktu}s] {speaker}: {teks}")
    transcript_text = "\n".join(transcript_lines)

    # =========================================================================
    # PANGGIL GEMINI JUDGE (JSON STRUCTURED + FALLBACK MODEL FLASH)
    # =========================================================================
    prompt = _build_clinical_and_pact_prompt(
        scenario=scenario,
        butir_aktif=butir_aktif,
        kesalahan_kritis=kesalahan_kritis_rules,
        transcript_text=transcript_text,
    )
    judge = GeminiEvaluationJudge()
    ai_result, used_model = await judge.generate_json(prompt)
    log_audit.append(f"[LLM] Evaluasi selesai menggunakan model '{used_model}'.")

    # =========================================================================
    # DIMENSI 1: KOMUNIKASI PaCT (TOOL A - E) + RULE-BASED KAMUS JARGON
    # =========================================================================
    profil = scenario.get("profil_pasien") or {}
    literasi = str(
        profil.get("pemahaman_kesehatan")
        or profil.get("literasi_kesehatan")
        or profil.get("literasi")
        or "sedang"
    ).lower()
    kamus_entries = _extract_kamus_entries(scenario.get("kamus_tambahan"), kamus_umum)
    gabungan_mhs_lower = " ".join(t.lower() for t in student_texts)

    pelanggaran_jargon: list[dict[str, Any]] = []
    penalti_jargon_per_item = 10.0 if literasi in ("rendah", "awam") else 5.0
    total_penalti_jargon = 0.0

    for entry in kamus_entries:
        istilah = entry["istilah"]
        pencarian = entry["pencarian"]
        padanan_list = entry["padanan"]
        istilah_dipakai = any(term in gabungan_mhs_lower for term in pencarian)
        if istilah_dipakai:
            ada_padanan = any(p in gabungan_mhs_lower for p in padanan_list)
            if not ada_padanan:
                total_penalti_jargon += penalti_jargon_per_item
                pelanggaran_jargon.append({
                    "istilah": istilah,
                    "padanan_diharapkan": padanan_list,
                    "penalti": penalti_jargon_per_item,
                })
                log_audit.append(
                    f"[PaCT-JARGON] Istilah '{istilah}' digunakan tanpa penjelasan awam {padanan_list} (-{penalti_jargon_per_item} pada Tool D)."
                )

    raw_pact = ai_result.get("pact") if isinstance(ai_result.get("pact"), dict) else {}
    pact_scores: dict[str, float] = {}
    pact_tools_detail: dict[str, dict[str, Any]] = {}

    for tool_key in ("A", "B", "C", "D", "E"):
        entry = raw_pact.get(tool_key) if isinstance(raw_pact.get(tool_key), dict) else {}
        base_score = _clamp(float(entry.get("skor", 65.0)))
        kutipan = str(entry.get("kutipan") or "").strip()
        kode_gil = entry.get("kode_giliran")
        alasan = str(entry.get("alasan") or PACT_TOOL_META[tool_key]["indikator"]).strip()

        # Validasi kutipan agar tidak halusinasi
        kutipan_valid = _kutipan_sah(kutipan, student_texts_norm) if kutipan else False
        if kutipan_valid:
            found_kode, _, _ = _find_turn_for_quote(kutipan, valid_student_rows)
            if found_kode:
                kode_gil = found_kode
        elif kutipan:
            kutipan = ""

        # Terapkan penalti jargon berbasis kamus pada Tool D (Edukasi Kolaboratif & Bahasa Awam)
        final_tool_score = base_score
        if tool_key == "D" and total_penalti_jargon > 0:
            final_tool_score = _clamp(base_score - total_penalti_jargon)

        level_num, level_label = _pact_level_info(final_tool_score)
        pact_scores[tool_key] = round(final_tool_score, 2)
        pact_tools_detail[tool_key] = {
            "kode": tool_key,
            "nama": PACT_TOOL_META[tool_key]["nama"],
            "indikator": PACT_TOOL_META[tool_key]["indikator"],
            "skor": round(final_tool_score, 2),
            "skor_tampil": int(round(final_tool_score)),
            "skala_level": level_num,
            "label_level": level_label,
            "alasan": alasan,
            "kutipan": kutipan,
            "bukti_giliran": [kode_gil] if kode_gil else [],
        }

    skor_komunikasi_mentah = round(sum(pact_scores.values()) / 5.0, 2)
    skor_komunikasi_tampil = int(round(skor_komunikasi_mentah))

    # Proses rincian kriteria PaCT untuk tabel Audit Rubrik (Bagian 6)
    raw_kriteria_pact = ai_result.get("kriteria_pact") if isinstance(ai_result.get("kriteria_pact"), list) else []
    kriteria_pact_clean: list[dict[str, Any]] = []
    for idx, kp in enumerate(raw_kriteria_pact, start=1):
        if not isinstance(kp, dict):
            continue
        pilar = str(kp.get("pilar") or "A").upper()[:1]
        kutipan = str(kp.get("kutipan") or "").strip()
        status_raw = str(kp.get("status") or "terpenuhi").lower()
        skor_poin = float(kp.get("skor_poin") or 0)
        maks_poin = float(kp.get("maks_poin") or 25)
        kode_gil = kp.get("kode_giliran")
        waktu_detik = None
        kutipan_ditolak = False

        if skor_poin > 0 and kutipan:
            if _kutipan_sah(kutipan, student_texts_norm):
                found_kode, _, found_sec = _find_turn_for_quote(kutipan, valid_student_rows)
                if found_kode:
                    kode_gil = found_kode
                    waktu_detik = found_sec
            else:
                kutipan_ditolak = True
                skor_poin = 0.0
                status_raw = "ditolak"

        kriteria_pact_clean.append({
            "kode": str(kp.get("kode") or f"{pilar}-{idx}"),
            "pilar": pilar,
            "kategori": f"Komunikasi (Pilar {pilar})",
            "parameter": str(kp.get("parameter") or PACT_TOOL_META.get(pilar, {}).get("nama", "Komunikasi")),
            "status": status_raw,
            "skor_poin": round(skor_poin, 1),
            "maks_poin": round(maks_poin, 1),
            "kutipan": kutipan,
            "kutipan_ditolak": kutipan_ditolak,
            "kode_giliran": kode_gil,
            "waktu_detik": waktu_detik,
            "alasan": str(kp.get("alasan") or "").strip(),
        })

    if not kriteria_pact_clean:
        for tool_key in ("A", "B", "C", "D", "E"):
            td = pact_tools_detail[tool_key]
            kriteria_pact_clean.append({
                "kode": f"{tool_key}-1",
                "pilar": tool_key,
                "kategori": f"Komunikasi (Pilar {tool_key})",
                "parameter": td["nama"],
                "status": "terpenuhi" if td["skor"] >= 75 else ("parsial" if td["skor"] >= 50 else "tidak_terpenuhi"),
                "skor_poin": round((td["skor"] / 100.0) * 25.0, 1),
                "maks_poin": 25.0,
                "kutipan": td["kutipan"],
                "kutipan_ditolak": False,
                "kode_giliran": td["bukti_giliran"][0] if td["bukti_giliran"] else None,
                "waktu_detik": None,
                "alasan": td["alasan"],
            })

    detail_pact = {
        "tools": pact_tools_detail,
        "kriteria": kriteria_pact_clean,
        "pelanggaran_jargon": pelanggaran_jargon,
        "skor_komunikasi_mentah": skor_komunikasi_mentah,
        "skor_komunikasi_tampil": skor_komunikasi_tampil,
    }

    # =========================================================================
    # DIMENSI 2A: EVALUASI KESALAHAN KRITIS & JENDELA KOREKSI 2 GILIRAN
    # =========================================================================
    raw_kk = ai_result.get("kesalahan_kritis") if isinstance(ai_result.get("kesalahan_kritis"), dict) else {}
    alasan_tinjau_dosen: list[str] = []
    penalti_pilar: dict[str, float] = {"prosedur": 0.0, "ddi": 0.0, "kelengkapan": 0.0}
    ada_gagal_global = False
    butir_gugur_karena_kk: set[str] = set()
    kk_items_detail: list[dict[str, Any]] = []

    for kk_id, aturan in kesalahan_kritis_rules.items():
        data_kk = raw_kk.get(kk_id) if isinstance(raw_kk.get(kk_id), dict) else {}
        if not data_kk.get("terjadi"):
            continue

        terkena_penalti = True
        bisa_dikoreksi = bool(aturan.get("bisa_dikoreksi", True))
        maks_jarak = int(aturan.get("koreksi_maks_giliran") or 2)
        kutipan_kk = str(data_kk.get("kutipan") or "").strip()
        kode_gil_terjadi = data_kk.get("kode_giliran_terjadi")
        num_gil_terjadi = data_kk.get("nomor_giliran_terjadi")
        waktu_terjadi = None

        found_kode, found_num, found_sec = _find_turn_for_quote(kutipan_kk, valid_student_rows)
        if found_kode:
            kode_gil_terjadi = found_kode
            num_gil_terjadi = found_num
            waktu_terjadi = found_sec

        status_koreksi = "Tidak dikoreksi"
        catatan_algoritma = ""
        dikoreksi_sah = False

        if bisa_dikoreksi and data_kk.get("dikoreksi"):
            num_gil_koreksi = data_kk.get("nomor_giliran_koreksi")
            if (
                isinstance(num_gil_terjadi, int)
                and isinstance(num_gil_koreksi, int)
                and num_gil_terjadi in urutan_giliran_mhs
                and num_gil_koreksi in urutan_giliran_mhs
            ):
                jarak = urutan_giliran_mhs.index(num_gil_koreksi) - urutan_giliran_mhs.index(num_gil_terjadi)
                if 0 < jarak <= maks_jarak:
                    terkena_penalti = False
                    dikoreksi_sah = True
                    status_koreksi = f"Koreksi Diri Berhasil (≤ {maks_jarak} Giliran)"
                    catatan_algoritma = (
                        "Penalti ditiadakan karena self-correction cepat dalam batas giliran, "
                        "namun insiden tetap dicatat pada log klinis."
                    )
                else:
                    status_koreksi = f"Koreksi terlambat (> {maks_jarak} giliran)"
            else:
                status_koreksi = "Koreksi tidak terverifikasi pada urutan giliran"
        elif not bisa_dikoreksi:
            status_koreksi = "Tidak dapat dikoreksi mandiri"

        pilar_target = _normalize_pillar(aturan.get("kategori", "Prosedur"))
        nilai_penalti_aturan = float(aturan.get("penalti") or 25.0)
        penalti_diterapkan = nilai_penalti_aturan if terkena_penalti else 0.0

        if terkena_penalti:
            if aturan.get("gagal") or pilar_target == "global":
                ada_gagal_global = True
                penalti_pilar["prosedur"] = max(penalti_pilar["prosedur"], 100.0)
                penalti_pilar["kelengkapan"] = max(penalti_pilar["kelengkapan"], 100.0)
                if memuat_ddi:
                    penalti_pilar["ddi"] = max(penalti_pilar["ddi"], 100.0)
            else:
                penalti_pilar[pilar_target] = _clamp(penalti_pilar[pilar_target] + penalti_diterapkan)

            if bisa_dikoreksi:
                for b_id in aturan.get("butir_terkait", []):
                    butir_gugur_karena_kk.add(str(b_id))

        alasan_tinjau_dosen.append(f"Terdeteksi Kesalahan Kritis {kk_id}: {aturan.get('judul')}")
        log_audit.append(
            f"[KK] {kk_id} ({aturan.get('judul')}) | Pilar={pilar_target} | "
            f"Status={status_koreksi} | Penalti=-{penalti_diterapkan}"
        )

        kk_items_detail.append({
            "id": kk_id,
            "judul": aturan.get("judul", kk_id),
            "deskripsi": str(data_kk.get("alasan") or aturan.get("deskripsi") or ""),
            "kategori": aturan.get("kategori", "Prosedur"),
            "pilar": pilar_target,
            "kutipan": kutipan_kk,
            "kode_giliran_terjadi": kode_gil_terjadi,
            "nomor_giliran_terjadi": num_gil_terjadi,
            "waktu_detik": waktu_terjadi,
            "dikoreksi": dikoreksi_sah,
            "kode_giliran_koreksi": data_kk.get("kode_giliran_koreksi"),
            "status_koreksi": status_koreksi,
            "bisa_dikoreksi": bisa_dikoreksi,
            "penalti_diterapkan": round(penalti_diterapkan, 2),
            "catatan_algoritma": catatan_algoritma,
        })

    # =========================================================================
    # DIMENSI 2B: PERHITUNGAN 3 PILAR KONTEN KLINIS + ANTI-HALUSINASI
    # =========================================================================
    raw_butir = ai_result.get("hasil_butir") if isinstance(ai_result.get("hasil_butir"), dict) else {}
    pilar_bobot: dict[str, float] = {"prosedur": 0.0, "ddi": 0.0, "kelengkapan": 0.0}
    pilar_poin: dict[str, float] = {"prosedur": 0.0, "ddi": 0.0, "kelengkapan": 0.0}
    pilar_total_butir: dict[str, int] = {"prosedur": 0, "ddi": 0, "kelengkapan": 0}
    pilar_terpenuhi: dict[str, int] = {"prosedur": 0, "ddi": 0, "kelengkapan": 0}

    detail_butir_list: list[dict[str, Any]] = []
    missing_clinical_items: list[str] = []
    total_active_items = 0
    ambiguous_items = 0

    for item_id, detail in butir_aktif.items():
        data_b = raw_butir.get(item_id) if isinstance(raw_butir.get(item_id), dict) else {}
        pilar = _normalize_pillar(detail.get("kategori", "Prosedur"))
        if pilar == "global":
            pilar = "prosedur"
        bobot = float(detail.get("bobot") or 1.0)
        berlaku = bool(data_b.get("berlaku", True))

        if not berlaku:
            detail_butir_list.append({
                "kode": item_id,
                "parameter": detail["nama_butir"],
                "kategori": detail["kategori"],
                "pilar": pilar,
                "bobot": bobot,
                "berlaku": False,
                "status": "diabaikan",
                "skor": None,
                "ambigu": False,
                "kutipan": "",
                "kutipan_ditolak": False,
                "kode_giliran": None,
                "waktu_detik": None,
                "alasan": str(data_b.get("alasan") or "Tidak berlaku kondisional pada alur sesi ini."),
            })
            log_audit.append(f"[KONTEN] {item_id} tidak berlaku kondisional (dikeluarkan dari pembagi).")
            continue

        total_active_items += 1
        pilar_total_butir[pilar] += 1

        raw_skor = float(data_b.get("skor", 0.0))
        nilai = 1.0 if raw_skor >= 0.75 else (0.5 if raw_skor >= 0.25 else 0.0)
        ambigu = bool(data_b.get("ambigu", False))
        if ambigu:
            ambiguous_items += 1

        kutipan = str(data_b.get("kutipan") or "").strip()
        kode_gil = data_b.get("kode_giliran")
        waktu_detik = None
        kutipan_ditolak = False
        alasan = str(data_b.get("alasan") or "").strip()

        if item_id in butir_gugur_karena_kk and nilai > 0:
            nilai = 0.0
            alasan = "Digugurkan menjadi 0 karena terkait kesalahan kritis tanpa koreksi."
            log_audit.append(f"[KONTEN] {item_id} digugurkan akibat kesalahan kritis.")

        if nilai > 0:
            if _kutipan_sah(kutipan, student_texts_norm):
                found_kode, _, found_sec = _find_turn_for_quote(kutipan, valid_student_rows)
                if found_kode:
                    kode_gil = found_kode
                    waktu_detik = found_sec
            else:
                kutipan_ditolak = True
                nilai = 0.0
                alasan = "Kutipan bukti AI tidak ditemukan eksak di transkrip mahasiswa (anti-halusinasi)."
                log_audit.append(f"[ANTI-HALUSINASI] Kutipan '{kutipan}' pada {item_id} ditolak; skor -> 0.")

        if nilai >= 1.0:
            status_butir = "terpenuhi"
            pilar_terpenuhi[pilar] += 1
        elif nilai >= 0.5:
            status_butir = "parsial"
            missing_clinical_items.append(detail["nama_butir"])
        elif kutipan_ditolak:
            status_butir = "ditolak"
            missing_clinical_items.append(detail["nama_butir"])
        else:
            status_butir = "terlewat"
            missing_clinical_items.append(detail["nama_butir"])

        pilar_bobot[pilar] += bobot
        pilar_poin[pilar] += nilai * bobot

        detail_butir_list.append({
            "kode": item_id,
            "parameter": detail["nama_butir"],
            "kategori": detail["kategori"],
            "pilar": pilar,
            "bobot": bobot,
            "berlaku": True,
            "status": status_butir,
            "skor": nilai,
            "ambigu": ambigu,
            "kutipan": kutipan,
            "kutipan_ditolak": kutipan_ditolak,
            "kode_giliran": kode_gil,
            "waktu_detik": waktu_detik,
            "alasan": alasan,
        })

    # Hitung skor 3 pilar (dikurangi penalti, minimal 0)
    def _calc_pillar(p_key: str) -> tuple[float | None, float | None]:
        if pilar_bobot[p_key] <= 0:
            return None, None
        dasar = round((pilar_poin[p_key] / pilar_bobot[p_key]) * 100.0, 2)
        akhir = round(_clamp(dasar - penalti_pilar[p_key]), 2)
        return dasar, akhir

    prosedur_dasar, skor_prosedur = _calc_pillar("prosedur")
    ddi_dasar, skor_penanganan_ddi = _calc_pillar("ddi") if memuat_ddi else (None, None)
    kelengkapan_dasar, skor_kelengkapan = _calc_pillar("kelengkapan")

    # Jika skenario tidak punya butir prosedur atau kelengkapan sama sekali, jaga fallback aman
    if skor_prosedur is None and pilar_bobot["kelengkapan"] > 0:
        prosedur_dasar = round((pilar_poin["kelengkapan"] / pilar_bobot["kelengkapan"]) * 100.0, 2)
        skor_prosedur = round(_clamp(prosedur_dasar - penalti_pilar["prosedur"]), 2)
    if skor_kelengkapan is None and skor_prosedur is not None:
        kelengkapan_dasar = skor_prosedur
        skor_kelengkapan = round(_clamp(kelengkapan_dasar - penalti_pilar["kelengkapan"]), 2)

    # Normalisasi bobot antar pilar (0.30 Prosedur, 0.30 DDI, 0.40 Kelengkapan)
    active_pillar_weights: dict[str, float] = {}
    if skor_prosedur is not None:
        active_pillar_weights["prosedur"] = 0.30
    if skor_penanganan_ddi is not None:
        active_pillar_weights["ddi"] = 0.30
    if skor_kelengkapan is not None:
        active_pillar_weights["kelengkapan"] = 0.40

    if skor_penanganan_ddi is None:
        log_audit.append(
            "[NORMALISASI] DDI dinormalisasi karena tidak ada interaksi pada skenario "
            "(bobot Prosedur ~43% & Kelengkapan ~57%)."
        )

    weight_sum = sum(active_pillar_weights.values())
    pillar_values = {
        "prosedur": skor_prosedur or 0.0,
        "ddi": skor_penanganan_ddi or 0.0,
        "kelengkapan": skor_kelengkapan or 0.0,
    }
    if ada_gagal_global:
        skor_konten_mentah = 0.0
        log_audit.append("[KONTEN] Penalti gagal global (-100%) diterapkan pada skor konten.")
    elif weight_sum > 0:
        skor_konten_mentah = round(
            sum((w / weight_sum) * pillar_values[k] for k, w in active_pillar_weights.items()),
            2,
        )
    else:
        skor_konten_mentah = 0.0

    skor_konten_tampil = int(round(skor_konten_mentah))

    ringkasan_pilar = {
        "prosedur": {
            "label": "Prosedur Swamedikasi" if jenis_skenario == "swamedikasi" else "Prosedur KIE",
            "skor_dasar": prosedur_dasar,
            "penalti": round(penalti_pilar["prosedur"], 2),
            "skor_akhir": skor_prosedur,
            "terpenuhi": pilar_terpenuhi["prosedur"],
            "total": pilar_total_butir["prosedur"],
        },
        "ddi": {
            "label": "Penanganan DDI",
            "aktif": skor_penanganan_ddi is not None,
            "skor_dasar": ddi_dasar,
            "penalti": round(penalti_pilar["ddi"], 2),
            "skor_akhir": skor_penanganan_ddi,
            "terpenuhi": pilar_terpenuhi["ddi"],
            "total": pilar_total_butir["ddi"],
        },
        "kelengkapan": {
            "label": "Kelengkapan Konseling",
            "skor_dasar": kelengkapan_dasar,
            "penalti": round(penalti_pilar["kelengkapan"], 2),
            "skor_akhir": skor_kelengkapan,
            "terpenuhi": pilar_terpenuhi["kelengkapan"],
            "total": pilar_total_butir["kelengkapan"],
        },
    }

    # =========================================================================
    # DIMENSI 3: NILAI GABUNGAN SISTEM
    # =========================================================================
    nilai_gabungan_mentah = round(
        (w_kom * skor_komunikasi_mentah) + (w_kon * skor_konten_mentah),
        2,
    )
    nilai_gabungan_tampil = int(round(nilai_gabungan_mentah))

    log_audit.append(
        f"[SKOR] Komunikasi={skor_komunikasi_mentah:.2f} ({skor_komunikasi_tampil}) | "
        f"Konten={skor_konten_mentah:.2f} ({skor_konten_tampil}) | "
        f"Gabungan={nilai_gabungan_mentah:.2f} ({nilai_gabungan_tampil})"
    )

    # =========================================================================
    # DIMENSI 5: STATUS RAPOR, ESKALASI DOSEN, & UMPAN BALIK KUALITATIF
    # =========================================================================
    if mode == "praktikum" and 58.0 <= nilai_gabungan_mentah <= 62.0:
        alasan_tinjau_dosen.append(
            f"Nilai berada di zona batas kelulusan (borderline {nilai_gabungan_mentah:.1f}) pada mode praktikum."
        )
        log_audit.append("[ESKALASI] Nilai borderline (58-62) pada mode praktikum memicu tinjauan dosen.")

    if total_active_items > 0 and (ambiguous_items / total_active_items) > 0.25:
        alasan_tinjau_dosen.append("Lebih dari 25% butir klinis memiliki makna ambigu.")
        log_audit.append("[ESKALASI] Proporsi butir ambigu > 25% memicu tinjauan dosen.")

    if mode == "praktikum" and abs(skor_komunikasi_mentah - skor_konten_mentah) >= 45.0:
        alasan_tinjau_dosen.append(
            f"Selisih ekstrem antara skor komunikasi ({skor_komunikasi_tampil}) dan konten klinis ({skor_konten_tampil})."
        )
        log_audit.append("[ESKALASI] Anomali selisih ekstrem antar dimensi memicu tinjauan dosen.")

    alasan_tinjau_unik = list(dict.fromkeys(alasan_tinjau_dosen))
    if existing_rapor and existing_rapor.get("is_overridden"):
        status_rapor = "selesai_ditinjau"
        nilai_resmi_akhir = existing_rapor.get("nilai_resmi_akhir") or nilai_gabungan_tampil
    elif alasan_tinjau_unik:
        status_rapor = "perlu_ditinjau_dosen"
        nilai_resmi_akhir = nilai_gabungan_tampil
        log_audit.append(f"[STATUS] Eskalasi dosen dipicu oleh {len(alasan_tinjau_unik)} alasan.")
    else:
        status_rapor = "otomatis"
        nilai_resmi_akhir = nilai_gabungan_tampil

    # Susun umpan_balik_rapor (3 kelompok terstruktur)
    raw_fb = ai_result.get("umpan_balik") if isinstance(ai_result.get("umpan_balik"), dict) else {}
    default_fb = _build_default_feedback(
        status_rapor=status_rapor,
        valid_turns=len(valid_student_rows),
        skor_kom=skor_komunikasi_mentah,
        skor_kon=skor_konten_mentah,
        kk_findings=kk_items_detail,
        missing_items=missing_clinical_items,
    )

    def _clean_fb_quote(raw_q: Any) -> tuple[str, str | None, int | None]:
        q = str(raw_q or "").strip()
        if q and _kutipan_sah(q, student_texts_norm):
            fk, _, fsec = _find_turn_for_quote(q, valid_student_rows)
            return q, fk, fsec
        return "", None, None

    fb_kuat = raw_fb.get("kekuatan_utama") if isinstance(raw_fb.get("kekuatan_utama"), dict) else {}
    fb_perbaikan = raw_fb.get("area_perbaikan") if isinstance(raw_fb.get("area_perbaikan"), dict) else {}
    fb_saran = raw_fb.get("saran_praktik") if isinstance(raw_fb.get("saran_praktik"), dict) else {}

    q_kuat, k_kuat, w_kuat = _clean_fb_quote(fb_kuat.get("kutipan"))
    q_perb, k_perb, w_perb = _clean_fb_quote(fb_perbaikan.get("kutipan"))

    saran_poin = [
        {
            "judul": str(p.get("judul") or f"Langkah {i}").strip(),
            "deskripsi": str(p.get("deskripsi") or "").strip(),
        }
        for i, p in enumerate(fb_saran.get("poin") or [], start=1)
        if isinstance(p, dict) and str(p.get("deskripsi") or p.get("judul") or "").strip()
    ]
    if not saran_poin:
        saran_poin = default_fb[2]["poin"]

    umpan_balik_rapor = [
        {
            "kategori": "kekuatan_utama",
            "judul": "Yang Sudah Baik",
            "ringkasan": str(fb_kuat.get("ringkasan") or default_fb[0]["ringkasan"]).strip(),
            "kutipan": q_kuat,
            "kode_giliran": k_kuat or fb_kuat.get("kode_giliran"),
            "waktu_detik": w_kuat,
            "tag": str(fb_kuat.get("tag") or "Sikap profesional terjaga").strip(),
        },
        {
            "kategori": "area_perbaikan",
            "judul": "Perlu Ditingkatkan",
            "ringkasan": str(fb_perbaikan.get("ringkasan") or default_fb[1]["ringkasan"]).strip(),
            "kutipan": q_perb,
            "kode_giliran": k_perb or fb_perbaikan.get("kode_giliran"),
            "waktu_detik": w_perb,
            "tag": str(fb_perbaikan.get("tag") or "Disiplin alur KIE").strip(),
        },
        {
            "kategori": "saran_praktik",
            "judul": "Fokus Latihan Berikut",
            "poin": saran_poin[:4],
            "tag": str(fb_saran.get("tag") or "Rencana remediasi mandiri").strip(),
        },
    ]

    elapsed_ms = int((time.perf_counter() - started_perf) * 1000)

    return {
        "id_sesi": session_id,
        "skor_tool_a": pact_scores["A"],
        "skor_tool_b": pact_scores["B"],
        "skor_tool_c": pact_scores["C"],
        "skor_tool_d": pact_scores["D"],
        "skor_tool_e": pact_scores["E"],
        "skor_komunikasi_mentah": skor_komunikasi_mentah,
        "skor_komunikasi_tampil": skor_komunikasi_tampil,
        "detail_pact": detail_pact,
        "skor_prosedur": skor_prosedur,
        "skor_penanganan_ddi": skor_penanganan_ddi,
        "skor_kelengkapan": skor_kelengkapan,
        "skor_konten_mentah": skor_konten_mentah,
        "skor_konten_tampil": skor_konten_tampil,
        "detail_butir_konten": {
            "items": detail_butir_list,
            "ringkasan_pilar": ringkasan_pilar,
        },
        "detail_kesalahan_kritis": {
            "items": kk_items_detail,
            "jumlah_temuan": len(kk_items_detail),
            "jumlah_penalti_aktif": sum(1 for x in kk_items_detail if x["penalti_diterapkan"] > 0),
        },
        "total_penalti_prosedur": round(penalti_pilar["prosedur"], 2),
        "total_penalti_ddi": round(penalti_pilar["ddi"], 2),
        "total_penalti_kelengkapan": round(penalti_pilar["kelengkapan"], 2),
        "nilai_gabungan_sistem_mentah": nilai_gabungan_mentah,
        "nilai_gabungan_sistem_tampil": nilai_gabungan_tampil,
        "nilai_resmi_akhir": int(nilai_resmi_akhir),
        "layak_tampil_vokal": vocal_result["layak_tampil_vokal"],
        "data_pengamatan_vokal": vocal_result["data_pengamatan_vokal"],
        "narasi_pengamatan_vokal": vocal_result["narasi_pengamatan_vokal"],
        "umpan_balik_rapor": umpan_balik_rapor,
        "log_audit_sistem": log_audit,
        "detail_pemicu": detail_pemicu,
        "metadata_evaluasi": {
            "model_llm": used_model,
            "versi_rubrik": versi_skenario,
            "versi_mesin": ENGINE_VERSION,
            "bobot_komunikasi": w_kom,
            "bobot_konten": w_kon,
            "jumlah_giliran_valid": len(valid_student_rows),
            "dievaluasi_at": now_iso,
            "durasi_proses_ms": elapsed_ms,
            "alasan_tinjau_dosen": alasan_tinjau_unik,
            "judul_skenario": judul_skenario,
            "kode_skenario": kode_skenario,
        },
        "status_rapor": status_rapor,
        "dievaluasi_at": now_iso,
        "updated_at": now_iso,
    }
