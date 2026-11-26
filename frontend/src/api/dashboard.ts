import { supabase } from "@/lib/supabase";
import { fetchStudentHistoryApi } from "@/api/evaluation";
import type {
  CaseCategory,
  DashboardData,
  EvaluationStatus,
  PatientCase,
  SimulationHistory,
  Student,
} from "@/types/simulation";

interface ScenarioRow {
  id: string;
  kode_skenario?: string | null;
  versi?: string | null;
  judul?: string | null;
  jenis?: string | null;
  mode_rilis?: string[] | null;
  profil_pasien?: Record<string, unknown> | null;
  fokus_kie?: string | null;
  instruksi_tugas?: string | null;
  data_klinis_khusus?: Record<string, unknown> | null;
}

interface TugasPraktikumRow {
  id: string;
  id_kelas?: string | null;
  deadline?: string | null;
  status?: string | null;
  skenario?: ScenarioRow | ScenarioRow[] | null;
}

const PRACTICUM_COMPLETED_STATUSES = [
  "selesai_otomatis",
  "perlu_ditinjau_dosen",
  "selesai_ditinjau",
] as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const cleanStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function normalizeCategory(jenis: unknown): CaseCategory {
  const low = cleanStr(jenis).toLowerCase();
  if (low === "resep_akut" || low === "resep akut") return "RESEP AKUT";
  if (low === "resep_kronis" || low === "resep kronis") return "RESEP KRONIS";
  return "SWAMEDIKASI";
}

function extractNama(p: Record<string, unknown> | null | undefined): string {
  if (!isObj(p)) return "Pasien";
  return cleanStr(p.nama_pasien) || cleanStr(p.nama) || "Pasien";
}

function extractMeta(p: Record<string, unknown> | null | undefined): string {
  if (!isObj(p)) return "Pasien";
  const peran = cleanStr(p.peran_komunikasi) || cleanStr(p.peran);
  const kategoriUsia = cleanStr(p.kategori_usia);
  const jenisKelamin = cleanStr(p.jenis_kelamin);
  const parts = [peran, kategoriUsia, jenisKelamin].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Pasien";
}

function extractKasus(s: ScenarioRow): string {
  const judul = cleanStr(s.judul);
  if (judul) return judul;

  const klinis = isObj(s.data_klinis_khusus) ? s.data_klinis_khusus : {};
  const swa = isObj(klinis.swamedikasi) ? klinis.swamedikasi : {};
  const akut = isObj(klinis.resep_akut) ? klinis.resep_akut : {};
  const kronis = isObj(klinis.resep_kronis) ? klinis.resep_kronis : {};

  return (
    cleanStr(akut.diagnosis) ||
    cleanStr(kronis.diagnosis) ||
    cleanStr(swa.jenis_keluhan) ||
    cleanStr(klinis.keluhan_utama) ||
    cleanStr(klinis.diagnosis_utama) ||
    cleanStr(s.fokus_kie) ||
    cleanStr(s.instruksi_tugas) ||
    "Kasus KIE Praktikum"
  );
}

