import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Send } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSimulationSession } from "@/hooks/useSimulationSession";
import { SessionHeader } from "@/components/simulation/session/SessionHeader";
import { AvatarPanel } from "@/components/simulation/session/AvatarPanel";
import { TranscriptPanel } from "@/components/simulation/session/TranscriptPanel";
import { SessionControls } from "@/components/simulation/session/SessionControls";
import { ForceFinishModal } from "@/components/simulation/session/ForceFinishModal";
import type { CaseMode } from "@/types/simulation";

export default function SessionPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const profile = useAuthStore((s) => s.profile);
  const rawMode = sp.get("mode");
  const mode: CaseMode = rawMode === "mandiri" ? "mandiri" : "praktikum";

  const [size, setSize] = useState(16);
  const [recording, setRecording] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [showForceFinishModal, setShowForceFinishModal] = useState(false);
  const [showPracticumConfirmModal, setShowPracticumConfirmModal] = useState(false);
  const [pendingMissingItems, setPendingMissingItems] = useState<string[]>([]);

  const {
    sessionId,
    isPracticumBlocked,
    isResumed,
    isPageVisible,
    isSessionFinished,
    personaContext,
    messages,
    studentTurnCount,
    elapsedSec,
    elapsedLabel,
    isStarting,
    isSending,
    isFinishing,
    canFinishSession,
    finishResult,
    error,
    sendMessage,
    finishSession,
    syncDurationToServer,
  } = useSimulationSession({
    skenarioId: id ?? "",
    mode,
    idMahasiswa: profile?.id ?? "",
    studentName: profile?.nama_lengkap ?? "Mahasiswa",
  });

  const patientName = personaContext?.patient.nama ?? "Pasien";
  const subtitleParts = [
    personaContext?.patient.kategoriUsia,
    personaContext?.patient.jenisKelamin,
    personaContext?.patient.peranKomunikasi,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" · ") || "Simulasi KIE";

  const handleExitSession = () => {
    if (!isSessionFinished) {
      void syncDurationToServer(sessionId, elapsedSec, true);
    }
    navigate(id ? `/simulasi/${id}?mode=${mode}` : "/simulasi");
  };

  const handleSendText = async (e: FormEvent) => {
    e.preventDefault();
    if (!draftText.trim() || isSending || isFinishing || isSessionFinished || isPracticumBlocked) return;
    const textToSend = draftText;
    setDraftText("");
    await sendMessage(textToSend);
  };

  const handleFinishClick = async () => {
    if (mode === "praktikum") {
      setShowPracticumConfirmModal(true);
      return;
    }

    const res = await finishSession({
      forceFinish: false,
      discardOnForceFinish: false,
    });
    if (!res) return;

    if (res.canFinish && sessionId) {
      navigate(`/dokumentasi?sesi=${encodeURIComponent(sessionId)}`, { replace: true });
      return;
    }

    if (!res.canFinish && mode === "mandiri") {
      setPendingMissingItems(res.missingItems ?? []);
      setShowForceFinishModal(true);
    }
  };

  const handleConfirmFinishPracticum = async () => {
    const res = await finishSession({
      forceFinish: true,
      discardOnForceFinish: false,
    });
    if (res?.canFinish && sessionId) {
      setShowPracticumConfirmModal(false);
      navigate(`/dokumentasi?sesi=${encodeURIComponent(sessionId)}`, { replace: true });
    }
  };

  const handleConfirmSaveAndFinish = async () => {
    const res = await finishSession({
      forceFinish: true,
      discardOnForceFinish: false,
    });
    if (res?.canFinish) {
      setShowForceFinishModal(false);
      navigate(
        sessionId ? `/dokumentasi?sesi=${encodeURIComponent(sessionId)}` : "/riwayat",
        { replace: true },
      );
    }
  };

  const handleConfirmDiscardAndFinish = async () => {
    const res = await finishSession({
      forceFinish: true,
      discardOnForceFinish: true,
    });
    if (res?.canFinish) {
      setShowForceFinishModal(false);
      navigate("/riwayat", { replace: true });
    }
  };

  // Konservasi hint: mode praktikum hanya menampilkan kategori umum tanpa bocoran pemicu spesifik
  const finishHint = isSessionFinished
    ? "Sesi telah berakhir. Pasien sudah pamit dan sesi diarahkan ke evaluasi."
    : isFinishing
      ? "Memeriksa kelengkapan pemicu & rencana tindak lanjut..."
      : mode === "praktikum"
        ? studentTurnCount < 1
          ? "Lakukan minimal 1 giliran percakapan sebelum menyelesaikan sesi praktikum."
          : "Tekan Selesaikan Sesi jika konseling telah selesai untuk melanjutkan ke dokumentasi kefarmasian."
        : finishResult && !finishResult.canFinish && finishResult.missingItems.length > 0
          ? `Belum terpenuhi: ${finishResult.missingItems.join(" • ")}`
          : "Mode mandiri: jika syarat belum lengkap, menekan Selesaikan Sesi akan membuka opsi konfirmasi pengakhiran/penghapusan sesi.";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 lg:h-[calc(100vh-7rem)]">
      <SessionHeader
        title={personaContext?.judul || "Sesi Simulasi KIE"}
        modeLabel={mode.toUpperCase()}
        elapsed={elapsedLabel}
        limit="10:00"
        onExit={handleExitSession}
      />

      {isResumed && !isSessionFinished && (
        <div
          role="status"
          className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-900"
        >
          Sesi dilanjutkan otomatis dari durasi terakhir ({elapsedLabel})
          {!isPageVisible ? " — timer dijeda karena tab tidak aktif." : "."}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {isSessionFinished && finishResult?.canFinish && (
        <div
          role="status"
          className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-2.5 text-xs font-semibold text-lime-900"
        >
          Sesi telah diakhiri dengan status evaluasi:{" "}
          <span className="uppercase">{finishResult.evaluationStatus}</span>.
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AvatarPanel
          name={patientName}
          subtitle={subtitle}
          patientStatus={
            isStarting
              ? "Menyiapkan Sesi..."
              : isSessionFinished
                ? "Pasien Pamit"
                : isSending
                  ? "Pasien Merespons"
                  : "Pasien Mendengarkan"
          }
          audioLabel="16kHz Audio Aktif"
          virtualStatus={
            isSessionFinished ? "Sesi Selesai" : isSending ? "Sedang Mengetik..." : "Virtual Pasien Standby"
          }
          speaking={isSending}
        />

        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <TranscriptPanel
              messages={messages}
              fontSize={size}
              onFontSize={(d) => setSize((s) => Math.min(22, Math.max(12, s + d)))}
              typing={isSending}
            />
          </div>

          <form
            onSubmit={handleSendText}
            className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 shadow-sm"
          >
            <input
              type="text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              disabled={isSending || isFinishing || isSessionFinished || isPracticumBlocked}
              placeholder={
                isPracticumBlocked
                  ? "Percobaan praktikum untuk skenario ini sudah selesai."
                  : isSessionFinished
                    ? "Sesi percakapan telah selesai."
                    : isStarting
                      ? "Ketik tanggapan apoteker di sini (menghubungkan sesi...)"
                      : "Ketik tanggapan apoteker di sini..."
              }
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!draftText.trim() || isSending || isFinishing || isSessionFinished || isPracticumBlocked}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} /> Kirim
            </button>
          </form>
        </div>
      </div>

      <SessionControls
        recording={recording}
        recordTime="00:00"
        canFinish={canFinishSession}
        mode={mode}
        isFinishing={isFinishing}
        isSessionFinished={isSessionFinished || isPracticumBlocked}
        finishHint={finishHint}
        onToggleRecord={() => setRecording((r) => !r)}
        onCancelRecord={() => setRecording(false)}
        onFinish={handleFinishClick}
      />

      <ForceFinishModal
        open={showForceFinishModal}
        isSubmitting={isFinishing}
        studentTurnCount={studentTurnCount}
        missingItems={pendingMissingItems}
        onCancel={() => setShowForceFinishModal(false)}
        onConfirmSaveAndFinish={handleConfirmSaveAndFinish}
        onConfirmDiscardAndFinish={handleConfirmDiscardAndFinish}
      />

      {showPracticumConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="practicum-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h2
              id="practicum-confirm-title"
              className="font-serif text-lg font-bold text-navy-900"
            >
              Akhiri Sesi Praktikum?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Setelah diakhiri, percakapan tidak dapat dilanjutkan kembali dan Anda akan
              langsung diarahkan ke halaman pengisian dokumentasi kefarmasian.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isFinishing}
                onClick={() => setShowPracticumConfirmModal(false)}
                className="rounded-xl border border-line bg-cream px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-sky-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isFinishing}
                onClick={handleConfirmFinishPracticum}
                className="rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white hover:bg-navy-800 disabled:opacity-50"
              >
                {isFinishing ? "Memproses..." : "Ya, Akhiri & Lanjut Dokumentasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}