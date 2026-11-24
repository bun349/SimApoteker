import type { CaseMode } from "@/types/simulation";
import type { EvaluationStatusEnum, PatientPersonaContext } from "@/types/session";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";

export interface TurnHistoryPayload {
  role: "student" | "patient";
  text: string;
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