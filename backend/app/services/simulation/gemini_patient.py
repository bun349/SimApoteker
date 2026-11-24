import re
from google import genai
from google.genai import types

from app.core.config import settings
from app.models.schemas import PatientPersonaContext, TurnHistoryItem


def _format_patient_facts(ctx: PatientPersonaContext) -> str:
    if not ctx.patient_facts:
        return "- Jawablah secara wajar sesuai kondisi pasien atau pendamping pada kasus ini."
    return "\n".join(f"- {label}: {value}" for label, value in ctx.patient_facts.items() if value.strip())


def _format_key_info_triggers(ctx: PatientPersonaContext) -> str:
    if not ctx.key_info_triggers:
        return "- Tidak ada daftar informasi kunci tambahan."
    lines: list[str] = []
    for t in ctx.key_info_triggers:
        kode = f"[{t.kode}] " if t.kode else ""
        mode_hint = (
            "Sampaikan secara alami bila relevan dengan pembukaan/situasi."
            if t.mode.lower() == "langsung"
            else "Jangan langsung diungkap; jawablah jika mahasiswa menanyakan atau menggali hal terkait."
        )
        lines.append(f"- {kode}{t.hal} -> Mode: {t.mode} ({mode_hint})")
    return "\n".join(lines)


def _format_cues_and_probes(ctx: PatientPersonaContext) -> str:
    lines: list[str] = []
    for c in ctx.cue_triggers:
        kode = f"[{c.kode}] " if c.kode else ""
        meta = f" ({c.jenis_atau_sifat})" if c.jenis_atau_sifat else ""
        when = f" — Muncul saat: {c.kapan}" if c.kapan else ""
        lines.append(f"- Isyarat Emosi {kode}{meta}{when}: \"{c.kalimat}\"")

    for p in ctx.probe_triggers:
        kode = f"[{p.kode}] " if p.kode else ""
        meta = f" [{p.jenis_atau_sifat}]" if p.jenis_atau_sifat else ""
        when = f" — Muncul jika: {p.kapan}" if p.kapan else ""
        lines.append(f"- Probe Kebingungan {kode}{meta}{when}: \"{p.kalimat}\"")

    return "\n".join(lines) if lines else "- Tidak ada isyarat emosi atau probe khusus."


def _format_glossary(ctx: PatientPersonaContext) -> str:
    if not ctx.glossary:
        return "- Gunakan bahasa sehari-hari yang wajar sesuai tingkat literasi pasien."
    return "\n".join(
        f"- Jika mahasiswa menyebut \"{g.istilah}\", bagi pasien awam/menengah padanan wajarnya adalah: {g.padanan}"
        for g in ctx.glossary
    )


def build_patient_system_prompt(ctx: PatientPersonaContext) -> str:
    p = ctx.patient
    b = ctx.brief_summary

    kategori_khusus_str = (
        ", ".join(p.kategori_khusus) if p.kategori_khusus else "Tidak ada"
    )
    obat_lain_str = (
        ", ".join(p.obat_lain_suplemen) if p.obat_lain_suplemen else "Tidak ada"
    )

    brief_lines = [
        f"- Jenis Kasus: {ctx.jenis}",
        f"- Kalimat Pembuka Awal: \"{ctx.opening_line}\"",
    ]
    if b.status_resep:
        brief_lines.append(f"- Status Resep/Kunjungan: {b.status_resep}")
    if b.unit_layanan:
        brief_lines.append(f"- Unit/Poli: {b.unit_layanan}")
    if b.obat:
        brief_lines.append(f"- Nama Obat pada Resep/Konteks: {', '.join(b.obat)}")
    if b.signa:
        brief_lines.append(f"- Aturan Pakai Tertulis pada Resep: {'; '.join(b.signa)}")
    if b.jumlah:
        brief_lines.append(f"- Jumlah Obat pada Resep: {', '.join(b.jumlah)}")

    return f"""Kamu adalah pemeran pasien/pendamping dalam simulasi praktik KIE (Komunikasi, Informasi, dan Edukasi) kefarmasian.
Mahasiswa farmasi sedang berperan sebagai apoteker/tenaga kefarmasian yang berdialog denganmu.

IDENTITAS & KARAKTER PERAN:
- Nama Tampil: {p.nama}
- Peran Komunikasi: {p.peran_komunikasi or "Pasien"}
- Kategori Usia: {p.kategori_usia}
- Jenis Kelamin: {p.jenis_kelamin}
- Kategori Khusus: {kategori_khusus_str}
- Gaya Bicara: {p.gaya_bicara or "Wajar dan sopan"}
- Tingkat Literasi Kesehatan: {p.literasi or "Sedang"}

RIWAYAT DASAR:
- Riwayat Alergi: {p.riwayat_alergi}
- Obat / Suplemen Lain yang Sedang Dikonsumsi: {obat_lain_str}
- Kondisi Penyerta: {p.kondisi_penyerta}

KONTEKS BRIEFING & RESEP:
{chr(10).join(brief_lines)}

FAKTA KONDISI & PENGALAMAN (HANYA DIUNGKAP WAJAR SESUAI PERCAKAPAN):
{_format_patient_facts(ctx)}

PANDUAN INFORMASI KUNCI & PEMICU:
{_format_key_info_triggers(ctx)}

ISYARAT EMOSI & PROBE KEBINGUNGAN (GUNAKAN SECARA ALAMI SAAT SITUASINYA COCOK):
{_format_cues_and_probes(ctx)}

PEMAHAMAN ISTILAH & BAHASA AWAM:
{_format_glossary(ctx)}

ATURAN KETAT PERAN:
1. Berbicaralah 100% dalam karakter {p.nama} dengan bahasa Indonesia lisan yang wajar, ringkas, dan natural seperti percakapan nyata di apotek/klinik. Jangan menulis esai panjang atau daftar bernomor yang kaku kecuali diminta.
2. Jangan pernah bertindak sebagai apoteker, dokter, atau evaluator; jangan menyebut kata "rubrik", "kunci jawaban", "poin", "penalti", atau "evaluasi".
3. Jangan langsung menumpahkan seluruh fakta sekaligus di awal. Jawablah sesuai pertanyaan atau pernyataan mahasiswa pada giliran ini; untuk butir ber-mode "Bila Ditanya", ungkapkan ketika mahasiswa menanyakan atau menggali topik tersebut.
4. Jika mahasiswa menggunakan istilah teknis/medis yang belum kamu pahami sesuai tingkat literasimu, bereaksilah secara wajar (misalnya meminta dijelaskan dengan bahasa yang lebih mudah dipahami).
5. Jika mahasiswa meminta kamu mengulang penjelasan (teach-back), ulangi pemahamanmu dengan bahasa sendiri secara natural.
6. Jaga konsistensi dengan identitas, peran (pasien vs pendamping), dan kalimat pembuka.
7. Selalu selesaikan kalimatmu hingga tuntas dengan tanda baca akhir yang wajar; jangan pernah berhenti di tengah kalimat.
""".strip()


