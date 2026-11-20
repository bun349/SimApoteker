// ====== Tipe konfigurasi ======
export interface KField {
  key: string;
  label: string;
  kind: "input" | "textarea";
  placeholder: string;
  rows?: number;
  full?: boolean; // melebar 2 kolom
  tone?: "warn" | "danger";
  help?: string;
  optional?: boolean;
}

export interface KSection {
  id: string;
  title: string;
  desc?: string;
  cols: 1 | 2;
  check: string; // teks di panel Kelengkapan
  fields: KField[];
  chips?: { label: string; placeholder: string; help?: string }; // Butir Rubrik Tidak Berlaku
}

export interface KConfig {
  jenis: string;
  sections: KSection[];
}

export interface Step3Form {
  values: Record<string, string>;
  butir: string[];
}

// ====== Pembantu penyusun konfigurasi ======
type Extra = Partial<Omit<KField, "key" | "label" | "kind" | "placeholder">>;
const input = (key: string, label: string, placeholder: string, x: Extra = {}): KField =>
  ({ key, label, placeholder, kind: "input", ...x });
const area = (key: string, label: string, placeholder: string, x: Extra = {}): KField =>
  ({ key, label, placeholder, kind: "textarea", rows: 3, ...x });

const RUBRIK = {
  label: "Butir Rubrik Tidak Berlaku (Excluded Items)",
  placeholder: "Ketik butir lalu tekan Enter, contoh: K-06 (Instruksi antibiotik)",
  help: "Butir rubrik KIE yang tidak dinilai pada kasus ini. Boleh dikosongkan.",
};

const kontra = (a: string, b: string): KSection => ({
  id: "kontra",
  title: "Kontraindikasi Klinis & Pantangan Makanan/Minuman (Permenkes No. 73/2016)",
  cols: 2,
  check: "Kontraindikasi & Interaksi Nutrisi Tervalidasi",
  fields: [
    area("kontraindikasi", "Kontraindikasi Terhadap Kondisi Pasien", a, { rows: 4 }),
    area("pantangan", "Pantangan Makanan / Minuman & Interaksi Nutrisi", b, { rows: 4 }),
  ],
});

const bud = (title: string, a: string, b: string): KSection => ({
  id: "bud",
  title,
  cols: 2,
  check: "Regulasi BUD & Disposal Sesuai Permenkes 73/2016",
  fields: [
    area("bud", "Beyond Use Date (BUD) / Batas Pakai Setelah Kemasan Dibuka", a, { rows: 4 }),
    area("disposal", "Cara Membuang Sisa Obat (Disposal)", b, { rows: 4 }),
  ],
});

const tindakLanjut = (a: string, b: string): KSection => ({
  id: "tl",
  title: "Rencana Tindak Lanjut & Monitoring Mandiri",
  cols: 2,
  check: "Rencana Tindak Lanjut & Monitoring Terisi",
  fields: [
    area("tl_rencana", "Rencana Tindak Lanjut (Kunjungan Ulang & Rujukan)", a, { rows: 4 }),
    area("tl_monitoring", "Parameter Pemantauan Mandiri di Rumah", b, { rows: 4 }),
  ],
});

const tigaPertanyaan = (a: string, b: string, c: string): KSection => ({
  id: "3pq",
  title: "Three Prime Questions (3PQ): Verifikasi Pasien",
  desc: "Jawaban pasien virtual atas tiga pertanyaan pembuka konseling. Tulis sebagai ucapan langsung pasien.",
  cols: 1,
  check: "Three Prime Questions Terisi Penuh",
  fields: [
    area("q_kegunaan", "Apa yang telah dokter sampaikan tentang kegunaan obat ini?", a, { rows: 2 }),
    area("q_cara", "Apa yang telah dokter sampaikan tentang cara pakai obat ini?", b, { rows: 2 }),
    area("q_harapan", "Apa harapan yang telah dokter sampaikan setelah meminum obat ini?", c, { rows: 2 }),
  ],
});

