export const TOTAL_STEPS = 8;

export const STEPS = [
  { n: 1, label: "Identitas Kasus", title: "Identitas Kasus & Metadata Skenario", desc: "Informasi dasar dan penomoran modul simulasi KIE." },
  { n: 2, label: "Profil Pasien", title: "Profil Pasien & Persona Virtual", desc: "Demografi, persona komunikasi, dan dialog awal pasien virtual." },
  { n: 3, label: "Data Klinis Khusus", title: "Data Klinis Khusus", desc: "Alergi, obat lain, kondisi penyerta, dan data klinis spesifik kasus." },
  { n: 4, label: "Pemicu & Ucapan", title: "Pemicu & Ucapan Pasien Virtual", desc: "Isyarat emosi, probe, dan informasi kunci yang dimunculkan pasien." },
  { n: 5, label: "Kamus Istilah", title: "Kamus Istilah Medis Khusus", desc: "Istilah medis dan padanan awam yang diterima pasien virtual." },
  { n: 6, label: "Kunci Konten", title: "Kunci Konten & Kunci Jawaban", desc: "Butir rubrik penilaian klinis, komponen wajib, dan bobotnya." },
  { n: 7, label: "Kesalahan Kritis", title: "Kesalahan Kritis & Konfigurasi Penalti", desc: "Kesalahan yang berdampak pada keselamatan pasien dan besar pemotongan nilainya." },
  { n: 8, label: "Bobot & Finalisasi", title: "Bobot Nilai & Finalisasi Skenario", desc: "Komposisi nilai gabungan, mode rilis, dan pengesahan skenario." },
] as const;

export type StepState = "current" | "done" | "open" | "locked";

// maxStep = nilai progres_langkah (batas tertinggi yang boleh dibuka)
export function stepState(n: number, current: number, maxStep: number, allDone = false): StepState {
  if (n === current) return "current";
  if (n > maxStep) return "locked";
  return allDone || n < maxStep ? "done" : "open";
}

export const completedCount = (maxStep: number, current: number, currentValid: boolean) =>
  maxStep - 1 + (current === maxStep && currentValid ? 1 : 0);

// Langkah 1
export interface Step1Form {
  kode: string;
  jenis: string;
  judul: string;
}
export const KODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/; // contoh: SW-02
export const KODE_MAX = 30;
export const JUDUL_MIN = 15;
export const JUDUL_MAX = 160;

// ===== Langkah 2 =====
export interface Step2Form {
  nama: string;
  kategoriUsia: string;
  jenisKelamin: string;
  kategori: string[];
  riwayatAlergi: string;
  kondisiPenyerta: string;
  peranKomunikasi: string; // Penanda apakah yang bicara pasien sendiri atau pendamping
  gayaBicara: string;
  literasi: string;
  kalimat: string;
  memuatIk: boolean;
  // Field tambahan khusus untuk Resep Kronis
  unitLayanan: string;
  statusKunjungan: string;
}

export const KALIMAT_MAX = 180;
export const KALIMAT_MIN = 10;

export const JENIS_KELAMIN = ["Laki-laki", "Perempuan"];

export const KATEGORI_USIA = ["Balita", "Anak-anak", "Remaja", "Dewasa", "Lansia"];

export const PERAN_KOMUNIKASI = ["Pasien", "Pendamping (Keluarga/Kerabat)"];

export const KATEGORI_KHUSUS = [
  { key: "pediatri", label: "Pediatri", hint: "(<18 th)" },
  { key: "geriatri", label: "Geriatri", hint: "(≥60 th)" },
  { key: "ibu_hamil_menyusui", label: "Ibu Hamil & Menyusui", hint: "" },
  { key: "gangguan_fungsi_organ", label: "Gangguan Fungsi Hati/Ginjal", hint: "" },
  { key: "penyakit_kronis", label: "Penyakit Kronis", hint: "" },
  { key: "indeks_terapi_sempit", label: "Pengguna Obat Indeks Terapi Sempit", hint: "" },
  { key: "polifarmasi", label: "Polifarmasi (>5 macam obat)", hint: "" },
];

// value = yang disimpan di database, label = yang tampil
export const GAYA_BICARA = [
  { value: "Normal dan koperatif", label: "Normal & Koperatif" },
  { value: "Cemas dan peragu", label: "Cemas & Peragu (Sering bertanya ulang)" },
  { value: "Singkat dan pasif", label: "Singkat & Pasif (Menjawab seperlunya)" },
  { value: "Banyak bicara", label: "Banyak Bicara (Sering keluar topik)" },
  { value: "Tidak sabar", label: "Tidak Sabar (Terburu-buru)" },
  { value: "LAINNYA", label: "Lainnya (Ketik gaya bicara spesifik...)" },
];

