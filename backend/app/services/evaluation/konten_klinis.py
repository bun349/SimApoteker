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


def _susun_referensi_langkah_3(jenis: str, data_langkah_3: dict) -> dict:
    """
    Memformat isian Langkah 3 UI Frontend (Data Klinis Khusus) sesuai jenis kasus
    agar AI memahami konteks klinis saat memeriksa Kunci Konten (Langkah 6) & Kesalahan Kritis (Langkah 7).
    """
    if jenis == "swamedikasi":
        # Sesuai UI Langkah 3: Data Klinis Khusus: Swamedikasi
        return {
            "1_identifikasi_gejala_utama": data_langkah_3.get("identifikasi_gejala", {
                "gejala": data_langkah_3.get("gejala"),
                "durasi_onset": data_langkah_3.get("durasi_onset")
            }),
            "2_ucapan_pasien_penggalian_wwham": data_langkah_3.get("ucapan_penggalian", {}),
            "3_riwayat_dan_permintaan": data_langkah_3.get("riwayat_permintaan", {
                "tindakan_dicoba": data_langkah_3.get("tindakan_dicoba"),
                "obat_diminta": data_langkah_3.get("obat_diminta")
            }),
            "4_keputusan_klinis": data_langkah_3.get("keputusan_klinis", {
                "tanda_bahaya_tersembunyi": data_langkah_3.get("tanda_bahaya_tersembunyi"),
                "rekomendasi_final": data_langkah_3.get("rekomendasi_final")
            })
        }
    elif jenis == "resep_kronis":
        # Sesuai UI Langkah 3: Data Klinis Khusus: Resep Kronis
        return {
            "1_resep_dokter_dan_durasi": data_langkah_3.get("resep_dokter", {}),
            "2_three_prime_questions_3pq": data_langkah_3.get("three_prime_questions", {}),
            "3_kepatuhan_dan_pemantauan_parameter": data_langkah_3.get("kepatuhan_pemantauan", {}),
            "4_modifikasi_gaya_hidup_edukasi": data_langkah_3.get("modifikasi_gaya_hidup", {}),
            "5_tanda_bahaya_dan_logistik_prb": data_langkah_3.get("tanda_bahaya_logistik", {})
        }
    elif jenis == "resep_akut":
        # Sesuai Formulir Bagian C: Khusus Resep Akut
        return {
            "1_kartu_resep": data_langkah_3.get("kartu_resep", {}),
            "2_three_prime_questions_3pq": data_langkah_3.get("three_prime_questions", {}),
            "3_aturan_pakai_benar": data_langkah_3.get("aturan_pakai_benar", []),
            "4_efek_samping_penting": data_langkah_3.get("efek_samping", {}),
            "5_tanda_bahaya_dan_penyimpanan": data_langkah_3.get("tanda_bahaya_penyimpanan", {})
        }
    return data_langkah_3


