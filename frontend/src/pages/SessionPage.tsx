import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Send } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSimulationSession } from "@/hooks/useSimulationSession";
import { SessionHeader } from "@/components/simulation/session/SessionHeader";
import { AvatarPanel } from "@/components/simulation/session/AvatarPanel";
import { TranscriptPanel } from "@/components/simulation/session/TranscriptPanel";
import { SessionControls } from "@/components/simulation/session/SessionControls";
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

  const {
    personaContext,
    messages,
    studentTurnCount,
    elapsedLabel,
    isStarting,
    isSending,
    error,
    sendMessage,
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

  const handleSendText = async (e: FormEvent) => {
    e.preventDefault();
    if (!draftText.trim() || isSending || isStarting) return;
    const textToSend = draftText;
    setDraftText("");
    await sendMessage(textToSend);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 lg:h-[calc(100vh-7rem)]">
      <SessionHeader
        title={personaContext?.judul || "Sesi Simulasi KIE"}
        modeLabel={mode.toUpperCase()}
        elapsed={elapsedLabel}
        limit="10:00"
        onExit={() => navigate(-1)}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AvatarPanel
          name={patientName}
          subtitle={subtitle}
          patientStatus={isStarting ? "Menyiapkan Sesi..." : isSending ? "Pasien Merespons" : "Pasien Mendengarkan"}
          audioLabel="16kHz Audio Aktif"
          virtualStatus={isSending ? "Sedang Mengetik..." : "Virtual Pasien Standby"}
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
              disabled={isStarting || isSending}
              placeholder={isStarting ? "Memulai sesi..." : "Ketik tanggapan apoteker di sini..."}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!draftText.trim() || isStarting || isSending}
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
        canFinish={studentTurnCount >= 1 && !isSending}
        finishHint="Lakukan minimal 1 giliran percakapan sebelum menyelesaikan sesi."
        onToggleRecord={() => setRecording((r) => !r)}
        onCancelRecord={() => setRecording(false)}
        onFinish={() => {}}
      />
    </div>
  );
}