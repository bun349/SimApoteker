import { supabase } from "@/lib/supabase";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";

export type StatusRapor =
  | "otomatis"
  | "perlu_ditinjau_dosen"
  | "selesai_ditinjau"
  | "tidak_cukup_data"
  | "tidak_dapat_dinilai";

export type SessionStatusEnum =
  | "berjalan"
  | "selesai_otomatis"
  | "perlu_ditinjau_dosen"
  | "selesai_ditinjau"
  | "tidak_cukup_data"
  | "tidak_dapat_dinilai";

export interface PactToolItem {
  kode: string;
  nama: string;
  indikator?: string;
  skor: number;
  skor_tampil: number;
  skala_level: number;
  label_level: string;
  alasan: string;
  kutipan?: string;
  bukti_giliran?: string[];
}

export interface PactCriterionItem {
  kode: string;
  pilar: string;
  kategori: string;
  parameter: string;
  status: string;
  skor_poin: number;
  maks_poin: number;
  kutipan?: string;
  kutipan_ditolak?: boolean;
  kode_giliran?: string | null;
  waktu_detik?: number | null;
  alasan?: string;
}

export interface DetailPact {
  tools?: Record<string, PactToolItem>;
  kriteria?: PactCriterionItem[];
  pelanggaran_jargon?: Array<{
    istilah: string;
    padanan_diharapkan?: string[];
    penalti?: number;
  }>;
  catatan?: string;
}

export interface ClinicalCriterionItem {
  kode: string;
  parameter: string;
  kategori: string;
  pilar: string;
  bobot?: number;
  berlaku?: boolean;
  status: string;
  skor: number | null;
  ambigu?: boolean;
  kutipan?: string;
  kutipan_ditolak?: boolean;
  kode_giliran?: string | null;
  waktu_detik?: number | null;
  alasan?: string;
}

export interface PillarSummaryItem {
  label: string;
  aktif?: boolean;
  skor_dasar?: number | null;
  penalti?: number;
  skor_akhir?: number | null;
  terpenuhi?: number;
  total?: number;
}

export interface DetailButirKonten {
  items?: ClinicalCriterionItem[];
  ringkasan_pilar?: Record<string, PillarSummaryItem>;
}

export interface CriticalErrorItem {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  pilar: string;
  kutipan?: string;
  kode_giliran_terjadi?: string | null;
  nomor_giliran_terjadi?: number | null;
  waktu_detik?: number | null;
  dikoreksi?: boolean;
  kode_giliran_koreksi?: string | null;
  status_koreksi?: string;
  bisa_dikoreksi?: boolean;
  penalti_diterapkan: number;
  catatan_algoritma?: string;
}

export interface DetailKesalahanKritis {
  items?: CriticalErrorItem[];
  jumlah_temuan?: number;
  jumlah_penalti_aktif?: number;
}

export interface VocalDataEntry {
  tipe?: "ringkasan" | "giliran";
  audio_turns?: number;
  total_student_turns?: number;
  wpm_rata_rata?: number | null;
  rasio_jeda_persen?: number | null;
  stabilitas_volume_rms?: number | null;
  pitch_rata_rata_hz?: number | null;
  intensitas_rata_rata_db?: number | null;
  validitas_asr_persen?: number | null;
  kode_giliran?: string;
  nomor_giliran?: number;
  waktu_mulai_detik?: number;
  wpm?: number | null;
  pitch_hz?: number | null;
  kekuatan_db?: number | null;
  status_asr_valid?: boolean;
}

export interface FeedbackGroup {
  kategori: "kekuatan_utama" | "area_perbaikan" | "saran_praktik" | string;
  judul: string;
  ringkasan?: string;
  kutipan?: string;
  kode_giliran?: string | null;
  waktu_detik?: number | null;
  poin?: Array<{ judul: string; deskripsi: string }>;
  tag?: string;
}

