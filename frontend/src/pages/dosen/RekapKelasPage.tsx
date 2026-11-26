import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flag,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  fetchDosenRecapApi,
  type RecapStatusFilter,
  type RecapStudentRow,
  type RecapTaskScoreCell,
} from "@/api/rekap";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50] as const;

const STATUS_META: Record<
  RecapStudentRow["status_ringkas"],
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  selesai: {
    label: "Selesai",
    cls: "bg-olive-100 text-olive-700",
    icon: CheckCircle2,
  },
  perlu_ditinjau: {
    label: "Perlu Ditinjau",
    cls: "bg-gold-100 text-amber-900",
    icon: Flag,
  },
  tidak_cukup_data: {
    label: "Tidak Cukup Data",
    cls: "bg-amber-50 text-amber-800 border border-amber-200",
    icon: AlertTriangle,
  },
  belum_mengerjakan: {
    label: "Belum Mengerjakan",
    cls: "bg-slate-100 text-slate-600",
    icon: Clock,
  },
};

function pillarBarTone(score: number | null): string {
  if (score === null) return "bg-slate-200";
  if (score >= 75) return "bg-olive-600";
  if (score >= 55) return "bg-gold-400";
  return "bg-red-600";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted";
  if (score >= 75) return "text-olive-700";
  if (score >= 60) return "text-amber-800";
  return "text-red-700";
}

function CellBadge({
  cell,
  studentId,
}: {
  cell: RecapTaskScoreCell | undefined;
  studentId: string;
}) {
  if (!cell || !cell.assigned) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  if (cell.status_ui === "belum_mengerjakan") {
    return <span className="text-xs text-muted">Belum</span>;
  }

  if (cell.status_ui === "tidak_cukup_data") {
    return cell.id_sesi ? (
      <Link
        to={`/dosen/rapor?sesi=${encodeURIComponent(cell.id_sesi)}`}
        title="Data belum mencukupi — klik untuk lihat detail"
        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
      >
        Kurang
      </Link>
    ) : (
      <span className="text-xs text-amber-700">Kurang</span>
    );
  }

  const score = cell.nilai_resmi ?? cell.nilai_sistem;
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums transition",
        cell.status_ui === "perlu_ditinjau"
          ? "bg-gold-100 text-amber-900 hover:bg-gold-400/40"
          : "bg-slate-50 text-ink hover:bg-slate-100",
      )}
    >
      <span className={scoreColor(score)}>{score !== null ? score : "—"}</span>
      {cell.status_ui === "perlu_ditinjau" && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-700" title="Perlu ditinjau dosen" />
      )}
      {cell.is_overridden && (
        <span className="text-[10px] font-medium text-navy-800" title="Nilai override dosen">
          *
        </span>
      )}
    </span>
  );

  if (cell.id_sesi) {
    return (
      <Link
        key={`${studentId}-${cell.id_sesi}`}
        to={`/dosen/rapor?sesi=${encodeURIComponent(cell.id_sesi)}`}
        title="Buka rapor untuk tugas ini"
      >
        {content}
      </Link>
    );
  }
  return content;
}

