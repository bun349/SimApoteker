import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Flag,
  Loader2,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  fetchStudentHistoryApi,
  type SessionStatusEnum,
  type StudentHistoryItem,
  type StudentHistoryResponse,
} from "@/api/evaluation";
import { formatMmSs } from "@/hooks/useSimulationSession";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

type ModeFilter = "semua" | "praktikum" | "mandiri";

const PAGE_SIZE = 6;

const JENIS_LABEL: Record<string, string> = {
  swamedikasi: "Swamedikasi",
  resep_akut: "Resep Akut",
  resep_kronis: "Resep Kronis",
};

function formatWibDateTime(iso?: string | null): string {
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
  return `${datePart}, ${timePart.replace(".", ":")} WIB`;
}

function getStatusBadge(item: StudentHistoryItem): {
  label: string;
  cls: string;
  icon: typeof CheckCircle2;
} {
  const hasMissedFlag = item.penanda_khusus?.includes("ada_penilaian_terlewat");

  switch (item.status_evaluasi) {
    case "perlu_ditinjau_dosen":
      return {
        label: "Perlu Ditinjau Dosen",
        cls: "bg-gold-100 text-amber-900 border border-amber-200",
        icon: Flag,
      };
    case "selesai_ditinjau":
      return {
        label: "Selesai Ditinjau",
        cls: "bg-lime-100 text-lime-800 border border-lime-200",
        icon: CheckCircle2,
      };
    case "tidak_cukup_data":
      return {
        label: "Tidak Cukup Data",
        cls: "bg-amber-100 text-amber-900 border border-amber-200",
        icon: AlertTriangle,
      };
    case "tidak_dapat_dinilai":
      return {
        label: "Tidak Dapat Dinilai",
        cls: "bg-red-50 text-red-700 border border-red-200",
        icon: ShieldAlert,
      };
    case "berjalan":
      return {
        label: "Sedang Berjalan",
        cls: "bg-sky-100 text-navy-800 border border-sky-200",
        icon: Clock,
      };
    case "selesai_otomatis":
    default:
      if (hasMissedFlag) {
        return {
          label: "Penilaian Terlewat",
          cls: "bg-amber-100 text-amber-900 border border-amber-200",
          icon: AlertTriangle,
        };
      }
      return {
        label: "Lengkap",
        cls: "bg-lime-100 text-lime-800 border border-lime-200",
        icon: CheckCircle2,
      };
  }
}

function pactDescriptor(score: number | null): string {
  if (score === null) return "PaCT: Menunggu Evaluasi";
  if (score >= 90) return "PaCT: Exemplary (Unggul)";
  if (score >= 75) return "PaCT: Capable (Kompeten)";
  if (score >= 50) return "PaCT: Adequate (Cukup)";
  return "PaCT: Needs Improvement";
}

