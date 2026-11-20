// components/dashboard/ModeCards.tsx
import { ArrowRight, Brain, CalendarCheck, ClipboardCheck } from "lucide-react";
import { Link } from "react-router";
import type { Student } from "@/types/simulation";
import { formatDeadline } from "@/lib/utils";

export function ModeCards({ student }: { student: Student }) {
  const practicum = student.activeMode === "practicum";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Latihan Mandiri */}
      <section className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-cream text-navy-900">
            <Brain size={22} />
          </div>
          <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-medium text-muted">
            Tanpa Batas Penilaian
          </span>
        </div>
        <h3 className="mt-3 font-serif text-lg font-semibold">Latihan Mandiri</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Belajar bebas tanpa batas waktu penilaian resmi. Eksplorasi teknik konseling KIE, uji
          respon pasien virtual secara adaptif, dan dapatkan umpan balik formatif instan dari AI.
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-xs">
          <span className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-full bg-gray-500" />
            {student.selfBankCount} Kasus Bank Mandiri
          </span>
          <Link to="/simulasi" className="flex items-center gap-1 text-sm font-medium text-navy-900">
            Pilih Mode Mandiri <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Praktikum Terjadwal */}
      <section className="flex flex-col rounded-2xl border-2 border-gold-400 bg-linear-to-br from-navy-900 to-navy-950 p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold-400 text-navy-900">
            <ClipboardCheck size={22} />
          </div>
          {practicum && (
            <span className="flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-bold uppercase text-navy-900">
              <span className="h-1.5 w-1.5 rounded-full bg-navy-900" /> Mode Aktif
            </span>
          )}
        </div>
        <h3 className="mt-3 flex items-center gap-2 font-serif text-lg font-semibold">
          Praktikum Terjadwal
          <span className="rounded-full bg-gold-400 px-2 py-0.5 font-sans text-[10px] font-bold text-navy-900">
            {student.mandatoryTasks} Tugas Wajib
          </span>
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-white/90">
          Sesi tercatat secara resmi untuk evaluasi rubrik PaCT (Patient Consultation Tool). Audio
          verbatim & analitik empati klinis direkam dan ditinjau dosen penguji.
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
          <span className="flex items-center gap-2 text-xs font-semibold text-gold-400">
            <CalendarCheck size={14} /> Tenggat terdekat:{" "}
            {formatDeadline(student.nearestDeadline).split(",")[0]}
          </span>
          <Link
            to="/praktikum"
            className="rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 hover:brightness-95"
          >
            {student.mandatoryTasks} Tugas Wajib
          </Link>
        </div>
      </section>
    </div>
  );
}