# app/utils/constants.py

# =====================================================================
# 1. KERANGKA PENILAIAN BAKU (TIDAK BERUBAH)
# =====================================================================
KERANGKA_PENILAIAN = {
    "swamedikasi": {
        "K-01": {"kategori": "Prosedur", "bobot": 2, "nama_butir": "Menanyakan sejak kapan keluhan", "syarat_berlaku": "Selalu berlaku"},
        "K-02": {"kategori": "Prosedur", "bobot": 3, "nama_butir": "Menanyakan obat lain/rutin", "syarat_berlaku": "Selalu berlaku"},
        "K-03": {"kategori": "Prosedur", "bobot": 3, "nama_butir": "Menanyakan alergi obat", "syarat_berlaku": "Selalu berlaku"},
        "K-04": {"kategori": "Penanganan DDI", "bobot": 3, "nama_butir": "Mendeteksi interaksi (jika ada)", "syarat_berlaku": "Selalu berlaku"},
        "K-05": {"kategori": "Penanganan DDI", "bobot": 3, "nama_butir": "Keputusan akhir aman", "syarat_berlaku": "Selalu berlaku"},
        "K-06": {"kategori": "Kelengkapan", "bobot": 2, "nama_butir": "Aturan pakai alternatif obat", "syarat_berlaku": "Hanya berlaku JIKA mahasiswa memberikan obat alternatif yang disetujui kepada pasien."},
        "K-07": {"kategori": "Kelengkapan", "bobot": 2, "nama_butir": "Tanda bahaya & kapan ke dokter", "syarat_berlaku": "Selalu berlaku"},
        "K-08": {"kategori": "Kelengkapan", "bobot": 1, "nama_butir": "Penyimpanan obat", "syarat_berlaku": "Hanya berlaku JIKA mahasiswa menyerahkan obat kepada pasien."}
    },
    "resep_akut": {
        "RA-01": {"kategori": "Prosedur", "bobot": 2, "nama_butir": "Menanyakan TPQ 1 (Apa penjelasan dokter)", "syarat_berlaku": "Selalu berlaku"},
        "RA-02": {"kategori": "Prosedur", "bobot": 2, "nama_butir": "Menanyakan TPQ 2 (Cara minum dari dokter)", "syarat_berlaku": "Selalu berlaku"},
        "RA-03": {"kategori": "Prosedur", "bobot": 1, "nama_butir": "Menanyakan TPQ 3 (Harapan pasien)", "syarat_berlaku": "Selalu berlaku"},
        "RA-04": {"kategori": "Prosedur", "bobot": 3, "nama_butir": "Menanyakan alergi dan obat lain", "syarat_berlaku": "Selalu berlaku"},
        "RA-05": {"kategori": "Kelengkapan", "bobot": 3, "nama_butir": "Aturan pakai lengkap", "syarat_berlaku": "Selalu berlaku"},
        "RA-06": {"kategori": "Kelengkapan", "bobot": 2, "nama_butir": "Efek samping", "syarat_berlaku": "Selalu berlaku"},
        "RA-07": {"kategori": "Kelengkapan", "bobot": 3, "nama_butir": "Tanda bahaya & kapan kembali", "syarat_berlaku": "Selalu berlaku"},
        "RA-08": {"kategori": "Kelengkapan", "bobot": 1, "nama_butir": "Penyimpanan obat", "syarat_berlaku": "Selalu berlaku"}
    },
    "resep_kronis": {
        "RK-01": {"kategori": "Prosedur", "bobot": 2, "nama_butir": "Menanyakan TPQ 1 (Apa penjelasan dokter)", "syarat_berlaku": "Selalu berlaku"},
        "RK-02": {"kategori": "Prosedur", "bobot": 2, "nama_butir": "Menanyakan TPQ 2 (Cara pakai)", "syarat_berlaku": "Selalu berlaku"},
        "RK-03": {"kategori": "Prosedur", "bobot": 3, "nama_butir": "Menggali pola kepatuhan pasien", "syarat_berlaku": "Selalu berlaku"},
        "RK-04": {"kategori": "Kelengkapan", "bobot": 3, "nama_butir": "Aturan pakai dan pentingnya terus minum", "syarat_berlaku": "Selalu berlaku"},
        "RK-05": {"kategori": "Kelengkapan", "bobot": 2, "nama_butir": "Parameter dan pemantauan", "syarat_berlaku": "Selalu berlaku"},
        "RK-06": {"kategori": "Kelengkapan", "bobot": 2, "nama_butir": "Gaya hidup (Diet/Olahraga)", "syarat_berlaku": "Selalu berlaku"},
        "RK-07": {"kategori": "Kelengkapan", "bobot": 3, "nama_butir": "Kapan kembali lebih cepat", "syarat_berlaku": "Selalu berlaku"},
        "RK-08": {"kategori": "Kelengkapan", "bobot": 1, "nama_butir": "Penyimpanan dan kapan mengisi ulang", "syarat_berlaku": "Selalu berlaku"}
    }
}


