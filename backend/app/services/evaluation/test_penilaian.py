import sys
import os
import asyncio
import json

# Paksa Python mengenali folder 'backend' sebagai root (jika dijalankan dari dalam folder evaluation)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app.services.evaluation.konten_klinis import proses_evaluasi_konten
from app.services.evaluation.pact_tools import proses_evaluasi_pact  # Import fungsi PaCT

# 1. Buat Mock (Tiruan) Model Data Request dari FastAPI
class TranskripItem:
    def __init__(self, giliran, pembicara, teks):
        self.giliran = giliran
        self.pembicara = pembicara
        self.teks = teks

class MockRequestData:
    def __init__(self, id_sesi, id_skenario, transkrip):
        self.id_sesi = id_sesi
        self.id_skenario = id_skenario
        self.transkrip = transkrip

# 2. Transkrip Simulasi
transkrip_simulasi = [
    TranskripItem(0, "Pasien", "Mbak, ada obat buat nyeri lutut? Saya biasa pakai ibuprofen."),
    TranskripItem(1, "Mahasiswa", "Selamat pagi, Pak. Saya apoteker di sini. Boleh tahu nyeri lututnya sudah sejak kapan, Pak?"),
    TranskripItem(2, "Pasien", "Sudah dua minggu, Mbak, kadang hilang kadang kambuh."),
    TranskripItem(3, "Mahasiswa", "Oh, sudah dua minggu ya, Pak. Nyerinya muncul biasanya pas Bapak lagi ngapain?"),
    TranskripItem(4, "Pasien", "Habis jalan jauh, Mbak. Sudah saya kompres hangat, tapi nggak banyak membantu."),
    TranskripItem(5, "Mahasiswa", "Oh begitu. Kalau kompres kurang mempan, Bapak boleh minum ibuprofen saja dulu biar nyerinya cepat reda. Beli 1 strip dulu saja."), 
    TranskripItem(6, "Pasien", "Saya takut lambung saya rusak kalau minum obat terus, Mbak."),
    TranskripItem(7, "Mahasiswa", "Wajar kalau Bapak khawatir soal lambung. Ngomong-ngomong, apakah Bapak ada alergi obat? Dan apakah saat ini Bapak sedang rutin minum obat lain dari dokter?"),
    TranskripItem(8, "Pasien", "Alergi tidak ada, Mbak. Tapi saya lagi rutin minum obat pengencer darah dari dokter, warfarin namanya."),
    TranskripItem(9, "Mahasiswa", "Wah, Bapak minum warfarin ya. Mohon maaf sekali Pak, tadi saya keliru. Bapak sama sekali tidak boleh minum ibuprofen karena ada interaksi dengan warfarin yang bisa berisiko perdarahan atau membuat Bapak mudah berdarah."),
    TranskripItem(10, "Pasien", "Sudah dua minggu begini, capek rasanya, Mbak."),
    TranskripItem(11, "Mahasiswa", "Pasti capek ya Pak menahan nyeri. Jadi untuk keputusan amannya, ibuprofennya jangan diminum ya Pak. Sebaiknya Bapak segera periksa ke dokter saja agar diberikan obat nyeri yang aman."),
    TranskripItem(12, "Pasien", "Maaf Mbak, tolong diulang, saya kurang paham."),
    TranskripItem(13, "Mahasiswa", "Baik Pak, saya ulangi ya. Intinya obat ibuprofen dilarang dicampur dengan obat pengencer darah Bapak. Nanti saat di rumah, kalau nyerinya makin memburuk, lututnya makin bengkak, atau ada memar dan darah keluar, Bapak harus segera kembali ke dokter ya. Nanti kalau dari dokter dapat obat, simpannya di tempat yang sejuk, kering, dan jauh dari jangkauan anak-anak ya Pak. Ada yang ingin ditanyakan lagi?")
]

# 3. Rakit Data Request
request_data = MockRequestData(
    id_sesi="TEST-SESI-001",
    id_skenario="SW-02",
    transkrip=transkrip_simulasi
)