// ====== Swamedikasi ======
const swamedikasi: KConfig = {
  jenis: "swamedikasi",
  sections: [
    {
      id: "gejala", title: "Identifikasi Gejala Utama", cols: 2, check: "Gejala Utama Teridentifikasi",
      fields: [
        input("jenis_keluhan", "Jenis Keluhan Pasien", "Nyeri sendi lutut kanan akut-on-kronis"),
        input("onset", "Awal Muncul (Onset)", "2 minggu yang lalu"),
        input("durasi_karakter", "Lama / Durasi & Karakteristik", "Hilang timbul, memburuk 3 hari terakhir"),
        input("keparahan", "Tingkat Keparahan (NRS / VAS)", "Skala 5-6 (nyeri sedang, mengganggu aktivitas)"),
      ],
    },
    {
      id: "ucapan", title: "Ucapan Pasien pada Penggalian",
      desc: "Jawaban pasien ketika mahasiswa menggali tiap aspek. Tulis sebagai ucapan langsung.",
      cols: 2, check: "Ucapan Pasien pada Penggalian Disusun",
      fields: [
        area("u_durasi", "1. Durasi & Frekuensi", "Sudah dua minggu ini Mbak, kumat-kumatan terutama pas bangun pagi rasanya kaku banget."),
        area("u_pemicu", "2. Pemicu & Pemberat", "Kalau habis jalan jauh ke pasar atau pas naik tangga makin ngilu."),
        area("u_keparahan", "3. Keparahan & Gangguan Aktivitas", "Kadang sampai susah jongkok, jalan agak pincang dan susah tidur kalau malam."),
        area("u_riwayat", "4. Riwayat Obat / Alergi", "Alergi makanan/obat tidak ada, tapi saya rutin minum obat pengencer darah dari dokter."),
      ],
    },
    {
      id: "riwayat", title: "Riwayat & Permintaan", cols: 1, check: "Riwayat & Permintaan Pasien Terisi",
      fields: [
        area("pengobatan_mandiri", "Pengobatan Mandiri / Tindakan yang Sudah Dicoba", "Cuma saya oles balsem hangat sama koyo, tapi cuma sebentar hilangnya."),
        area("obat_diminta", "Obat yang Diminta Pasien & Alasan Pemilihan", "Minta ibuprofen 400 mg 1 strip (alasan: rekomendasi tetangga, cepat reda)."),
      ],
    },
    kontra(
      "Riwayat ulkus peptikum aktif/perdarahan saluran cerna, alergi/hipersensitivitas OAINS/aspirin, serta terdistribusi...",
      "Hindari minuman beralkohol berlebihan (meningkatkan risiko perdarahan lambung/toksisitas hepar), konsumsi obat sesudah makan.",
    ),
    {
      id: "keputusan", title: "Keputusan Klinis", cols: 1, check: "Rencana Monitoring & Rujukan Terisi",
      fields: [
        input("red_flags", "Tanda Bahaya Tersembunyi (Red Flags)", "Lutut bengkak kemerahan panas, melena (tinja hitam), riwayat interaksi obat", { tone: "danger" }),
        area("rekomendasi_final", "Rekomendasi Final (Obat / Non-obat / Rekomendasi Rujuk)", "Tolak ibuprofen (DDI fatal warfarin). Alihkan ke Parasetamol 500 mg maks 2-3 g/hari + kompres dingin + edukasi segera rujuk bila bengkak meluas."),
      ],
      chips: RUBRIK,
    },
    bud(
      "Beyond Use Date (BUD) & Pembuangan Sisa Obat (Blueprint UKAI)",
      "Sediaan tetes mata mini-dose: 3x/24 jam; botol multi-dose: maks 28 hari; tablet/krim: sesuai instruksi kemasan & kondisi fisik.",
      "Keluarkan obat dari kemasan asli, rusak label/wadah obat, campur obat pada dengan ampas kopi/tanah, buang ke tempat sampah tertutup.",
    ),
  ],
};

