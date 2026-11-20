// components/dashboard/HistoryTable.tsx
import { ArrowRight, Flag, History, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router";
import type { CaseCategory, EvaluationStatus, SimulationHistory } from "@/types/simulation";
import { cn, formatDate, scoreTone } from "@/lib/utils";

const categoryChip: Record<CaseCategory, string> = {
  "SWAMEDIKASI": "bg-lime-100 text-lime-800",
  "RESEP AKUT": "bg-sky-100 text-navy-800",
  "RESEP KRONIS": "bg-sky-100 text-navy-800",
};

const status: Record<EvaluationStatus, { label: string; cls: string; icon: typeof Flag }> = {
  pending_review: { label: "Perlu Ditinjau Dosen", cls: "bg-gold-100 text-amber-800", icon: Flag },
  reviewed: { label: "Selesai Ditinjau", cls: "bg-sky-100 text-navy-900", icon: CheckCircle2 },
  graded: { label: "Ada Penilaian Terlewat", cls: "bg-red-100 text-red-700", icon: AlertTriangle },
};

export function HistoryTable({ rows, total }: { rows: SimulationHistory[]; total: number }) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-start justify-between p-6 pb-4">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <History size={16} /> Riwayat Simulasi Terakhir
          </h3>
          <p className="mt-1 text-xs text-muted">
            Daftar rekaman sesi konseling, status verifikasi dosen, dan skor rubrik PaCT.
          </p>
        </div>
        <Link to="/riwayat" className="flex items-center gap-1 text-sm font-medium text-navy-900">
          Lihat Semua Arsip Riwayat ({total}) <ArrowRight size={14} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream text-[11px] uppercase tracking-wider text-navy-800">
            <tr>
              {["Skenario & Pasien", "Mode", "Tanggal & Waktu", "Status Evaluasi", "Skor Akhir (PaCT)", "Aksi"].map((h) => (
                <th key={h} className="px-6 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const s = status[r.status];
              return (
                <tr key={r.id}>
                <td className="min-w-56 px-6 py-4">
                  <div className="font-semibold leading-snug text-navy-900">{r.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>Pasien: {r.patient}</span>
                    <span aria-hidden>•</span>
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold tracking-wide", categoryChip[r.category])}>
                      {r.category}
                    </span>
                  </div>
                </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={cn("rounded-full px-3 py-1 text-xs",
                      r.mode === "Praktikum" ? "bg-sky-100 text-navy-900" : "text-muted")}>
                      {r.mode}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">{formatDate(r.takenAt)}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", s.cls)}>
                      <s.icon size={12} /> {s.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn("font-serif text-lg font-bold", scoreTone(r.score))}>
                      {r.score}
                      <span className="ml-1 font-sans text-xs font-normal text-muted">/100</span>
                    </div>
                    <div className={cn("text-xs font-medium", scoreTone(r.score))}>{r.scoreLabel}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/rapor/${r.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs font-medium hover:bg-cream"
                    >
                      Buka Rapor
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-6 py-4 text-xs text-muted">
        💡 <b className="text-ink">Tips Simulasi:</b> Gunakan teknik{" "}
        <i>Three Prime Questions</i> dan konfirmasi kepahaman pasien sebelum mengakhiri sesi.
      </p>
    </section>
  );
}