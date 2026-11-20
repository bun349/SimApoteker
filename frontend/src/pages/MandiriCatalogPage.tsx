import { useState, useMemo } from "react";
import { ArrowLeft, Brain } from "lucide-react";
import { Link } from "react-router";
import { useCaseCatalog } from "@/hooks/useCaseCatalog";
import { CaseCard } from "@/components/dashboard/CaseCard";
import { cn } from "@/lib/utils";

export default function MandiriCatalogPage() {
  const { data, isLoading, isError, refetch } = useCaseCatalog("mandiri");
  
  // State filter sekarang hanya menerima string biasa
  const [filter, setFilter] = useState<string>("SEMUA");

  // Ekstrak daftar kategori unik secara otomatis dari data database
  const filters = useMemo(() => {
    const rawCategories = (data ?? []).map((c) => c.category).filter(Boolean);
    const uniqueCategories = Array.from(new Set(rawCategories));
    return ["SEMUA", ...uniqueCategories];
  }, [data]);

  // Saring kasus berdasarkan filter yang aktif
  const cases = (data ?? []).filter((c) => filter === "SEMUA" || c.category === filter);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-cream"
        >
          <ArrowLeft size={15} /> Kembali ke Dashboard
        </Link>
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-navy-900">
          <span className="h-2 w-2 rounded-full bg-lime-600" /> Latihan Mandiri: Tidak Dinilai
        </span>
      </div>

      <header className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-navy-900 shadow-sm">
          <Brain size={22} />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold">Katalog Latihan Mandiri</h1>
          <p className="mt-1 text-sm text-muted">
            Pilih kasus untuk berlatih tanpa batas waktu dan tanpa penilaian resmi. Anda mendapat umpan balik formatif dari AI.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold",
              filter === f ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-ink hover:bg-cream",
            )}
          >
            {f === "SEMUA" ? "Semua Kasus" : f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-gold-400"></div>
          <p className="mt-4 animate-pulse text-sm font-medium">Memuat katalog mandiri...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-bold">Gagal memuat katalog.</p>
          <button className="mt-2 text-red-800 underline hover:text-red-900" onClick={() => refetch()}>
            Coba muat ulang
          </button>
        </div>
      )}

      {!isLoading && !isError && cases.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-cream p-10 text-center text-sm text-muted">
          Belum ada kasus mandiri untuk kategori ini.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => <CaseCard key={c.id} c={c} mode="mandiri" />)}
      </div>
    </div>
  );
}