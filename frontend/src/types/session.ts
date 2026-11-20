import type { CaseMode } from "@/types/simulation";

export type EvaluationStatusEnum =
  | "berjalan"
  | "selesai otomatis"
  | "perlu ditinjau dosen"
  | "selesai ditinjau"
  | "tidak cukup data"
  | "tidak dapat dinilai";

export type JenisSkenario = "swamedikasi" | "resep_akut" | "resep_kronis";

export type TurnSpeaker = "student" | "patient";

export interface KeyInfoTrigger {
  kode: string;
  hal: string;
  mode: string;
}

export interface CueOrProbeTrigger {
  kode: string;
  jenisAtauSifat: string;
  kapan: string;
  kalimat: string;
}

export interface GlossaryEntry {
  istilah: string;
  padanan: string;
}

export interface PatientPersonaContext {
  skenarioId: string;
  kodeSkenario: string;
  versi: string;
  jenis: JenisSkenario;
  judul: string;
  openingLine: string;
  patient: {
    nama: string;
    kategoriUsia: string;
    jenisKelamin: string;
    peranKomunikasi?: string;
    gayaBicara?: string;
    literasi?: string;
    kategoriKhusus?: string[];
    riwayatAlergi?: string;
    obatLainSuplemen?: string[];
    kondisiPenyerta?: string;
  };
  briefSummary?: {
    statusResep?: string;
    unitLayanan?: string;
    obat?: string[];
    signa?: string[];
    jumlah?: string[];
  };
  patientFacts?: Record<string, string>;
  keyInfoTriggers?: KeyInfoTrigger[];
  cueTriggers?: CueOrProbeTrigger[];
  probeTriggers?: CueOrProbeTrigger[];
  glossary?: GlossaryEntry[];
}

export interface SimulationTurn {
  id: string;
  turnIndex: number;
  speaker: TurnSpeaker;
  text: string;
  createdAt: string; // ISO timestamp
  inputMethod?: "voice" | "text";
  audioDurationMs?: number;
}

export interface SimulationSessionState {
  sessionId: string | null;
  sessionCode: string | null;
  studentId: string;
  skenarioId: string;
  mode: CaseMode;
  evaluationStatus: EvaluationStatusEnum;
  startedAt: string | null;
  endedAt: string | null;
  studentTurnCount: number;
  validTurnCount: number;
  audioValidPercent?: number;
  validVocalSegments?: number;
  allTriggersDug?: boolean;
  turns: SimulationTurn[];
  /** Hanya konteks aman untuk peran pasien virtual; tanpa rubrik/kunci/penalti */
  personaContext: PatientPersonaContext | null;
  isSendingTurn: boolean;
  isFinishing: boolean;
  error: string | null;
}