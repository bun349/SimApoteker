import { supabase } from "@/lib/supabase";
import type { DashboardData, Student, PatientCase, SimulationHistory } from "@/types/simulation";

interface ScenarioRow {
  id: string;
  kode_skenario?: string | null;
  versi?: string | null;
  judul?: string | null;
  jenis: PatientCase["category"];
  mode_rilis?: string[] | null;
  profil_pasien?: Record<string, unknown> | null;
  fokus_kie?: string | null;
  data_klinis_khusus?: Record<string, unknown> | null;
}

interface TugasPraktikumRow {
  id: string;
  deadline?: string | null;
  status?: string | null;
  skenario?: ScenarioRow | ScenarioRow[] | null;
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

  // 2. Ambil Profil Mahasiswa dari tabel pengguna dan join ke tabel kelas
  const { data: profil, error: profilErr } = await supabase
    .from("pengguna")
    .select(`
      id,
      nama_lengkap,
      nomor_induk,
      id_kelas,
      kelas!pengguna_id_kelas_fkey (nama_kelas, id_dosen)
    `)
    .eq("auth_user_id", user.id)
    .single();

  if (profilErr || !profil) {
    throw new Error("Gagal mengambil data profil mahasiswa.");
  }

  const kls = Array.isArray(profil.kelas) ? profil.kelas[0] : profil.kelas;
  const namaKelas = kls?.nama_kelas || "Belum Terdaftar di Kelas";

  // 3. Ambil Katalog Latihan Mandiri (Skenario yang rilis & ber-tag mandiri)
  const { data: mandiriRaw, error: mandiriErr } = await supabase
    .from("skenario_praktikum")
    .select("id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, data_klinis_khusus")
    .eq("status_rilis", "diterbitkan")
    .not("frozen_at", "is", null)
    .contains("mode_rilis", ["mandiri"]);

  if (mandiriErr) throw mandiriErr;

  // 4. Ambil Tugas Praktikum (Filter per kelas di-handle otomatis oleh RLS Database)
  const { data: tugasRaw, error: tugasErr } = await supabase
    .from("tugas_praktikum")
    .select(`
      id,
      deadline,
      status,
      skenario:skenario_praktikum (
        id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, data_klinis_khusus
      )
    `)
    .eq("status", "Aktif");

  if (tugasErr) throw tugasErr;

  // ==========================================
  // MAPPING JSONB DATABASE -> TIPE UI FRONTEND
  // ==========================================

  const extractNama = (p: Record<string, unknown> | null | undefined) => {
    const nama = typeof p?.nama_pasien === "string" ? p.nama_pasien.trim() : "";
    return nama || "Pasien Anonim";
  };

  // Tanpa usia dan pekerjaan sesuai permintaan
  const extractMeta = (p: Record<string, unknown> | null | undefined) => {
    if (!p) return "Pasien / Pendamping";
    const peran = typeof p.peran_komunikasi === "string" ? p.peran_komunikasi.trim() : "";
    const kategoriUsia = typeof p.kategori_usia === "string" ? p.kategori_usia.trim() : "";
    const meta = [peran, kategoriUsia].filter(Boolean).join(" • ");
    return meta || "Pasien / Pendamping";
  };

  // Isi "kasus": judul skenario (atau fokus_kie / ringkasan keluhan di data_klinis_khusus)
  const extractKasus = (s: ScenarioRow) => {
    const judul = typeof s.judul === "string" ? s.judul.trim() : "";
    if (judul) return judul;

    const fokus = typeof s.fokus_kie === "string" ? s.fokus_kie.trim() : "";
    if (fokus) return fokus;

    const klinis = s.data_klinis_khusus || {};
    const keluhan =
      (typeof klinis.keluhan_utama === "string" && klinis.keluhan_utama.trim()) ||
      (typeof klinis.diagnosis_utama === "string" && klinis.diagnosis_utama.trim()) ||
      "";
    return keluhan || "Kasus KIE Praktikum";
  };

  const casesMandiri: PatientCase[] = ((mandiriRaw as ScenarioRow[] | null) || []).map((r) => {
    const kasusText = extractKasus(r);
    return {
      id: r.id,
      category: r.jenis,
      modes: ["mandiri"],
      estimatedMinutes: "~10 - 15 Menit",
      patientName: extractNama(r.profil_pasien),
      patientMeta: extractMeta(r.profil_pasien),
      kasus: kasusText,
      diagnosis: kasusText,
      focus: r.fokus_kie || "Latihan KIE Mandiri",
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
        category: s.jenis,
        modes: ["praktikum"],
        estimatedMinutes: "~15 - 20 Menit",
        patientName: extractNama(s.profil_pasien),
        patientMeta: extractMeta(s.profil_pasien),
        kasus: kasusText,
        diagnosis: kasusText,
        focus: s.fokus_kie || "Ujian Praktikum KIE",
        deadline: t.deadline ?? undefined,
      } as PatientCase;
    })
    .filter((item): item is PatientCase => item !== null);

  const allCases = [...casesPraktikum, ...casesMandiri];

  const sortedDeadlines = casesPraktikum
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
    supervisor: "Dosen Pengampu",
    totalSessions: 0,
    avgPact: 0,
    activeMode: casesPraktikum.length > 0 ? "practicum" : "self",
    mandatoryTasks: casesPraktikum.length,
    nearestDeadline,
    selfBankCount: casesMandiri.length,
  };

  const history: SimulationHistory[] = [];

  return {
    student,
    cases: allCases,
    history,
    historyTotal: history.length,
  };
}