// ====== Resep Akut ======
const resepAkut: KConfig = {
  jenis: "resep_akut",
  sections: [
    {
      id: "kop_resep",
      title: "Kop Faskes & Identitas Penulis Resep",
      desc: "Informasi ini akan tampil pada lembar salinan resep di halaman briefing mahasiswa.",
      cols: 2,
      check: "Kop Faskes & Penulis Resep Terisi",
      fields: [
        input("klinik", "Nama Klinik / Faskes", "Klinik Pratama Universitas Padjadjaran"),
        input("poli", "Ruang / Poli", "Rawat Jalan (Anak & Dewasa Muda)"),
        input("dokter", "Dokter Penulis Resep & SIP", "dr. Hendra Setiawan, Sp.A (SIP: 446/123/SIP/2023)", {
          full: true,
          help: "Format nama + SIP akan dipisah otomatis menjadi nama dokter dan nomor SIP pada lembar resep.",
        }),
        input("tanggal", "Tanggal Resep", "20 November 2026"),
        input("alamat", "Alamat Faskes", "Jl. Raya Bandung-Sumedang Km. 21, Jatinangor, Sumedang"),
      ],
    },
    {
      id: "resep", title: "Salinan Resep Dokter", cols: 2, check: "Rincian Resep Dokter Lengkap & Valid",
      fields: [
        input("diagnosis", "Diagnosis Klinis Dokter (Indikasi)", "Faringitis Bakterialis Akut (ICD-10 J02.9)", { full: true }),
        input("obat", "Nama Obat, Kekuatan & Bentuk Sediaan", "Amoxicillin Trihydrate 500 mg Kapsul"),
        input("signa", "Signa (Dosis & Frekuensi Pemakaian)", "3 x sehari 1 kapsul (3 dd cap I)"),
        input("jumlah", "Jumlah Obat (Numerik / Rangkaian)", "15 Kapsul (No. XV)"),
        input("durasi_terapi", "Durasi Terapi", "5 hari (harus dihabiskan)"),
      ],
    },
    tigaPertanyaan(
      "Dokter bilang ini antibiotik untuk radang tenggorokan akibat bakteri saya.",
      "Disuruh minum 3 kali sehari setelah makan, tapi tidak dijelaskan jam pastinya.",
      "Biar cepat sembuh radangnya dan bisa kerja lagi seperti biasa.",
    ),
    {
      id: "aturan", title: "Aturan Pakai & Informasi Efek Samping", cols: 2, check: "Parameter Klinis & Efek Samping Terisi",
      fields: [
        input("interval", "Instruksi Interval & Kepatuhan yang Benar", "Tiap 8 jam teratur sesudah makan, wajib habis dalam 5 hari", {
          full: true, help: "Wajib mencakup penegasan interval waktu tetap dan penyelesaian obat hingga habis.",
        }),
        area("es_umum", "Efek Samping Umum Wajib Disebut", "Mual ringan, rasa tidak nyaman di lambung, diare ringan.", { rows: 4 }),
        area("adr_berat", "ADR Berat / Tanda Alergi Segera Stop", "Ruam merah kulit gatal mendadak, pembengkakan bibir/wajah, sesak napas (alergi anafilaksis).", { rows: 4, tone: "danger" }),
      ],
    },
    {
      id: "bahaya", title: "Tanda Bahaya & Aturan Tambahan", cols: 1, check: "Tanda Bahaya & Penyimpanan Terisi",
      fields: [
        input("red_flags", "Tanda Bahaya Rujukan Segera (Red Flags)", "Demam tinggi >39°C menetap setelah 3 hari, nyeri menelan makin berat", { tone: "danger" }),
        area("penyimpanan", "Penyimpanan", "Simpan pada suhu ruang terkendali (15-25°C), terlindung dari cahaya matahari langsung dan kelembapan tinggi. Jauhkan dari jangkauan anak-anak."),
      ],
      chips: RUBRIK,
    },
    kontra(
      "Riwayat hipersensitivitas penisilin berat (anafilaksis), mononukleosis infeksiosa.",
      "Hindari minuman beralkohol, jus asam tinggi secara berlebihan; konsumsi sesudah makan untuk mengurangi gangguan lambung.",
    ),
    bud(
      "Beyond Use Date (BUD) & Pembuangan Obat (Disposal)",
      "Sesuai tanggal kedaluwarsa pada kemasan.",
      "Keluarkan obat dari blister/strip, gerus/hancurkan kapsul, campur dengan ampas kopi, buang ke tempat sampah tertutup.",
    ),
    tindakLanjut(
      "Konsultasikan kembali ke dokter bila keluhan demam dan sakit tenggorokan tidak membaik dalam 3 hari.",
      "Pantau suhu tubuh harian, penurunan nyeri saat menelan, serta tidak munculnya ruam kulit.",
    ),
  ],
};