export interface RaporPenilaianRecord {
  id: string;
  id_sesi: string;
  skor_tool_a: number | null;
  skor_tool_b: number | null;
  skor_tool_c: number | null;
  skor_tool_d: number | null;
  skor_tool_e: number | null;
  skor_komunikasi_mentah: number | null;
  skor_komunikasi_tampil: number | null;
  detail_pact: DetailPact;
  skor_prosedur: number | null;
  skor_penanganan_ddi: number | null;
  skor_kelengkapan: number | null;
  skor_konten_mentah: number | null;
  skor_konten_tampil: number | null;
  detail_butir_konten: DetailButirKonten;
  detail_kesalahan_kritis: DetailKesalahanKritis;
  total_penalti_prosedur: number;
  total_penalti_ddi: number;
  total_penalti_kelengkapan: number;
  nilai_gabungan_sistem_mentah: number | null;
  nilai_gabungan_sistem_tampil: number | null;
  layak_tampil_vokal: boolean;
  data_pengamatan_vokal: VocalDataEntry[];
  narasi_pengamatan_vokal: string | null;
  umpan_balik_rapor: FeedbackGroup[];
  log_audit_sistem: string[];
  is_overridden: boolean;
  id_dosen_peninjau?: string | null;
  skor_komunikasi_dosen?: number | null;
  skor_konten_dosen?: number | null;
  nilai_resmi_akhir: number | null;
  catatan_override_butir?: Record<string, unknown> | null;
  komentar_dosen_untuk_mahasiswa?: string | null;
  waktu_ditinjau?: string | null;
  detail_pemicu?: Record<string, unknown>;
  metadata_evaluasi?: Record<string, unknown>;
  status_rapor: StatusRapor;
  dievaluasi_at?: string | null;
}

export interface RaporTranscriptRow {
  id?: string;
  urutan_global?: number;
  kode_giliran?: string;
  nomor_giliran_pembicara?: number;
  pembicara: string;
  waktu_mulai_detik?: number;
  teks: string;
  status_asr_valid?: boolean;
}

