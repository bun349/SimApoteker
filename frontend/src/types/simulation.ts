// =========================================
// 1. TIPE MENTAH (RAW) DARI SUPABASE UNTUK SKENARIO
// =========================================
export interface SkenarioRow {
  id: string;
  kode_skenario: string;
  versi: string;
  judul: string;
  jenis: string;
  mode_rilis: string[];
  profil_pasien: Record<string, any>; // Menampung JSONB profil
  kalimat_pembuka: string;
  data_klinis_khusus: Record<string, any>; // Menampung JSONB klinis
  fokus_kie: string;
}

// =========================================
// 2. TIPE DASAR SESI & MODE
// =========================================
export type CaseCategory = "SWAMEDIKASI" | "RESEP AKUT" | "RESEP KRONIS";
export type SessionMode = "Praktikum" | "Mandiri";
export type EvaluationStatus = "pending_review" | "reviewed" | "graded";
export type CaseMode = "praktikum" | "mandiri";

// =========================================
// 3. TIPE ENTITAS MAHASISWA & DASHBOARD
// =========================================
export interface Student {
  id: string;
  name: string;
  nim: string;
  avatarUrl?: string;
  role: string;
  academicYear: string;
  block: string;
  supervisor: string;
  totalSessions: number;
  avgPact: number;
  activeMode: "practicum" | "self";
  mandatoryTasks: number;
  nearestDeadline: string; // ISO
  selfBankCount: number;
}

export interface DashboardData {
  student: Student;
  cases: PatientCase[];
  history: SimulationHistory[];
  historyTotal: number;
}

// =========================================
// 4. TIPE KASUS (PATIENT CASE & DETAIL)
// =========================================
export interface PatientCase {
  id: string; // ID Skenario
  tugasId?: string; // ID dari tabel tugas_praktikum (jika mode praktikum)
  category: string;
  modes: CaseMode[];
  estimatedMinutes?: string;
  patientName: string;
  patientMeta: string;
  photoUrl?: string;
  diagnosis: string;
  focus: string;
  deadline?: string; // Opsional, kasus mandiri tidak punya deadline
}

export interface CaseDetail extends PatientCase {
  title: string;
  shortName: string;
  ageLabel: string; // Berisi kategori_usia (misal: "Dewasa", "Lansia")
  gender: string;
  instruction: string;
  openingLine: string;
  avatarCode: string;
  caseLabel?: string;
  patientSummary?: string;
  settingBadge?: string;

  // Atribut Resep Akut / Swamedikasi (Opsional)
  refillStatus?: string;
  prescription?: Prescription;

  // Atribut Resep Kronis (Opsional)
  visitStatus?: string;
  clinicUnit?: string;
  refillBadge?: string;
  chronicRx?: ChronicPrescription;
}

// =========================================
// 5. TIPE RIWAYAT (HISTORY)
// =========================================
export interface SimulationHistory {
  id: string; // ID sesi riwayat ujian
  skenarioId: string; // Untuk link balik ke skenario
  title: string;
  category: string;
  patient: string;
  mode: SessionMode;
  takenAt: string;
  status: EvaluationStatus;
  score: number;
  scoreLabel: string;
}

// =========================================
// 6. TIPE RESEP AKUT (PRESCRIPTION)
// =========================================
export interface PrescriptionItem {
  drug: string;
  qty: string;   // contoh: "XV"
  signa: string; // contoh: "S 3 dd tab I d.c"
}

export interface Prescription {
  clinic: string;
  address: string;
  doctor: string;
  sip: string;
  room: string;
  date: string;
  items: PrescriptionItem[];
  patientName: string;
  patientAddress: string;
}

// =========================================
// 7. TIPE RESEP KRONIS (CHRONIC PRESCRIPTION)
// =========================================
export interface ChronicRxItem {
  drug: string;
  qty: string;
  signa: string;
}

export interface ChronicPrescription {
  facility: string;
  address: string;
  doctor: string;
  rxNumber: string;
  date: string;
  items: ChronicRxItem[];
  patientLine: string;
  addressLine: string;
  stamp: string;
}

// =========================================
// 8. TIPE PENYELESAIAN SESI (FINISH & FORCE FINISH)
// =========================================
export type SessionEvaluationEnum =
  | "berjalan"
  | "selesai_otomatis"
  | "perlu_ditinjau_dosen"
  | "selesai_ditinjau"
  | "tidak_cukup_data"
  | "tidak_dapat_dinilai";

export interface FinishChecklistItem {
  key: string;
  label: string;
  satisfied: boolean;
}

export interface SimulationFinishPayload {
  session_id: string;
  skenario_id: string;
  durasi_detik: number;
  mode?: CaseMode;
  force_finish?: boolean;
  discard_on_force_finish?: boolean;
}

export interface SimulationFinishResult {
  session_id: string;
  can_finish: boolean;
  status_evaluasi: SessionEvaluationEnum | string;
  all_triggers_covered: boolean;
  follow_up_plan_delivered: boolean;
  missing_items: string[];
  checklist: FinishChecklistItem[];
  farewell_message: string | null;
  finished_at: string | null;
}