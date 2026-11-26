import { ArrowRight, CalendarDays, CheckCircle2, Clock, User } from "lucide-react";
import { Link } from "react-router";
import type { CaseMode, PatientCase } from "@/types/simulation";
import { cn, formatDeadline } from "@/lib/utils";

const categoryStyle: Record<string, { chip: string; avatar: string }> = {
  "RESEP KRONIS": {
    chip: "bg-sky-50 text-navy-900",
    avatar: "bg-sky-50 text-navy-800",
  },
  "RESEP AKUT": {
    chip: "bg-gold-100 text-amber-900",
    avatar: "bg-gold-100 text-amber-800",
  },
  SWAMEDIKASI: {
    chip: "bg-olive-100 text-olive-700",
    avatar: "bg-olive-100 text-olive-700",
  },
};

export function CaseCard({
  c,
  mode = "praktikum",
  isCompleted,
}: {
  c: PatientCase;
  mode?: CaseMode;
  isCompleted?: boolean;
}) {
  const catKey = c.category?.toUpperCase() || "";
  const style = categoryStyle[catKey] || {
    chip: "bg-slate-100 text-slate-700",
    avatar: "bg-slate-100 text-slate-600",
  };
  const mandiri = mode === "mandiri";
  const isLocked = mode === "praktikum" && Boolean(isCompleted ?? c.isPracticumCompleted);

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white transition hover:border-slate-300">
      <div className="flex-1 p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              style.chip,
            )}
          >
            {c.category || "PRAKTIKUM"}
          </span>
          {c.estimatedMinutes && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Clock size={12} /> {c.estimatedMinutes}
            </span>
          )}
        </div>

        <h4 className="mt-3.5 text-base font-bold leading-snug text-ink">{c.diagnosis}</h4>

        <div className="mt-3.5 flex items-center gap-2.5">
          {c.photoUrl ? (
            <img src={c.photoUrl} className="h-9 w-9 rounded-full object-cover" alt="" />
          ) : (
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                style.avatar,
              )}
            >
              <User size={15} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{c.patientName}</p>
            <p className="truncate text-xs text-muted">{c.patientMeta}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-3.5 text-xs">
          {!mandiri && c.deadline && (
            <div className="flex items-center gap-1.5 font-semibold text-amber-700">
              <CalendarDays size={13} /> {formatDeadline(c.deadline)}
            </div>
          )}
          <p className="line-clamp-2 leading-relaxed text-muted">
            <span className="font-semibold text-ink">Fokus:</span> {c.focus}
          </p>
        </div>
      </div>

      <div className="p-4 pt-0">
        {isLocked ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-olive-600/20 bg-olive-100 py-2.5 text-sm font-semibold text-olive-700"
          >
            <CheckCircle2 size={15} />
            <span>Sudah Dikerjakan</span>
          </button>
        ) : (
          <Link
            to={`/simulasi/${c.id}?mode=${mode}${c.tugasId ? `&tugas=${c.tugasId}` : ""}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            <span>{mandiri ? "Mulai Latihan" : "Kerjakan Praktikum"}</span>
            <ArrowRight size={14} className="text-gold-400" />
          </Link>
        )}
      </div>
    </article>
  );
}
