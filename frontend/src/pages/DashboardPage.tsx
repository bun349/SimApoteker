import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { ModeCards } from "@/components/dashboard/ModeCards";
import { MicStatus } from "@/components/dashboard/MicStatus";
import { CaseCard } from "@/components/dashboard/CaseCard";
import { HistoryTable } from "@/components/dashboard/HistoryTable";
import type { CaseMode } from "@/types/simulation";

const MAX_DASHBOARD_CASES = 3;

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const [selectedMode, setSelectedMode] = useState<CaseMode>("praktikum");
  const [initializedMode, setInitializedMode] = useState(false);

  // Pilih mode awal otomatis: praktikum jika ada tugas aktif, selain itu mandiri
  useEffect(() => {
    if (!data || initializedMode) return;
    const hasPraktikum = data.cases.some((c) => c.modes.includes("praktikum"));
    setSelectedMode(hasPraktikum ? "praktikum" : "mandiri");
    setInitializedMode(true);
  }, [data, initializedMode]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-muted">
        <Loader2 size={28} className="animate-spin text-navy-900" />
        <p className="mt-3 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
        <p className="font-semibold">Gagal memuat data dashboard.</p>
        <button
          type="button"
          className="mt-2 font-medium text-navy-900 underline"
          onClick={() => refetch()}
        >
          Coba muat ulang
        </button>
      </div>
    );
  }

  const { student, cases, history, historyTotal, completedPracticumIds = [] } = data;
  const praktikumCases = cases.filter((c) => c.modes.includes("praktikum"));
  const mandiriCases = cases.filter((c) => c.modes.includes("mandiri"));
  const completedPracticumSet = new Set<string>(completedPracticumIds);

  const activeCases = selectedMode === "praktikum" ? praktikumCases : mandiriCases;
  const displayedCases = activeCases.slice(0, MAX_DASHBOARD_CASES);
  const firstName = student.name.split(",")[0].split(" ").slice(0, 2).join(" ");
  const pactPercent = Math.max(0, Math.min(100, student.avgPact));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs font-semibold text-olive-600">
            TA {student.academicYear} · {student.block}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">
            Halo, {firstName}
          </h1>
          <div className="mt-3">
            <MicStatus />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="min-w-[132px] rounded-xl border border-line bg-white px-4 py-3">
            <div className="text-xs text-muted">Total Sesi</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-ink">
              {student.totalSessions}{" "}
              <span className="text-xs font-normal text-muted">selesai</span>
            </div>
          </div>

          <div className="min-w-[152px] rounded-xl border border-line bg-white px-4 py-3">
            <div className="text-xs text-muted">Rata-rata PaCT</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-ink">
              {student.avgPact.toFixed(1)}{" "}
              <span className="text-xs font-normal text-muted">/ 100</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-olive-600 transition-all"
                style={{ width: `${pactPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <ModeCards
        student={student}
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
      />

      {/* Daftar 3 Skenario Terbaru sesuai mode yang sedang dipilih */}
      <section id="daftar-skenario" className="space-y-4 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy-900">
              {selectedMode === "praktikum"
                ? "Tugas Praktikum Terjadwal"
                : "Skenario Latihan Mandiri Terbaru"}
            </h2>
            <p className="text-xs text-muted">
              {selectedMode === "praktikum"
                ? "Selesaikan kasus praktikum sesuai jadwal yang ditetapkan dosen pengampu."
                : "Pilih kasus latihan mandiri untuk berlatih konseling KIE secara fleksibel."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted">
              Menampilkan {displayedCases.length} dari {activeCases.length} kasus
            </span>
            <Link
              to={`/simulasi?tab=${selectedMode}`}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
            >
              Kasus Lainnya <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {displayedCases.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {displayedCases.map((c) => (
              <CaseCard
                key={c.tugasId ?? c.id}
                c={c}
                mode={selectedMode}
                isCompleted={
                  selectedMode === "praktikum" &&
                  (Boolean(c.isPracticumCompleted) || completedPracticumSet.has(c.id))
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-sm text-muted">
              {selectedMode === "praktikum"
                ? "Belum ada tugas praktikum aktif untuk kelas Anda saat ini."
                : "Belum ada skenario latihan mandiri yang tersedia."}
            </p>
          </div>
        )}
      </section>

      <HistoryTable rows={history} total={historyTotal} />
    </div>
  );
}
