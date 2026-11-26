import { AlertTriangle, ArrowRight, CheckCircle2, Flag } from "lucide-react";
import { Link } from "react-router";
import type { EvaluationStatus, SimulationHistory } from "@/types/simulation";
import { cn, formatDate, scoreTone } from "@/lib/utils";

const categoryChip: Record<string, string> = {
  SWAMEDIKASI: "bg-emerald-50 text-emerald-700",
  "RESEP AKUT": "bg-sky-50 text-sky-800",
  "RESEP KRONIS": "bg-indigo-50 text-indigo-800",
};

const statusMeta: Record<EvaluationStatus, { label: string; cls: string; icon: typeof Flag }> = {
  pending_review: {
    label: "Perlu Ditinjau Dosen",
    cls: "bg-amber-50 text-amber-800 border border-amber-200",
    icon: Flag,
  },
  reviewed: {
    label: "Selesai",
    cls: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    icon: CheckCircle2,
  },
  graded: {
    label: "Perlu Perhatian",
    cls: "bg-slate-100 text-slate-700 border border-slate-200",
    icon: AlertTriangle,
  },
};

export function HistoryTable({ rows, total }: { rows: SimulationHistory[]; total: number }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Riwayat Simulasi Terakhir</h3>
          <p className="text-xs text-muted">
            Menampilkan 5 sesi terakhir yang sudah selesai.
          </p>
        </div>
        <Link
          to="/riwayat"
          className="inline-flex items-center gap-1 text-xs font-semibold text-navy-900 hover:underline"
        >
          Lihat Semua ({total}) <ArrowRight size={13} />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted">
          Belum ada riwayat sesi yang selesai.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-slate-50 text-xs font-medium text-muted">
              <tr>
                <th className="px-6 py-3">Skenario &amp; Pasien</th>
                <th className="px-6 py-3">Mode</th>
                <th className="px-6 py-3">Tanggal</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Skor</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const s = statusMeta[r.status];
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    <td className="min-w-56 px-6 py-4">
                      <div className="font-medium text-ink">{r.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{r.patient}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-medium",
                            categoryChip[r.category] || "bg-slate-100 text-slate-700",
                          )}
                        >
                          {r.category}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          r.mode === "Praktikum"
                            ? "bg-sky-50 text-navy-900"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {r.mode}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-muted">
                      {formatDate(r.takenAt)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          s.cls,
                        )}
                      >
                        <s.icon size={12} /> {s.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 tabular-nums">
                      <span className={cn("text-base font-semibold", scoreTone(r.score))}>
                        {r.score > 0 ? r.score : "—"}
                      </span>
                      {r.score > 0 && <span className="ml-0.5 text-xs text-muted">/100</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <Link
                        to={`/rapor?sesi=${encodeURIComponent(r.id)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-slate-50"
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
      )}
    </section>
  );
}
