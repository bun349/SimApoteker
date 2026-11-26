import { Info, Lock, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseMode } from "@/types/simulation";

interface Props {
  recording: boolean;
  recordTime: string;
  canFinish: boolean;
  mode?: CaseMode;
  isFinishing?: boolean;
  isSessionFinished?: boolean;
  finishHint?: string;
  onToggleRecord: () => void;
  onCancelRecord: () => void;
  onFinish: () => void;
}

export function SessionControls({
  recording,
  recordTime,
  canFinish,
  mode = "mandiri",
  isFinishing = false,
  isSessionFinished = false,
  finishHint = "Masih ada informasi yang perlu digali sebelum sesi diakhiri.",
  onToggleRecord,
  onCancelRecord,
  onFinish,
}: Props) {
  const allowClickWhenIncomplete = mode === "mandiri" && !isSessionFinished;
  const isFinishDisabled =
    isSessionFinished || isFinishing || (!canFinish && !allowClickWhenIncomplete);
  const showLockIcon = !canFinish && mode === "praktikum" && !isSessionFinished;

  return (
    <footer className="rounded-xl border border-line bg-white px-5 py-3.5">
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="min-h-8">
          {recording && (
            <span
              role="status"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-red-700"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              Merekam {recordTime}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleRecord}
          disabled={isSessionFinished || isFinishing}
          aria-pressed={recording}
          className={cn(
            "inline-flex w-full min-w-64 items-center justify-center gap-3 rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto",
            recording
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-navy-900 text-white hover:bg-navy-800",
          )}
        >
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full",
              recording ? "bg-white text-red-600" : "bg-white/15 text-white",
            )}
          >
            {recording ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}
          </span>
          <span className="text-left leading-tight">
            <span className="block">{recording ? "Tekan untuk Kirim" : "Tekan untuk Bicara"}</span>
            <span className="block text-[11px] font-normal text-white/75">
              atau tahan Space
            </span>
          </span>
        </button>

        <div className="flex flex-col items-stretch gap-1.5 lg:items-end">
          <div className="flex gap-2">
            {recording && (
              <button
                type="button"
                onClick={onCancelRecord}
                disabled={isSessionFinished}
                className="flex-1 whitespace-nowrap rounded-lg border border-line bg-white px-4 py-2 text-xs font-medium text-muted hover:bg-slate-50 hover:text-ink disabled:opacity-50 lg:flex-none"
              >
                Batalkan
              </button>
            )}
            <button
              type="button"
              onClick={onFinish}
              disabled={isFinishDisabled}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition lg:flex-none",
                !isFinishDisabled
                  ? "border border-navy-900 bg-white text-navy-900 hover:bg-slate-50"
                  : "cursor-not-allowed border border-line bg-slate-50 text-muted",
              )}
            >
              {showLockIcon && <Lock size={13} />}
              {isFinishing ? "Memproses..." : "Selesaikan Sesi"}
            </button>
          </div>
          {!canFinish && (
            <p
              role="status"
              aria-live="polite"
              className="flex items-start gap-1.5 text-[11px] text-muted lg:justify-end"
            >
              <Info size={12} className="mt-0.5 shrink-0" /> {finishHint}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
