import { ArrowLeft, Timer } from "lucide-react";

interface Props {
  title: string;
  modeLabel: string; // "PRAKTIKUM" | "MANDIRI"
  elapsed: string; // "02:41"
  limit?: string; // "10:00"
  onExit?: () => void;
}

export function SessionHeader({ title, modeLabel, elapsed, limit, onExit }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-5 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-sm font-medium text-muted transition hover:bg-slate-100 hover:text-ink"
        >
          <ArrowLeft size={15} /> Keluar
        </button>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
        <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-navy-900">
          {modeLabel === "PRAKTIKUM" ? "Praktikum" : "Mandiri"}
        </span>
      </div>

      <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-slate-50 px-3.5 py-1.5 text-sm tabular-nums">
        <Timer size={14} className="text-muted" />
        <span className="font-semibold text-ink">{elapsed}</span>
        {limit && <span className="text-xs text-muted">/ {limit}</span>}
      </div>
    </header>
  );
}