export default function RekapKelasPage() {
  const profile = useAuthStore((s) => s.profile);
  const dosenId = profile?.id ?? "";
  const [sp, setSp] = useSearchParams();

  const [idKelas, setIdKelas] = useState<string>(sp.get("kelas") || "semua");
  const [idTugas, setIdTugas] = useState<string>(sp.get("tugas") || "semua");
  const [statusFilter, setStatusFilter] = useState<RecapStatusFilter>(
    (sp.get("status") as RecapStatusFilter) || "semua",
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Debounce pencarian ringan agar tidak spam request saat mengetik
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Reset halaman ke 1 saat filter atau pageSize berubah
  useEffect(() => {
    setPage(1);
  }, [idKelas, idTugas, statusFilter, debouncedSearch, pageSize]);

  // Sinkronkan URL query agar mudah dibagikan / di-refresh
  useEffect(() => {
    const next = new URLSearchParams();
    if (idKelas !== "semua") next.set("kelas", idKelas);
    if (idTugas !== "semua") next.set("tugas", idTugas);
    if (statusFilter !== "semua") next.set("status", statusFilter);
    setSp(next, { replace: true });
  }, [idKelas, idTugas, statusFilter, setSp]);

  const qRecap = useQuery({
    queryKey: [
      "dosen",
      "rekap",
      dosenId,
      profile?.auth_user_id ?? "",
      idKelas,
      idTugas,
      statusFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      fetchDosenRecapApi({
        idDosen: dosenId,
        authUserId: profile?.auth_user_id,
        idKelas,
        idTugas,
        status: statusFilter,
        search: debouncedSearch,
      }),
    enabled: !!dosenId,
    placeholderData: (prev) => prev,
  });

  const data = qRecap.data;
  const kelasList = data?.filters.kelas_list ?? [];
  const allTugasList = data?.filters.tugas_list ?? [];

  // Filter pilihan dropdown tugas sesuai kelas yang sedang dipilih
  const tugasOptions = useMemo(() => {
    if (idKelas === "semua") return allTugasList;
    return allTugasList.filter((t) => t.id_kelas === idKelas);
  }, [allTugasList, idKelas]);

  // Jika kelas diganti dan tugas terpilih bukan milik kelas tersebut, reset tugas ke "semua"
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
    idKelas !== "semua" ||
    idTugas !== "semua" ||
    statusFilter !== "semua" ||
    searchInput.trim().length > 0;

  const resetFilters = () => {
    setIdKelas("semua");
    setIdTugas("semua");
    setStatusFilter("semua");
    setSearchInput("");
    setDebouncedSearch("");
  };

  const students = data?.students ?? [];
  const taskColumns = data?.task_columns ?? [];
  const selectedTugas = data?.selected_tugas ?? null;
  const isSingleTaskMode = selectedTugas !== null;

  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = students.slice(startIdx, startIdx + pageSize);

  const summary = data?.summary ?? {
    total_mahasiswa: 0,
    total_tuntas: 0,
    tingkat_penyelesaian_persen: 0,
    rata_rata_nilai: null,
    nilai_tertinggi: null,
    nilai_terendah: null,
    perlu_ditinjau_count: 0,
    belum_mengerjakan_count: 0,
    tidak_cukup_data_count: 0,
    total_sesi_dinilai: 0,
  };

  const pactAggregate = data?.pact_aggregate ?? [];
  const weakestPillar = data?.weakest_pillar ?? null;
  const radarItems = data?.clinical_error_radar ?? [];

  const handleExportCsv = () => {
    if (!students.length) return;
    const headers = isSingleTaskMode
      ? [
          "Nama",
          "NPM",
          "Kelas",
          `${selectedTugas.kode_skenario} (Sistem)`,
          `${selectedTugas.kode_skenario} (Resmi)`,
          "Status",
        ]
      : [
          "Nama",
          "NPM",
          "Kelas",
          ...taskColumns.map((c) => c.kode_skenario),
          "Rata-rata",
          "Status",
        ];

    const csvEscape = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const lines = [headers.map(csvEscape).join(",")];
    for (const st of students) {
      if (isSingleTaskMode) {
        const cell = st.task_scores[selectedTugas.id_skenario];
        lines.push(
          [
            st.nama_lengkap,
            st.nomor_induk,
            st.nama_kelas,
            cell?.nilai_sistem ?? "",
            cell?.nilai_resmi ?? "",
            STATUS_META[st.status_ringkas].label,
          ]
            .map(csvEscape)
            .join(","),
        );
      } else {
        lines.push(
          [
            st.nama_lengkap,
            st.nomor_induk,
            st.nama_kelas,
            ...taskColumns.map((c) => {
              const cell = st.task_scores[c.id_skenario];
              return cell?.nilai_resmi ?? cell?.nilai_sistem ?? "";
            }),
            st.rata_rata ?? "",
            STATUS_META[st.status_ringkas].label,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    }

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-kelas-${selectedTugas?.kode_skenario || "semua"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-medium text-muted">
            Portal Dosen UNPAD /{" "}
            <span className="font-semibold text-olive-600">Rekap Kelas &amp; Analitik</span>
          </p>
          <h1 className="mt-1.5 text-2xl font-bold text-navy-900 sm:text-3xl">
            Rekap Kelas &amp; Analitik
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pantau capaian praktikum per kelas, analisis 5 pilar PaCT, radar kesalahan klinis, dan
            nilai tiap tugas praktikan.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={students.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-semibold text-navy-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} /> Ekspor CSV
        </button>
      </header>

      {/* ================================================================
          BAGIAN 1: BAR FILTER UTAMA (NYAMAN & REAKTIF)
         ================================================================ */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1.35fr_1fr_1.35fr]">
          {/* Filter Kelas */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">Kelas</label>
            <select
              value={idKelas}
              onChange={(e) => handleKelasChange(e.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-3.5 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-navy-900 focus:bg-white"
            >
              <option value="semua">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tugas / Skenario */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              Tugas / Skenario
            </label>
            <select
              value={idTugas}
              onChange={(e) => setIdTugas(e.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-3.5 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-navy-900 focus:bg-white"
            >
              <option value="semua">Semua Tugas</option>
              {tugasOptions.map((t) => (
                <option key={t.id_tugas} value={t.id_tugas}>
                  {t.kode_skenario} v{t.versi} · {t.judul} ({t.nama_kelas}
                  {t.status !== "Aktif" ? ` · ${t.status}` : ""})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              Status Evaluasi
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RecapStatusFilter)}
              className="w-full rounded-xl border border-line bg-cream px-3.5 py-2.5 text-sm font-medium text-ink outline-none transition focus:border-navy-900 focus:bg-white"
            >
              <option value="semua">Semua Status</option>
              <option value="selesai">Selesai</option>
              <option value="perlu_ditinjau">Perlu Ditinjau</option>
              <option value="belum_mengerjakan">Belum Mengerjakan</option>
              <option value="tidak_cukup_data">Tidak Cukup Data</option>
            </select>
          </div>

          {/* Pencarian Praktikan */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              Cari Praktikan
            </label>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nama atau NPM praktikan..."
                className="w-full rounded-xl border border-line bg-cream py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-navy-900 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {hasActiveFilter && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
            <span className="text-muted">
              Menampilkan data sesuai filter aktif ({summary.total_mahasiswa} praktikan).
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 font-semibold text-navy-900 hover:underline"
            >
              <RotateCcw size={12} /> Reset Filter
            </button>
          </div>
        )}
      </section>

      {qRecap.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {qRecap.error instanceof Error
            ? qRecap.error.message
            : "Gagal memuat rekap kelas dan analitik."}
        </div>
      )}

      {/* ================================================================
          BAGIAN 2: PANEL RINGKASAN & ANALITIK KELAS
         ================================================================ */}
      <section className="space-y-4">
        {/* 4 Kartu Ringkasan */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium text-muted">Rata-rata Nilai</p>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-navy-900">
                {summary.rata_rata_nilai !== null ? summary.rata_rata_nilai.toFixed(1) : "—"}
              </span>
              <span className="text-xs text-muted">/ 100</span>
            </div>
            <p className="mt-2 text-xs text-muted tabular-nums">
              {summary.nilai_terendah !== null && summary.nilai_tertinggi !== null
                ? `Rentang: ${summary.nilai_terendah} – ${summary.nilai_tertinggi}`
                : "Belum ada sesi ternilai"}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium text-muted">Tingkat Penyelesaian</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-navy-900">
                {summary.total_tuntas}/{summary.total_mahasiswa}
              </span>
              <span className="text-xs font-semibold tabular-nums text-olive-700">
                {summary.tingkat_penyelesaian_persen.toFixed(0)}%
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-olive-600 transition-all"
                style={{ width: `${Math.min(100, summary.tingkat_penyelesaian_persen)}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "perlu_ditinjau" ? "semua" : "perlu_ditinjau")
            }
            className={cn(
              "rounded-2xl border p-5 text-left transition",
              summary.perlu_ditinjau_count > 0
                ? "border-gold-400/50 bg-gold-100/75 hover:bg-gold-100"
                : "border-line bg-white hover:border-slate-300",
            )}
          >
            <p className="text-xs font-medium text-amber-900">Perlu Ditinjau</p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums text-amber-900">
              {summary.perlu_ditinjau_count}
            </p>
            <p className="mt-2 text-xs text-amber-900/80">
              {statusFilter === "perlu_ditinjau"
                ? "Klik untuk tampilkan semua"
                : "Klik untuk saring antrean tinjau"}
            </p>
          </button>

          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium text-muted">Belum Tuntas / Data Kurang</p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums text-navy-900">
              {summary.belum_mengerjakan_count + summary.tidak_cukup_data_count}
            </p>
            <p className="mt-2 text-xs text-muted tabular-nums">
              {summary.belum_mengerjakan_count} belum · {summary.tidak_cukup_data_count} tidak cukup
              data
            </p>
          </div>
        </div>

        {/* 2 Panel Analitik: Agregat 5 Pilar PaCT + Radar Kesalahan Klinis */}
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* Skor Agregat PaCT */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-navy-900">
                  Skor Agregat PaCT (5 Pilar Komunikasi)
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Rata-rata capaian komunikasi praktikan pada cakupan filter aktif.
                </p>
              </div>
              {weakestPillar && (
                <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                  Pilar terlemah: Pilar {weakestPillar}
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3.5">
              {pactAggregate.map((p) => {
                const isWeakest = weakestPillar === p.kode;
                return (
                  <div key={p.kode} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-ink">
                        <span className="mr-1.5 font-mono font-bold text-navy-900">
                          Pilar {p.kode}
                        </span>
                        {p.label}
                        {isWeakest && (
                          <span className="ml-2 rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                            Perlu fokus
                          </span>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums text-navy-900">
                        {p.rata_rata !== null ? `${p.rata_rata.toFixed(1)}` : "—"}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pillarBarTone(p.rata_rata),
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, p.rata_rata ?? 0))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Radar Kesalahan Klinis */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-navy-900">Radar Kesalahan Klinis</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Temuan kesalahan kritis &amp; butir klinis yang paling sering terlewat.
                </p>
              </div>
              <span className="text-xs text-muted tabular-nums">
                {summary.total_sesi_dinilai} sesi dinilai
              </span>
            </div>

            {radarItems.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-line bg-cream px-4 py-8 text-center text-xs text-muted">
                Belum ada temuan kesalahan klinis tercatat pada cakupan filter ini.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {radarItems.map((item) => {
                  const isCritical = item.tipe === "kesalahan_kritis";
                  return (
                    <div
                      key={`${item.tipe}-${item.kode}-${item.judul}`}
                      className="rounded-xl border border-line bg-cream/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                                isCritical
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gold-100 text-amber-900",
                              )}
                            >
                              {isCritical && <ShieldAlert size={10} />}
                              {item.kode}
                            </span>
                            <span className="text-[11px] text-muted">{item.kategori}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-ink">
                            {item.judul}
                          </p>
                        </div>

                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-xs font-bold text-navy-900">
                            {item.jumlah_praktikan} praktikan
                          </p>
                          <p className="text-[11px] text-muted">{item.persentase.toFixed(0)}%</p>
                        </div>
                      </div>

                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isCritical ? "bg-red-600" : "bg-gold-400",
                          )}
                          style={{ width: `${Math.min(100, item.persentase)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          BAGIAN 3: TABEL NILAI MAHASISWA (PEMISAHAN NILAI TIAP TUGAS)
         ================================================================ */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-navy-900">
              {isSingleTaskMode
                ? `Daftar Nilai — ${selectedTugas.kode_skenario} · ${selectedTugas.judul}`
                : "Daftar Nilai Praktikan per Tugas"}
            </h2>
            <p className="text-xs text-muted">
              {isSingleTaskMode
                ? "Menampilkan perbandingan nilai sistem, nilai resmi/override dosen, dan status evaluasi."
                : "Nilai tiap skenario dipisahkan per kolom agar performa antar tugas mudah dibandingkan."}
            </p>
          </div>
          {qRecap.isFetching && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={13} className="animate-spin text-navy-900" /> Memperbarui...
            </span>
          )}
        </div>

        {qRecap.isLoading ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted">
            <Loader2 size={26} className="animate-spin text-navy-900" />
            <p className="mt-3 text-xs">Memuat rekap nilai praktikan...</p>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">
              Tidak ada data praktikan untuk filter ini.
            </p>
            <p className="mt-1 text-xs text-muted">
              Coba ubah filter kelas, tugas, status, atau kata kunci pencarian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Praktikan</th>
                  <th className="px-4 py-3.5">Kelas</th>
                  {isSingleTaskMode ? (
                    <>
                      <th className="px-4 py-3.5 text-center">Nilai Sistem</th>
                      <th className="px-4 py-3.5 text-center">Nilai Resmi</th>
                      <th className="px-4 py-3.5 text-center">PaCT / Konten</th>
                    </>
                  ) : (
                    <>
                      {taskColumns.map((col) => (
                        <th
                          key={col.id_skenario}
                          className="whitespace-nowrap px-3.5 py-3.5 text-center"
                          title={`${col.kode_skenario} · ${col.judul}`}
                        >
                          <div>{col.kode_skenario}</div>
                          <div className="font-normal normal-case text-[10px] text-muted/80">
                            v{col.versi}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3.5 text-center">Rata-rata</th>
                    </>
                  )}
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {pageRows.map((st) => {
                  const stMeta = STATUS_META[st.status_ringkas];
                  const StIcon = stMeta.icon;
                  const singleCell = isSingleTaskMode
                    ? st.task_scores[selectedTugas.id_skenario]
                    : undefined;
                  const targetSessionId = isSingleTaskMode
                    ? singleCell?.id_sesi
                    : st.latest_session_id;

                  return (
                    <tr key={st.id_mahasiswa} className="transition hover:bg-slate-50/70">
                      <td className="min-w-[200px] px-5 py-3.5">
                        <p className="font-semibold text-ink">{st.nama_lengkap}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted">{st.nomor_induk}</p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-muted">
                        {st.nama_kelas}
                      </td>

                      {isSingleTaskMode ? (
                        <>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold tabular-nums text-ink">
                            {singleCell?.nilai_sistem ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center tabular-nums">
                            <span
                              className={cn(
                                "text-sm font-bold",
                                scoreColor(singleCell?.nilai_resmi ?? null),
                              )}
                            >
                              {singleCell?.nilai_resmi ?? "—"}
                            </span>
                            {singleCell?.is_overridden && (
                              <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy-900">
                                Dosen
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center text-xs tabular-nums text-muted">
                            {singleCell?.skor_komunikasi != null || singleCell?.skor_konten != null
                              ? `${singleCell?.skor_komunikasi ?? "—"} / ${singleCell?.skor_konten ?? "—"}`
                              : "—"}
                          </td>
                        </>
                      ) : (
                        <>
                          {taskColumns.map((col) => (
                            <td
                              key={col.id_skenario}
                              className="whitespace-nowrap px-3.5 py-3.5 text-center"
                            >
                              <CellBadge
                                cell={st.task_scores[col.id_skenario]}
                                studentId={st.id_mahasiswa}
                              />
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-4 py-3.5 text-center tabular-nums">
                            <span className={cn("text-sm font-bold", scoreColor(st.rata_rata))}>
                              {st.rata_rata !== null ? st.rata_rata.toFixed(1) : "—"}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            stMeta.cls,
                          )}
                        >
                          <StIcon size={12} /> {stMeta.label}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        {targetSessionId ? (
                          <Link
                            to={`/dosen/rapor?sesi=${encodeURIComponent(targetSessionId)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
                          >
                            Lihat Rapor <ArrowRight size={12} />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ================================================================
            BAGIAN 4: NAVIGASI & PAGINASI
           ================================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-cream/60 px-6 py-3.5 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Menampilkan{" "}
              <b className="text-ink">
                {students.length === 0 ? 0 : startIdx + 1}–
                {Math.min(startIdx + pageSize, students.length)}
              </b>{" "}
              dari <b className="text-ink">{students.length}</b> praktikan
            </span>

            <label className="inline-flex items-center gap-1.5">
              <span>Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink outline-none focus:border-navy-900"
              >
                {PAGE_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-slate-50 disabled:opacity-40"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2))
              .map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setPage(pNum)}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg text-xs font-semibold transition",
                    pNum === safePage
                      ? "bg-navy-900 text-white"
                      : "border border-line bg-white text-ink hover:bg-slate-50",
                  )}
                >
                  {pNum}
                </button>
              ))}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-slate-50 disabled:opacity-40"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
