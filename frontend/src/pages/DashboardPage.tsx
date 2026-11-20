import { useDashboard } from "@/hooks/useDashboard";
import { ModeCards } from "@/components/dashboard/ModeCards";
import { MicStatus } from "@/components/dashboard/MicStatus";
import { CaseCard } from "@/components/dashboard/CaseCard";
import { HistoryTable } from "@/components/dashboard/HistoryTable";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-muted">
        <Loader2 size={32} className="animate-spin text-gold-400" />
        <p className="mt-4 animate-pulse text-sm font-medium">Memuat Dasbor Mahasiswa...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-bold">Gagal memuat data dari server.</p>
        <button className="mt-2 text-red-800 underline hover:text-red-900" onClick={() => refetch()}>
          Coba Muat Ulang
        </button>
      </div>
    );
  }

  const { student, cases, history, historyTotal } = data;
  const praktikumCases = cases.filter((c) => c.modes.includes("praktikum"));

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted">
            Simulasi Farmasi / <span className="font-medium text-ink">Portal Utama</span>
          </p>
          <span className="mt-2 inline-block rounded bg-gold-100 px-3 py-1 text-[11px] font-bold text-amber-900 shadow-sm">
            TA {student.academicYear} • {student.block}
          </span>
          <h1 className="mt-2 font-serif text-4xl font-bold">
            Halo, {student.name.split(",")[0].split(" ")[0]} {student.name.split(",")[0].split(" ")[1] ?? ""}
          </h1>
        </div>
        <div className="flex gap-3">
          <Stat label="Total Sesi" value={`${student.totalSessions}`} unit="Simulasi" />
          <Stat label="Rata-rata PaCT" value={student.avgPact.toFixed(1)} unit="/100" highlight />
        </div>
      </header>

      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>Pilih Mode Kerja Simulasi</span>
        <span className="normal-case tracking-normal">
          Dosen Pembimbing: <b className="text-ink">{student.supervisor}</b>
        </span>
      </div>

      <ModeCards student={student} />
      <MicStatus />

      {/* DAFTAR TUGAS PRAKTIKUM TERBARU */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-ink">Tugas Praktikum Terjadwal</h2>
        {praktikumCases.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {praktikumCases.map((c) => (
              <CaseCard key={c.id} c={c} mode="praktikum" />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-cream p-10 text-center">
            <p className="text-sm font-medium text-muted">Belum ada tugas praktikum baru dari dosen untuk kelas Anda.</p>
          </div>
        )}
      </div>

      <HistoryTable rows={history} total={historyTotal} />
    </div>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className="min-w-[120px] rounded-xl bg-white px-5 py-3 shadow-sm border border-line">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-serif text-2xl font-bold ${highlight ? "text-lime-800" : ""}`}>
        {value} <span className="font-sans text-xs font-normal text-muted">{unit}</span>
      </div>
    </div>
  );
}