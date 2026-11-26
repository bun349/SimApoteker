import { useCallback, useEffect, useRef, useState } from "react";
import {
  finishSimulationApi,
  pauseSimulationDurationApi,
  sendSimulationTurnApi,
  startSimulationApi,
  type FinishSimulationApiResponse,
  type ResumedTranscriptItem,
  type TurnHistoryPayload,
} from "@/api/simulation";
import type { Msg } from "@/components/simulation/session/TranscriptPanel";
import type { CaseMode } from "@/types/simulation";
import type { EvaluationStatusEnum, PatientPersonaContext } from "@/types/session";

export function formatMmSs(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const VALID_STATUSES: EvaluationStatusEnum[] = [
  "berjalan",
  "selesai otomatis",
  "perlu ditinjau dosen",
  "selesai ditinjau",
  "tidak cukup data",
  "tidak dapat dinilai",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function normalizeEvaluationStatus(raw?: string): EvaluationStatusEnum {
  const cleaned = raw?.trim().replace(/_/g, " ");
  if (cleaned && (VALID_STATUSES as string[]).includes(cleaned)) {
    return cleaned as EvaluationStatusEnum;
  }
  if (raw === "menunggu_evaluasi" || raw === "selesai") {
    return "selesai otomatis";
  }
  return "berjalan";
}

interface UseSimulationSessionParams {
  skenarioId: string;
  mode: CaseMode;
  idMahasiswa: string;
  studentName?: string;
  allowLocalFallback?: boolean;
}

export function useSimulationSession({
  skenarioId,
  mode,
  idMahasiswa,
  studentName = "Mahasiswa",
  allowLocalFallback = true,
}: UseSimulationSessionParams) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isPracticumBlocked, setIsPracticumBlocked] = useState(false);
  const [isResumed, setIsResumed] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [evaluationStatus, setEvaluationStatus] = useState<EvaluationStatusEnum>("berjalan");
  const [personaContext, setPersonaContext] = useState<PatientPersonaContext | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [studentTurnCount, setStudentTurnCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isStarting, setIsStarting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishResult, setFinishResult] = useState<FinishSimulationApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startedKeyRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<EvaluationStatusEnum>("berjalan");

  elapsedRef.current = elapsedSec;
  sessionIdRef.current = sessionId;
  statusRef.current = evaluationStatus;

  const syncDurationToServer = useCallback(
    async (targetSid: string | null, sec: number, useKeepalive = false) => {
      if (!targetSid || !isValidUuid(targetSid) || statusRef.current !== "berjalan") return;
      try {
        await pauseSimulationDurationApi({
          sessionId: targetSid,
          durasiDetik: sec,
          keepalive: useKeepalive,
        });
      } catch {
        // Abaikan kegagalan jaringan saat tab ditutup/unmount
      }
    },
    [],
  );

  // Pantau visibilitas tab/jendela dan sinkronkan durasi saat keluar/sembunyi
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsPageVisible(visible);
      if (!visible && isValidUuid(sessionIdRef.current) && statusRef.current === "berjalan") {
        void syncDurationToServer(sessionIdRef.current, elapsedRef.current, true);
      }
    };

    const handlePageLeave = () => {
      setIsPageVisible(false);
      if (isValidUuid(sessionIdRef.current) && statusRef.current === "berjalan") {
        void syncDurationToServer(sessionIdRef.current, elapsedRef.current, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageLeave);
    window.addEventListener("beforeunload", handlePageLeave);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageLeave);
      window.removeEventListener("beforeunload", handlePageLeave);
      if (isValidUuid(sessionIdRef.current) && statusRef.current === "berjalan") {
        void syncDurationToServer(sessionIdRef.current, elapsedRef.current, true);
      }
    };
  }, [syncDurationToServer]);

  // Timer hanya berjalan saat sesi "berjalan" dan tab/halaman sedang terlihat aktif
  useEffect(() => {
    if (!sessionId || evaluationStatus !== "berjalan" || !isPageVisible) return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionId, evaluationStatus, isPageVisible]);

  const initializeSession = useCallback(
    async (options?: { force?: boolean; currentElapsedSec?: number }) => {
      if (!skenarioId) return null;

      const startSec = Math.max(0, Math.floor(options?.currentElapsedSec ?? 0));
      setIsStarting(true);
      setIsPracticumBlocked(false);
      setError(null);
      if (options?.force) {
        setFinishResult(null);
      }

      const activateLocalTestSession = (reason?: string) => {
        if (!allowLocalFallback) {
          setError(reason || "Gagal memulai sesi.");
          setIsStarting(false);
          return null;
        }
        const localSid = `local-test-${Date.now()}`;
        setSessionId(localSid);
        setIsLocalMode(true);
        setIsResumed(false);
        setEvaluationStatus("berjalan");
        setElapsedSec(startSec);
        setStudentTurnCount(0);
        setMessages([
          {
            id: `opening-${localSid}`,
            from: "pasien",
            name: "Pasien (Mode Uji Ketik)",
            time: formatMmSs(startSec),
            text: "Halo Mbak/Mas, saya mau tanya soal keluhan dan obat saya. Silakan mulai konselingnya.",
          },
        ]);
        if (reason) {
          setError(`Mode uji ketik aktif (${reason}).`);
        }
        setIsStarting(false);
        return localSid;
      };

      if (!idMahasiswa) {
        return activateLocalTestSession("ID mahasiswa belum tersedia");
      }

      try {
        const started = await startSimulationApi({
          skenarioId,
          mode,
          idMahasiswa,
          waktuMulaiDetik: startSec,
        });

        const resumedFlag = Boolean(started.isResumed);
        const savedDuration =
          typeof started.durasiAktifDetik === "number"
            ? Math.max(0, Math.floor(started.durasiAktifDetik))
            : startSec;
        const rawTranscript: ResumedTranscriptItem[] = Array.isArray(started.transcript)
          ? started.transcript
          : [];

        const resolvedElapsed = resumedFlag ? savedDuration : startSec;
        const patientLabel = `Pasien (${started.personaContext.patient.nama})`;
        const actorLabel = `Anda (${studentName})`;

        let initialMessages: Msg[];
        let initialTurnCount = 0;

        if (resumedFlag && rawTranscript.length > 0) {
          initialMessages = rawTranscript.map((row, idx) => {
            const isStudent = row.pembicara === "mahasiswa";
            if (isStudent) initialTurnCount += 1;
            const rowSec =
              typeof row.waktu_mulai_detik === "number" ? row.waktu_mulai_detik : resolvedElapsed;
            return {
              id: row.id || `resumed-${idx}`,
              from: isStudent ? "anda" : "pasien",
              name: isStudent ? actorLabel : patientLabel,
              time: formatMmSs(rowSec),
              text: row.teks,
            };
          });
        } else {
          initialMessages = [
            {
              id: started.openingTurnId,
              from: "pasien",
              name: patientLabel,
              time: formatMmSs(resolvedElapsed),
              text: started.openingText,
            },
          ];
        }

        setSessionId(started.sessionId);
        setIsLocalMode(false);
        setIsResumed(resumedFlag);
        setEvaluationStatus(normalizeEvaluationStatus(started.evaluationStatus));
        setPersonaContext(started.personaContext);
        setElapsedSec(resolvedElapsed);
        setStudentTurnCount(initialTurnCount);
        setFinishResult(null);
        setMessages(initialMessages);
        setIsStarting(false);
        return started.sessionId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Backend /start belum merespons";
        const practicumBlocked =
          mode === "praktikum" &&
          /percobaan mode praktikum.*sudah selesai|409/i.test(message);

        if (practicumBlocked) {
          setSessionId(null);
          setIsLocalMode(false);
          setIsPracticumBlocked(true);
          setIsResumed(false);
          setMessages([]);
          setError(message);
          setIsStarting(false);
          return null;
        }

        return activateLocalTestSession(message);
      }
    },
    [skenarioId, mode, idMahasiswa, studentName, allowLocalFallback],
  );

  // Mulai atau lanjutkan sesi saat halaman dibuka atau parameter utama berubah
  useEffect(() => {
    if (!skenarioId) return;
    const initKey = `${skenarioId}::${mode}::${idMahasiswa}`;
    if (startedKeyRef.current === initKey) return;
    startedKeyRef.current = initKey;

    void initializeSession({ force: true, currentElapsedSec: 0 });
  }, [skenarioId, mode, idMahasiswa, initializeSession]);

  const retryStartSession = useCallback(async () => {
    startedKeyRef.current = `${skenarioId}::${mode}::${idMahasiswa}`;
    return initializeSession({ force: true, currentElapsedSec: 0 });
  }, [skenarioId, mode, idMahasiswa, initializeSession]);

  const sendMessage = useCallback(
    async (rawText: string, options?: { waktuMulaiDetik?: number; statusAsrValid?: boolean }) => {
      const cleanText = rawText.trim();
      if (!cleanText || isSending || isFinishing || isPracticumBlocked || evaluationStatus !== "berjalan") return;

      setIsSending(true);
      setError(null);

      const turnSec = options?.waktuMulaiDetik ?? elapsedRef.current;
      const patientLabel = `Pasien (${personaContext?.patient.nama ?? (isLocalMode ? "Mode Uji Ketik" : "Pasien")})`;
      const studentLabel = `Anda (${studentName})`;
      const tempStudentId = `tmp-mhs-${Date.now()}`;

      const optimisticStudentMsg: Msg = {
        id: tempStudentId,
        from: "anda",
        name: studentLabel,
        time: formatMmSs(turnSec),
        text: cleanText,
      };

      const historyPayload: TurnHistoryPayload[] = messages.map((m) => ({
        role: m.from === "anda" ? "student" : "patient",
        text: m.text,
      }));

      setMessages((prev) => [...prev, optimisticStudentMsg]);

      try {
        let targetSessionId = sessionId;

        if (!isValidUuid(targetSessionId) && idMahasiswa) {
          const syncedId = await initializeSession({ force: false, currentElapsedSec: turnSec });
          if (isValidUuid(syncedId)) {
            targetSessionId = syncedId;
          }
        }

        if (!isValidUuid(targetSessionId)) {
          throw new Error("Sesi belum memiliki session_id UUID valid dari server.");
        }

        const res = await sendSimulationTurnApi({
          sessionId: targetSessionId,
          skenarioId,
          mode,
          studentMessage: cleanText,
          waktuMulaiDetik: turnSec,
          statusAsrValid: options?.statusAsrValid ?? true,
          history: historyPayload,
        });

        setIsLocalMode(false);
        setEvaluationStatus(normalizeEvaluationStatus(res.evaluationStatus));
        setStudentTurnCount(res.studentTurnCount);

        // Sinkronkan durasi aktif saat giliran berhasil tersimpan
        void syncDurationToServer(targetSessionId, elapsedRef.current, false);

        const resolvedPatientLabel = `Pasien (${personaContext?.patient.nama ?? "Pasien"})`;
        const patientReplyMsg: Msg = {
          id: res.turnId,
          from: "pasien",
          name: resolvedPatientLabel,
          time: formatMmSs(elapsedRef.current),
          text: res.replyText,
        };

        setMessages((prev) => [
          ...prev.map((m) => (m.id === tempStudentId ? { ...m, id: res.studentTurnId } : m)),
          patientReplyMsg,
        ]);
      } catch (err) {
        if (allowLocalFallback) {
          const fallbackSid = sessionId ?? `local-test-${Date.now()}`;
          if (!sessionId) setSessionId(fallbackSid);
          const nextCount = studentTurnCount + 1;
          setIsLocalMode(true);
          setStudentTurnCount(nextCount);
          setMessages((prev) => [
            ...prev,
            {
              id: `local-reply-${Date.now()}`,
              from: "pasien",
              name: patientLabel,
              time: formatMmSs(elapsedRef.current),
              text: `[Balasan Lokal Uji Ketik] Saya mengerti terkait: "${cleanText}". Ada lagi yang ingin ditanyakan atau dijelaskan?`,
            },
          ]);
          setError(
            err instanceof Error
              ? `Endpoint /turn belum aktif (${err.message}). Menampilkan balasan lokal untuk tes ketik.`
              : "Endpoint /turn belum aktif. Menampilkan balasan lokal untuk tes ketik.",
          );
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== tempStudentId));
          setError(err instanceof Error ? err.message : "Gagal memproses balasan pasien.");
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      sessionId,
      isSending,
      isFinishing,
      isPracticumBlocked,
      evaluationStatus,
      personaContext,
      isLocalMode,
      studentName,
      messages,
      idMahasiswa,
      initializeSession,
      skenarioId,
      mode,
      syncDurationToServer,
      allowLocalFallback,
      studentTurnCount,
    ],
  );

  const finishSession = useCallback(
    async (options?: {
      forceFinish?: boolean;
      discardOnForceFinish?: boolean;
    }) => {
      if (!sessionId || isFinishing || isSending) return null;

      setIsFinishing(true);
      setError(null);

      try {
        if (!isValidUuid(sessionId)) {
          throw new Error("Sesi lokal tidak memiliki UUID server untuk /finish.");
        }

        const finalSec = elapsedRef.current;
        await syncDurationToServer(sessionId, finalSec, false);

        const res = await finishSimulationApi({
          sessionId,
          skenarioId,
          mode,
          durasiDetik: finalSec,
          forceFinish: options?.forceFinish ?? false,
          discardOnForceFinish: options?.discardOnForceFinish ?? false,
        });

        const normalizedStatus = normalizeEvaluationStatus(res.evaluationStatus);
        const normalizedRes: FinishSimulationApiResponse = {
          ...res,
          evaluationStatus: normalizedStatus,
        };

        setFinishResult(normalizedRes);

        if (res.canFinish) {
          setEvaluationStatus(normalizedStatus);
        }

        if (res.canFinish && res.farewellMessage) {
          const patientLabel = `Pasien (${personaContext?.patient.nama ?? "Pasien"})`;
          setMessages((prev) => [
            ...prev,
            {
              id: `farewell-${sessionId}`,
              from: "pasien",
              name: patientLabel,
              time: formatMmSs(finalSec),
              text: res.farewellMessage!,
            },
          ]);
        }

        return normalizedRes;
      } catch (err) {
        if (allowLocalFallback || isLocalMode) {
          const farewell =
            "Baik, terima kasih banyak atas penjelasannya ya. Saya pamit dulu (sesi uji ketik selesai).";
          const patientLabel = `Pasien (${personaContext?.patient.nama ?? "Mode Uji Ketik"})`;
          const localStatus: EvaluationStatusEnum = "selesai otomatis";
          const localFinish: FinishSimulationApiResponse = {
            sessionId,
            canFinish: true,
            evaluationStatus: localStatus,
            allTriggersCovered: true,
            followUpPlanDelivered: true,
            missingItems: [],
            checklist: [],
            farewellMessage: farewell,
            finishedAt: new Date().toISOString(),
          };
          setFinishResult(localFinish);
          setEvaluationStatus(localStatus);
          setMessages((prev) => [
            ...prev,
            {
              id: `farewell-local-${Date.now()}`,
              from: "pasien",
              name: patientLabel,
              time: formatMmSs(elapsedRef.current),
              text: farewell,
            },
          ]);
          return localFinish;
        }
        setError(err instanceof Error ? err.message : "Gagal menyelesaikan sesi.");
        return null;
      } finally {
        setIsFinishing(false);
      }
    },
    [
      sessionId,
      isFinishing,
      isSending,
      skenarioId,
      mode,
      syncDurationToServer,
      personaContext,
      allowLocalFallback,
      isLocalMode,
    ],
  );

  const isSessionFinished = evaluationStatus !== "berjalan";
  const canFinishSession =
    studentTurnCount >= 1 && !isSending && !isFinishing && !isSessionFinished && !isPracticumBlocked;

  return {
    sessionId,
    isLocalMode,
    isPracticumBlocked,
    isResumed,
    isPageVisible,
    evaluationStatus,
    isSessionFinished,
    personaContext,
    messages,
    studentTurnCount,
    elapsedSec,
    elapsedLabel: formatMmSs(elapsedSec),
    isStarting,
    isSending,
    isFinishing,
    canFinishSession,
    finishResult,
    error,
    sendMessage,
    finishSession,
    syncDurationToServer,
    retryStartSession,
  };
}