# 4. Fungsi Utama untuk Menjalankan Evaluasi Asynchronous
async def jalankan_test():
    print("Memulai proses evaluasi AI...")
    try:
        # =========================================================
        # JALANKAN EVALUASI KONTEN KLINIS
        # =========================================================
        hasil_konten = await proses_evaluasi_konten(request_data)
        
        # =========================================================
        # JALANKAN EVALUASI PaCT (KOMUNIKASI)
        # =========================================================
        skor_konten = hasil_konten.get('skor_konten_mentah', 0.0)
        hasil_pact = await proses_evaluasi_pact(request_data, skor_konten_klinis=skor_konten)
        
        # =========================================================
        # PRINT HASIL KONTEN KLINIS
        # =========================================================
        print("\n" + "="*70)
        print("🎉 HASIL EVALUASI KONTEN KLINIS")
        print("="*70)
        print(f"Skenario     : {hasil_konten.get('skenario_dievaluasi', 'Unknown')} (v{hasil_konten.get('versi_skenario', '0')})")
        print(f"Skor Mentah  : {hasil_konten.get('skor_konten_mentah')}")
        print(f"Skor Tampil  : {hasil_konten.get('skor_konten')}")
        print(f"Perlu Tinjau?: {hasil_konten.get('perlu_ditinjau_dosen')}")
        
        print("\n📊 RINCIAN KATEGORI (KONTEN):")
        for kat, skor in hasil_konten.get('rincian_kategori', {}).items():
            print(f" - {kat}: {skor}")
            
        print("\n📝 BUKTI KUTIPAN BUTIR KUNCI:")
        detail_butir = hasil_konten.get('detail_ai', {}).get('hasil_butir', {})
        if isinstance(detail_butir, list): 
            detail_butir = {} # Pelindung jika AI merespons dengan []
            
        for id_butir, data in sorted(detail_butir.items()):
            if data.get('berlaku'):
                skor = data.get('skor', 0)
                giliran = data.get('nomor_giliran', '-')
                kutipan = data.get('kutipan', '')
                catatan = f" ({data['catatan_sistem']})" if 'catatan_sistem' in data else ""
                print(f" [{id_butir}] Skor: {skor} | Giliran M{giliran}{catatan}")
                print(f"        Bukti: \"{kutipan}\"")

        print("\n🚨 BUKTI KESALAHAN KRITIS:")
        detail_kk = hasil_konten.get('detail_ai', {}).get('kesalahan_kritis', {})
        if isinstance(detail_kk, list): 
            detail_kk = {} # Pelindung jika AI merespons dengan []
            
        kk_terjadi = False
        for id_kk, data in sorted(detail_kk.items()):
            if data.get('terjadi'):
                kk_terjadi = True
                status = data.get('status_koreksi', 'Terjadi')
                giliran = data.get('nomor_giliran_terjadi', '-')
                kutipan = data.get('kutipan', '')
                print(f" [{id_kk}] Giliran M{giliran} | {status}")
                print(f"        Bukti: \"{kutipan}\"")
        if not kk_terjadi:
            print(" - Tidak ada kesalahan kritis yang terdeteksi.")

        # =========================================================
        # PRINT HASIL KOMUNIKASI (PaCT)
        # =========================================================
        print("\n" + "="*70)
        print("🗣️  HASIL EVALUASI KOMUNIKASI (PaCT)")
        print("="*70)
        
        if hasil_pact.get('status_evaluasi') == "tidak_cukup_data":
            print("❌ Tidak cukup data transkrip untuk menilai PaCT (Minimal 5 giliran mahasiswa).")
        else:
            print(f"Skor PaCT Murni : {hasil_pact.get('skor_pact_murni')}")
            print(f"Bobot Penilaian : Komunikasi {hasil_pact.get('bobot_komunikasi_persen')}% | Konten {hasil_pact.get('bobot_konten_persen')}%")
            
            print("\n📊 RINCIAN SKOR PaCT (Per Tool):")
            for tool, skor in hasil_pact.get('rincian_pact', {}).items():
                print(f" - {tool}: {skor}")

            print("\n📝 DETAIL PENILAIAN AI (PaCT):")
            detail_pact_ai = hasil_pact.get('detail_ai_pact', {})
            
            tool_b = detail_pact_ai.get("tool_b_info_gathering", {})
            if isinstance(tool_b, list): tool_b = {}
                
            tool_c = detail_pact_ai.get("tool_c_empati", {})
            if isinstance(tool_c, list): tool_c = {}
                
            tool_d = detail_pact_ai.get("tool_d_penjelasan", {})
            if isinstance(tool_d, list): tool_d = {}

            print(" -> Tool B (Information Gathering):")
            for info, data in tool_b.items():
                status = "✅ Tergali" if data.get("berhasil_digali") else "❌ Gagal"
                print(f"    * {info} | {status} | Bukti: \"{data.get('kutipan', '')}\"")
            
            print("\n -> Tool C (Empati & Respons Isyarat):")
            for isyarat, data in tool_c.items():
                status = "✅ Direspons Empati" if data.get("direspons_dengan_empati") else "❌ Diabaikan/Tidak Empati"
                print(f"    * Pasien: \"{isyarat}\"\n      Status: {status} | Bukti Mhs: \"{data.get('kutipan', '')}\"")

            print("\n -> Tool D (Penjelasan Efektif saat Bingung):")
            for probe, data in tool_d.items():
                status = "✅ Dijelaskan" if data.get("dijelaskan_efektif") else "❌ Gagal/Makin Bingung"
                print(f"    * Pasien: \"{probe}\"\n      Status: {status} | Bukti Mhs: \"{data.get('kutipan', '')}\"")

            print("\n🚨 PELANGGARAN BAHASA AWAM (Tool E):")
            pelanggaran = hasil_pact.get('pelanggaran_jargon', [])
            if pelanggaran:
                for p in pelanggaran:
                    print(f" ❌ Menggunakan istilah medis tanpa penjelasan awam: '{p}'")
            else:
                print(" ✅ Bersih! Tidak ada pelanggaran jargon medis tanpa padanan.")

        # =========================================================
        # SKOR AKHIR GABUNGAN
        # =========================================================
        print("\n" + "="*70)
        print("🏆 SKOR AKHIR GABUNGAN (FINAL)")
        print("="*70)
        if hasil_pact.get('skor_akhir_gabungan') is not None:
            print(f"Skor Keseluruhan: {hasil_pact['skor_akhir_gabungan']}")
        else:
            print("Skor Keseluruhan tidak dapat dihitung karena data transkrip tidak memadai.")
        print("="*70 + "\n")
            
    except Exception as e:
        print(f"Terjadi error saat evaluasi: {e}")
        # Tambahkan traceback untuk debugging lebih mudah jika error lain muncul
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(jalankan_test())