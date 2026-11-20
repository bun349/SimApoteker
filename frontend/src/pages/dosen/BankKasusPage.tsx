import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpDown, FolderSearch, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useDebounce } from "@/hooks/useDebounce";
import { useChangeStatus, useSkenarioList, useTabCounts } from "@/hooks/useSkenario";
import { JENIS_META, PAGE_SIZE, SORTS, STATUS_ARSIP, STATUS_DRAF, STATUS_GROUPS, TAB_LABEL, jenisMeta } from "@/lib/skenario";
import type { SortKey, TabKey } from "@/types/skenario";
import { SkenarioCard } from "@/components/dosen/SkenarioCard";
import { Pagination } from "@/components/dosen/Pagination";
import { cn } from "@/lib/utils";
import { deleteSkenario } from "@/api/wizard";

const TABS: TabKey[] = ["diterbitkan", "draf", "beku", "arsip"];
const select =
  "rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium outline-none focus:border-navy-800";

export default function BankKasusPage() {
  const qc = useQueryClient();
  
  const profile = useAuthStore((s) => s.profile); 
  const ownerId = profile?.id;

  const [tab, setTab] = useState<TabKey>("diterbitkan");
  const [searchInput, setSearchInput] = useState("");
  const [jenis, setJenis] = useState("semua");
  const [sort, setSort] = useState<SortKey>("terbaru");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const list = useSkenarioList(ownerId, { tab, search, jenis, sort, page });
  const counts = useTabCounts(ownerId);
  const change = useChangeStatus(ownerId);

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const move = (id: string, status: string) =>
    change.mutate(
      { id, status },
      {
        onSuccess: () => {
          // Mundur satu halaman jika menghapus/memindah item terakhir di halaman saat ini
          if (items.length === 1 && page > 1) setPage(page - 1);
        },
      },
    );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!ownerId) throw new Error("Anda belum login");
      return deleteSkenario(id, ownerId);
    },
    onSuccess: () => {
      // Jika berhasil, refresh daftar dan jumlah tab
      void qc.invalidateQueries({ queryKey: ["skenario", "list"] });
      void qc.invalidateQueries({ queryKey: ["skenario", "counts"] });
      
      if (items.length === 1 && page > 1) setPage(page - 1);
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted">
            Portal Dosen UNPAD / <span className="font-medium text-ink">Bank Kasus & Studio</span>
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold">Bank Kasus & Studio Skenario</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Kelola modul skenario praktikum farmasi klinis dan susun kasus interaktif baru dengan
            panduan wizard terstruktur.
          </p>
        </div>
        <Link
          to="/dosen/kasus/baru"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-navy-900 shadow-md hover:brightness-95"
        >
          <Plus size={16} /> Buat Skenario Baru
        </Link>
      </header>

      {/* Pencarian & filter */}
      <section className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-60 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Cari kode, judul, atau kata kunci skenario..."
              className="w-full rounded-lg border border-line bg-cream py-2.5 pl-9 pr-3 text-sm outline-none focus:border-navy-800 focus:bg-white"
            />
          </label>

          <select
            value={jenis}
            onChange={(e) => { setJenis(e.target.value); setPage(1); }}
            aria-label="Filter kategori"
            className={select}
          >
            <option value="semua">Semua Kategori ({counts.data?.total ?? 0})</option>
            {Object.keys(JENIS_META).map((k) => (
              <option key={k} value={k}>{jenisMeta(k).label}</option>
            ))}
          </select>

          <label className="relative">
            <ArrowUpDown size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
              aria-label="Urutkan"
              className={cn(select, "pl-8")}
            >
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORTS[k].label}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-3 text-[11px] text-muted">
          Menampilkan {items.length} dari {total} skenario {TAB_LABEL[tab]?.replace(/ \(.*\)/, "") || tab}
        </p>
      </section>

      {/* Tab + sinkronisasi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-xl border border-line bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setPage(1); }}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition",
                tab === t ? "bg-navy-900 text-white" : "text-muted hover:text-ink",
              )}
            >
              {TAB_LABEL[t]}
              <span className={cn("rounded-full px-1.5 py-px text-[10px]", tab === t ? "bg-gold-400 text-navy-900" : "bg-cream")}>
                {counts.data?.[t] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["skenario"] })}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-4 py-2 text-xs font-medium hover:bg-cream"
        >
          {list.isFetching ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} className="text-lime-700" />}
          Sinkronisasi Modul Praktikum Terkini
        </button>
      </div>

      {/* Daftar kartu */}
      {list.isLoading && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      )}

      {list.isError && (
        <div className="rounded-xl bg-red-50 p-6 text-sm text-red-700">
          Gagal memuat skenario.{" "}
          <button className="underline" onClick={() => list.refetch()}>Coba lagi</button>
        </div>
      )}

      {!list.isLoading && !list.isError && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-sm text-muted">
          <FolderSearch size={28} className="mx-auto mb-3 text-muted/60" />
          {search || jenis !== "semua"
            ? "Tidak ada skenario yang cocok dengan pencarian atau filter Anda."
            : `Belum ada skenario di tab ${TAB_LABEL[tab] || tab}.`}
        </div>
      )}

      {items.length > 0 && (
        <div className={cn("grid gap-5 md:grid-cols-2 xl:grid-cols-3", list.isPlaceholderData && "opacity-60 transition")}>
          {items.map((s) => (
            <SkenarioCard
              key={s.id}
              s={s}
              author={profile?.nama_lengkap ?? "Anda"} 
              busy={change.isPending || deleteMutation.isPending}
              onArchive={() => move(s.id, STATUS_ARSIP)}
              
              /* PERBAIKAN LOGIKA PEMULIHAN DISINI */
              onRestore={() => move(s.id, s.beku ? STATUS_GROUPS.diterbitkan[0] : STATUS_DRAF)}
              
              onDelete={() => deleteMutation.mutate(s.id)}
            />
          ))}
        </div>
      )}

      {/* Pesan Error Global */}
      {(change.isError || deleteMutation.isError) && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700">
          Gagal memproses aksi skenario. Coba lagi.
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}