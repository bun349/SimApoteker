import os
import json
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv
from app.core.database import supabase

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY belum diatur di file .env")

client = genai.Client(api_key=GEMINI_API_KEY)


def _normalisasi_teks(teks: str) -> str:
    """Hilangkan tanda baca dan ubah ke huruf kecil untuk validasi kutipan."""
    if not teks:
        return ""
    return re.sub(r'[^\w\s]', '', teks.lower()).strip()


def _kutipan_sah(kutipan: str, daftar_ucapan_mahasiswa: list[str]) -> bool:
    """Aturan Bab 4: Kutipan sah minimal 2 kata dan benar-benar ada di transkrip mahasiswa."""
    if not kutipan:
        return False
    kutipan_bersih = _normalisasi_teks(kutipan)
    if len(kutipan_bersih.split()) < 2:
        return False
    teks_gabungan = " ".join(daftar_ucapan_mahasiswa)
    return kutipan_bersih in teks_gabungan


def _ambil_skenario_supabase(kode_skenario: str) -> dict:
    """Menarik data 8 langkah Studio Skenario dari tabel skenario_praktikum di Supabase."""
    response = (
        supabase.table("skenario_praktikum")
        .select("*")
        .eq("kode_skenario", kode_skenario)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise ValueError(f"Skenario '{kode_skenario}' tidak ditemukan di Supabase.")
    return response.data[0]


async def proses_evaluasi_pact(request_data, skor_konten_klinis: float = 0.0):
    # =========================================================================
    # EKSTRAKSI DATA DARI 8 LANGKAH STUDIO SKENARIO (FRONTEND -> SUPABASE)
    # =========================================================================
    row = _ambil_skenario_supabase(request_data.id_skenario)
    
    kode_skenario = row.get("kode_skenario", "Unknown")
    judul_kasus = row.get("judul", "Unknown")
    
    # Ekstraksi Langkah 2 & 4 khusus untuk Komunikasi (PaCT)
    profil_pasien = row.get("profil_pasien") or {}
    pemahaman_kesehatan = profil_pasien.get("pemahaman_kesehatan", "sedang").lower()
    gaya_bicara = profil_pasien.get("gaya_bicara", "biasa").lower()
    
    konfigurasi_pemicu = row.get("konfigurasi_pemicu") or {}
    target_isyarat_emosi = konfigurasi_pemicu.get("isyarat_emosi", [])
    target_probe_bingung = konfigurasi_pemicu.get("probe_bingung", [])
    informasi_kunci = konfigurasi_pemicu.get("informasi_kunci", [])
    
    # =========================================================================
    # NORMALISASI KAMUS AWAM (Mencegah error tipe data dari JSONB Supabase)
    # =========================================================================
    raw_kamus = row.get("kamus_tambahan") or {}
    kamus_awam_bersih = {}
    
    if isinstance(raw_kamus, dict):
        # Jika formatnya {"hipertensi": "darah tinggi"} atau {"hipertensi": ["darah", "tensi"]}
        for k, v in raw_kamus.items():
            kamus_awam_bersih[str(k)] = v
    elif isinstance(raw_kamus, list):
        # Jika formatnya array of objects: [{"istilah": "hipertensi", "padanan": "darah tinggi"}]
        for item in raw_kamus:
            if isinstance(item, dict):
                k = item.get('istilah_medis') or item.get('istilah')
                v = item.get('padanan_awam') or item.get('padanan')
                if k and v:
                    kamus_awam_bersih[str(k)] = v

    bobot_komunikasi = float(row.get("bobot_komunikasi", 20.0))
    bobot_konten = float(row.get("bobot_konten", 80.0))

    log_perhitungan = []
    log_perhitungan.append(f"[INIT] Mulai Evaluasi Komunikasi (PaCT) untuk: {kode_skenario} | {judul_kasus}")

    # =========================================================================
    # CEK KECUKUPAN TRANSKRIP MAHASISWA
    # =========================================================================
    item_mahasiswa = [
        t for t in request_data.transkrip if t.pembicara.lower() == "mahasiswa" and t.teks.strip()
    ]
    urutan_giliran_mahasiswa = [t.giliran for t in item_mahasiswa]
    daftar_ucapan_mahasiswa_bersih = [_normalisasi_teks(t.teks) for t in item_mahasiswa]
    
    teks_transkrip = "\n".join([
        f"Giliran {t.giliran} ({t.pembicara}): {t.teks}" for t in request_data.transkrip
    ])

    if len(urutan_giliran_mahasiswa) < 5:
        log_perhitungan.append("[STOP] Giliran valid mahasiswa < 5. Komunikasi: Tidak cukup data.")
        return {
            "status_evaluasi": "tidak_cukup_data",
            "skor_pact_murni": None,
            "skor_akhir_gabungan": None,
            "log_audit_sistem": log_perhitungan
        }

    # =========================================================================
    # FASE 1: EVALUASI TOOL E (PENGGUNAAN BAHASA AWAM) - PYTHON
    # =========================================================================
    log_perhitungan.append("\n[FASE 1] EVALUASI TOOL E (PENGGUNAAN BAHASA AWAM):")
    skor_e = 100.0
    penalti_jargon = 10 if pemahaman_kesehatan == 'rendah' else 5
    
    gabungan_transkrip_raw = " ".join([t.teks.lower() for t in item_mahasiswa])
    pelanggaran_kamus = []

    for istilah_medis, padanan_awam in kamus_awam_bersih.items():
        medis_lower = istilah_medis.lower()
        
        if medis_lower in gabungan_transkrip_raw:
            # STANDARISASI: Pastikan padanan_awam selalu dievaluasi sebagai list of strings
            if isinstance(padanan_awam, list):
                daftar_padanan = [str(p).lower() for p in padanan_awam]
            else:
                daftar_padanan = [str(padanan_awam).lower()]
                
            # Cek apakah setidaknya SALAH SATU padanan awam disebutkan
            ada_padanan = any(p in gabungan_transkrip_raw for p in daftar_padanan)

            if not ada_padanan:
                skor_e -= penalti_jargon
                pelanggaran_kamus.append(istilah_medis)
                log_perhitungan.append(f"  -> [PELANGGARAN] Istilah medis '{istilah_medis}' digunakan tanpa padanan {daftar_padanan}. Penalti -{penalti_jargon}")
            else:
                log_perhitungan.append(f"  -> [AMAN] Istilah medis '{istilah_medis}' disertai padanannya.")

    skor_e = max(0.0, skor_e)
    log_perhitungan.append(f"  => Skor Tool E Akhir: {skor_e}")

    # =========================================================================
    # FASE 2: PROMPT AI UNTUK TOOL B, C, & D
    # =========================================================================
    log_perhitungan.append("\n[FASE 2] PROSES GEMINI AI (TOOL B, C, D):")
    
    prompt = f"""
    Anda adalah evaluator komunikasi (PaCT) untuk ujian farmasi OSCE.
    Baca transkrip berikut dan nilai respons mahasiswa terhadap pemicu pasien.

    [PROFIL PASIEN]
    Gaya Bicara: {gaya_bicara.upper()}
    Pemahaman Kesehatan: {pemahaman_kesehatan.upper()}

    [TARGET EVALUASI]
    1. Informasi Kunci yang harus digali mahasiswa (Tool B):
    {json.dumps(informasi_kunci, ensure_ascii=False)}

    2. Isyarat Emosi Pasien (Tool C):
    {json.dumps(target_isyarat_emosi, ensure_ascii=False)}

    3. Pertanyaan/Kebingungan Pasien (Tool D):
    {json.dumps(target_probe_bingung, ensure_ascii=False)}

    [TRANSKRIP PERCAKAPAN]
    {teks_transkrip}

    INSTRUKSI PENILAIAN WAJIB JSON:
    {{
        "tool_b_info_gathering": {{
            "<teks_info_kunci>": {{"berhasil_digali": true, "kutipan": "<ucapan_mahasiswa>"}}
        }},
        "tool_c_empati": {{
            "<teks_isyarat_emosi>": {{"direspons_dengan_empati": true, "kutipan": "<ucapan_mahasiswa_yang_berempati>"}}
        }},
        "tool_d_penjelasan": {{
            "<teks_probe_bingung>": {{"dijelaskan_efektif": true, "kutipan": "<ucapan_mahasiswa_menjawab_bingung>"}}
        }}
    }}
    Catatan: "kutipan" WAJIB eksak (minimal 2 kata) persis dari ucapan MAHASISWA. Kosongkan jika false/tidak ada.
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0
        )
    )
    ai_result = json.loads(response.text)

    # =========================================================================
    # FASE 3: PERHITUNGAN SKOR TOOL B, C, D DENGAN ANTI-HALUSINASI
    # =========================================================================
    
    # --- TOOL B (Information Gathering) ---
    log_perhitungan.append("\n[FASE 3.1] EVALUASI TOOL B (INFO GATHERING):")
    data_b = ai_result.get("tool_b_info_gathering", {})
    if isinstance(data_b, list): data_b = {}
    skor_b = 100.0
    if informasi_kunci:
        item_tergali = 0
        for info, res in data_b.items():
            status = res.get("berhasil_digali", False)
            kutipan = res.get("kutipan", "")
            
            if status and _kutipan_sah(kutipan, daftar_ucapan_mahasiswa_bersih):
                item_tergali += 1
                log_perhitungan.append(f"  -> Info '{info}' TERGALI. Bukti: '{kutipan}'")
            else:
                log_perhitungan.append(f"  -> Info '{info}' GAGAL DIGALI atau kutipan AI halusinasi.")
        
        skor_b = (item_tergali / len(informasi_kunci)) * 100.0
    log_perhitungan.append(f"  => Skor Tool B Akhir: {skor_b}")

    # --- TOOL C (Empati & Isyarat Emosi) ---
    log_perhitungan.append("\n[FASE 3.2] EVALUASI TOOL C (EMPATI):")
    data_c = ai_result.get("tool_c_empati", {})
    if isinstance(data_c, list): data_c = {}
    skor_c = 100.0
    faktor_pengali = 1.2 if gaya_bicara in ['cemas', 'marah', 'sedih'] else 1.0

    for isyarat, res in data_c.items():
        status = res.get("direspons_dengan_empati", False)
        kutipan = res.get("kutipan", "")
        
        if status and _kutipan_sah(kutipan, daftar_ucapan_mahasiswa_bersih):
            log_perhitungan.append(f"  -> Isyarat '{isyarat[:30]}...' DIRESPONS EMPATI. Bukti: '{kutipan}'")
        else:
            penalti = 20 * faktor_pengali
            skor_c -= penalti
            log_perhitungan.append(f"  -> Isyarat '{isyarat[:30]}...' ABAI / TIDAK EMPATI. Penalti -{penalti}")

    skor_c = max(0.0, skor_c)
    log_perhitungan.append(f"  => Skor Tool C Akhir: {skor_c}")

    # --- TOOL D (Penjelasan & Probe Bingung) ---
    log_perhitungan.append("\n[FASE 3.3] EVALUASI TOOL D (PENJELASAN EFEKTIF):")
    data_d = ai_result.get("tool_d_penjelasan", {})
    if isinstance(data_d, list): data_d = {}
    skor_d = 100.0

    for probe, res in data_d.items():
        status = res.get("dijelaskan_efektif", False)
        kutipan = res.get("kutipan", "")
        
        if status and _kutipan_sah(kutipan, daftar_ucapan_mahasiswa_bersih):
            log_perhitungan.append(f"  -> Probe bingung '{probe[:30]}...' DIJELASKAN. Bukti: '{kutipan}'")
        else:
            skor_d -= 25.0
            log_perhitungan.append(f"  -> Probe bingung '{probe[:30]}...' GAGAL DIJELASKAN. Penalti -25.0")

    skor_d = max(0.0, skor_d)
    log_perhitungan.append(f"  => Skor Tool D Akhir: {skor_d}")

    # =========================================================================
    # FASE 4: FINALISASI & GABUNGAN SKOR (LANGKAH 8)
    # =========================================================================
    log_perhitungan.append("\n[FASE 4] REKAPITULASI & PENGGABUNGAN SKOR:")
    
    skor_pact_murni = (skor_b + skor_c + skor_d + skor_e) / 4.0
    log_perhitungan.append(f"  -> Skor PaCT Murni: {skor_pact_murni:.2f}")
    
    # Penggabungan Skor Konten Klinis dengan PaCT (Jika dipanggil oleh scoring engine)
    skor_akhir_gabungan = (skor_pact_murni * (bobot_komunikasi / 100)) + (skor_konten_klinis * (bobot_konten / 100))
    log_perhitungan.append(f"  -> Skor Gabungan (Konten {bobot_konten}% | Komunikasi {bobot_komunikasi}%): {skor_akhir_gabungan:.2f}")

    return {
        "status_evaluasi": "selesai_otomatis",
        "bobot_komunikasi_persen": bobot_komunikasi,
        "bobot_konten_persen": bobot_konten,
        "skor_pact_murni": round(skor_pact_murni, 2),
        "skor_akhir_gabungan": round(skor_akhir_gabungan, 2),
        "rincian_pact": {
            "Tool_B_Info_Gathering": round(skor_b, 1),
            "Tool_C_Empati": round(skor_c, 1),
            "Tool_D_Penjelasan": round(skor_d, 1),
            "Tool_E_Bahasa_Awam": round(skor_e, 1)
        },
        "pelanggaran_jargon": pelanggaran_kamus,
        "detail_ai_pact": ai_result,
        "log_audit_pact": log_perhitungan
    }