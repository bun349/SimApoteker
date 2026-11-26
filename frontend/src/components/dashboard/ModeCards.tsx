import { ArrowRight, BookOpen, Calendar, ClipboardCheck } from "lucide-react";
import type { CaseMode, Student } from "@/types/simulation";
import { cn, formatDeadline } from "@/lib/utils";

interface ModeCardsProps {
  student: Student;
  selectedMode: CaseMode;
  onSelectMode: (mode: CaseMode) => void;
}

export function ModeCards({ student, selectedMode, onSelectMode }: ModeCardsProps) {
  const isMandiriActive = selectedMode === "mandiri";
  const isPraktikumActive = selectedMode === "praktikum";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Kartu Latihan Mandiri */}
      <section
        onClick={() => onSelectMode("mandiri")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectMode("mandiri");
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col rounded-2xl border p-6 text-left transition",
          isMandiriActive
            ? "border-navy-900 bg-navy-900 text-white"
            : "border-line bg-white text-ink hover:border-slate-300",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl",
              isMandiriActive
                ? "bg-white/10 text-gold-400"
                : "bg-olive-100 text-olive-700",
            )}
          >
            <BookOpen size={18} />
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              isMandiriActive
                ? "bg-gold-400 text-navy-900"
                : "bg-olive-100 text-olive-700",
            )}
          >
            Latihan Bebas
          </span>
        </div>

        <h3
          className={cn(
            "mt-4 text-base font-semibold",
            isMandiriActive ? "text-white" : "text-ink",
          )}
        >
          Latihan Mandiri
        </h3>
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            isMandiriActive ? "text-slate-300" : "text-muted",
          )}
        >
          Berlatih konseling KIE secara fleksibel tanpa mempengaruhi nilai resmi, lengkap dengan
          evaluasi formatif instan.
        </p>

        <div
          className={cn(
            "mt-6 flex items-center justify-between border-t pt-4 text-xs",
            isMandiriActive ? "border-white/15" : "border-line",
          )}
        >
          <span className={isMandiriActive ? "text-slate-300" : "text-muted"}>
            {student.selfBankCount} kasus tersedia
          </span>
          {isMandiriActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400 px-3.5 py-1.5 font-semibold text-navy-900">
              Sedang Ditampilkan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-navy-900">
              Pilih Mode Mandiri <ArrowRight size={14} />
            </span>
          )}
        </div>
      </section>

      {/* Kartu Praktikum Terjadwal */}
      <section
        onClick={() => onSelectMode("praktikum")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectMode("praktikum");
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col rounded-2xl border p-6 text-left transition",
          isPraktikumActive
            ? "border-navy-900 bg-navy-900 text-white"
            : "border-line bg-white text-ink hover:border-slate-300",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl",
              isPraktikumActive
                ? "bg-white/10 text-gold-400"
                : "bg-olive-100 text-olive-700",
            )}
          >
            <ClipboardCheck size={18} />
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              isPraktikumActive
                ? "bg-gold-400 text-navy-900"
                : "bg-olive-100 text-olive-700",
            )}
          >
            {student.mandatoryTasks} Tugas Aktif
          </span>
        </div>

        <h3
          className={cn(
            "mt-4 text-base font-semibold",
            isPraktikumActive ? "text-white" : "text-ink",
          )}
        >
          Praktikum Terjadwal
        </h3>
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            isPraktikumActive ? "text-slate-300" : "text-muted",
          )}
        >
          Sesi penilaian resmi berbasis rubrik PaCT dan konten klinis yang tercatat serta dapat
          ditinjau oleh dosen penguji.
        </p>

        <div
          className={cn(
            "mt-6 flex items-center justify-between border-t pt-4 text-xs",
            isPraktikumActive ? "border-white/15" : "border-line",
          )}
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              isPraktikumActive ? "text-slate-300" : "text-muted",
            )}
          >
            <Calendar size={13} />
            {student.nearestDeadline
              ? `Tenggat: ${formatDeadline(student.nearestDeadline).split(",")[0]}`
              : "Belum ada tenggat"}
          </span>
          {isPraktikumActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400 px-3.5 py-1.5 font-semibold text-navy-900">
              Sedang Ditampilkan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-navy-900">
              Lihat Tugas <ArrowRight size={14} />
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
