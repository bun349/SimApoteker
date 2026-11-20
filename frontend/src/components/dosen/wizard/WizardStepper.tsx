import { ArrowRight, Check, Lock } from "lucide-react";
import { STEPS, TOTAL_STEPS, stepState } from "@/lib/wizard";
import { cn } from "@/lib/utils";

interface Props {
  current: number;
  maxStep: number;
  completed: number;
  busy: boolean;
  allDone: boolean;
  onGo: (n: number) => void;
}

export function WizardStepper({ current, maxStep, completed, busy, allDone, onGo }: Props) {
  const pct = Math.floor((completed / TOTAL_STEPS) * 100);

  return (
    <nav aria-label="Alur perancangan" className="rounded-2xl border border-line bg-white p-4 shadow-sm xl:sticky xl:top-24">
      <div className="flex items-center justify-between px-2 pb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>Alur Perancangan</span>
        <span className="font-serif text-sm text-ink">{current} / {TOTAL_STEPS}</span>
      </div>

      <ol className="relative space-y-1">
        <span aria-hidden className="absolute bottom-5 left-[26px] top-5 w-px bg-line" />
        {STEPS.map((s) => {
          const st = stepState(s.n, current, maxStep, allDone);
          const locked = st === "locked";
          return (
            <li key={s.n} className="relative">
              <button
                type="button"
                onClick={() => !locked && !busy && onGo(s.n)}
                aria-current={st === "current" ? "step" : undefined}
                aria-disabled={locked}
                title={locked ? "Selesaikan langkah sebelumnya terlebih dahulu" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                  st === "current" && "bg-navy-900 text-white",
                  (st === "done" || st === "open") && "cursor-pointer text-ink hover:bg-cream",
                  locked && "cursor-not-allowed text-muted/50",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    st === "current" && "bg-gold-400 text-navy-900",
                    st === "done" && "bg-lime-100 text-lime-700",
                    st === "open" && "bg-sky-100 text-navy-800",
                    locked && "bg-gray-100 text-muted/50",
                  )}
                >
                  {st === "done" ? <Check size={14} strokeWidth={3} /> : s.n}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
                {st === "current" && <ArrowRight size={15} className="text-gold-400" />}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-xl bg-cream p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span>Kelengkapan Skenario</span>
          <span className="font-serif text-sm">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
          <div className="h-full rounded-full bg-navy-900 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Lock size={11} /> {completed} dari {TOTAL_STEPS} langkah tuntas
        </p>
      </div>
    </nav>
  );
}