async def proses_evaluasi_konten(request_data):
    # =========================================================================
    # EKSTRAKSI DATA DARI 8 LANGKAH STUDIO SKENARIO (FRONTEND -> SUPABASE)
    # =========================================================================
    row = _ambil_skenario_supabase(request_data.id_skenario)
    
    # -> LANGKAH 1: Identitas Kasus
    kode_skenario = row["kode_skenario"]
    judul_kasus = row["judul"]
    jenis_kasus = row["jenis"]  # 'swamedikasi', 'resep_akut', 'resep_kronis'
    memuat_ddi = row.get("memuat_ddi", False)
    
    # -> LANGKAH 2: Profil Pasien & Riwayat Medis
    data_langkah_2_pasien = {
        "profil_pasien": row.get("profil_pasien", {}),
        "riwayat_alergi": row.get("riwayat_alergi", "Tidak ada"),
        "obat_lain_suplemen": row.get("obat_lain_suplemen", []),
        "kondisi_penyerta": row.get("kondisi_penyerta", "Tidak ada"),
        "interaksi_ditanam": row.get("interaksi_ditanam", None)
    }
    
    # -> LANGKAH 3: Data Klinis Khusus & Butir Rubrik Tidak Berlaku (Excluded Items)
    raw_langkah_3 = row.get("data_klinis_khusus") or {}
    referensi_klinis_langkah_3 = _susun_referensi_langkah_3(jenis_kasus, raw_langkah_3)
    
    # Ambil daftar Excluded Items dari kolom tabel atau dari dalam JSON Langkah 3
    butir_dikecualikan_langkah_3 = list(row.get("butir_tidak_berlaku") or [])
    if "butir_tidak_berlaku" in raw_langkah_3:
        for b in raw_langkah_3["butir_tidak_berlaku"]:
            if b not in butir_dikecualikan_langkah_3:
                butir_dikecualikan_langkah_3.append(b)
                
    # -> LANGKAH 6: Kunci Konten
    kunci_konten_langkah_6 = row.get("kunci_konten") or {}
    
    # -> LANGKAH 7: Kesalahan Kritis
    kesalahan_kritis_langkah_7 = row.get("kesalahan_kritis") or {}
    
    # -> LANGKAH 8: Bobot & Finalisasi
    versi_skenario = row.get("versi", "0.1")
    status_rilis = row.get("status_rilis", "draf")
    bobot_komunikasi = float(row.get("bobot_komunikasi", 20.0))
    bobot_konten = float(row.get("bobot_konten", 80.0))

    log_perhitungan = []
    alasan_tinjau_dosen = []
    penanda_khusus = []

    log_perhitungan.append(
        f"[INIT] Skenario: {kode_skenario} (v{versi_skenario} - {status_rilis}) | {judul_kasus} [{jenis_kasus}]"
    )

    # =========================================================================
    # CEK KECUKUPAN TRANSKRIP MAHASISWA (ATURAN BAB 4)
    # =========================================================================
    item_mahasiswa = [
        t for t in request_data.transkrip if t.pembicara.lower() == "mahasiswa" and t.teks.strip()
    ]
    urutan_giliran_mahasiswa = [t.giliran for t in item_mahasiswa]
    daftar_ucapan_mahasiswa_bersih = [_normalisasi_teks(t.teks) for t in item_mahasiswa]

    log_perhitungan.append(f"[INIT] Giliran valid mahasiswa ({len(urutan_giliran_mahasiswa)} giliran): {urutan_giliran_mahasiswa}")

    if len(urutan_giliran_mahasiswa) < 5:
        log_perhitungan.append("[STOP] Giliran valid mahasiswa < 5. Konten klinis: Tidak cukup data.")
        return {
            "id_sesi": request_data.id_sesi,
            "id_skenario_db": row["id"],
            "kode_skenario": kode_skenario,
            "versi_skenario": versi_skenario,
            "skenario_dievaluasi": judul_kasus,
            "status_evaluasi": "tidak_cukup_data",
            "skor_konten_mentah": None,
            "skor_konten": None,
            "rincian_kategori": {},
            "penalti_kategori": {},
            "perlu_ditinjau_dosen": False,
            "alasan_tinjau_dosen": ["Giliran valid kurang dari 5 (Tidak cukup data)"],
            "detail_ai": {},
            "log_audit_sistem": log_perhitungan
        }

    # =========================================================================
    # FILTER KUNCI KONTEN (LANGKAH 6) DENGAN EXCLUDED ITEMS (LANGKAH 3)
    # =========================================================================
    instruksi_butir_aktif = {}
    for id_butir, detail in kunci_konten_langkah_6.items():
        kategori = detail.get("kategori", "")
        
        # 1. Abaikan jika masuk "Butir Rubrik Tidak Berlaku (Excluded Items)" di Langkah 3
        if id_butir in butir_dikecualikan_langkah_3:
            log_perhitungan.append(f"[FILTER LANGKAH 3] Butir {id_butir} dikecualikan lewat Excluded Items.")
            continue
            
        # 2. Abaikan jika kategori Penanganan DDI tetapi di Langkah 1 memuat_ddi = False
        if not memuat_ddi and kategori.lower() == "penanganan ddi":
            log_perhitungan.append(f"[FILTER LANGKAH 1] Butir {id_butir} (Penanganan DDI) diabaikan karena kasus non-DDI.")
            continue

        instruksi_butir_aktif[id_butir] = {
            "kategori": kategori,
            "nama_butir": detail.get("nama_butir", ""),
            "bobot": detail.get("bobot", 1),
            "syarat_berlaku": detail.get("syarat_berlaku", "Selalu berlaku"),
            "wajib": detail.get("wajib", []),
            "alternatif_diterima": detail.get("alternatif_diterima", []),
            "keliru_atau_tidak_aman": detail.get("keliru_atau_tidak_aman", [])
        }

    teks_transkrip = "\n".join([
        f"Giliran {t.giliran} ({t.pembicara}): {t.teks}" for t in request_data.transkrip
    ])

    # =========================================================================
    # PROMPT AI DENGAN REFERENSI LANGKAH 2, 3, 6, DAN 7
    # =========================================================================
    prompt = f"""
    Anda adalah evaluator klinis objektif sistem VIKIE.
    Nilai transkrip konseling mahasiswa farmasi berdasarkan data kasus yang diinput dosen pada Studio Skenario.

    [DATA LANGKAH 2 - PROFIL & RIWAYAT PASIEN]:
    {json.dumps(data_langkah_2_pasien, indent=2, ensure_ascii=False)}

    [DATA LANGKAH 3 - DATA KLINIS KHUSUS ({jenis_kasus.upper()})]:
    {json.dumps(referensi_klinis_langkah_3, indent=2, ensure_ascii=False)}

    [DATA LANGKAH 6 - KUNCI KONTEN KLINIS]:
    {json.dumps(instruksi_butir_aktif, indent=2, ensure_ascii=False)}

    [DATA LANGKAH 7 - DAFTAR KESALAHAN KRITIS]:
    {json.dumps(kesalahan_kritis_langkah_7, indent=2, ensure_ascii=False)}

    [TRANSKRIP PERCAKAPAN]:
    {teks_transkrip}

    INSTRUKSI PENILAIAN:
    1. Evaluasi setiap butir pada [DATA LANGKAH 6 - KUNCI KONTEN KLINIS] dengan mengacu pada kebenaran klinis di [DATA LANGKAH 2] dan [DATA LANGKAH 3]:
       - "berlaku" (true/false): Cek "syarat_berlaku". Contoh: Jika syaratnya hanya berlaku bila mahasiswa menyerahkan obat alternatif, namun di transkrip mahasiswa hanya merujuk ke dokter/kompres tanpa memberi obat, maka set "berlaku": false.
       - "skor" (1, 0.5, atau 0):
         * 1 = Seluruh komponen "wajib" (atau padanannya di "alternatif_diterima") disampaikan sesuai Data Langkah 3.
         * 0.5 = Hanya sebagian komponen "wajib" yang disampaikan.
         * 0 = Tidak disampaikan, ATAU mahasiswa mengucapkan hal yang masuk daftar "keliru_atau_tidak_aman" tanpa dikoreksi.
       - Bila mahasiswa meralat ucapannya, nilai butir diambil dari PERNYATAAN TERAKHIR mahasiswa.
       - "kutipan": Kutipan eksak (minimal 2 kata, persis sesuai transkrip) dari ucapan Mahasiswa sebagai bukti. Kosongkan "" jika skor 0.
       - "nomor_giliran": Angka giliran Mahasiswa saat bukti diucapkan (atau null).

    2. Evaluasi setiap item pada [DATA LANGKAH 7 - DAFTAR KESALAHAN KRITIS]:
       - "terjadi" (true/false): Apakah perilaku kritis terjadi sesuai "dianggap_terjadi_bila" (dan bukan "tidak_dianggap_terjadi_bila")?
       - "nomor_giliran_terjadi": Angka giliran Mahasiswa saat kesalahan terjadi pertama kali.
       - "dikoreksi" (true/false): Apakah mahasiswa menyadari dan mengoreksi kesalahan tersebut pada giliran berikutnya? (Khusus kesalahan urutan, selalu false).
       - "nomor_giliran_koreksi": Angka giliran Mahasiswa saat koreksi diucapkan (atau null).
       - "kutipan": Kutipan eksak ucapan Mahasiswa saat kesalahan terjadi.

    Format keluaran WAJIB JSON murni:
    {{
        "hasil_butir": {{
            "<ID_BUTIR>": {{"berlaku": true, "skor": 1, "ambigu": false, "kutipan": "<teks>", "nomor_giliran": 1}}
        }},
        "kesalahan_kritis": {{
            "<ID_KK>": {{"terjadi": false, "nomor_giliran_terjadi": null, "dikoreksi": false, "nomor_giliran_koreksi": null, "kutipan": ""}}
        }}
    }}
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
    hasil_butir_ai = ai_result.get("hasil_butir", {})
    hasil_kk_ai = ai_result.get("kesalahan_kritis", {})

    # =========================================================================
    # FASE 1: EVALUASI KESALAHAN KRITIS (LANGKAH 7) & JENDELA KOREKSI 2 GILIRAN
    # =========================================================================
    log_perhitungan.append("\n[FASE 1] EVALUASI KESALAHAN KRITIS (LANGKAH 7):")
    penalti_per_kategori = {}
    butir_gugur_karena_kk = set()

    for id_kk, aturan_kk in kesalahan_kritis_langkah_7.items():
        data_kk = hasil_kk_ai.get(id_kk, {})
        if data_kk.get("terjadi"):
            terkena_penalti = True
            bisa_dikoreksi = aturan_kk.get("bisa_dikoreksi", True)
            gil_terjadi = data_kk.get("nomor_giliran_terjadi")

            alasan_tinjau_dosen.append(f"Terdeteksi Kesalahan Kritis {id_kk}")
            log_perhitungan.append(f"  -> {id_kk} TERJADI di giliran {gil_terjadi}: \"{data_kk.get('kutipan', '')}\"")

            if bisa_dikoreksi and data_kk.get("dikoreksi"):
                gil_koreksi = data_kk.get("nomor_giliran_koreksi")
                if gil_terjadi in urutan_giliran_mahasiswa and gil_koreksi in urutan_giliran_mahasiswa:
                    jarak = urutan_giliran_mahasiswa.index(gil_koreksi) - urutan_giliran_mahasiswa.index(gil_terjadi)
                    log_perhitungan.append(f"     * Dikoreksi pada giliran {gil_koreksi} (Jarak: {jarak} giliran mahasiswa).")
                    if 0 < jarak <= 2:
                        terkena_penalti = False
                        data_kk["status_koreksi"] = "Terkoreksi sah (<= 2 giliran)"
                        log_perhitungan.append("     * STATUS: Koreksi SAH. Penalti dibatalkan.")
                    else:
                        data_kk["status_koreksi"] = "Koreksi terlambat (> 2 giliran)"
                        log_perhitungan.append("     * STATUS: Koreksi TERLAMBAT. Penalti tetap berlaku.")
            elif not bisa_dikoreksi:
                data_kk["status_koreksi"] = "Kesalahan urutan (Tidak dapat dikoreksi)"
                log_perhitungan.append("     * STATUS: Kesalahan urutan TIDAK BISA dikoreksi.")
            else:
                data_kk["status_koreksi"] = "Tidak dikoreksi"
                log_perhitungan.append("     * STATUS: Tidak ada koreksi diri.")

            if terkena_penalti:
                kat_penalti = aturan_kk.get("kategori_dikenai_penalti")
                nilai_penalti = float(aturan_kk.get("penalti", 25))
                if bisa_dikoreksi:
                    for b_id in aturan_kk.get("butir_terkait", []):
                        butir_gugur_karena_kk.add(b_id)
                if kat_penalti:
                    penalti_per_kategori[kat_penalti] = max(penalti_per_kategori.get(kat_penalti, 0.0), nilai_penalti)

    # =========================================================================
    # FASE 2: PERHITUNGAN SKOR BUTIR KUNCI KONTEN (LANGKAH 6)
    # =========================================================================
    log_perhitungan.append("\n[FASE 2] PERHITUNGAN BUTIR KUNCI KONTEN (LANGKAH 6):")
    skor_kategori = {}
    bobot_kategori = {}
    skor_mentah = {}

    for id_butir, detail in instruksi_butir_aktif.items():
        data_b = hasil_butir_ai.get(id_butir, {})
        kat = detail["kategori"]
        bobot = float(detail["bobot"])

        if kat not in bobot_kategori:
            bobot_kategori[kat] = 0.0
            skor_mentah[kat] = 0.0
            skor_kategori[kat] = 0.0

        if not data_b.get("berlaku", True):
            log_perhitungan.append(f"  -> {id_butir} ({kat}): TIDAK BERLAKU kondisional (Dikeluarkan dari pembagi).")
            continue

        nilai = float(data_b.get("skor", 0))
        kutipan = data_b.get("kutipan", "")

        # Gugurkan butir jika terkait KK yang tidak dikoreksi
        if id_butir in butir_gugur_karena_kk and nilai > 0:
            nilai = 0.0
            data_b["skor"] = 0.0
            log_perhitungan.append(f"  -> {id_butir} ({kat}): Skor menjadi 0 karena Kesalahan Kritis tidak dikoreksi.")

        # Validasi kutipan eksak (Anti-Halusinasi)
        if nilai > 0 and not _kutipan_sah(kutipan, daftar_ucapan_mahasiswa_bersih):
            log_perhitungan.append(f"  -> [DITOLAK] Kutipan '{kutipan}' pada {id_butir} tidak valid. Skor diubah ke 0.")
            nilai = 0.0
            data_b["skor"] = 0.0
            data_b["catatan_sistem"] = "kutipan ditolak"

        bobot_kategori[kat] += bobot
        poin = nilai * bobot
        skor_mentah[kat] += poin
        log_perhitungan.append(f"  -> {id_butir} ({kat}): Nilai={nilai} x Bobot={int(bobot)} = {poin} | Bukti: \"{kutipan}\"")

    # =========================================================================
    # FASE 3 & 4: REKAP KATEGORI, PENALTI, & SKOR AKHIR KONTEN
    # =========================================================================
    log_perhitungan.append("\n[FASE 3] SKOR PER KATEGORI & POTONGAN PENALTI:")
    skor_kategori_awal = {}
    for kat in list(skor_kategori.keys()):
        if bobot_kategori[kat] > 0:
            awal = (skor_mentah[kat] / bobot_kategori[kat]) * 100.0
            skor_kategori_awal[kat] = round(awal, 2)
            potongan = penalti_per_kategori.get(kat, 0.0)
            akhir = max(0.0, awal - potongan)
            skor_kategori[kat] = akhir
            log_perhitungan.append(f"  -> {kat} (W={int(bobot_kategori[kat])}): Awal={awal:.2f} | Penalti=-{potongan} | Akhir={akhir:.2f}")
        else:
            del skor_kategori[kat]
            del bobot_kategori[kat]

    total_bobot = sum(bobot_kategori.values())
    skor_akhir_presisi = (
        sum((skor_kategori[kat] * bobot_kategori[kat]) for kat in skor_kategori) / total_bobot
        if total_bobot > 0 else 0.0
    )
    log_perhitungan.append(f"\n[FASE 4] SKOR AKHIR KONTEN: {skor_akhir_presisi:.2f} (Dibulatkan: {round(skor_akhir_presisi)})")

    perlu_tinjau = len(alasan_tinjau_dosen) > 0
    return {
        "id_sesi": request_data.id_sesi,
        "id_skenario_db": row["id"],
        "kode_skenario": kode_skenario,
        "versi_skenario": versi_skenario,
        "jenis_skenario": jenis_kasus,
        "skenario_dievaluasi": judul_kasus,
        "status_evaluasi": "perlu_ditinjau_dosen" if perlu_tinjau else "selesai_otomatis",
        "bobot_komunikasi": bobot_komunikasi,
        "bobot_konten": bobot_konten,
        "skor_konten_mentah": round(skor_akhir_presisi, 2),
        "skor_konten": round(skor_akhir_presisi),
        "rincian_kategori_awal": skor_kategori_awal,
        "rincian_kategori": {k: round(v, 1) for k, v in skor_kategori.items()},
        "bobot_per_kategori": {k: int(v) for k, v in bobot_kategori.items()},
        "penalti_kategori": penalti_per_kategori,
        "perlu_ditinjau_dosen": perlu_tinjau,
        "alasan_tinjau_dosen": list(dict.fromkeys(alasan_tinjau_dosen)),
        "detail_ai": ai_result,
        "log_audit_sistem": log_perhitungan
    }