export default function RiwayatSimulasiPage() {
  const profile = useAuthStore((s) => s.profile);
  const searchRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<StudentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("semua");
  const [jenisFilter, setJenisFilter] = useState<string>("semua");
  const [statusFilter, setStatusFilter] = useState<string>("semua");
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStudentHistoryApi(profile.id);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat simulasi.");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Shortcut Ctrl+K untuk fokus pencarian
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const allItems = data?.items ?? [];

  const modeCounts = useMemo(() => {
    return {
      semua: allItems.length,
      praktikum: allItems.filter((i) => i.mode === "praktikum").length,
      mandiri: allItems.filter((i) => i.mode === "mandiri").length,
    };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      if (modeFilter !== "semua" && item.mode !== modeFilter) return false;
      if (jenisFilter !== "semua" && (item.scenario.jenis || "").toLowerCase() !== jenisFilter) {
        return false;
      }
      if (statusFilter !== "semua" && item.status_evaluasi !== (statusFilter as SessionStatusEnum)) {
        return false;
      }
      if (q) {
        const hay = [
          item.kode_sesi,
          item.scenario.judul,
          item.scenario.kode_skenario,
          item.scenario.nama_pasien,
          item.scenario.patient_meta,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, modeFilter, jenisFilter, statusFilter, query]);

  // Reset halaman ke 1 saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [modeFilter, jenisFilter, statusFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);

  const summary = data?.summary ?? {
    total_sessions: 0,
    total_all: 0,
    mandiri_count: 0,
    praktikum_count: 0,
    avg_official_score: null,
    avg_ddi_detection: null,
    avg_duration_sec: 0,
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-muted">
        <Loader2 size={32} className="animate-spin text-gold-400" />
        <p className="mt-4 text-sm font-medium">Memuat Riwayat Simulasi KIE...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <header>
        <p className="text-xs text-muted">
          <Link to="/" className="hover:underline">
            Portal Mahasiswa
          </Link>{" "}
          › <span className="font-medium text-ink">Riwayat Simulasi</span>
        </p>
        <h1 className="mt-1.5 font-serif text-3xl font-bold text-navy-900">
          Riwayat Simulasi KIE
        </h1>
        <p className="mt-1 text-sm text-muted">
          Daftar seluruh rekaman latihan mandiri dan sesi praktikum terjadwal yang telah Anda
          selesaikan di laboratorium virtual farmasi.
        </p>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="font-bold underline hover:text-red-900"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* 4 Kartu Ringkasan KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Total Sesi Dijalankan
            </p>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-navy-800">
              <ClipboardList size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-bold text-navy-900">
              {summary.total_sessions}
            </span>
            <span className="text-xs text-muted">Sesi Selesai</span>
          </div>
          <p className="mt-3 text-xs text-muted">
            <b className="text-ink">{summary.mandiri_count}</b> Latihan Mandiri •{" "}
            <b className="text-ink">{summary.praktikum_count}</b> Praktikum
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Rata-rata Nilai Resmi
            </p>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-100 text-amber-800">
              <Award size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-bold text-navy-900">
              {summary.avg_official_score !== null ? summary.avg_official_score.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-muted">/ 100</span>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-md bg-lime-100 px-2 py-0.5 text-[11px] font-semibold text-lime-800">
              <TrendingUp size={11} />
              {summary.avg_official_score === null
                ? "Menunggu Evaluasi"
                : summary.avg_official_score >= 80
                  ? "Baik · Kompeten"
                  : summary.avg_official_score >= 70
                    ? "Lulus Ambang Batas"
                    : "Perlu Pembinaan"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Deteksi DDI &amp; Alergi
            </p>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-navy-800">
              <ShieldCheck size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-bold text-navy-900">
              {summary.avg_ddi_detection !== null ? `${Math.round(summary.avg_ddi_detection)}%` : "—"}
            </span>
            {summary.avg_ddi_detection !== null && (
              <span className="text-xs font-medium text-emerald-700">
                {summary.avg_ddi_detection >= 85 ? "Optimal" : "Perlu Perhatian"}
              </span>
            )}
          </div>
          <p className="mt-3 flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle2 size={12} /> Target Fakultas min 85%
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Rata-rata Durasi Sesi
            </p>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-navy-800">
              <Clock size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-serif text-3xl font-bold text-navy-900">
              {formatMmSs(summary.avg_duration_sec)}
            </span>
            <span className="text-xs text-muted">Menit</span>
          </div>
          <p className="mt-3 text-xs text-muted">Rentang optimal konseling KIE</p>
        </div>
      </div>

      {/* Pencarian & Filter */}
      <section className="rounded-2xl border border-line bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode sesi, nama skenario, atau pasien..."
            className="w-full rounded-xl border border-line bg-[#FAFAF8] py-2.5 pl-10 pr-16 text-sm outline-none focus:border-navy-900 focus:bg-white"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-2 py-0.5 font-mono text-[10px] text-muted">
            Ctrl+K
          </kbd>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tab Mode */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-cream p-1 text-xs font-semibold">
            {(
              [
                { id: "semua", label: `Semua Mode (${modeCounts.semua})` },
                { id: "praktikum", label: `Praktikum Terjadwal (${modeCounts.praktikum})` },
                { id: "mandiri", label: `Latihan Mandiri (${modeCounts.mandiri})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setModeFilter(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition",
                  modeFilter === tab.id
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dropdown Jenis & Status */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={jenisFilter}
              onChange={(e) => setJenisFilter(e.target.value)}
              className="rounded-xl border border-line bg-[#FAFAF8] px-3 py-1.5 text-xs font-medium text-ink outline-none focus:border-navy-900"
            >
              <option value="semua">Semua Jenis Skenario</option>
              <option value="swamedikasi">Swamedikasi</option>
              <option value="resep_akut">Resep Akut</option>
              <option value="resep_kronis">Resep Kronis</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-line bg-[#FAFAF8] px-3 py-1.5 text-xs font-medium text-ink outline-none focus:border-navy-900"
            >
              <option value="semua">Semua Status Evaluasi</option>
              <option value="selesai_otomatis">Selesai Otomatis</option>
              <option value="perlu_ditinjau_dosen">Perlu Ditinjau Dosen</option>
              <option value="selesai_ditinjau">Selesai Ditinjau</option>
              <option value="tidak_cukup_data">Tidak Cukup Data</option>
              <option value="tidak_dapat_dinilai">Tidak Dapat Dinilai</option>
              <option value="berjalan">Sedang Berjalan</option>
            </select>
          </div>
        </div>
      </section>

      {/* Tabel Riwayat Sesi */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3.5">Waktu Sesi</th>
                <th className="px-5 py-3.5">Skenario &amp; Profil Pasien</th>
                <th className="px-5 py-3.5">Mode Sesi</th>
                <th className="px-5 py-3.5">Durasi</th>
                <th className="px-5 py-3.5">Status Evaluasi</th>
                <th className="px-5 py-3.5">Capaian / Nilai</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="font-serif text-base font-semibold text-navy-900">
                      {allItems.length === 0
                        ? "Belum ada riwayat simulasi tersimpan."
                        : "Tidak ada sesi yang sesuai dengan filter pencarian."}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {allItems.length === 0
                        ? "Selesaikan sesi latihan mandiri atau tugas praktikum agar muncul di daftar ini."
                        : "Coba ubah kata kunci pencarian atau pilih filter lainnya."}
                    </p>
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const badge = getStatusBadge(item);
                  const BadgeIcon = badge.icon;
                  const isPracticum = item.mode === "praktikum";
                  const isShortTurns = item.jumlah_giliran_mahasiswa > 0 && item.jumlah_giliran_mahasiswa < 5;
                  const jenisLabel = JENIS_LABEL[item.scenario.jenis] || "KIE";
                  const score =
                    item.rapor?.nilai_resmi_akhir ?? item.rapor?.nilai_gabungan_sistem_tampil ?? null;
                  const komScore = item.rapor?.skor_komunikasi_tampil ?? null;

                  return (
                    <tr key={item.id} className="transition hover:bg-cream/40">
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-muted">
                        <div>{formatWibDateTime(item.waktu_selesai || item.waktu_mulai)}</div>
                        <div className="mt-0.5 font-mono text-[10px] opacity-75">
                          {item.kode_sesi}
                        </div>
                      </td>

                      <td className="min-w-[230px] px-5 py-4">
                        <div className="font-serif text-sm font-bold leading-snug text-navy-900">
                          {jenisLabel}: {item.scenario.judul}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-navy-800">
                            {item.scenario.nama_pasien}
                            {item.scenario.patient_meta ? ` (${item.scenario.patient_meta})` : ""}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
                            isPracticum
                              ? "bg-sky-100 text-navy-900"
                              : "bg-slate-100 text-slate-700",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isPracticum ? "bg-navy-900" : "bg-slate-500",
                            )}
                          />
                          {isPracticum ? "Praktikum Terjadwal" : "Latihan Mandiri"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div
                          className={cn(
                            "font-mono text-xs font-bold",
                            isShortTurns ? "text-amber-700" : "text-ink",
                          )}
                        >
                          {formatMmSs(item.durasi_aktif_detik)}
                        </div>
                        <div className="text-[11px] text-muted">
                          {item.jumlah_giliran_mahasiswa} Giliran Bicara
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
                            badge.cls,
                          )}
                        >
                          <BadgeIcon size={12} /> {badge.label}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {item.status_evaluasi === "berjalan" ? (
                          <span className="text-xs text-muted">Sesi belum selesai</span>
                        ) : item.status_evaluasi === "tidak_cukup_data" ||
                          item.status_evaluasi === "tidak_dapat_dinilai" ? (
                          <span className="text-xs font-medium text-amber-800">
                            PaCT: Incomplete
                          </span>
                        ) : isPracticum ? (
                          score !== null ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-serif text-base font-bold text-navy-900">
                                {item.rapor?.is_overridden ? score.toFixed(1) : score}
                              </span>
                              <span className="text-[11px] text-muted">
                                {item.rapor?.is_overridden ? "Resmi" : "(Sistem)"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">Siap Dievaluasi</span>
                          )
                        ) : (
                          <div>
                            <div className="text-xs font-semibold text-navy-900">
                              {pactDescriptor(komScore)}
                            </div>
                            {score !== null && (
                              <div className="text-[11px] text-muted">Skor Sistem: {score}/100</div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        {item.status_evaluasi === "berjalan" ? (
                          <Link
                            to={`/simulasi/${item.id_skenario}/sesi?mode=${item.mode}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-navy-800"
                          >
                            <Play size={12} /> Lanjutkan
                          </Link>
                        ) : (
                          <Link
                            to={`/rapor?sesi=${encodeURIComponent(item.id)}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
                          >
                            Buka Rapor <ArrowRight size={13} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFAF8] px-5 py-3.5 text-xs text-muted">
          <span>
            Menampilkan{" "}
            <b className="text-ink">
              {filteredItems.length === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + PAGE_SIZE, filteredItems.length)}
            </b>{" "}
            dari <b className="text-ink">{filteredItems.length}</b> total sesi simulasi
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-cream disabled:opacity-40"
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
                    "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition",
                    pNum === safePage
                      ? "bg-navy-900 text-white"
                      : "border border-line bg-white text-ink hover:bg-cream",
                  )}
                >
                  {pNum}
                </button>
              ))}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-ink hover:bg-cream disabled:opacity-40"
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