def _map_history_to_contents(
    history: list[TurnHistoryItem],
    student_message: str,
) -> list[types.Content]:
    items = list(history)
    if (
        items
        and items[-1].role == "student"
        and items[-1].text.strip() == student_message.strip()
    ):
        items = items[:-1]

    contents: list[types.Content] = []
    for item in items:
        role = "user" if item.role == "student" else "model"
        text = (item.text or "").strip()
        if text:
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=text)],
                )
            )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=student_message)],
        )
    )
    return contents


def _build_config(system_instruction: str, max_tokens: int = 768) -> types.GenerateContentConfig:
    kwargs: dict[str, object] = {
        "system_instruction": system_instruction,
        "temperature": 0.7,
        "max_output_tokens": max_tokens,
    }
    thinking_cls = getattr(types, "ThinkingConfig", None)
    if thinking_cls is not None:
        try:
            kwargs["thinking_config"] = thinking_cls(thinking_budget=128)
        except TypeError:
            pass
    return types.GenerateContentConfig(**kwargs)  # type: ignore[arg-type]


def _is_truncated_reply(text: str, finish_reason: object) -> bool:
    reason_str = str(finish_reason or "").upper()
    if "MAX_TOKENS" in reason_str:
        return True
    trimmed = text.strip()
    if not trimmed:
        return True
    # Terlihat terpotong jika tidak diakhiri tanda baca kalimat/tutup wajar
    return not re.search(r'[.!?…"\')\]»]$', trimmed)


class GeminiPatientService:
    def __init__(self, model_name: str | None = None) -> None:
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_name = model_name or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")

    async def generate_reply(
        self,
        *,
        persona_context: PatientPersonaContext,
        history: list[TurnHistoryItem],
        student_message: str,
    ) -> str:
        system_instruction = build_patient_system_prompt(persona_context)
        contents = _map_history_to_contents(history, student_message)
        config = _build_config(system_instruction, max_tokens=768)

        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config,
        )

        reply = (response.text or "").strip()
        finish_reason = None
        candidates = getattr(response, "candidates", None) or []
        if candidates:
            finish_reason = getattr(candidates[0], "finish_reason", None)

        if _is_truncated_reply(reply, finish_reason):
            retry_prompt = (
                f"{student_message}\n\n"
                "(Catatan sistem: berikan jawaban lengkap dalam 2-4 kalimat wajar sesuai karakter dan akhiri dengan tanda baca penuh.)"
            )
            retry_contents = _map_history_to_contents(history, retry_prompt)
            retry_response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=retry_contents,
                config=_build_config(system_instruction, max_tokens=896),
            )
            retry_reply = (retry_response.text or "").strip()
            if retry_reply and (
                not reply
                or len(retry_reply) > len(reply)
                or not _is_truncated_reply(retry_reply, None)
            ):
                reply = retry_reply

        if not reply:
            raise RuntimeError("Gemini mengembalikan respons kosong.")
        return reply