// ====== Resep Kronis ======
const resepKronis: KConfig = {
  jenis: "resep_kronis",
  sections: [
    {
      id: "resep", title: "Resep Dokter & Durasi Penyakit", cols: 2, check: "Rincian Resep Dokter Lengkap & Valid",
      fields: [
        input("diagnosis", "Diagnosis Pasien", "Hipertensi Primer Stage II & DM Tipe 2 (ICD-10 I10, E11.9)", { full: true }),
        input("lama_sakit", "Lama Sakit", "Hipertensi ± 5 tahun, DM ± 3 tahun"),
        input("lama_terapi", "Lama Terapi Obat Kini", "Regimen sama sejak 8 bulan terakhir"),
        input("obat_utama", "Nama Obat & Dosis Utama", "Amlodipine 10 mg, Metformin 500 mg, Glimepirid 2 mg", { full: true }),
        input("dosis_sediaan", "Dosis & Bentuk Sediaan", "Amlodipine 10 mg (pagi), Metformin 500 mg (3x1), Glimepirid 2 mg (1x1)", { full: true }),
        input("aturan_pakai", "Aturan Pakai Dokter", "Metformin sesudah makan, Glimepirid sebelum makan pagi", { full: true }),
      ],
    },
    tigaPertanyaan(
      "Katanya obat ini untuk menurunkan tekanan darah dan gula darah saya.",
      "Diminum rutin tiap hari, pagi dan malam, jangan sampai putus.",
      "Supaya tensi dan gula saya stabil dan tidak komplikasi.",
    ),
    {
      id: "kepatuhan", title: "Kepatuhan & Pemantauan Parameter Klinis", cols: 1, check: "Parameter Klinis, Target & Kepatuhan Terisi",
      fields: [
        area("adherence", "Pola Kepatuhan Minum Obat (Adherence)", "Sering lupa dosis malam, kadang berhenti sendiri kalau merasa sehat.", { tone: "warn" }),
        area("parameter", "Parameter & Target Terapi", "Tekanan darah <140/90 mmHg, GDP 80-130 mg/dL, HbA1c <7%."),
        area("mandiri", "Keluhan / Pemantauan Mandiri di Rumah", "Cek tensi seminggu sekali di puskesmas, belum punya alat cek gula darah."),
      ],
    },
    {
      id: "gayahidup", title: "Modifikasi Gaya Hidup & Edukasi Kronis", cols: 1, check: "Gaya Hidup & Edukasi Terisi",
      fields: [
        area("diet", "Pola Makan (Diet)", "Sering makan asin dan gorengan, nasi porsi besar dua kali sehari.", { rows: 2 }),
        area("aktivitas", "Aktivitas Fisik", "Jarang olahraga, jalan kaki ringan 10 menit tiap pagi.", { rows: 2 }),
        area("kebiasaan", "Kebiasaan Merokok / Gaya Hidup", "Merokok ±10 batang per hari, tidur larut malam.", { rows: 2 }),
      ],
    },
    kontra(
      "Hindari kombinasi dengan NSAID (menaikkan tekanan darah), riwayat hipoglikemia berat, gangguan fungsi ginjal.",
      "Batasi garam dan gula, hindari alkohol, jus grapefruit tidak dianjurkan bersama amlodipine.",
    ),
    {
      id: "bahaya", title: "Tanda Bahaya & Stop Rules (Logbook FRB)", cols: 1, check: "Tanda Bahaya & Penyimpanan Terisi",
      fields: [
        input("refill", "Jadwal Konfirmasi Refill / Kunjungan Ulang", "Tanggal 6 setiap bulan di Poli Penyakit Dalam"),
        area("penyimpanan", "Penyimpanan Obat", "Simpan di suhu ruang, jauh dari panas dan lembap, di wadah asli.", { rows: 2 }),
        area("red_flags", "Tanda Bahaya Rujukan Segera (Red Flags)", "Nyeri dada, sesak napas, keringat dingin, gula darah <70 atau >300 mg/dL, tekanan darah >180/110.", { tone: "danger", rows: 2 }),
      ],
      chips: RUBRIK,
    },
    bud(
      "Beyond Use Date (BUD) & Pembuangan Obat (Disposal)",
      "Tablet dalam strip: sesuai tanggal kedaluwarsa kemasan; jangan campur ke wadah lain.",
      "Keluarkan obat dari kemasan, rusak label, campur dengan ampas kopi/tanah, buang ke tempat sampah tertutup.",
    ),
    tindakLanjut(
      "Kontrol rutin tiap bulan, bawa buku catatan tensi dan gula darah, rujuk bila parameter tidak tercapai 2 bulan.",
      "Catat tekanan darah dan gula darah harian di logbook, laporkan efek samping seperti batuk kering atau pusing.",
    ),
  ],
};

const CONFIGS: Record<string, KConfig> = {
  swamedikasi,
  resep_akut: resepAkut,
  resep_kronis: resepKronis,
};

export const getKlinisConfig = (jenis: string): KConfig | undefined => CONFIGS[jenis];

const allFields = (cfg: KConfig) => cfg.sections.flatMap((s) => s.fields);
const MIN_FIELD = 3;
const filled = (v: string | undefined) => (v ?? "").trim().length >= MIN_FIELD;

