import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useCaseCatalog } from "@/hooks/useCaseCatalog";
import { CaseCard } from "@/components/dashboard/CaseCard";
import type { CaseMode } from "@/types/simulation";
import { cn } from "@/lib/utils";

export default function MandiriCatalogPage() {
  const [sp, setSp] = useSearchParams();
  const initialTab: CaseMode = sp.get("tab") === "praktikum" ? "praktikum" : "mandiri";

  const [activeTab, setActiveTab] = useState<CaseMode>(initialTab);
  const [filter, setFilter] = useState<string>("SEMUA");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const paramTab: CaseMode = sp.get("tab") === "praktikum" ? "praktikum" : "mandiri";
    setActiveTab(paramTab);
    setFilter("SEMUA");
  }, [sp]);

  const mandiriQuery = useCaseCatalog("mandiri");
  const praktikumQuery = useCaseCatalog("praktikum");

  const activeQuery = activeTab === "praktikum" ? praktikumQuery : mandiriQuery;
  const rawCases = activeQuery.data ?? [];

  const filters = useMemo(() => {
    const rawCategories = rawCases.map((c) => c.category).filter(Boolean);
    return ["SEMUA", ...Array.from(new Set(rawCategories))];
  }, [rawCases]);

  const cases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawCases.filter((c) => {
      if (filter !== "SEMUA" && c.category !== filter) return false;
      if (q) {
        const hay = `${c.diagnosis} ${c.patientName} ${c.patientMeta} ${c.focus} ${c.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rawCases, filter, search]);

  const handleSelectTab = (tab: CaseMode) => {
    setActiveTab(tab);
    setFilter("SEMUA");
    setSp({ tab }, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft size={14} /> Kembali ke Dashboard
        </Link>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            activeTab === "praktikum"
              ? "bg-gold-100 text-amber-900"
              : "bg-olive-100 text-olive-700",
          )}
        >
          {activeTab === "praktikum"
            ? "Praktikum Terjadwal · Penilaian Resmi"
            : "Latihan Mandiri · Tanpa Nilai Resmi"}
        </span>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-navy-900">Katalog Kasus KIE</h1>
        <p className="mt-1 text-sm text-muted">
          Jelajahi seluruh skenario latihan mandiri maupun tugas praktikum terjadwal untuk kelas
          Anda.
        </p>
      </header>

      {/* Bar Tab Mode + Pencarian */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3.5">
        <div className="inline-flex rounded-xl bg-cream p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleSelectTab("mandiri")}
            className={cn(
              "rounded-lg px-3.5 py-2 transition",
              activeTab === "mandiri"
                ? "bg-navy-900 text-white"
                : "text-muted hover:text-ink",
            )}
          >
            Latihan Mandiri ({mandiriQuery.data?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab("praktikum")}
            className={cn(
              "rounded-lg px-3.5 py-2 transition",
              activeTab === "praktikum"
                ? "bg-navy-900 text-white"
                : "text-muted hover:text-ink",
            )}
          >
            Praktikum Terjadwal ({praktikumQuery.data?.length ?? 0})
          </button>
        </div>

        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul kasus atau pasien..."
            className="w-full rounded-xl border border-line bg-cream py-2 pl-9 pr-3 text-xs outline-none focus:border-navy-900 focus:bg-white"
          />
        </div>
      </div>

      {/* Filter Kategori */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition",
              filter === f
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-line bg-white text-muted hover:text-ink",
            )}
          >
            {f === "SEMUA" ? "Semua Kategori" : f}
          </button>
        ))}
      </div>

      {activeQuery.isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <Loader2 size={26} className="animate-spin text-navy-900" />
          <p className="mt-3 text-sm">Memuat katalog kasus...</p>
        </div>
      )}

      {activeQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
          <p className="font-semibold">Gagal memuat katalog kasus.</p>
          <button
            type="button"
            className="mt-2 font-medium text-navy-900 underline"
            onClick={() => activeQuery.refetch()}
          >
            Coba muat ulang
          </button>
        </div>
      )}

      {!activeQuery.isLoading && !activeQuery.isError && cases.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          Belum ada kasus yang sesuai untuk mode atau kategori ini.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <CaseCard
            key={c.tugasId ?? c.id}
            c={c}
            mode={activeTab}
            isCompleted={activeTab === "praktikum" ? Boolean(c.isPracticumCompleted) : false}
          />
        ))}
      </div>
    </div>
  );
}