export async function fetchDashboard(): Promise<DashboardData> {
  // 1. Autentikasi Pengguna
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Belum login atau sesi telah berakhir.");
  }

  // 2. Ambil Profil Mahasiswa dari tabel pengguna + join tabel kelas
  const { data: profil, error: profilErr } = await supabase
    .from("pengguna")
    .select(`
      id,
      nama_lengkap,
      nomor_induk,
      id_kelas,
      kelas!pengguna_id_kelas_fkey (id, nama_kelas, kode_kelas, id_dosen)
    `)
    .eq("auth_user_id", user.id)
    .single();

  if (profilErr || !profil) {
    throw new Error("Gagal mengambil data profil mahasiswa.");
  }

  const kls = Array.isArray(profil.kelas) ? profil.kelas[0] : profil.kelas;
  const namaKelas = kls?.nama_kelas || "Belum Terdaftar di Kelas";

  // Ambil nama dosen pengampu kelas secara dinamis dari tabel pengguna
  let supervisorName = "Dosen Pengampu";
  if (kls?.id_dosen) {
    const { data: dosenRow } = await supabase
      .from("pengguna")
      .select("nama_lengkap")
      .eq("id", kls.id_dosen)
      .maybeSingle();
    if (dosenRow?.nama_lengkap) {
      supervisorName = dosenRow.nama_lengkap;
    }
  }

  // 3. Ambil Katalog Latihan Mandiri (skenario diterbitkan & ber-tag mandiri, terbaru lebih dulu)
  const { data: mandiriRaw, error: mandiriErr } = await supabase
    .from("skenario_praktikum")
    .select(
      "id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, instruksi_tugas, data_klinis_khusus, created_at",
    )
    .eq("status_rilis", "diterbitkan")
    .contains("mode_rilis", ["mandiri"])
    .order("created_at", { ascending: false });

  if (mandiriErr) throw mandiriErr;

  // 4. Ambil Tugas Praktikum aktif untuk kelas mahasiswa ini
  let tugasQuery = supabase
    .from("tugas_praktikum")
    .select(`
      id,
      id_kelas,
      deadline,
      status,
      skenario:skenario_praktikum (
        id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, instruksi_tugas, data_klinis_khusus
      )
    `)
    .eq("status", "Aktif")
    .order("deadline", { ascending: true });

  if (profil.id_kelas) {
    tugasQuery = tugasQuery.eq("id_kelas", profil.id_kelas);
  }

  const { data: tugasRaw, error: tugasErr } = await tugasQuery;
  if (tugasErr) throw tugasErr;

  // 5. Ambil status selesai praktikum dari sesi_simulasi (langsung Supabase)
  const { data: completedPracticumRaw, error: completedPracticumErr } = await supabase
    .from("sesi_simulasi")
    .select("id_skenario, status_evaluasi")
    .eq("id_mahasiswa", profil.id)
    .eq("mode", "praktikum")
    .in("status_evaluasi", [...PRACTICUM_COMPLETED_STATUSES]);

  if (completedPracticumErr) {
    console.warn("Gagal memeriksa status selesai praktikum via Supabase:", completedPracticumErr);
  }

  const completedPracticumSet = new Set<string>(
    ((completedPracticumRaw as Array<{ id_skenario?: string | null }> | null) || [])
      .map((row) => row.id_skenario)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  // 6. Ambil Riwayat Sesi & Ringkasan Nilai (Backend API + fallback otomatis Supabase)
  let history: SimulationHistory[] = [];
  let historyTotal = 0;
  let totalSessions = 0;
  let avgPact = 0;

  try {
    const histRes = await fetchStudentHistoryApi(profil.id);
    const finished = histRes.items.filter((it) => it.status_evaluasi !== "berjalan");

    // Gabungkan juga status selesai praktikum dari hasil history agar kebal kendala RLS
    for (const it of finished) {
      if (
        it.mode === "praktikum" &&
        (PRACTICUM_COMPLETED_STATUSES as readonly string[]).includes(it.status_evaluasi) &&
        it.id_skenario
      ) {
        completedPracticumSet.add(it.id_skenario);
      }
    }

    totalSessions = histRes.summary.total_sessions;
    historyTotal = finished.length;

    const komScores = finished
      .map((it) => it.rapor?.skor_komunikasi_tampil)
      .filter((v): v is number => typeof v === "number");
    if (komScores.length > 0) {
      avgPact = Number((komScores.reduce((a, b) => a + b, 0) / komScores.length).toFixed(1));
    } else if (typeof histRes.summary.avg_official_score === "number") {
      avgPact = histRes.summary.avg_official_score;
    }

    const mapStatus = (s: string, penanda: string[]): EvaluationStatus => {
      if (s === "perlu_ditinjau_dosen") return "pending_review";
      if (
        s === "selesai_ditinjau" ||
        (s === "selesai_otomatis" && !penanda.includes("ada_penilaian_terlewat"))
      ) {
        return "reviewed";
      }
      return "graded";
    };

    history = finished.slice(0, 5).map((it) => {
      const score = it.rapor?.nilai_resmi_akhir ?? it.rapor?.nilai_gabungan_sistem_tampil ?? 0;
      return {
        id: it.id,
        skenarioId: it.id_skenario,
        title: it.scenario.judul,
        category: normalizeCategory(it.scenario.jenis),
        patient: it.scenario.nama_pasien,
        mode: it.mode === "praktikum" ? "Praktikum" : "Mandiri",
        takenAt: it.waktu_selesai || it.waktu_mulai,
        status: mapStatus(it.status_evaluasi, it.penanda_khusus || []),
        score,
        scoreLabel:
          score >= 85
            ? "Sangat Baik"
            : score >= 70
              ? "Kompeten"
              : score > 0
                ? "Perlu Perbaikan"
                : "Menunggu Evaluasi",
      };
    });
  } catch (err) {
    console.warn("Riwayat dasbor gagal dimuat:", err);
  }

  // Mapping kartu kasus Mandiri & Praktikum
  const casesMandiri: PatientCase[] = ((mandiriRaw as ScenarioRow[] | null) || []).map((r) => {
    const kasusText = extractKasus(r);
    return {
      id: r.id,
      category: normalizeCategory(r.jenis),
      modes: ["mandiri"],
      estimatedMinutes: "~10 - 15 Menit",
      patientName: extractNama(r.profil_pasien),
      patientMeta: extractMeta(r.profil_pasien),
      diagnosis: kasusText,
      focus: cleanStr(r.fokus_kie) || cleanStr(r.instruksi_tugas) || "Latihan KIE Mandiri",
    };
  });

  const casesPraktikum: PatientCase[] = ((tugasRaw as TugasPraktikumRow[] | null) || [])
    .map((t) => {
      const s = Array.isArray(t.skenario) ? t.skenario[0] : t.skenario;
      if (!s?.id) return null;
      const kasusText = extractKasus(s);
      return {
        id: s.id,
        tugasId: t.id,
        category: normalizeCategory(s.jenis),
        modes: ["praktikum"],
        estimatedMinutes: "~15 - 20 Menit",
        patientName: extractNama(s.profil_pasien),
        patientMeta: extractMeta(s.profil_pasien),
        diagnosis: kasusText,
        focus: cleanStr(s.fokus_kie) || cleanStr(s.instruksi_tugas) || "Ujian Praktikum KIE",
        deadline: t.deadline ?? undefined,
        isPracticumCompleted: completedPracticumSet.has(s.id),
      } as PatientCase;
    })
    .filter((item): item is PatientCase => item !== null);

  const allCases = [...casesPraktikum, ...casesMandiri];

  const sortedDeadlines = casesPraktikum
    .filter((c) => !c.isPracticumCompleted)
    .map((c) => (c.deadline ? new Date(c.deadline).getTime() : NaN))
    .filter((ts) => Number.isFinite(ts))
    .sort((a, b) => a - b);

  const nearestDeadline =
    sortedDeadlines.length > 0 ? new Date(sortedDeadlines[0]).toISOString() : "";

  const student: Student = {
    id: profil.id,
    name: profil.nama_lengkap,
    nim: profil.nomor_induk,
    role: "Mahasiswa / Praktikan",
    academicYear: "2026/2027",
    block: namaKelas,
    supervisor: supervisorName,
    totalSessions,
    avgPact,
    activeMode: casesPraktikum.length > 0 ? "practicum" : "self",
    mandatoryTasks: casesPraktikum.length,
    nearestDeadline,
    selfBankCount: casesMandiri.length,
  };

  return {
    student,
    cases: allCases,
    history,
    historyTotal,
    completedPracticumIds: Array.from(completedPracticumSet),
  };
}
