import sys
import os
import asyncio
import json

# Paksa Python mengenali folder 'backend' sebagai root (sesuaikan dengan struktur folder Anda)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app.services.evaluation.konten_klinis import proses_evaluasi_konten
from app.services.evaluation.pact_tools import proses_evaluasi_pact

# =========================================================
# 1. MOCK DATA REQUEST
# =========================================================
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

request_data = MockRequestData(
    id_sesi="TEST-SESI-001",
    id_skenario="SW-02", # Pastikan ID/Kode Skenario ini ada di Supabase Anda
    transkrip=transkrip_simulasi
)

# =========================================================
# 2. FUNGSI EKSEKUSI
# =========================================================
async def jalankan_cek():
    print("Memulai proses evaluasi AI... Mohon tunggu...\n")
    try:
        # Jalankan Evaluasi
        hasil_konten = await proses_evaluasi_konten(request_data)
        skor_konten = hasil_konten.get('skor_konten_mentah', 0.0)
        hasil_pact = await proses_evaluasi_pact(request_data, skor_konten_klinis=skor_konten)
        
        # ---------------------------------------------------------
        # RINGKASAN SKOR AKHIR
        # ---------------------------------------------------------
        print("="*80)
        print("🏆 RINGKASAN SKOR AKHIR")
        print("="*80)
        print(f"Skenario            : {hasil_konten.get('skenario_dievaluasi', 'Unknown')}")
        print(f"Skor Konten Klinis  : {hasil_konten.get('skor_konten_mentah')}")
        print(f"Skor Komunikasi PaCT: {hasil_pact.get('skor_pact_murni')}")
        print(f"SKOR GABUNGAN FINAL : {hasil_pact.get('skor_akhir_gabungan')}")
        
        print("\n" + "="*80)
        print("🔍 JEJAK AUDIT LOG: KONTEN KLINIS (Asal Angka)")
        print("="*80)
        audit_konten = hasil_konten.get('log_audit_sistem', [])
        if audit_konten:
            for log in audit_konten:
                print(log)
        else:
            print("Tidak ada log audit konten.")

        print("\n" + "="*80)
        print("🗣️ JEJAK AUDIT LOG: KOMUNIKASI PaCT (Asal Angka)")
        print("="*80)
        audit_pact = hasil_pact.get('log_audit_pact', [])
        if audit_pact:
            for log in audit_pact:
                print(log)
        else:
            print("Tidak ada log audit PaCT.")
            
        print("\n" + "="*80)

    except Exception as e:
        print(f"Terjadi error saat evaluasi: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(jalankan_cek())