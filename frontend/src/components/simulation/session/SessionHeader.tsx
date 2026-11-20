import { ArrowLeft, Focus, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  modeLabel: string;      // "PRAKTIKUM" | "MANDIRI"
  elapsed: string;        // "02:41"
  limit?: string;         // "10:00"
  onExit?: () => void;
}

export function SessionHeader({ title, modeLabel, elapsed, limit, onExit }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-3 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <button
          type="button" onClick={onExit}
          className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-navy-900 hover:underline"
        >
          <ArrowLeft size={16} /> Keluar Sesi
        </button>
        <span className="hidden h-6 w-px bg-line sm:block" />
        <h1 className="truncate font-serif text-lg font-bold">{title}</h1>
        <span className="rounded-full bg-navy-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gold-400">
          {modeLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-cream px-4 py-2 font-mono text-sm">
          <Timer size={15} className="text-amber-600" />
          <b>{elapsed}</b>
          {limit && <span className="text-muted">/ {limit}</span>}
        </span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-cream px-3 py-2 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-lime-600" />
          <Focus size={13} className="hidden sm:block" /> Mode Fokus Aktif
        </span>
      </div>
    </header>
  );
}