// ====== Validasi ======
export const step3Checks = (cfg: KConfig, f: Step3Form) =>
  cfg.sections.map((s) => ({
    label: s.check,
    ok: s.fields.every((x) => x.optional || filled(f.values[x.key])),
  }));

// ====== Baca / tulis jsonb ======
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

// kunci lama di data_klinis_khusus yang tetap diisi untuk kompatibilitas
const LEGACY: Record<string, string[]> = {
  kontraindikasi: ["kontraindikasi"],
  pantangan_konsumsi: ["pantangan"],
  bud_dan_disposal: ["bud", "disposal"],
  tindak_lanjut_monitoring: ["tl_rencana", "tl_monitoring"],
};

export function parseStep3(
  cfg: KConfig,
  klinis: Record<string, unknown>,
  columnButir: string[],
  isDraftJenis: boolean,
): Step3Form {
  const hasNs = isObj(klinis[cfg.jenis]);
  const ns = hasNs ? (klinis[cfg.jenis] as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const f of allFields(cfg)) {
    const v = ns[f.key];
    values[f.key] = typeof v === "string" ? v : "";
  }
  // data lama (sebelum ada pemisahan per jenis) dipakai sebagai isi awal
  if (!hasNs) {
    if (typeof klinis.kontraindikasi === "string" && "kontraindikasi" in values) values.kontraindikasi = klinis.kontraindikasi;
    if (typeof klinis.pantangan_konsumsi === "string" && "pantangan" in values) values.pantangan = klinis.pantangan_konsumsi;
  }
  const butir = Array.isArray(ns.butir)
    ? ns.butir.filter((x): x is string => typeof x === "string")
    : !hasNs && isDraftJenis
      ? columnButir
      : [];
  return { values, butir };
}

export function buildKlinis(
  existing: Record<string, unknown>,
  cfg: KConfig,
  f: Step3Form,
): Record<string, unknown> {
  const fields = allFields(cfg);
  const trimmed: Record<string, string> = {};
  for (const x of fields) trimmed[x.key] = (f.values[x.key] ?? "").trim();

  const prev = isObj(existing[cfg.jenis]) ? (existing[cfg.jenis] as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {
    ...existing,
    [cfg.jenis]: { ...prev, ...trimmed, butir: f.butir },
  };

  for (const [legacyKey, keys] of Object.entries(LEGACY)) {
    const present = keys.flatMap((k) => fields.filter((x) => x.key === k));
    if (present.length === 0) continue;
    out[legacyKey] =
      present.length === 1
        ? trimmed[present[0].key]
        : present
            .filter((x) => trimmed[x.key])
            .map((x) => `${x.label}: ${trimmed[x.key]}`)
            .join("\n");
  }
  return out;
}

export interface KlinisTambahanForm {
  obatLainSuplemen: string[];
  interaksiDitanam: string;
  memuatDdi: boolean;
}

export function parseKlinisTambahan(params: {
  obatLainSuplemen?: unknown;
  interaksiDitanam?: unknown;
  memuatDdi?: unknown;
  klinis?: Record<string, unknown>;
}): KlinisTambahanForm {
  const klinis = params.klinis ?? {};

  const fromTopObat = Array.isArray(params.obatLainSuplemen)
    ? params.obatLainSuplemen.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  const fromKlinisObat = Array.isArray(klinis.obat_lain_suplemen)
    ? klinis.obat_lain_suplemen.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  const obatLainSuplemen = fromTopObat.length ? fromTopObat : fromKlinisObat;

  const interaksiRaw =
    typeof params.interaksiDitanam === "string"
      ? params.interaksiDitanam
      : typeof klinis.interaksi_ditanam === "string"
        ? klinis.interaksi_ditanam
        : "";
  const interaksiDitanam = interaksiRaw.trim();

  // Aturan: jika interaksi_ditanam terisi, memuat_ddi otomatis true
  const memuatDdi = interaksiDitanam.length > 0 ? true : params.memuatDdi === true || klinis.memuat_ddi === true;

  return {
    obatLainSuplemen,
    interaksiDitanam,
    memuatDdi,
  };
}

export function applyInteraksiChange(interaksi: string, currentMemuatDdi = false): {
  interaksiDitanam: string;
  memuatDdi: boolean;
} {
  const hasInteraksi = interaksi.trim().length > 0;
  return {
    interaksiDitanam: interaksi,
    memuatDdi: hasInteraksi ? true : currentMemuatDdi,
  };
}