export const LITERASI = [
  { value: "Awam", label: "Awam (Tidak paham istilah medis)" },
  { value: "Sedang", label: "Sedang (Paham istilah awam)" },
  { value: "Tinggi", label: "Tinggi (Paham istilah medis)" },
];

export interface Step2ExtraInput {
  riwayatAlergi?: string;
  kondisiPenyerta?: string;
}

/**
 * PARSING DARI DATABASE KE FORM
 * Menyertakan parameter `dataKlinis` karena untuk resep kronis,
 * info unitLayanan dan statusKunjungan disimpan di sana.
 */
export function parseStep2(
  profil: Record<string, unknown>,
  kalimat: string,
  dataKlinis: unknown = {},
  extra: Step2ExtraInput = {},
): Step2Form {
  const str = (k: string, d = "") => (typeof profil[k] === "string" ? (profil[k] as string) : d);

  const klinisObj =
    dataKlinis && typeof dataKlinis === "object" && !Array.isArray(dataKlinis)
      ? (dataKlinis as Record<string, unknown>)
      : {};
  const rkData =
    klinisObj.resep_kronis && typeof klinisObj.resep_kronis === "object" && !Array.isArray(klinisObj.resep_kronis)
      ? (klinisObj.resep_kronis as Record<string, unknown>)
      : {};

  return {
    nama: str("nama_pasien"),
    kategoriUsia: str("kategori_usia"),
    jenisKelamin: str("jenis_kelamin", "Laki-laki"),
    kategori: Array.isArray(profil.kategori_khusus)
      ? profil.kategori_khusus.filter((x): x is string => typeof x === "string")
      : [],
    riwayatAlergi: typeof extra.riwayatAlergi === "string" ? extra.riwayatAlergi : "",
    kondisiPenyerta: typeof extra.kondisiPenyerta === "string" ? extra.kondisiPenyerta : "",
    peranKomunikasi: str("peran_komunikasi", PERAN_KOMUNIKASI[0]),
    gayaBicara: str("gaya_bicara", GAYA_BICARA[0].value),
    literasi: str("literasi_kesehatan", LITERASI[0].value),
    kalimat,
    memuatIk: profil.kalimat_memuat_ik === true,
    unitLayanan: typeof rkData.unit_layanan === "string" ? rkData.unit_layanan : "",
    statusKunjungan: typeof rkData.status_resep === "string" ? rkData.status_resep : "",
  };
}

/**
 * MENGGABUNGKAN (BUILD) KE DATABASE UNTUK OBJEK profil_pasien
 */
export function buildProfil(existing: Record<string, unknown>, f: Step2Form): Record<string, unknown> {
  // Jika sebelumnya ada kunci "usia" atau "pekerjaan" di draft lama, kita hapus agar database bersih
  const { usia, pekerjaan, ...rest } = existing;

  return {
    ...rest,
    nama_pasien: f.nama.trim(),
    kategori_usia: f.kategoriUsia,
    jenis_kelamin: f.jenisKelamin,
    kategori_khusus: f.kategori,
    peran_komunikasi: f.peranKomunikasi,
    gaya_bicara: f.gayaBicara,
    literasi_kesehatan: f.literasi,
    kalimat_memuat_ik: f.memuatIk,
  };
}

/**
 * FUNGSI VALIDASI UNTUK TOMBOL "LANJUT"
 * Jika jenisnya adalah resep kronis, unit layanan dan status kunjungan wajib diisi.
 */
export const step2Checks = (f: Step2Form, jenisSkenario: string) => {
  const isResepKronis = jenisSkenario === "resep_kronis" || jenisSkenario === "RESEP KRONIS";

  const checks = [
    {
      label: "Demografi Pasien Lengkap",
      ok: f.nama.trim().length >= 2 && !!f.kategoriUsia && !!f.jenisKelamin,
    },
    { label: "Persona Komunikasi Ditetapkan", ok: !!f.peranKomunikasi && !!f.gayaBicara && !!f.literasi },
    { label: "Kalimat Pembuka & Pemicu Disusun", ok: f.kalimat.trim().length >= KALIMAT_MIN },
  ];

  if (isResepKronis) {
    checks.push({
      label: "Konteks Pelayanan Resep Dilengkapi",
      ok: !!f.unitLayanan && !!f.statusKunjungan,
    });
  }

  return checks;
};