# =====================================================================
# 2. DATA SKENARIO DOSEN (BISA BERUBAH)
# =====================================================================
DATA_SKENARIO = {
    # ----- CONTOH SWAMEDIKASI -----
    "SW-1": {
        "jenis": "swamedikasi",
        "nama_skenario": "Nyeri Lutut dan Warfarin",
        "kriteria_jawaban_dosen": {
            "K-01": "Pertanyaan durasi (misal: 'sejak kapan', 'sudah berapa lama')",
            "K-02": "Pertanyaan obat dari dokter (misal: 'obat rutin')",
            "K-03": "Pertanyaan alergi obat",
            "K-04": "Sebutkan ibuprofen ada risiko perdarahan dengan pengencer darah (warfarin)",
            "K-05": "Tolak ibuprofen, sarankan rujuk dokter atau alternatif aman",
            "K-06": "Dosis alternatif jika diberi (jika tidak memberi obat, butir ini tidak berlaku)",
            "K-07": "Beri tahu tanda bahaya (nyeri memburuk, memar/perdarahan, darah keluar)",
            "K-08": "Simpan di tempat sejuk"
        },
        "kesalahan_kritis": {
            "KK-01": {
                "perilaku": "Merekomendasikan ibuprofen tanpa menyebut interaksi dengan pengencer darah pada giliran yang sama",
                "kategori_dikenai_penalti": "Penanganan DDI",
                "penalti": 25,
                "bisa_dikoreksi": True
            },
            "KK-02": {
                "perilaku": "Merekomendasikan obat (ibuprofen) sebelum riwayat obat dan alergi ditanyakan (kesalahan urutan)",
                "kategori_dikenai_penalti": "Prosedur",
                "penalti": 25,
                "bisa_dikoreksi": False
            }
        }
    },

    # ----- CONTOH RESEP AKUT -----
    "RA-1": {
        "jenis": "resep_akut",
        "nama_skenario": "Radang Tenggorokan - Amoksisilin",
        "kriteria_jawaban_dosen": {
            "RA-01": "Tanya apa kata dokter tentang obat",
            "RA-02": "Tanya cara minum dari dokter",
            "RA-03": "Tanya harapan setelah minum obat",
            "RA-04": "Tanya alergi dan obat lain",
            "RA-05": "Diminum 3 kali sehari, sesudah makan, dihabiskan 5 hari walau sudah sembuh",
            "RA-06": "Beri tahu efek samping mual atau diare",
            "RA-07": "Demam tidak turun atau nyeri menelan makin berat setelah 2 hari",
            "RA-08": "Tempat sejuk dan kering"
        },
        "kesalahan_kritis": {
            "KK-RA-1": {
                "perilaku": "Menyuruh pasien berhenti minum antibiotik saat gejala mereda ATAU lupa menginstruksikan harus dihabiskan",
                "kategori_dikenai_penalti": "Kelengkapan",
                "penalti": 50,
                "bisa_dikoreksi": True
            }
        }
    },

    # ----- CONTOH RESEP KRONIS -----
    "RK-1": {
        "jenis": "resep_kronis",
        "nama_skenario": "Tekanan Darah Tinggi - Amlodipin",
        "kriteria_jawaban_dosen": {
            "RK-01": "Tanya apa penjelasan dokter",
            "RK-02": "Tanya cara pakai",
            "RK-03": "Gali pola kepatuhan (apakah sering lupa minum obat atau berhenti saat merasa sehat)",
            "RK-04": "Satu kali sehari pagi hari, tetap diminum walau merasa sehat",
            "RK-05": "Pantau tekanan darah berkala (target <140/90)",
            "RK-06": "Kurangi makanan asin dan tingkatkan aktivitas fisik",
            "RK-07": "Kembali lebih cepat bila pusing berat atau nyeri dada",
            "RK-08": "Tempat sejuk dan kering, tebus sebelum habis"
        },
        "kesalahan_kritis": {
            "KK-RK-1": {
                "perilaku": "Menyuruh pasien berhenti minum amlodipin saat tekanan darah sudah merasa normal",
                "kategori_dikenai_penalti": "Kelengkapan",
                "penalti": 50,
                "bisa_dikoreksi": True
            }
        }
    }
}