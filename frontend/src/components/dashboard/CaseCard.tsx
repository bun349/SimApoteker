import { ArrowRight, CalendarDays, Clock, User } from "lucide-react";
import { Link } from "react-router";
import type { CaseMode, PatientCase } from "@/types/simulation";
import { cn, formatDeadline } from "@/lib/utils";

// Beri fallback default 'RESEP AKUT' jika category dari database belum terpetakan di map ini
const accent: Record<string, { bar: string; chip: string }> = {
  "SWAMEDIKASI": { bar: "border-t-lime-600", chip: "bg-lime-100 text-lime-800" },
  "RESEP AKUT": { bar: "border-t-red-700", chip: "bg-sky-100 text-navy-800" },
  "RESEP KRONIS": { bar: "border-t-lime-600", chip: "bg-sky-100 text-navy-800" },
  "DEFAULT": { bar: "border-t-gold-400", chip: "bg-cream text-navy-900" },
};

export function CaseCard({ c, mode = "praktikum" }: { c: PatientCase; mode?: CaseMode }) {
  // Gunakan UPPERCASE agar cocok dengan key dictionary, atau fallback ke DEFAULT
  const a = accent[c.category?.toUpperCase()] || accent["DEFAULT"];
  const mandiri = mode === "mandiri";

  return (
    <article className={cn("flex flex-col rounded-2xl border border-line border-t-2 bg-white shadow-sm", a.bar)}>
      <div className="flex-1 p-5">
        <div className="flex items-center justify-between">
          <span className={cn("rounded px-2 py-1 text-[10px] font-bold tracking-wide", a.chip)}>
            {c.category || "TUGAS PRAKTIKUM"}
          </span>
          {c.estimatedMinutes && (
            <span className="flex items-center gap-1 font-serif text-xs text-muted">
              <Clock size={12} /> {c.estimatedMinutes}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {c.photoUrl ? (
            <img src={c.photoUrl} className="h-12 w-12 rounded-full object-cover" alt="" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-50 text-navy-900">
              <User size={20} />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-serif text-base font-semibold leading-tight">{c.patientName}</h4>
            <p className="text-xs text-muted">{c.patientMeta}</p>
          </div>
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-navy-800">
          Diagnosis / Kasus:
        </p>
        <h5 className="mt-1 font-serif text-base font-semibold leading-snug">{c.diagnosis}</h5>

        <hr className="my-3 border-line" />

        {!mandiri && c.deadline && (
          <div className="flex items-center text-xs">
            <span className="flex items-center gap-1.5 font-medium text-red-700">
              <CalendarDays size={12} /> {formatDeadline(c.deadline)}
            </span>
          </div>
        )}

        <dl className={cn("flex justify-between gap-4 text-xs", !mandiri && c.deadline && "mt-3")}>
          <dt className="shrink-0 text-muted">Fokus KIE</dt>
          <dd className="text-right font-medium">{c.focus}</dd>
        </dl>
      </div>

      <div className="p-4 pt-0">
        {/* URL ditambahkan &tugas=ID jika mode praktikum */}
        <Link
          to={`/simulasi/${c.id}?mode=${mode}${c.tugasId ? `&tugas=${c.tugasId}` : ""}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 py-3 text-sm font-semibold text-white transition hover:bg-navy-800"
        >
          {mandiri ? "Mulai Sesi Mandiri" : "Kerjakan Tugas Praktikum"} <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}