export interface DocumentationRecord {
  id: string;
  id_sesi: string;
  nama_pasien: string;
  usia_pasien: string;
  jenis_kelamin: string;
  nama_dokter?: string;
  keluhan_diagnosa: string;
  riwayat_alergi: string;
  obat_lain_penyerta: string;
  nama_obat_dosis: string;
  instruksi_khusus: string;
  edukasi_tindak_lanjut: string;
  durasi_pengisian_detik: number;
  waktu_habis: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RaporStudentInfo {
  id: string;
  nama_lengkap: string;
  nomor_induk: string;
  email?: string;
  id_kelas?: string | null;
  nama_kelas?: string | null;
  kode_kelas?: string | null;
}

export interface RaporReviewerInfo {
  id: string;
  nama_lengkap: string;
  nomor_induk?: string;
  email?: string;
}

export interface RaporBundleResponse {
  rapor: RaporPenilaianRecord;
  session: {
    id: string;
    kode_sesi?: string;
    id_skenario?: string;
    id_mahasiswa?: string;
    mode?: string;
    status_evaluasi?: string;
    durasi_aktif_detik?: number;
    jumlah_giliran_mahasiswa?: number;
    jumlah_giliran_valid?: number;
    waktu_mulai?: string;
    waktu_selesai?: string;
    perlu_ditinjau_dosen?: boolean;
    alasan_tinjau_dosen?: string[];
  };
  scenario: {
    id?: string;
    kode_skenario?: string;
    versi?: string;
    judul?: string;
    jenis?: string;
    memuat_ddi?: boolean;
    bobot_komunikasi?: number;
    bobot_konten?: number;
    nama_pasien?: string;
  };
  student?: RaporStudentInfo | null;
  reviewer?: RaporReviewerInfo | null;
  transcript: RaporTranscriptRow[];
  has_documentation: boolean;
  documentation: DocumentationRecord | null;
}

export interface StudentHistoryRaporBrief {
  id_sesi: string;
  skor_komunikasi_tampil: number | null;
  skor_konten_tampil: number | null;
  skor_penanganan_ddi: number | null;
  nilai_gabungan_sistem_tampil: number | null;
  nilai_resmi_akhir: number | null;
  is_overridden: boolean;
  status_rapor: StatusRapor;
}

export interface StudentHistoryItem {
  id: string;
  kode_sesi: string;
  id_skenario: string;
  mode: "praktikum" | "mandiri";
  status_evaluasi: SessionStatusEnum;
  perlu_ditinjau_dosen: boolean;
  alasan_tinjau_dosen: string[];
  penanda_khusus: string[];
  semua_pemicu_tergali: boolean;
  jumlah_giliran_mahasiswa: number;
  jumlah_giliran_valid: number;
  durasi_aktif_detik: number;
  waktu_mulai: string;
  waktu_selesai: string | null;
  scenario: {
    id: string;
    kode_skenario: string;
    versi: string;
    judul: string;
    jenis: string;
    nama_pasien: string;
    patient_meta: string;
    memuat_ddi: boolean;
  };
  rapor: StudentHistoryRaporBrief | null;
}

export interface StudentHistorySummary {
  total_sessions: number;
  total_all: number;
  mandiri_count: number;
  praktikum_count: number;
  avg_official_score: number | null;
  avg_ddi_detection: number | null;
  avg_duration_sec: number;
}

export interface StudentHistoryResponse {
  summary: StudentHistorySummary;
  items: StudentHistoryItem[];
}

async function resolveStudentAndReviewerFromSupabase(
  studentId?: string | null,
  reviewerId?: string | null,
): Promise<{ student: RaporStudentInfo | null; reviewer: RaporReviewerInfo | null }> {
  let student: RaporStudentInfo | null = null;
  let reviewer: RaporReviewerInfo | null = null;

  const userIds = Array.from(
    new Set([studentId, reviewerId].filter((x): x is string => Boolean(x))),
  );
  if (userIds.length === 0) return { student, reviewer };

  const { data: usersData } = await supabase
    .from("pengguna")
    .select("id, nama_lengkap, nomor_induk, email, id_kelas")
    .in("id", userIds);

  const userMap = new Map<string, Record<string, any>>();
  for (const u of (usersData || []) as Array<Record<string, any>>) {
    if (u.id) userMap.set(String(u.id), u);
  }

  if (studentId && userMap.has(studentId)) {
    const m = userMap.get(studentId)!;
    let namaKelas: string | null = null;
    let kodeKelas: string | null = null;
    if (m.id_kelas) {
      const { data: kData } = await supabase
        .from("kelas")
        .select("id, nama_kelas, kode_kelas")
        .eq("id", m.id_kelas)
        .limit(1);
      const kRow = (kData || [])[0] as Record<string, any> | undefined;
      if (kRow) {
        namaKelas = kRow.nama_kelas ? String(kRow.nama_kelas) : null;
        kodeKelas = kRow.kode_kelas ? String(kRow.kode_kelas) : null;
      }
    }
    student = {
      id: String(m.id),
      nama_lengkap: String(m.nama_lengkap || "Mahasiswa"),
      nomor_induk: String(m.nomor_induk || "-"),
      email: m.email ? String(m.email) : "",
      id_kelas: m.id_kelas ? String(m.id_kelas) : null,
      nama_kelas: namaKelas,
      kode_kelas: kodeKelas,
    };
  }

  if (reviewerId && userMap.has(reviewerId)) {
    const r = userMap.get(reviewerId)!;
    reviewer = {
      id: String(r.id),
      nama_lengkap: String(r.nama_lengkap || "Dosen Penguji"),
      nomor_induk: r.nomor_induk ? String(r.nomor_induk) : "",
      email: r.email ? String(r.email) : "",
    };
  }

  return { student, reviewer };
}

async function fetchSessionRaporFromSupabase(sessionId: string): Promise<RaporBundleResponse> {
  const { data: sessRows, error: sessErr } = await supabase
    .from("sesi_simulasi")
    .select("*")
    .eq("id", sessionId)
    .limit(1);
  if (sessErr || !sessRows || sessRows.length === 0) {
    throw new Error("Data sesi simulasi tidak ditemukan.");
  }
  const session = sessRows[0] as Record<string, any>;

  const [scenRes, transRes, raporRes, docRes] = await Promise.all([
    session.id_skenario
      ? supabase
          .from("skenario_praktikum")
          .select("id, kode_skenario, versi, judul, jenis, memuat_ddi, bobot_komunikasi, bobot_konten, profil_pasien")
          .eq("id", session.id_skenario)
          .limit(1)
      : Promise.resolve({ data: [] as Record<string, any>[] }),
    supabase
      .from("transkrip_dialog")
      .select("*")
      .eq("id_sesi", sessionId)
      .order("urutan_global", { ascending: true }),
    supabase
      .from("rapor_penilaian")
      .select("*")
      .eq("id_sesi", sessionId)
      .limit(1),
    supabase
      .from("dokumentasi_konseling")
      .select("*")
      .eq("id_sesi", sessionId)
      .limit(1),
  ]);

  const rapor = ((raporRes.data || [])[0] || null) as RaporPenilaianRecord | null;
  if (!rapor) {
    throw new Error("Rapor evaluasi untuk sesi ini belum tersedia.");
  }
  const scen = ((scenRes.data || [])[0] || {}) as Record<string, any>;
  const profil =
    scen.profil_pasien && typeof scen.profil_pasien === "object"
      ? (scen.profil_pasien as Record<string, any>)
      : {};
  const documentation = ((docRes.data || [])[0] || null) as DocumentationRecord | null;

  const { student, reviewer } = await resolveStudentAndReviewerFromSupabase(
    session.id_mahasiswa ? String(session.id_mahasiswa) : null,
    rapor.id_dosen_peninjau ? String(rapor.id_dosen_peninjau) : null,
  );

  return {
    rapor,
    session: session as RaporBundleResponse["session"],
    scenario: {
      id: scen.id ? String(scen.id) : undefined,
      kode_skenario: scen.kode_skenario ? String(scen.kode_skenario) : undefined,
      versi: scen.versi ? String(scen.versi) : "0.1",
      judul: scen.judul ? String(scen.judul) : undefined,
      jenis: scen.jenis ? String(scen.jenis) : undefined,
      memuat_ddi: Boolean(scen.memuat_ddi),
      bobot_komunikasi: typeof scen.bobot_komunikasi === "number" ? scen.bobot_komunikasi : undefined,
      bobot_konten: typeof scen.bobot_konten === "number" ? scen.bobot_konten : undefined,
      nama_pasien: profil.nama_pasien || profil.nama || undefined,
    },
    student,
    reviewer,
    transcript: (transRes.data || []) as RaporTranscriptRow[],
    has_documentation: documentation !== null,
    documentation,
  };
}

export async function fetchSessionRaporApi(
  sessionId: string,
  options?: { force?: boolean; autoEvaluate?: boolean },
): Promise<RaporBundleResponse> {
  const params = new URLSearchParams();
  params.set("auto_evaluate", String(options?.autoEvaluate ?? true));
  if (options?.force) params.set("force", "true");

  try {
    const res = await fetch(
      `${API_BASE}/api/evaluation/rapor/${encodeURIComponent(sessionId)}?${params.toString()}`,
    );
    if (res.ok) {
      const json = (await res.json()) as RaporBundleResponse;
      // Jika backend belum direstart sehingga student/reviewer belum disertakan, lengkapi ringan dari Supabase
      if (
        json &&
        json.rapor &&
        ((json.session?.id_mahasiswa && !json.student) ||
          (json.rapor.id_dosen_peninjau && !json.reviewer))
      ) {
        try {
          const extra = await resolveStudentAndReviewerFromSupabase(
            !json.student ? json.session?.id_mahasiswa : null,
            !json.reviewer ? json.rapor.id_dosen_peninjau : null,
          );
          if (!json.student && extra.student) json.student = extra.student;
          if (!json.reviewer && extra.reviewer) json.reviewer = extra.reviewer;
        } catch {
          // Abaikan jika gagal memperkaya metadata tambahan
        }
      }
      return json;
    }
  } catch {
    // Fallback ke Supabase jika backend sedang tidak terjangkau
  }

  return fetchSessionRaporFromSupabase(sessionId);
}

export async function recalculateSessionRaporApi(
  sessionId: string,
): Promise<RaporBundleResponse> {
  const res = await fetch(
    `${API_BASE}/api/evaluation/session/${encodeURIComponent(sessionId)}?force=true`,
    { method: "POST" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal menghitung ulang rapor evaluasi.");
  }
  return res.json();
}

export async function fetchLatestRaporApi(
  idMahasiswa: string,
): Promise<RaporBundleResponse> {
  const res = await fetch(
    `${API_BASE}/api/evaluation/latest?id_mahasiswa=${encodeURIComponent(idMahasiswa)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Belum ada rapor evaluasi yang tersedia.");
  }
  return res.json();
}

export async function fetchSessionDocumentationApi(sessionId: string): Promise<{
  session_id: string;
  exists: boolean;
  documentation: DocumentationRecord | null;
  session: Record<string, unknown>;
}> {
  const res = await fetch(
    `${API_BASE}/api/simulation/${encodeURIComponent(sessionId)}/documentation`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal memuat data dokumentasi kefarmasian.");
  }
  return res.json();
}

async function fetchStudentHistoryFromSupabase(
  idMahasiswa: string,
): Promise<StudentHistoryResponse> {
  const { data: sessions, error: sessErr } = await supabase
    .from("sesi_simulasi")
    .select(
      "id, kode_sesi, id_mahasiswa, id_skenario, mode, jumlah_giliran_mahasiswa, jumlah_giliran_valid, persentase_audio_valid, jumlah_segmen_vokal_valid, semua_pemicu_tergali, status_evaluasi, perlu_ditinjau_dosen, alasan_tinjau_dosen, penanda_khusus, waktu_mulai, waktu_selesai, durasi_aktif_detik",
    )
    .eq("id_mahasiswa", idMahasiswa)
    .order("waktu_mulai", { ascending: false });

  if (sessErr) throw sessErr;
  const rows = (sessions || []) as Array<Record<string, any>>;
  if (rows.length === 0) {
    return {
      summary: {
        total_sessions: 0,
        total_all: 0,
        mandiri_count: 0,
        praktikum_count: 0,
        avg_official_score: null,
        avg_ddi_detection: null,
        avg_duration_sec: 0,
      },
      items: [],
    };
  }

  const scenarioIds = Array.from(new Set(rows.map((r) => String(r.id_skenario)).filter(Boolean)));
  const sessionIds = rows.map((r) => String(r.id)).filter(Boolean);

  const [scenRes, raporRes] = await Promise.all([
    scenarioIds.length > 0
      ? supabase
          .from("skenario_praktikum")
          .select("id, kode_skenario, versi, judul, jenis, profil_pasien, memuat_ddi")
          .in("id", scenarioIds)
      : Promise.resolve({ data: [] as Record<string, any>[] }),
    sessionIds.length > 0
      ? supabase
          .from("rapor_penilaian")
          .select(
            "id_sesi, skor_komunikasi_tampil, skor_konten_tampil, skor_penanganan_ddi, nilai_gabungan_sistem_tampil, nilai_resmi_akhir, is_overridden, status_rapor",
          )
          .in("id_sesi", sessionIds)
      : Promise.resolve({ data: [] as Record<string, any>[] }),
  ]);

  const scenMap = new Map<string, Record<string, any>>();
  for (const sc of (scenRes.data || []) as Array<Record<string, any>>) {
    scenMap.set(String(sc.id), sc);
  }
  const raporMap = new Map<string, StudentHistoryRaporBrief>();
  for (const rp of (raporRes.data || []) as Array<Record<string, any>>) {
    raporMap.set(String(rp.id_sesi), rp as StudentHistoryRaporBrief);
  }

  const items: StudentHistoryItem[] = rows.map((s) => {
    const sid = String(s.id);
    const scen = scenMap.get(String(s.id_skenario || "")) || {};
    const profil =
      scen.profil_pasien && typeof scen.profil_pasien === "object"
        ? (scen.profil_pasien as Record<string, unknown>)
        : {};
    const namaPasien =
      (typeof profil.nama_pasien === "string" && profil.nama_pasien.trim()) ||
      (typeof profil.nama === "string" && profil.nama.trim()) ||
      "Pasien";
    const metaParts = [
      typeof profil.peran_komunikasi === "string" ? profil.peran_komunikasi.trim() : "",
      typeof profil.kategori_usia === "string" ? profil.kategori_usia.trim() : "",
      typeof profil.jenis_kelamin === "string" ? profil.jenis_kelamin.trim() : "",
    ].filter(Boolean);

    return {
      id: sid,
      kode_sesi: String(s.kode_sesi || ""),
      id_skenario: String(s.id_skenario || ""),
      mode: s.mode === "praktikum" ? "praktikum" : "mandiri",
      status_evaluasi: (s.status_evaluasi || "berjalan") as SessionStatusEnum,
      perlu_ditinjau_dosen: Boolean(s.perlu_ditinjau_dosen),
      alasan_tinjau_dosen: Array.isArray(s.alasan_tinjau_dosen) ? s.alasan_tinjau_dosen : [],
      penanda_khusus: Array.isArray(s.penanda_khusus) ? s.penanda_khusus : [],
      semua_pemicu_tergali: Boolean(s.semua_pemicu_tergali),
      jumlah_giliran_mahasiswa: Number(s.jumlah_giliran_mahasiswa || 0),
      jumlah_giliran_valid: Number(s.jumlah_giliran_valid || 0),
      durasi_aktif_detik: Number(s.durasi_aktif_detik || 0),
      waktu_mulai: String(s.waktu_mulai || ""),
      waktu_selesai: s.waktu_selesai ? String(s.waktu_selesai) : null,
      scenario: {
        id: String(scen.id || s.id_skenario || ""),
        kode_skenario: String(scen.kode_skenario || ""),
        versi: String(scen.versi || "0.1"),
        judul: String(scen.judul || "Skenario Simulasi KIE"),
        jenis: String(scen.jenis || "swamedikasi"),
        nama_pasien: namaPasien,
        patient_meta: metaParts.join(" · "),
        memuat_ddi: Boolean(scen.memuat_ddi),
      },
      rapor: raporMap.get(sid) || null,
    };
  });

  const completed = items.filter((it) => it.status_evaluasi !== "berjalan");
  const scores = completed
    .map((it) => it.rapor?.nilai_resmi_akhir ?? it.rapor?.nilai_gabungan_sistem_tampil)
    .filter((v): v is number => typeof v === "number");
  const ddiScores = completed
    .map((it) => it.rapor?.skor_penanganan_ddi)
    .filter((v): v is number => typeof v === "number");
  const durations = completed.map((it) => it.durasi_aktif_detik).filter((d) => d > 0);

  return {
    summary: {
      total_sessions: completed.length,
      total_all: items.length,
      mandiri_count: completed.filter((it) => it.mode === "mandiri").length,
      praktikum_count: completed.filter((it) => it.mode === "praktikum").length,
      avg_official_score:
        scores.length > 0
          ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
          : null,
      avg_ddi_detection:
        ddiScores.length > 0
          ? Number((ddiScores.reduce((a, b) => a + b, 0) / ddiScores.length).toFixed(1))
          : completed.length > 0
            ? Number(
                (
                  (completed.filter((it) => it.semua_pemicu_tergali).length / completed.length) *
                  100
                ).toFixed(1),
              )
            : null,
      avg_duration_sec:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
    },
    items,
  };
}

export async function fetchStudentHistoryApi(
  idMahasiswa: string,
): Promise<StudentHistoryResponse> {
  try {
    const res = await fetch(
      `${API_BASE}/api/evaluation/history?id_mahasiswa=${encodeURIComponent(idMahasiswa)}`,
    );
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback langsung ke Supabase jika backend sedang tidak terjangkau
  }
  return fetchStudentHistoryFromSupabase(idMahasiswa);
}
