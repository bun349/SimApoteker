import type { CaseMode } from "@/types/simulation";
import type { EvaluationStatusEnum, PatientPersonaContext } from "@/types/session";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";

export interface TurnHistoryPayload {
  role: "student" | "patient";
  text: string;
}

export interface ResumedTranscriptItem {
  id?: string | null;
  urutan_global?: number | null;
  kode_giliran?: string | null;
  nomor_giliran_pembicara?: number | null;
  pembicara: string;
  waktu_mulai_detik?: number;
  teks: string;
}

export interface StartSimulationApiResponse {
  sessionId: string;
  skenarioId: string;
  mode: CaseMode;
  evaluationStatus: EvaluationStatusEnum;
  openingTurnId: string;
  openingKodeGiliran: string;
  openingText: string;
  personaContext: PatientPersonaContext;
  createdAt: string;
  isResumed?: boolean;
  durasiAktifDetik?: number;
  transcript?: ResumedTranscriptItem[];
}

export interface SendTurnApiResponse {
  sessionId: string;
  evaluationStatus: EvaluationStatusEnum;
  studentTurnId: string;
  studentKodeGiliran: string;
  turnId: string;
  patientKodeGiliran: string;
  replyText: string;
  studentTurnCount: number;
  createdAt: string;
}

export interface FinishChecklistItem {
  key: string;
  label: string;
  satisfied: boolean;
}

export interface FinishSimulationApiResponse {
  sessionId: string;
  canFinish: boolean;
  evaluationStatus: EvaluationStatusEnum;
  allTriggersCovered: boolean;
  followUpPlanDelivered: boolean;
  missingItems: string[];
  checklist: FinishChecklistItem[];
  farewellMessage: string | null;
  finishedAt: string | null;
  discarded?: boolean;
}

export async function startSimulationApi(params: {
  skenarioId: string;
  mode: CaseMode;
  idMahasiswa: string;
  waktuMulaiDetik?: number;
}): Promise<StartSimulationApiResponse> {
  const res = await fetch(`${API_BASE}/api/simulation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skenario_id: params.skenarioId,
      mode: params.mode,
      id_mahasiswa: params.idMahasiswa,
      waktu_mulai_detik: params.waktuMulaiDetik ?? 0,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal memulai sesi simulasi.");
  }

  const data = await res.json();
  return {
    sessionId: data.session_id,
    skenarioId: data.skenario_id,
    mode: data.mode,
    evaluationStatus: data.status_evaluasi,
    openingTurnId: data.opening_turn_id,
    openingKodeGiliran: data.opening_kode_giliran ?? "PSN-01",
    openingText: data.opening_text,
    personaContext: data.persona_context,
    createdAt: data.created_at,
    isResumed: Boolean(data.is_resumed ?? data.isResumed ?? false),
    durasiAktifDetik:
      typeof data.durasi_aktif_detik === "number"
        ? data.durasi_aktif_detik
        : typeof data.durasiAktifDetik === "number"
          ? data.durasiAktifDetik
          : 0,
    transcript: Array.isArray(data.transcript) ? data.transcript : [],
  };
}

export async function sendSimulationTurnApi(params: {
  sessionId: string;
  skenarioId: string;
  mode: CaseMode;
  studentMessage: string;
  waktuMulaiDetik: number;
  statusAsrValid?: boolean;
  history: TurnHistoryPayload[];
}): Promise<SendTurnApiResponse> {
  const res = await fetch(`${API_BASE}/api/simulation/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.sessionId,
      skenario_id: params.skenarioId,
      mode: params.mode,
      student_message: params.studentMessage,
      waktu_mulai_detik: params.waktuMulaiDetik,
      status_asr_valid: params.statusAsrValid ?? true,
      history: params.history,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal mengirim giliran percakapan.");
  }

  const data = await res.json();
  return {
    sessionId: data.session_id,
    evaluationStatus: data.status_evaluasi,
    studentTurnId: data.student_turn_id,
    studentKodeGiliran: data.student_kode_giliran ?? "MHS",
    turnId: data.turn_id,
    patientKodeGiliran: data.patient_kode_giliran ?? "PSN",
    replyText: data.reply_text,
    studentTurnCount: data.student_turn_count,
    createdAt: data.created_at,
  };
}

export async function pauseSimulationDurationApi(params: {
  sessionId: string;
  durasiDetik: number;
  keepalive?: boolean;
}): Promise<{ synced: boolean; durasiAktifDetik?: number }> {
  const res = await fetch(
    `${API_BASE}/api/simulation/${encodeURIComponent(params.sessionId)}/pause`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durasi_detik: Math.max(0, Math.floor(params.durasiDetik)) }),
      keepalive: params.keepalive ?? false,
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal menyinkronkan durasi sesi.");
  }

  const data = await res.json().catch(() => ({}));
  return {
    synced: Boolean(data?.synced ?? true),
    durasiAktifDetik:
      typeof data?.durasi_aktif_detik === "number" ? data.durasi_aktif_detik : undefined,
  };
}

export async function finishSimulationApi(params: {
  sessionId: string;
  skenarioId: string;
  mode: CaseMode;
  durasiDetik: number;
  forceFinish?: boolean;
  discardOnForceFinish?: boolean;
}): Promise<FinishSimulationApiResponse> {
  const res = await fetch(`${API_BASE}/api/simulation/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: params.sessionId,
      skenario_id: params.skenarioId,
      mode: params.mode,
      durasi_detik: params.durasiDetik,
      force_finish: params.forceFinish ?? false,
      discard_on_force_finish: params.discardOnForceFinish ?? false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal menyelesaikan sesi simulasi.");
  }

  const data = await res.json();
  return {
    sessionId: data.session_id,
    canFinish: Boolean(data.can_finish),
    evaluationStatus: data.status_evaluasi,
    allTriggersCovered: Boolean(data.all_triggers_covered),
    followUpPlanDelivered: Boolean(data.follow_up_plan_delivered),
    missingItems: Array.isArray(data.missing_items) ? data.missing_items : [],
    checklist: Array.isArray(data.checklist) ? data.checklist : [],
    farewellMessage: typeof data.farewell_message === "string" ? data.farewell_message : null,
    finishedAt: typeof data.finished_at === "string" ? data.finished_at : null,
    discarded: Boolean(data.discarded),
  };
}

export interface SaveDocumentationPayload {
  nama_pasien: string;
  usia_pasien: string;
  jenis_kelamin: string;
  nama_dokter: string;
  keluhan_diagnosa: string;
  riwayat_alergi: string;
  obat_lain_penyerta: string;
  nama_obat_dosis: string;
  instruksi_khusus: string;
  edukasi_tindak_lanjut: string;
  durasi_pengisian_detik: number;
  waktu_habis: boolean;
}

export async function saveSimulationDocumentationApi(
  sessionId: string,
  payload: SaveDocumentationPayload,
): Promise<{ id: string; sessionId: string; saved: boolean }> {
  const res = await fetch(
    `${API_BASE}/api/simulation/${encodeURIComponent(sessionId)}/documentation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Gagal menyimpan dokumentasi kefarmasian.");
  }

  const data = await res.json();
  return {
    id: data.id,
    sessionId: data.session_id,
    saved: Boolean(data.saved),
  };
}