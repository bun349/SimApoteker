import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { fetchDosenReviewQueueApi, type ReviewPriority } from "@/api/antrean";
import { cn } from "@/lib/utils";

function formatShortDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(d);
  return `${datePart}, ${timePart.replace(".", ":")}`;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const AVATAR_TONES = [
  "bg-slate-100 text-navy-900",
  "bg-gold-100 text-amber-900",
  "bg-olive-100 text-olive-700",
] as const;

const PRIORITY_STYLE: Record<ReviewPriority, { dot: string; title: string }> = {
  tinggi: { dot: "bg-red-600", title: "text-red-700" },
  sedang: { dot: "bg-amber-500", title: "text-amber-800" },
  rendah: { dot: "bg-navy-800", title: "text-navy-900" },
};

export default function AntreanTinjauanPage() {
  const profile = useAuthStore((s) => s.profile);
  const dosenId = profile?.id ?? "";
  const [sp, setSp] = useSearchParams();

  const [idKelas, setIdKelas] = useState<string>(sp.get("kelas") || "semua");
  const [idTugas, setIdTugas] = useState<string>(sp.get("tugas") || "semua");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (idKelas !== "semua") next.set("kelas", idKelas);
    if (idTugas !== "semua") next.set("tugas", idTugas);
    setSp(next, { replace: true });
  }, [idKelas, idTugas, setSp]);

  const qQueue = useQuery({
    queryKey: [
      "dosen",
      "antrean",
      dosenId,
      profile?.auth_user_id ?? "",
      idKelas,
      idTugas,
      debouncedSearch,
    ],
    queryFn: () =>
      fetchDosenReviewQueueApi({
        idDosen: dosenId,
        authUserId: profile?.auth_user_id,
        idKelas,
        idTugas,
        search: debouncedSearch,
      }),
    enabled: !!dosenId,
    placeholderData: (prev) => prev,
  });

  const data = qQueue.data;
  const kelasList = data?.filters.kelas_list ?? [];
  const allTugasList = data?.filters.tugas_list ?? [];
  const items = data?.items ?? [];

  const tugasOptions = useMemo(() => {
    if (idKelas === "semua") return allTugasList;
    return allTugasList.filter((t) => t.id_kelas === idKelas);
  }, [allTugasList, idKelas]);

  const handleKelasChange = (nextKelas: string) => {
    setIdKelas(nextKelas);
    if (
      nextKelas !== "semua" &&
      idTugas !== "semua" &&
      !allTugasList.some((t) => t.id_tugas === idTugas && t.id_kelas === nextKelas)
    ) {
      setIdTugas("semua");
    }
  };

  const hasActiveFilter =
    idKelas !== "semua" || idTugas !== "semua" || searchInput.trim().length > 0;

  const resetFilters = () => {
    setIdKelas("semua");
    setIdTugas("semua");
    setSearchInput("");
    setDebouncedSearch("");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-12">
      {/* Header — disamakan dengan halaman dosen lainnya */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-medium text-muted">
            Portal Dosen UNPAD /{" "}
            <span className="font-semibold text-olive-600">Antrean &amp; Tinjauan</span>
          </p>
          <h1 className="mt-1.5 text-2xl font-bold text-navy-900 sm:text-3xl">
            Antrean &amp; Tinjauan Sesi Praktikum
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sesi mahasiswa yang perlu verifikasi manual sebelum Nilai Resmi terbit.
          </p>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
          >
            <RotateCcw size={13} /> Reset Filter
          </button>
        )}
      </header>

      {/* Banner Peringatan Ringkas (tampil jika ada sesi dalam antrean) */}
      {items.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-gold-400/50 bg-gold-100/75 px-4 py-3 text-xs text-amber-950">
          <AlertTriangle size={15} className="shrink-0 text-amber-700" />
          <p>
            <strong className="font-semibold">{items.length} sesi</strong> perlu tinjauan manual
            karena terdeteksi deviasi kritis atau butir evaluasi ambigu.
          </p>
        </div>
      )}

      {/* Bar Filter: Cari Nama/NPM + Filter Kelas + Filter Tugas + Info Urutan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Pencarian Praktikan */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama atau NPM"
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-navy-900"
            />
          </div>

          {/* Filter Kelas */}
          <select
            value={idKelas}
            onChange={(e) => handleKelasChange(e.target.value)}
            aria-label="Filter kelas"
            className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-navy-900"
          >
            <option value="semua">Semua kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama_kelas}
              </option>
            ))}
          </select>

          {/* Filter Tugas (menggantikan Semua skenario) */}
          <select
            value={idTugas}
            onChange={(e) => setIdTugas(e.target.value)}
            aria-label="Filter tugas"
            className="max-w-xs rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-navy-900"
          >
            <option value="semua">Semua tugas ({tugasOptions.length})</option>
            {tugasOptions.map((t) => (
              <option key={t.id_tugas} value={t.id_tugas}>
                {t.kode_skenario} v{t.versi} · {t.judul} ({t.nama_kelas})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          {qQueue.isFetching && !qQueue.isLoading && (
            <Loader2 size={13} className="animate-spin text-navy-900" />
          )}
          <span>Urut: prioritas tertinggi · Farmasi Komunitas &amp; Klinis</span>
        </div>
      </div>

      {qQueue.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {qQueue.error instanceof Error
            ? qQueue.error.message
            : "Gagal memuat antrean tinjauan praktikum."}
        </div>
      )}

      {/* Tabel Antrean Tinjauan */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {qQueue.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <Loader2 size={26} className="animate-spin text-navy-900" />
            <p className="mt-3 text-xs">Memuat antrean tinjauan sesi praktikum...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-olive-100 text-olive-700">
              <CheckCircle2 size={22} />
            </span>
            <h2 className="mt-4 text-base font-bold text-navy-900">
              {hasActiveFilter
                ? "Tidak ada sesi antrean yang sesuai filter"
                : "Antrean Tinjauan Kosong"}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              {hasActiveFilter
                ? "Ubah pilihan kelas, tugas, atau kata kunci pencarian untuk melihat sesi lainnya."
                : "Seluruh sesi praktikum yang memerlukan verifikasi manual telah selesai ditinjau."}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50"
              >
                <RotateCcw size={13} /> Tampilkan Semua Antrean
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-white text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-3.5">Praktikan</th>
                  <th className="px-4 py-3.5">Tugas / Skenario</th>
                  <th className="px-4 py-3.5">Pemicu Tinjauan</th>
                  <th className="px-4 py-3.5 text-right">Nilai Sistem</th>
                  <th className="px-6 py-3.5 text-right" />
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {items.map((item, idx) => {
                  const pStyle = PRIORITY_STYLE[item.prioritas] || PRIORITY_STYLE.rendah;
                  const avatarTone = AVATAR_TONES[idx % AVATAR_TONES.length];
                  const isTopPriorityRow = idx === 0;

                  return (
                    <tr key={item.id_sesi} className="transition hover:bg-slate-50/70">
                      {/* Praktikan */}
                      <td className="min-w-[220px] px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold",
                              avatarTone,
                            )}
                          >
                            {getInitials(item.nama_mahasiswa)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">
                              {item.nama_mahasiswa}
                            </p>
                            <p className="mt-0.5 text-xs text-muted">
                              <span className="font-mono">{item.nomor_induk}</span>
                              {item.nama_kelas && item.nama_kelas !== "-" && (
                                <> · {item.nama_kelas}</>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tugas / Skenario */}
                      <td className="min-w-[240px] max-w-[300px] px-4 py-4 align-middle">
                        <p className="font-semibold text-ink">{item.judul_skenario}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {item.kode_skenario} · v{item.versi_skenario} · Selesai{" "}
                          {formatShortDateTime(item.waktu_selesai)}
                        </p>
                      </td>

                      {/* Pemicu Tinjauan */}
                      <td className="min-w-[260px] max-w-[340px] px-4 py-4 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", pStyle.dot)} />
                          <span className={cn("text-xs font-semibold", pStyle.title)}>
                            {item.pemicu_judul}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                          {item.pemicu_deskripsi}
                        </p>
                      </td>

                      {/* Nilai Sistem */}
                      <td className="whitespace-nowrap px-4 py-4 text-right align-middle tabular-nums">
                        {item.nilai_sistem !== null ? (
                          <div className="inline-flex items-baseline gap-0.5">
                            <span className="text-lg font-bold text-navy-900">
                              {item.nilai_sistem}
                            </span>
                            <span className="text-xs text-muted">/100</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>

                      {/* Aksi Tinjau */}
                      <td className="whitespace-nowrap px-6 py-4 text-right align-middle">
                        <Link
                          to={`/dosen/rapor?sesi=${encodeURIComponent(item.id_sesi)}&from=antrean`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition",
                            isTopPriorityRow
                              ? "bg-navy-900 text-white hover:bg-navy-800"
                              : "border border-line bg-white text-navy-900 hover:bg-slate-50",
                          )}
                        >
                          Tinjau <ArrowRight size={13} />
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
    </div>
  );
}
