import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  Flag,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  fetchDosenDashboardData,
  fetchKamusIstilahUmum,
  type DashboardSessionStatus,
} from "@/api/dosenDashboard";
import { cn } from "@/lib/utils";

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  })
    .format(d)
    .replace(".", ":");
}

function pillarBarTone(score: number | null): string {
  if (score === null) return "bg-slate-200";
  if (score >= 75) return "bg-olive-600";
  if (score >= 55) return "bg-gold-400";
  return "bg-red-600";
}

function jenisLabel(jenis: string): string {
  const j = jenis.toLowerCase();
  if (j.includes("kronis")) return "Resep Kronis";
  if (j.includes("akut")) return "Resep Akut";
  return "Swamedikasi";
}

const SESSION_STATUS_META: Record<
  DashboardSessionStatus,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  perlu_ditinjau: {
    label: "Perlu Ditinjau",
    cls: "bg-gold-100 text-amber-900",
    icon: Flag,
  },
  selesai: {
    label: "Selesai",
    cls: "bg-olive-100 text-olive-700",
    icon: CheckCircle2,
  },
  tidak_cukup_data: {
    label: "Data Kurang",
    cls: "border border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
};

export default function DosenDashboardPage() {
  const profile = useAuthStore((s) => s.profile);
  const dosenId = profile?.id ?? "";

  // Filter tabel cuplikan sesi
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"semua" | DashboardSessionStatus>("semua");
  const [kelasFilter, setKelasFilter] = useState("semua");

  // Modal Kamus Istilah Medis
  const [kamusOpen, setKamusOpen] = useState(false);
  const [kamusQuery, setKamusQuery] = useState("");

  const qDashboard = useQuery({
    queryKey: ["dosen", "dashboard", dosenId, profile?.auth_user_id ?? ""],
    queryFn: () =>
      fetchDosenDashboardData({
        idDosen: dosenId,
        authUserId: profile?.auth_user_id,
      }),
    enabled: !!dosenId,
  });

  const qKamus = useQuery({
    queryKey: ["dosen", "kamus-istilah"],
    queryFn: fetchKamusIstilahUmum,
    enabled: kamusOpen,
    staleTime: 5 * 60_000,
  });

  const data = qDashboard.data;
  const recap = data?.recap;
  const kelasList = recap?.filters.kelas_list ?? [];
  const activeTaskCount = useMemo(
    () => (recap?.filters.tugas_list ?? []).filter((t) => t.status === "Aktif").length,
    [recap],
  );

  const summary = recap?.summary ?? {
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
  const pendingReviewCount = data?.pendingReviewCount ?? summary.perlu_ditinjau_count;

  const pactAggregate = recap?.pact_aggregate ?? [
    { kode: "A", label: "Membangun Koneksi", rata_rata: null, jumlah_sampel: 0 },
    { kode: "B", label: "Perspektif Pasien", rata_rata: null, jumlah_sampel: 0 },
    { kode: "C", label: "Respons Empatik", rata_rata: null, jumlah_sampel: 0 },
    { kode: "D", label: "Edukasi Kolaboratif", rata_rata: null, jumlah_sampel: 0 },
    { kode: "E", label: "Komunikasi Efektif", rata_rata: null, jumlah_sampel: 0 },
  ];
  const weakestPillar = recap?.weakest_pillar ?? null;

  const filteredSessions = useMemo(() => {
    const rows = data?.recentSessions ?? [];
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (kelasFilter !== "semua" && r.id_kelas !== kelasFilter) return false;
        if (statusFilter !== "semua" && r.status_ui !== statusFilter) return false;
        if (q) {
          const hay =
            `${r.nama_mahasiswa} ${r.nomor_induk} ${r.judul_skenario} ${r.kode_skenario}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 8);
  }, [data?.recentSessions, search, statusFilter, kelasFilter]);

  const filteredKamus = useMemo(() => {
    const rows = qKamus.data ?? [];
    const q = kamusQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (k) =>
        k.istilah.toLowerCase().includes(q) ||
        k.kelompok.toLowerCase().includes(q) ||
        k.padanan_awam.some((p) => p.toLowerCase().includes(q)),
    );
  }, [qKamus.data, kamusQuery]);

  const handleDownloadRecapCsv = () => {
    if (!recap || recap.students.length === 0) return;
    const cols = recap.task_columns;
    const csvEscape = (v: unknown) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const headers = [
      "Nama Praktikan",
      "NPM",
      "Kelas",
      ...cols.map((c) => `${c.kode_skenario} (v${c.versi})`),
      "Rata-rata",
      "Status",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    for (const st of recap.students) {
      lines.push(
        [
          st.nama_lengkap,
          st.nomor_induk,
          st.nama_kelas,
          ...cols.map((c) => {
            const cell = st.task_scores[c.id_skenario];
            return cell?.nilai_resmi ?? cell?.nilai_sistem ?? "";
          }),
          st.rata_rata ?? "",
          st.status_ringkas,
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rekap-nilai-praktikum-vikie.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-14">
      {/* ================================================================
          1. HEADER & AKSI CEPAT
         ================================================================ */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-medium text-muted">
            Portal Dosen UNPAD /{" "}
            <span className="font-semibold text-olive-600">Dashboard Dosen</span>
          </p>
          <h1 className="mt-1.5 text-2xl font-bold text-navy-900 sm:text-3xl">
            Halo, {profile?.nama_lengkap || "Dosen Penguji"}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
            {profile?.nomor_induk && (
              <span className="font-mono font-semibold text-ink">{profile.nomor_induk}</span>
            )}
            <span>·</span>
            <span>
              {kelasList.length > 0
                ? kelasList.map((k) => k.nama_kelas).join(", ")
                : "Farmasi Komunitas & Klinis"}
            </span>
            <span>·</span>
            <span>{activeTaskCount} tugas praktikum aktif</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadRecapCsv}
            disabled={!recap || recap.students.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-semibold text-navy-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download size={14} /> Unduh Rekap
          </button>
          <Link
            to="/dosen/penugasan"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
          >
            <CalendarClock size={14} /> Tugaskan ke Kelas
          </Link>
          <Link
            to="/dosen/kasus/baru"
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-navy-800"
          >
            <Plus size={14} /> Buat Skenario Baru
          </Link>
        </div>
      </header>

      {qDashboard.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {qDashboard.error instanceof Error
            ? qDashboard.error.message
            : "Gagal memuat ringkasan dashboard dosen."}
        </div>
      )}

      {/* ================================================================
          2. 3 KARTU RINGKASAN KPI
         ================================================================ */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* KPI 1: Rerata Nilai Gabungan */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-medium text-muted">Rerata Nilai Gabungan</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-navy-900">
              {summary.rata_rata_nilai !== null ? summary.rata_rata_nilai.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-muted">/ 100</span>
          </div>
          <p className="mt-2.5 text-xs text-muted tabular-nums">
            {summary.nilai_terendah !== null && summary.nilai_tertinggi !== null
              ? `Rentang ${summary.nilai_terendah}–${summary.nilai_tertinggi} · ${summary.total_sesi_dinilai} sesi ternilai`
              : "Belum ada sesi praktikum ternilai"}
          </p>
        </div>

        {/* KPI 2: Jumlah Antrean Perlu Ditinjau */}
        <Link
          to="/dosen/antrean"
          className={cn(
            "group flex flex-col justify-between rounded-2xl border p-5 transition",
            pendingReviewCount > 0
              ? "border-gold-400/60 bg-gold-100/75 hover:bg-gold-100"
              : "border-line bg-white hover:border-slate-300",
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-xs font-medium",
                  pendingReviewCount > 0 ? "text-amber-900" : "text-muted",
                )}
              >
                Antrean Perlu Ditinjau
              </p>
              <ArrowRight
                size={14}
                className={cn(
                  "transition group-hover:translate-x-0.5",
                  pendingReviewCount > 0 ? "text-amber-900" : "text-muted",
                )}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  pendingReviewCount > 0 ? "text-amber-950" : "text-navy-900",
                )}
              >
                {pendingReviewCount}
              </span>
              <span
                className={cn(
                  "text-xs",
                  pendingReviewCount > 0 ? "text-amber-900/80" : "text-muted",
                )}
              >
                sesi
              </span>
            </div>
          </div>
          <p
            className={cn(
              "mt-2.5 text-xs",
              pendingReviewCount > 0 ? "text-amber-900/85" : "text-muted",
            )}
          >
            {pendingReviewCount > 0
              ? "Buka antrean verifikasi manual"
              : "Semua sesi telah ditinjau (Inbox Zero)"}
          </p>
        </Link>

        {/* KPI 3: Tingkat Penyelesaian Sesi Mahasiswa */}
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-medium text-muted">Tingkat Penyelesaian Mahasiswa</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-navy-900">
              {summary.total_tuntas}/{summary.total_mahasiswa}
            </span>
            <span className="text-xs font-semibold tabular-nums text-olive-700">
              {summary.tingkat_penyelesaian_persen.toFixed(0)}%
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-olive-600 transition-all"
              style={{ width: `${Math.min(100, summary.tingkat_penyelesaian_persen)}%` }}
            />
          </div>
        </div>
      </section>

      {/* ================================================================
          3. TABEL CUPLIKAN SESI MAHASISWA  +  4. RINGKASAN 5 PILAR PaCT
         ================================================================ */}
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_330px]">
        {/* BAGIAN 3: TABEL CUPLIKAN SESI MAHASISWA */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-navy-900">Cuplikan Sesi Mahasiswa</h2>
              <p className="mt-0.5 text-xs text-muted">
                Sesi praktikum terbaru lintas kelas beserta status diagnostiknya.
              </p>
            </div>
            <Link
              to="/dosen/rekap"
              className="inline-flex items-center gap-1 text-xs font-semibold text-navy-900 hover:underline"
            >
              Rekap Lengkap <ArrowRight size={13} />
            </Link>
          </div>

          {/* Filter Pencarian, Status, dan Kelas */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-cream/60 px-5 py-3">
            <div className="relative min-w-[180px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NPM, atau skenario..."
                className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs text-ink outline-none transition placeholder:text-muted/70 focus:border-navy-900"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "semua" | DashboardSessionStatus)
              }
              aria-label="Filter status sesi"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink outline-none focus:border-navy-900"
            >
              <option value="semua">Semua status</option>
              <option value="perlu_ditinjau">Perlu Ditinjau</option>
              <option value="selesai">Selesai</option>
              <option value="tidak_cukup_data">Data Kurang</option>
            </select>

            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              aria-label="Filter kelas"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-ink outline-none focus:border-navy-900"
            >
              <option value="semua">Semua kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          {qDashboard.isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted">
              <Loader2 size={24} className="animate-spin text-navy-900" />
              <p className="mt-2.5 text-xs">Memuat sesi praktikum mahasiswa...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-ink">Belum ada sesi yang cocok</p>
              <p className="mt-1 text-xs text-muted">
                Coba ubah filter kelas, status, atau kata kunci pencarian.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-white text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-5 py-3">Praktikan</th>
                    <th className="px-3.5 py-3">Skenario</th>
                    <th className="px-3.5 py-3 text-right">Nilai</th>
                    <th className="px-3.5 py-3">Status / Diagnostik</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredSessions.map((row) => {
                    const stMeta = SESSION_STATUS_META[row.status_ui];
                    const StIcon = stMeta.icon;
                    const displayScore = row.nilai_resmi ?? row.nilai_sistem;
                    const isReview = row.status_ui === "perlu_ditinjau";

                    return (
                      <tr key={row.id_sesi} className="transition hover:bg-slate-50/70">
                        <td className="min-w-[165px] px-5 py-3.5 align-middle">
                          <p className="font-semibold text-ink">{row.nama_mahasiswa}</p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            <span className="font-mono">{row.nomor_induk}</span>
                            {row.nama_kelas && row.nama_kelas !== "-" ? ` · ${row.nama_kelas}` : ""}
                          </p>
                        </td>

                        <td className="min-w-[180px] max-w-[230px] px-3.5 py-3.5 align-middle">
                          <p className="truncate font-semibold text-ink" title={row.judul_skenario}>
                            {row.judul_skenario}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {row.kode_skenario} · {formatShortDate(row.waktu_selesai)}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-3.5 py-3.5 text-right align-middle tabular-nums">
                          {displayScore !== null ? (
                            <div>
                              <span className="text-sm font-bold text-navy-900">
                                {displayScore}
                              </span>
                              <span className="text-[11px] text-muted">/100</span>
                              {row.is_overridden && (
                                <p className="text-[10px] font-medium text-olive-700">Resmi</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        <td className="min-w-[160px] px-3.5 py-3.5 align-middle">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              stMeta.cls,
                            )}
                          >
                            <StIcon size={11} /> {stMeta.label}
                          </span>
                          <p className="mt-1 line-clamp-1 text-[11px] text-muted">
                            {row.diagnostik}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle">
                          <Link
                            to={`/dosen/rapor?sesi=${encodeURIComponent(row.id_sesi)}${
                              isReview ? "&from=antrean" : ""
                            }`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                              isReview
                                ? "bg-navy-900 text-white hover:bg-navy-800"
                                : "border border-line bg-white text-navy-900 hover:bg-slate-50",
                            )}
                          >
                            {isReview ? "Tinjau" : "Lihat Rapor"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BAGIAN 4: RINGKASAN 5 PILAR KOMPETENSI PaCT */}
        <aside className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-navy-900">5 Pilar Kompetensi PaCT</h2>
              <p className="mt-0.5 text-xs text-muted">
                Rata-rata capaian komunikasi kelas aktif.
              </p>
            </div>
            {weakestPillar && (
              <span className="shrink-0 rounded-full bg-gold-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900">
                Fokus: Pilar {weakestPillar}
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3.5">
            {pactAggregate.map((p) => {
              const isWeakest = weakestPillar === p.kode;
              return (
                <div key={p.kode} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-ink">
                      <span className="mr-1.5 font-mono font-bold text-navy-900">{p.kode}</span>
                      {p.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-bold tabular-nums",
                        isWeakest ? "text-amber-800" : "text-navy-900",
                      )}
                    >
                      {p.rata_rata !== null ? p.rata_rata.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all", pillarBarTone(p.rata_rata))}
                      style={{ width: `${Math.max(0, Math.min(100, p.rata_rata ?? 0))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <Link
              to="/dosen/rekap"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-cream/70 px-3.5 py-2 text-xs font-semibold text-navy-900 transition hover:bg-slate-100"
            >
              Lihat Analitik &amp; Radar Klinis <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      </section>

      {/* ================================================================
          5. AKSES CEPAT BANK KASUS & STUDIO SKENARIO
         ================================================================ */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="text-sm font-bold text-navy-900">
              Bank Kasus &amp; Studio Skenario
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {data
                ? `${data.scenarioCounts.diterbitkan} skenario diterbitkan · ${data.scenarioCounts.draf} draf`
                : "Akses cepat modul kasus aktif, draf studio, dan referensi kamus istilah medis."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setKamusOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
            >
              <BookOpen size={13} /> Kamus Istilah Medis
              {data && data.kamusCount > 0 && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-muted tabular-nums">
                  {data.kamusCount}
                </span>
              )}
            </button>
            <Link
              to="/dosen/kasus"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-cream px-3.5 py-2 text-xs font-semibold text-navy-900 transition hover:bg-slate-100"
            >
              <FolderOpen size={13} /> Lihat Semua Kasus <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {qDashboard.isLoading ? (
          <div className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (data?.quickScenarios.length ?? 0) === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-ink">Belum ada skenario di Bank Kasus</p>
            <p className="mt-1 text-xs text-muted">
              Mulai susun kasus praktikum KIE pertama Anda di Studio Skenario.
            </p>
            <Link
              to="/dosen/kasus/baru"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800"
            >
              <Plus size={14} /> Buat Skenario Baru
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {data!.quickScenarios.map((sc) => {
              const isDraft = sc.status_rilis === "draf";
              return (
                <div
                  key={sc.id}
                  className="flex flex-col justify-between rounded-xl border border-line bg-cream/50 p-4 transition hover:border-navy-900/25 hover:bg-white"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-navy-900">
                        {sc.kode_skenario} · v{sc.versi}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          isDraft
                            ? "bg-gold-100 text-amber-900"
                            : "bg-olive-100 text-olive-700",
                        )}
                      >
                        {isDraft ? "Draf" : "Aktif"}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-ink">
                      {sc.judul}
                    </h3>
                    <p className="mt-1 text-[11px] text-muted">{jenisLabel(sc.jenis)}</p>
                  </div>

                  <Link
                    to={isDraft ? `/dosen/kasus/${sc.id}/susun` : `/dosen/kasus/${sc.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-navy-900 hover:underline"
                  >
                    {isDraft ? "Lanjutkan Draf" : "Buka Studio"} <ArrowRight size={12} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Ringan Kamus Istilah Medis */}
      {kamusOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setKamusOpen(false);
          }}
        >
          <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-navy-900">Kamus Istilah Medis &amp; Padanan Awam</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Acuan deteksi jargon medis pada evaluasi PaCT Tool D.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKamusOpen(false)}
                className="rounded-lg border border-line p-1.5 text-muted hover:bg-slate-50 hover:text-ink"
                aria-label="Tutup kamus"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-b border-line bg-cream/60 px-5 py-3">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={kamusQuery}
                  onChange={(e) => setKamusQuery(e.target.value)}
                  placeholder="Cari istilah medis, kelompok, atau padanan awam..."
                  className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs text-ink outline-none focus:border-navy-900"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {qKamus.isLoading ? (
                <div className="flex items-center justify-center py-10 text-xs text-muted">
                  <Loader2 size={18} className="mr-2 animate-spin text-navy-900" />
                  Memuat kamus istilah...
                </div>
              ) : filteredKamus.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted">
                  Tidak ada istilah medis yang sesuai pencarian.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {filteredKamus.map((k) => (
                    <div
                      key={k.id}
                      className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-navy-900">{k.istilah}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            {k.kelompok}
                          </span>
                        </div>
                        {k.variasi_ejaan.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            Variasi: {k.variasi_ejaan.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 sm:justify-end">
                        {k.padanan_awam.map((pad, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-olive-100/80 px-2 py-0.5 text-[11px] font-medium text-olive-700"
                          >
                            {pad}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
