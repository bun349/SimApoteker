import { supabase } from "@/lib/supabase";
import type { DashboardData, Student, PatientCase, SimulationHistory } from "@/types/simulation";

export async function fetchDashboard(): Promise<DashboardData> {
  // 1. Autentikasi Pengguna
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Belum login atau sesi telah berakhir.");

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

  if (profilErr) throw new Error("Gagal mengambil data profil mahasiswa.");

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

  // 4. Ambil Tugas Praktikum (Filter per kelas di-handle otomatis oleh RLS Database!)
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
  
  // Fungsi utilitas untuk mem-parsing JSONB profil pasien
  const extractNama = (p: any) => p?.nama_pasien || "Pasien Anonim";
  const extractMeta = (p: any) => {
    if (!p) return "Tidak ada data demografi";
    const usia = p.usia ? `${p.usia} th` : "";
    const peran = p.peran_komunikasi || p.pekerjaan || "";
    return [usia, peran].filter(Boolean).join(" • ");
  };
  const extractDiagnosis = (k: any) => k?.diagnosis_utama || k?.keluhan_utama || "Tidak ada data diagnosis";

  // Konversi data Latihan Mandiri
  const casesMandiri: PatientCase[] = (mandiriRaw || []).map((r: any) => ({
    id: r.id,
    category: r.jenis,
    modes: ["mandiri"],
    estimatedMinutes: "~10 - 15 Menit",
    patientName: extractNama(r.profil_pasien),
    patientMeta: extractMeta(r.profil_pasien),
    diagnosis: extractDiagnosis(r.data_klinis_khusus),
    focus: r.fokus_kie || "Latihan KIE Mandiri",
  }));

  // Konversi data Tugas Praktikum
  const casesPraktikum: PatientCase[] = (tugasRaw || []).map((t: any) => {
    // Tangani kemungkinan format join array/object dari Supabase
    const s = Array.isArray(t.skenario) ? t.skenario[0] : t.skenario; 
    return {
      id: s.id,               // ID master skenario (untuk memuat detail kasus nanti)
      tugasId: t.id,          // ID dari tabel tugas_praktikum (untuk submit nilai)
      category: s.jenis,
      modes: ["praktikum"],
      estimatedMinutes: "~15 - 20 Menit",
      patientName: extractNama(s.profil_pasien),
      patientMeta: extractMeta(s.profil_pasien),
      diagnosis: extractDiagnosis(s.data_klinis_khusus),
      focus: s.fokus_kie || "Ujian Praktikum KIE",
      deadline: t.deadline,
    };
  });

  // Gabungkan seluruh kasus untuk dirender di Dasbor
  const allCases = [...casesPraktikum, ...casesMandiri];

  // Hitung deadline terdekat untuk banner UI
  const sortedDeadlines = casesPraktikum
    .map(c => new Date(c.deadline!).getTime())
    .sort((a, b) => a - b);
  const nearestDeadline = sortedDeadlines.length > 0 ? new Date(sortedDeadlines[0]).toISOString() : "";

  // Bentuk objek Profil Mahasiswa
  const student: Student = {
    id: profil.id,
    name: profil.nama_lengkap,
    nim: profil.nomor_induk,
    role: "Mahasiswa / Praktikan",
    academicYear: "2026/2027", 
    block: namaKelas, // Nama kelas asli dari database
    supervisor: "Dosen Pengampu", 
    totalSessions: 0, // Akan dihitung dari tabel riwayat nanti
    avgPact: 0,
    activeMode: casesPraktikum.length > 0 ? "practicum" : "self",
    mandatoryTasks: casesPraktikum.length,
    nearestDeadline: nearestDeadline,
    selfBankCount: casesMandiri.length,
  };

  // KOSONGKAN DULU history sampai tabel Riwayat Ujian kita buat
  const history: SimulationHistory[] = [];

  return {
    student,
    cases: allCases,
    history,
    historyTotal: history.length,
  };
}