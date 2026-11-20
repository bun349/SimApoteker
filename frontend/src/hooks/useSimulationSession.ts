import { useCallback, useEffect, useRef, useState } from "react";
import { sendSimulationTurnApi, startSimulationApi, type TurnHistoryPayload } from "@/api/simulation";
import type { Msg } from "@/components/simulation/session/TranscriptPanel";
import type { CaseMode } from "@/types/simulation";
import type { EvaluationStatusEnum, PatientPersonaContext } from "@/types/session";

export function formatMmSs(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

interface UseSimulationSessionParams {
  skenarioId: string;
  mode: CaseMode;
  idMahasiswa: string;
  studentName?: string;
}

export function useSimulationSession({
  skenarioId,
  mode,
  idMahasiswa,
  studentName = "Mahasiswa",
}: UseSimulationSessionParams) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [evaluationStatus, setEvaluationStatus] = useState<EvaluationStatusEnum>("berjalan");
  const [personaContext, setPersonaContext] = useState<PatientPersonaContext | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [studentTurnCount, setStudentTurnCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isStarting, setIsStarting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);

  // Timer sesi berjalan selama status "berjalan"
  useEffect(() => {
    if (!sessionId || evaluationStatus !== "berjalan") return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionId, evaluationStatus]);

  // Mulai sesi otomatis saat halaman dibuka
  useEffect(() => {
    if (!skenarioId || !idMahasiswa || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      setIsStarting(true);
      setError(null);
      try {
        const started = await startSimulationApi({
          skenarioId,
          mode,
          idMahasiswa,
          waktuMulaiDetik: 0,
        });
        if (cancelled) return;

        setSessionId(started.sessionId);
        setEvaluationStatus(started.evaluationStatus);
        setPersonaContext(started.personaContext);
        setElapsedSec(0);
        setStudentTurnCount(0);

        const patientLabel = `Pasien (${started.personaContext.patient.nama})`;
        setMessages([
          {
            id: started.openingTurnId,
            from: "pasien",
            name: patientLabel,
            time: formatMmSs(0),
            text: started.openingText,
          },
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal memulai sesi.");
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [skenarioId, mode, idMahasiswa]);

  const sendMessage = useCallback(
    async (rawText: string, options?: { waktuMulaiDetik?: number; statusAsrValid?: boolean }) => {
      const cleanText = rawText.trim();
      if (!cleanText || !sessionId || isSending) return;

      setIsSending(true);
      setError(null);

      const turnSec = options?.waktuMulaiDetik ?? elapsedSec;
      const patientLabel = `Pasien (${personaContext?.patient.nama ?? "Pasien"})`;
      const studentLabel = `Anda (${studentName})`;
      const tempStudentId = `tmp-mhs-${Date.now()}`;

      const optimisticStudentMsg: Msg = {
        id: tempStudentId,
        from: "anda",
        name: studentLabel,
        time: formatMmSs(turnSec),
        text: cleanText,
      };

      // Riwayat dikirim sebagai fallback konteks; sumber urutan utama tetap di transkrip_dialog backend
      const historyPayload: TurnHistoryPayload[] = messages.map((m) => ({
        role: m.from === "anda" ? "student" : "patient",
        text: m.text,
      }));

      setMessages((prev) => [...prev, optimisticStudentMsg]);

      try {
        const res = await sendSimulationTurnApi({
          sessionId,
          skenarioId,
          mode,
          studentMessage: cleanText,
          waktuMulaiDetik: turnSec,
          statusAsrValid: options?.statusAsrValid ?? true,
          history: historyPayload,
        });

        setEvaluationStatus(res.evaluationStatus);
        setStudentTurnCount(res.studentTurnCount);

        const patientReplyMsg: Msg = {
          id: res.turnId,
          from: "pasien",
          name: patientLabel,
          time: formatMmSs(elapsedSec),
          text: res.replyText,
        };

        setMessages((prev) => [
          ...prev.map((m) => (m.id === tempStudentId ? { ...m, id: res.studentTurnId } : m)),
          patientReplyMsg,
        ]);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempStudentId));
        setError(err instanceof Error ? err.message : "Gagal memproses balasan pasien.");
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, isSending, elapsedSec, personaContext, studentName, messages, skenarioId, mode],
  );

  return {
    sessionId,
    evaluationStatus,
    personaContext,
    messages,
    studentTurnCount,
    elapsedSec,
    elapsedLabel: formatMmSs(elapsedSec),
    isStarting,
    isSending,
    error,
    sendMessage,
  };
}