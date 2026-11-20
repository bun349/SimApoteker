import { Info, Lock, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  recording: boolean;
  recordTime: string;        // "00:07"
  canFinish: boolean;
  finishHint?: string;
  onToggleRecord: () => void;
  onCancelRecord: () => void;
  onFinish: () => void;
}

export function SessionControls({
  recording, recordTime, canFinish,
  finishHint = "Masih ada informasi yang perlu digali sebelum sesi diakhiri.",
  onToggleRecord, onCancelRecord, onFinish,
}: Props) {
  return (
    <footer className="rounded-2xl border border-line bg-white px-5 py-4 shadow-sm">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        {/* Kiri: indikator rekam */}
        <div className="min-h-9">
          {recording && (
            <span
              role="status"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-mono text-xs font-bold text-red-700"
            >
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
              MEREKAM {recordTime}
            </span>
          )}
        </div>

        {/* Tengah: tombol bicara */}
        <button
          type="button" onClick={onToggleRecord} aria-pressed={recording}
          className={cn(
            "flex w-full min-w-72 items-center justify-center gap-4 rounded-full px-6 py-3.5 shadow-lg transition active:scale-[0.99] lg:w-auto",
            recording ? "bg-red-600 text-white hover:bg-red-700" : "bg-gold-400 text-navy-900 hover:brightness-95",
          )}
        >
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", recording ? "bg-white text-red-600" : "bg-navy-900 text-gold-400")}>
            {recording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
          </span>
          <span className="text-left leading-tight">
            <span className="block font-serif text-base font-bold">
              {recording ? "Tekan untuk Kirim" : "Tekan untuk Bicara"}
            </span>
            <span className="block font-mono text-[11px] opacity-80">(atau tahan tombol Space)</span>
          </span>
        </button>

        {/* Kanan: aksi sesi */}
        <div className="flex flex-col items-stretch gap-2 lg:items-end">
          <div className="flex gap-2">
            <button
              type="button" onClick={onCancelRecord} disabled={!recording}
              className="flex-1 whitespace-nowrap rounded-xl border border-line bg-cream px-5 py-2.5 text-sm font-semibold hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none"
            >
              Batalkan Rekaman
            </button>
            <button
              type="button" onClick={onFinish} disabled={!canFinish}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold lg:flex-none",
                canFinish ? "bg-navy-900 text-white hover:bg-navy-800" : "cursor-not-allowed bg-sky-100 text-navy-800/50",
              )}
            >
              {!canFinish && <Lock size={14} />} Selesaikan Sesi
            </button>
          </div>
          {!canFinish && (
            <p className="flex items-start gap-1.5 text-[11px] text-muted lg:justify-end">
              <Info size={12} className="mt-0.5 shrink-0" /> {finishHint}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}