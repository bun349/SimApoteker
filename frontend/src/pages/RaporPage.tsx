import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Flag,
  Loader2,
  MessageSquare,
  Printer,
  RefreshCw,
  ShieldAlert,
  Target,
  UserCheck,
  Volume2,
  Wrench,
} from "lucide-react";
import {
  fetchLatestRaporApi,
  fetchSessionRaporApi,
  recalculateSessionRaporApi,
  type RaporBundleResponse,
  type StatusRapor,
} from "@/api/evaluation";
import { TranscriptDrawer } from "@/components/rapor/TranscriptDrawer";
import { VocalChart } from "@/components/rapor/VocalChart";
import { formatMmSs } from "@/hooks/useSimulationSession";
import { useAuthStore } from "@/store/authStore";
import { cn, formatDate } from "@/lib/utils";

type StudentRaporTab = "klinis" | "pact" | "umpanBalik" | "vokal";

const STATUS_BADGE: Record<
  StatusRapor,
  { badge: string; desc: string; pillCls: string; boxCls: string; icon: typeof Flag }
> = {
  perlu_ditinjau_dosen: {
    badge: "Perlu Ditinjau Dosen",
    desc: "Skor komputasi sistem ini dapat disesuaikan oleh dosen penguji.",
    pillCls: "border border-gold-400/60 bg-gold-100 text-amber-900",
    boxCls: "border-gold-400/50 bg-gold-100/60 text-amber-950",
    icon: Flag,
  },
  otomatis: {
    badge: "Evaluasi Otomatis",
    desc: "Seluruh gerbang kelayakan terpenuhi tanpa pemicu eskalasi.",
    pillCls: "border border-olive-600/25 bg-olive-100 text-olive-700",
    boxCls: "border-olive-600/25 bg-olive-100/60 text-olive-700",
    icon: CheckCircle2,
  },
  selesai_ditinjau: {
    badge: "Telah Ditinjau Dosen",
    desc: "Nilai resmi akhir telah diverifikasi dan ditetapkan oleh dosen penguji.",
    pillCls: "border border-navy-900/20 bg-navy-900 text-white",
    boxCls: "border-navy-900/20 bg-sky-50 text-navy-900",
    icon: UserCheck,
  },
  tidak_cukup_data: {
    badge: "Tidak Cukup Data",
    desc: "Giliran komunikasi valid belum memenuhi ambang minimal penilaian (5 giliran).",
    pillCls: "border border-amber-300 bg-amber-50 text-amber-900",
    boxCls: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  tidak_dapat_dinilai: {
    badge: "Tidak Dapat Dinilai",
    desc: "Tidak terdapat giliran komunikasi mahasiswa yang valid untuk dinilai.",
    pillCls: "border border-red-200 bg-red-50 text-red-700",
    boxCls: "border-red-200 bg-red-50 text-red-800",
    icon: ShieldAlert,
  },
};

function pactTone(score: number | null): { bar: string; chip: string } {
  if (score === null) return { bar: "bg-slate-200", chip: "bg-slate-100 text-slate-600" };
  if (score >= 75) return { bar: "bg-olive-600", chip: "bg-olive-100 text-olive-700" };
  if (score >= 55) return { bar: "bg-gold-400", chip: "bg-gold-100 text-amber-900" };
  return { bar: "bg-red-600", chip: "bg-red-50 text-red-700" };
}

function pillarBadge(score: number | null): { label: string; cls: string } {
  if (score === null) return { label: "Dinormalisasi", cls: "bg-slate-100 text-slate-600" };
  if (score >= 80) return { label: "Baik", cls: "bg-olive-100 text-olive-700" };
  if (score >= 65) return { label: "Cukup", cls: "bg-gold-100 text-amber-900" };
  return { label: "Perlu Perbaikan", cls: "bg-amber-100 text-amber-900" };
}

function competencyLabel(score: number | null): string {
  if (score === null) return "Belum Dinilai";
  if (score >= 85) return "Sangat Kompeten";
  if (score >= 70) return "Kompeten";
  if (score >= 55) return "Cukup Kompeten";
  return "Perlu Pembinaan";
}

export default function RaporPage() {
  const { sessionId: paramSessionId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);

  const requestedSessionId = paramSessionId || sp.get("sesi") || "";

  const [bundle, setBundle] = useState<RaporBundleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudentRaporTab>("klinis");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter ringan untuk rincian kriteria langsung di dalam aspek masing-masing
  const [klinisOnlyIssues, setKlinisOnlyIssues] = useState(false);
  const [pactOnlyIssues, setPactOnlyIssues] = useState(false);

  const applyDefaultTab = useCallback((res: RaporBundleResponse) => {
    const hasCriticalErrors = (res.rapor.detail_kesalahan_kritis?.items || []).length > 0;
    setActiveTab(hasCriticalErrors ? "klinis" : "pact");
  }, []);

  const loadRapor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (requestedSessionId) {
        const res = await fetchSessionRaporApi(requestedSessionId, { autoEvaluate: true });
        setBundle(res);
        applyDefaultTab(res);
      } else if (profile?.id) {
        const res = await fetchLatestRaporApi(profile.id);
        setBundle(res);
        applyDefaultTab(res);
      } else {
        throw new Error("ID sesi tidak ditemukan. Silakan buka rapor dari riwayat simulasi.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rapor evaluasi.");
    } finally {
      setLoading(false);
    }
  }, [requestedSessionId, profile?.id, applyDefaultTab]);

  useEffect(() => {
    void loadRapor();
  }, [loadRapor]);

  const handleRecalculate = async () => {
    const sid = bundle?.session.id || requestedSessionId;
    if (!sid || recalculating) return;
    setRecalculating(true);
    setError(null);
    try {
      const updated = await recalculateSessionRaporApi(sid);
      setBundle(updated);
      applyDefaultTab(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengevaluasi ulang sesi.");
    } finally {
      setRecalculating(false);
    }
  };

  const weights = useMemo(() => {
    const meta = (bundle?.rapor.metadata_evaluasi || {}) as Record<string, unknown>;
    const rawKom = Number(meta.bobot_komunikasi ?? bundle?.scenario.bobot_komunikasi ?? 0.4);
    const rawKon = Number(meta.bobot_konten ?? bundle?.scenario.bobot_konten ?? 0.6);
    const wKom = rawKom > 1 ? rawKom / 100 : rawKom;
    const wKon = rawKon > 1 ? rawKon / 100 : rawKon;
    const total = wKom + wKon || 1;
    return {
      komPct: Math.round((wKom / total) * 100),
      konPct: Math.round((wKon / total) * 100),
    };
  }, [bundle]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-muted">
        <Loader2 size={32} className="animate-spin text-navy-900" />
        <p className="mt-4 text-sm font-semibold text-navy-900">
          Menyiapkan Rapor Evaluasi KIE...
        </p>
        <p className="mt-1 text-xs text-muted">
          Memproses dimensi PaCT, konten klinis, kesalahan kritis, dan pengamatan vokal.
        </p>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center">
        <ShieldAlert size={34} className="mx-auto text-red-600" />
        <h2 className="mt-3 text-lg font-bold text-navy-900">
          Rapor Evaluasi Belum Dapat Dimuat
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {error || "Data rapor untuk sesi ini tidak ditemukan."}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => void loadRapor()}
            className="rounded-xl bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800"
          >
            Coba Muat Ulang
          </button>
          <button
            type="button"
            onClick={() => navigate("/riwayat")}
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50"
          >
            Kembali ke Riwayat Simulasi
          </button>
        </div>
      </div>
    );
  }

  const { rapor, session, scenario, reviewer, transcript, has_documentation } = bundle;
  const sessionId = session.id;
  const sessionCode = session.kode_sesi || `SES-${sessionId.slice(0, 8).toUpperCase()}`;
  const isPracticum = (session.mode || "mandiri").toLowerCase() === "praktikum";
  const isReviewedByDosen = Boolean(rapor.is_overridden) || rapor.status_rapor === "selesai_ditinjau";
  const statusInfo = STATUS_BADGE[rapor.status_rapor] || STATUS_BADGE.otomatis;
  const StatusIcon = statusInfo.icon;

  const sysFinal = rapor.nilai_gabungan_sistem_tampil;
  const sysFinalRaw = rapor.nilai_gabungan_sistem_mentah;
  const finalScore = rapor.nilai_resmi_akhir ?? sysFinal;
  const passed = typeof finalScore === "number" && finalScore >= 70;

  const kkItems = rapor.detail_kesalahan_kritis?.items || [];
  const clinicalItems = rapor.detail_butir_konten?.items || [];
  const visibleClinicalItems = klinisOnlyIssues
    ? clinicalItems.filter((c) => c.status !== "terpenuhi" && c.status !== "diabaikan")
    : clinicalItems;

  const pactCriteria = rapor.detail_pact?.kriteria || [];
  const visiblePactCriteria = pactOnlyIssues
    ? pactCriteria.filter((k) => k.status !== "terpenuhi")
    : pactCriteria;

  const pactToolsMap = rapor.detail_pact?.tools || {};
  const pactToolsList = (["A", "B", "C", "D", "E"] as const).map((k) => {
    const scoreMap: Record<string, number | null> = {
      A: rapor.skor_tool_a,
      B: rapor.skor_tool_b,
      C: rapor.skor_tool_c,
      D: rapor.skor_tool_d,
      E: rapor.skor_tool_e,
    };
    const existing = pactToolsMap[k];
    const fallbackNames: Record<string, string> = {
      A: "Membangun Koneksi & Hubungan Awal",
      B: "Eksplorasi Perspektif Pasien",
      C: "Respons Empatik & Dukungan",
      D: "Edukasi Kolaboratif & Bahasa Awam",
      E: "Komunikasi Efektif & Penstrukturan",
    };
    const rawVal = existing?.skor ?? scoreMap[k];
    const val = typeof rawVal === "number" ? rawVal : rawVal != null ? Number(rawVal) : null;
    return {
      kode: k,
      nama: existing?.nama || fallbackNames[k],
      skor: val,
      skorTampil: val !== null ? Math.round(val) : null,
      skalaLevel:
        existing?.skala_level ??
        (val !== null ? Math.max(1, Math.min(5, Math.ceil(val / 20))) : 0),
      labelLevel: existing?.label_level || "Belum Dinilai",
      alasan: existing?.alasan || "Belum ada catatan evaluator.",
      kutipan: existing?.kutipan || "",
      bukti: existing?.bukti_giliran || [],
    };
  });

  const ringkasanPilar = rapor.detail_butir_konten?.ringkasan_pilar || {};
  const vocalSummary =
    rapor.data_pengamatan_vokal?.find((v) => v.tipe === "ringkasan") ||
    rapor.data_pengamatan_vokal?.[0];

  const meta = (rapor.metadata_evaluasi || {}) as Record<string, unknown>;
  const alasanTinjau = Array.isArray(meta.alasan_tinjau_dosen)
    ? (meta.alasan_tinjau_dosen as string[])
    : session.alasan_tinjau_dosen || [];

  const fbKuat = rapor.umpan_balik_rapor?.find((f) => f.kategori === "kekuatan_utama");
  const fbPerbaikan = rapor.umpan_balik_rapor?.find((f) => f.kategori === "area_perbaikan");
  const fbSaran = rapor.umpan_balik_rapor?.find((f) => f.kategori === "saran_praktik");

  const durationSec = session.durasi_aktif_detik || 0;
  const studentTurnTotal =
    session.jumlah_giliran_mahasiswa ??
    transcript.filter((t) => t.pembicara.toLowerCase() === "mahasiswa").length;

  const tabs: Array<{ key: StudentRaporTab; label: string; count?: number }> = [
    { key: "klinis", label: "Konten Klinis & KK", count: kkItems.length || undefined },
    { key: "pact", label: "PaCT (A–E)" },
    { key: "umpanBalik", label: "Umpan Balik" },
    { key: "vokal", label: "Pengamatan Vokal" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-14">
      {/* ================================================================
          BAGIAN A: HEADER & RINGKASAN NILAI (DISAMAKAN DENGAN LAYOUT DOSEN)
         ================================================================ */}
      <header className="space-y-4 border-b border-line pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Link
              to="/riwayat"
              className="inline-flex items-center gap-1 text-navy-900 hover:underline"
            >
              <ArrowLeft size={13} /> Riwayat Simulasi
            </Link>
            <span>/</span>
            <span className="font-semibold text-olive-600">Rapor Evaluasi</span>
          </div>
        </div>

        {/* Judul, Skenario & Badge Status */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
              Rapor Evaluasi KIE
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                statusInfo.pillCls,
              )}
            >
              <StatusIcon size={13} /> {statusInfo.badge}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-semibold text-navy-900">
              {isPracticum ? "Praktikum Terjadwal" : "Latihan Mandiri"}
            </span>
            <span>·</span>
            <span className="font-semibold text-ink">
              {scenario.kode_skenario || "—"} v{scenario.versi || "0.1"}
            </span>
            <span>{scenario.judul || "Skenario KIE"}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} />{" "}
              {formatDate(session.waktu_selesai || session.waktu_mulai || new Date().toISOString())}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock size={13} /> Durasi {formatMmSs(durationSec)}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MessageSquare size={13} /> {studentTurnTotal} giliran
            </span>
            <span className="font-mono text-[11px]">{sessionCode}</span>
          </div>
        </div>

        {/* 2 Kartu Perbandingan Nilai Sistem vs. Nilai Resmi */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Nilai Gabungan Sistem */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-muted">Nilai Gabungan Sistem</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-navy-900">
                    {sysFinal ?? "—"}
                  </span>
                  <span className="text-xs text-muted">/ 100</span>
                  {sysFinalRaw != null && (
                    <span className="text-xs tabular-nums text-muted">
                      (mentah: {Number(sysFinalRaw).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-muted">
                Otomatis
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs text-muted tabular-nums">
              <span>
                Komunikasi PaCT ({weights.komPct}%):{" "}
                <b className="text-ink">{rapor.skor_komunikasi_tampil ?? "—"}</b>
              </span>
              <span>
                Konten Klinis ({weights.konPct}%):{" "}
                <b className="text-ink">{rapor.skor_konten_tampil ?? "—"}</b>
              </span>
            </div>
          </div>

          {/* Nilai Resmi Akhir */}
          <div className="rounded-2xl border border-navy-900/20 bg-navy-900 p-5 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-sky-200">
                  {isReviewedByDosen ? "Nilai Resmi Akhir" : "Skor Terkalkulasi"}
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {finalScore ?? "—"}
                  </span>
                  <span className="text-xs text-sky-200">/ 100</span>
                  {finalScore !== null && (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        passed ? "bg-gold-400 text-navy-900" : "bg-red-500 text-white",
                      )}
                    >
                      {passed ? "Lulus (Min. 70)" : "Belum Lulus"}
                    </span>
                  )}
                </div>
              </div>

              <span
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                  isReviewedByDosen
                    ? "bg-olive-600 text-white"
                    : "bg-white/15 text-white",
                )}
              >
                {isReviewedByDosen ? "Telah Ditinjau Dosen" : "Basis: Sistem"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3 text-xs text-sky-100">
              <span>
                Kategori: <b className="text-white">{competencyLabel(finalScore)}</b>
              </span>
              {isReviewedByDosen && rapor.waktu_ditinjau ? (
                <span className="inline-flex items-center gap-1">
                  <UserCheck size={12} className="text-gold-400" />
                  {reviewer?.nama_lengkap || "Dosen Penguji"} · {formatDate(rapor.waktu_ditinjau)}
                </span>
              ) : (
                <span>Kom {weights.komPct}% · Konten {weights.konPct}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Komentar Dosen Penguji (muncul otomatis jika sudah ditinjau dan ada komentar) */}
        {isReviewedByDosen && rapor.komentar_dosen_untuk_mahasiswa && (
          <div className="rounded-2xl border border-navy-900/20 bg-sky-50/70 px-5 py-4 text-xs">
            <p className="flex items-center gap-1.5 font-bold text-navy-900">
              <UserCheck size={15} className="text-olive-600" />
              Komentar Dosen Penguji
              {reviewer?.nama_lengkap ? ` (${reviewer.nama_lengkap})` : ""}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {rapor.komentar_dosen_untuk_mahasiswa}
            </p>
          </div>
        )}
      </header>

      {/* ================================================================
          GRID UTAMA: KONTEN TAB (KIRI) + SIDEBAR STATUS & AKSI (KANAN)
         ================================================================ */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* KIRI: TAB ASPEK EVALUASI (RINCIAN KRITERIA LANGSUNG DI DALAM ASPEK MASING-MASING) */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5 print:hidden">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                    active
                      ? "bg-navy-900 text-white"
                      : "text-muted hover:bg-slate-100 hover:text-ink",
                  )}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        active
                          ? "bg-white/20 text-white"
                          : tab.key === "klinis" && kkItems.length > 0
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-muted",
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: KONTEN KLINIS & KESALAHAN KRITIS + RINCIAN BUTIR KLINIS */}
          {activeTab === "klinis" && (
            <div className="space-y-4">
              {/* Kesalahan Kritis (hanya merah bila ada temuan; hijau tenang bila 0) */}
              <div
                className={cn(
                  "rounded-2xl border p-5",
                  kkItems.length > 0
                    ? "border-red-200 bg-white"
                    : "border-olive-600/25 bg-olive-100/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-navy-900">
                    Kesalahan Kritis ({kkItems.length} temuan)
                  </h2>
                  {kkItems.length === 0 ? (
                    <span className="rounded-full bg-olive-100 px-2.5 py-0.5 text-[11px] font-semibold text-olive-700">
                      Aman · 0 temuan
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                      Terdeteksi
                    </span>
                  )}
                </div>

                {kkItems.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    Tidak ditemukan pelanggaran keamanan terapi fatal pada transkrip sesi Anda.
                    Seluruh pilar nilai tidak dikenakan penalti kesalahan kritis.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {kkItems.map((kk, idx) => (
                      <div
                        key={`${kk.id}-${idx}`}
                        className={cn(
                          "rounded-xl border p-4 text-xs",
                          kk.dikoreksi
                            ? "border-gold-400/50 bg-gold-100/40"
                            : "border-red-200 bg-red-50/50",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 font-mono text-[11px] font-bold",
                                kk.dikoreksi
                                  ? "bg-gold-100 text-amber-900"
                                  : "bg-red-100 text-red-700",
                              )}
                            >
                              {kk.id}
                            </span>
                            <h3 className="text-sm font-semibold text-ink">{kk.judul}</h3>
                          </div>

                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              kk.dikoreksi
                                ? "bg-olive-100 text-olive-700"
                                : "bg-red-100 text-red-700",
                            )}
                          >
                            {kk.dikoreksi
                              ? kk.status_koreksi || "Koreksi Diri Berhasil (≤ 2 Giliran)"
                              : `Penalti -${kk.penalti_diterapkan} poin`}
                          </span>
                        </div>

                        {kk.deskripsi && (
                          <p className="mt-2 leading-relaxed text-muted">{kk.deskripsi}</p>
                        )}

                        {kk.kutipan && (
                          <div className="mt-2.5 rounded-lg border border-line bg-white px-3.5 py-2.5">
                            <p className="italic text-ink">&ldquo;{kk.kutipan}&rdquo;</p>
                            <p className="mt-1 text-[11px] text-muted">
                              Giliran {kk.kode_giliran_terjadi || "-"}
                              {kk.waktu_detik != null ? ` · ${formatMmSs(kk.waktu_detik)}` : ""}
                              {kk.status_koreksi ? (
                                <span
                                  className={cn(
                                    "ml-1.5 font-medium",
                                    kk.dikoreksi ? "text-olive-700" : "text-red-700",
                                  )}
                                >
                                  · {kk.status_koreksi}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        )}

                        {kk.catatan_algoritma && (
                          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-white/80 px-3 py-2 text-muted">
                            <span>{kk.catatan_algoritma}</span>
                            <span className="shrink-0 font-semibold text-ink">0 poin dikurangi</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Pilar Konten Klinis */}
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    {
                      key: "prosedur",
                      title: "Prosedur Klinis",
                      score: rapor.skor_prosedur,
                      penalty: rapor.total_penalti_prosedur,
                      summary: ringkasanPilar.prosedur,
                    },
                    {
                      key: "ddi",
                      title: "Penanganan DDI",
                      score: rapor.skor_penanganan_ddi,
                      penalty: rapor.total_penalti_ddi,
                      summary: ringkasanPilar.ddi,
                    },
                    {
                      key: "kelengkapan",
                      title: "Kelengkapan Konseling",
                      score: rapor.skor_kelengkapan,
                      penalty: rapor.total_penalti_kelengkapan,
                      summary: ringkasanPilar.kelengkapan,
                    },
                  ] as const
                ).map((p) => {
                  const badge = pillarBadge(p.score);
                  return (
                    <div
                      key={p.key}
                      className="flex flex-col justify-between rounded-2xl border border-line bg-white p-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-semibold text-muted">{p.title}</h3>
                          <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold", badge.cls)}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-baseline gap-1">
                          <span className="text-2xl font-bold tabular-nums text-navy-900">
                            {p.score !== null ? Math.round(Number(p.score)) : "N/A"}
                          </span>
                          {p.score !== null && <span className="text-xs text-muted">/ 100</span>}
                        </div>

                        {p.score === null ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-muted">
                            Skenario ini non-DDI; bobot dinormalisasi ke Prosedur &amp; Kelengkapan.
                          </p>
                        ) : Number(p.penalty || 0) > 0 ? (
                          <p className="mt-2 text-[11px] font-semibold text-red-700">
                            Penalti aktif: -{Number(p.penalty)} poin
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-muted">Tanpa penalti pilar.</p>
                        )}
                      </div>

                      {p.summary && typeof p.summary.total === "number" && p.summary.total > 0 && (
                        <p className="mt-3 border-t border-line pt-2 text-[11px] text-muted tabular-nums">
                          {p.summary.terpenuhi ?? 0}/{p.summary.total} butir terpenuhi
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rincian Kriteria Konten Klinis (langsung di dalam aspek klinis) */}
              <div className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
                  <h2 className="text-sm font-bold text-navy-900">
                    Rincian Butir Rubrik Konten Klinis ({clinicalItems.length})
                  </h2>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setKlinisOnlyIssues(false)}
                      className={cn(
                        "rounded-md px-2.5 py-1 transition",
                        !klinisOnlyIssues ? "bg-navy-900 text-white" : "text-muted hover:text-ink",
                      )}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setKlinisOnlyIssues(true)}
                      className={cn(
                        "rounded-md px-2.5 py-1 transition",
                        klinisOnlyIssues ? "bg-navy-900 text-white" : "text-muted hover:text-ink",
                      )}
                    >
                      Perlu Perbaikan
                    </button>
                  </div>
                </div>

                {visibleClinicalItems.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-muted">
                    {klinisOnlyIssues
                      ? "Seluruh butir konten klinis sudah terpenuhi."
                      : "Belum ada butir konten klinis tercatat."}
                  </p>
                ) : (
                  <div className="divide-y divide-line">
                    {visibleClinicalItems.map((item, idx) => (
                      <div key={`${item.kode}-${idx}`} className="px-5 py-3.5 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy-900">
                                {item.kode}
                              </span>
                              <span className="font-semibold text-ink">{item.parameter}</span>
                              <span className="text-[11px] text-muted">
                                ·{" "}
                                {item.pilar === "ddi"
                                  ? "DDI"
                                  : item.pilar === "kelengkapan"
                                    ? "Edukasi"
                                    : "Prosedur"}
                              </span>
                            </div>

                            {item.kutipan_ditolak ? (
                              <p className="mt-1.5 text-red-700">
                                Kutipan tidak ditemukan di transkrip ({item.alasan || "ditolak"}).
                              </p>
                            ) : item.kutipan ? (
                              <p className="mt-1.5 italic text-muted">
                                &ldquo;{item.kutipan}&rdquo;
                                {item.kode_giliran && (
                                  <span className="ml-1.5 not-italic font-mono text-[10px]">
                                    [{item.kode_giliran}
                                    {item.waktu_detik != null
                                      ? ` · ${formatMmSs(item.waktu_detik)}`
                                      : ""}
                                    ]
                                  </span>
                                )}
                              </p>
                            ) : (
                              item.alasan && <p className="mt-1 text-muted">{item.alasan}</p>
                            )}
                          </div>

                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              item.status === "terpenuhi"
                                ? "bg-olive-100 text-olive-700"
                                : item.status === "parsial"
                                  ? "bg-gold-100 text-amber-900"
                                  : item.status === "diabaikan"
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-red-50 text-red-700",
                            )}
                          >
                            {item.status === "terpenuhi"
                              ? "Terpenuhi (1.0)"
                              : item.status === "parsial"
                                ? "Parsial (0.5)"
                                : item.status === "diabaikan"
                                  ? "Diabaikan"
                                  : item.status === "ditolak"
                                    ? "Ditolak (0)"
                                    : "Terlewat (0)"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: KOMUNIKASI PaCT (TOOL A - E) + RINCIAN KRITERIA PaCT */}
          {activeTab === "pact" && (
            <div className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-navy-900">
                      Komunikasi Terapeutik · 5 Pilar PaCT
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Rerata komunikasi:{" "}
                      <b className="text-ink">{rapor.skor_komunikasi_tampil ?? "—"}</b> / 100
                      {rapor.skor_komunikasi_dosen != null && (
                        <>
                          {" "}
                          · Penyesuaian dosen:{" "}
                          <b className="text-navy-900">
                            {Math.round(Number(rapor.skor_komunikasi_dosen))}
                          </b>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {pactToolsList.map((tool) => {
                    const tone = pactTone(tool.skor);
                    return (
                      <div key={tool.kode} className="rounded-xl border border-line bg-cream/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-ink">
                            <span className="mr-1.5 font-mono font-bold text-navy-900">
                              Tool {tool.kode}
                            </span>
                            {tool.nama}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tabular-nums text-navy-900">
                              {tool.skorTampil ?? "—"}
                            </span>
                            <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", tone.chip)}>
                              {tool.labelLevel}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className={cn("h-full rounded-full transition-all", tone.bar)}
                            style={{ width: `${Math.max(0, Math.min(100, tool.skor ?? 0))}%` }}
                          />
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-muted">{tool.alasan}</p>
                        {tool.kutipan && (
                          <p className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-xs italic text-ink">
                            &ldquo;{tool.kutipan}&rdquo;
                            {tool.bukti.length > 0 && (
                              <span className="ml-2 not-italic font-mono text-[10px] text-muted">
                                [{tool.bukti.join(", ")}]
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(rapor.detail_pact?.pelanggaran_jargon || []).length > 0 && (
                  <div className="rounded-xl border border-gold-400/50 bg-gold-100/60 p-4 text-xs">
                    <p className="font-semibold text-amber-900">
                      Catatan Bahasa Awam (Jargon Medis)
                    </p>
                    <ul className="mt-2 space-y-1 text-amber-950">
                      {rapor.detail_pact.pelanggaran_jargon!.map((j, i) => (
                        <li key={`${j.istilah}-${i}`}>
                          Istilah <b>{j.istilah}</b> disebutkan tanpa padanan awam
                          {j.padanan_diharapkan?.length
                            ? ` (mis. ${j.padanan_diharapkan.join(", ")})`
                            : ""}
                          {j.penalti ? ` · -${j.penalti} poin Tool D` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Rincian Kriteria Komunikasi PaCT (langsung di dalam aspek PaCT) */}
              {pactCriteria.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
                    <h3 className="text-sm font-bold text-navy-900">
                      Rincian Kriteria Komunikasi PaCT ({pactCriteria.length})
                    </h3>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setPactOnlyIssues(false)}
                        className={cn(
                          "rounded-md px-2.5 py-1 transition",
                          !pactOnlyIssues ? "bg-navy-900 text-white" : "text-muted hover:text-ink",
                        )}
                      >
                        Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setPactOnlyIssues(true)}
                        className={cn(
                          "rounded-md px-2.5 py-1 transition",
                          pactOnlyIssues ? "bg-navy-900 text-white" : "text-muted hover:text-ink",
                        )}
                      >
                        Perlu Perbaikan
                      </button>
                    </div>
                  </div>

                  {visiblePactCriteria.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-muted">
                      Seluruh kriteria komunikasi PaCT sudah terpenuhi.
                    </p>
                  ) : (
                    <div className="divide-y divide-line">
                      {visiblePactCriteria.map((k, idx) => (
                        <div key={`${k.kode}-${idx}`} className="px-5 py-3.5 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy-900">
                                  {k.kode}
                                </span>
                                <span className="font-semibold text-ink">{k.parameter}</span>
                                <span className="text-[11px] text-muted">· Pilar {k.pilar}</span>
                              </div>
                              {k.kutipan_ditolak ? (
                                <p className="mt-1.5 text-red-700">
                                  Kutipan ditolak ({k.alasan || "tidak ditemukan di transkrip"}).
                                </p>
                              ) : k.kutipan ? (
                                <p className="mt-1.5 italic text-muted">
                                  &ldquo;{k.kutipan}&rdquo;
                                  {k.kode_giliran && (
                                    <span className="ml-1.5 not-italic font-mono text-[10px]">
                                      [{k.kode_giliran}
                                      {k.waktu_detik != null
                                        ? ` · ${formatMmSs(k.waktu_detik)}`
                                        : ""}
                                      ]
                                    </span>
                                  )}
                                </p>
                              ) : (
                                k.alasan && <p className="mt-1 text-muted">{k.alasan}</p>
                              )}
                            </div>

                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                                k.status === "terpenuhi"
                                  ? "bg-olive-100 text-olive-700"
                                  : k.status === "parsial"
                                    ? "bg-gold-100 text-amber-900"
                                    : "bg-red-50 text-red-700",
                              )}
                            >
                              {k.status === "terpenuhi"
                                ? `Terpenuhi (${k.skor_poin}/${k.maks_poin})`
                                : k.status === "parsial"
                                  ? `Parsial (${k.skor_poin}/${k.maks_poin})`
                                  : k.status === "ditolak"
                                    ? "Ditolak (0)"
                                    : `Tidak Terpenuhi (${k.skor_poin}/${k.maks_poin})`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UMPAN BALIK KUALITATIF */}
          {activeTab === "umpanBalik" && (
            <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
              <div className="border-b border-line pb-3">
                <h2 className="text-sm font-bold text-navy-900">Umpan Balik Kualitatif</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Rangkuman kekuatan utama, area perbaikan, dan fokus latihan untuk sesi berikutnya.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col justify-between rounded-xl border border-olive-600/25 bg-olive-100/40 p-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold text-olive-700">
                      <CheckCircle2 size={15} />
                      {fbKuat?.judul || "Yang Sudah Baik"}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink">
                      {fbKuat?.ringkasan || "Sikap komunikasi dasar sudah terjaga dengan baik."}
                    </p>
                    {fbKuat?.kutipan && (
                      <div className="mt-3 rounded-lg border border-olive-600/20 bg-white p-3 text-xs italic text-ink">
                        &ldquo;{fbKuat.kutipan}&rdquo;
                        {fbKuat.kode_giliran && (
                          <p className="mt-1 not-italic font-mono text-[10px] text-muted">
                            {fbKuat.kode_giliran}
                            {fbKuat.waktu_detik != null
                              ? ` · ${formatMmSs(fbKuat.waktu_detik)}`
                              : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold text-olive-700">
                    ✓ {fbKuat?.tag || "Sikap profesional terjaga"}
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-gold-400/50 bg-gold-100/50 p-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <Wrench size={14} />
                      {fbPerbaikan?.judul || "Perlu Ditingkatkan"}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink">
                      {fbPerbaikan?.ringkasan ||
                        "Perhatikan kelengkapan penggalian riwayat dan verifikasi pemahaman pasien."}
                    </p>
                    {fbPerbaikan?.kutipan && (
                      <div className="mt-3 rounded-lg border border-gold-400/40 bg-white p-3 text-xs italic text-ink">
                        &ldquo;{fbPerbaikan.kutipan}&rdquo;
                        {fbPerbaikan.kode_giliran && (
                          <p className="mt-1 not-italic font-mono text-[10px] text-muted">
                            {fbPerbaikan.kode_giliran}
                            {fbPerbaikan.waktu_detik != null
                              ? ` · ${formatMmSs(fbPerbaikan.waktu_detik)}`
                              : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold text-amber-900">
                    ! {fbPerbaikan?.tag || "Disiplin alur KIE"}
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-xl border border-line bg-cream/70 p-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold text-navy-900">
                      <Target size={14} />
                      {fbSaran?.judul || "Fokus Latihan Berikut"}
                    </h3>
                    <ol className="mt-2.5 space-y-2 text-xs leading-relaxed text-ink">
                      {(fbSaran?.poin || []).length > 0 ? (
                        fbSaran!.poin!.map((p, idx) => (
                          <li key={idx}>
                            <span className="font-semibold text-navy-900">
                              {idx + 1}. {p.judul}:
                            </span>{" "}
                            {p.deskripsi}
                          </li>
                        ))
                      ) : (
                        <li className="text-muted">Belum ada rencana latihan spesifik.</li>
                      )}
                    </ol>
                  </div>
                  <p className="mt-4 text-[11px] font-semibold text-navy-800">
                    ▣ {fbSaran?.tag || "Rencana remediasi mandiri"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PENGAMATAN VOKAL */}
          {activeTab === "vokal" && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
                <Volume2 size={16} className="text-navy-900" />
                <div>
                  <h2 className="text-sm font-bold text-navy-900">
                    Pengamatan Vokal Praktikan (Formatif · Tidak Dinilai)
                  </h2>
                  <p className="text-xs text-muted">
                    Pemantauan tempo bicara (WPM), variasi pitch (Hz), dan intensitas suara (dB).
                  </p>
                </div>
              </div>
              <VocalChart
                layakTampil={rapor.layak_tampil_vokal}
                data={rapor.data_pengamatan_vokal || []}
                narasi={rapor.narasi_pengamatan_vokal}
              />
            </div>
          )}
        </section>

        {/* KANAN: STICKY SIDEBAR STATUS & AKSI RAPOR */}
        <aside className="space-y-4 lg:sticky lg:top-20 print:hidden">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Status Sesi
            </p>
            <div className="mt-3 space-y-2.5">
              <div className={cn("rounded-xl border px-3 py-2.5 text-xs", statusInfo.boxCls)}>
                <p className="font-bold">{statusInfo.badge}</p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {alasanTinjau[0] || statusInfo.desc}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-navy-900">
                  <Volume2 size={13} />
                  {rapor.layak_tampil_vokal ? "Audio Memadai" : "Mode Teks / Audio Terbatas"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Validitas transkrip:{" "}
                  {typeof vocalSummary?.validitas_asr_persen === "number"
                    ? `${vocalSummary.validitas_asr_persen.toFixed(1)}%`
                    : "100%"}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5 text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-navy-900">
                  <ClipboardCheck size={13} />
                  {has_documentation ? "Dokumentasi Tersimpan" : "Dokumentasi Belum Diisi"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Formulir 5 &amp; 7 Permenkes 73/2016
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-line bg-white p-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 px-4 py-2.5 text-xs font-bold text-navy-900 transition hover:bg-gold-400/90"
            >
              <FileText size={14} /> Lihat Transkrip Lengkap
            </button>

            <Link
              to={`/dokumentasi/penilaian?sesi=${encodeURIComponent(sessionId)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-navy-800"
            >
              <ClipboardCheck size={14} /> Penilaian Dokumentasi
            </Link>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-xs font-medium text-ink transition hover:bg-slate-50"
            >
              <Printer size={14} /> Cetak / Unduh PDF
            </button>

            <button
              type="button"
              disabled={recalculating}
              onClick={handleRecalculate}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-muted transition hover:bg-slate-100 hover:text-ink disabled:opacity-50"
            >
              {recalculating ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {recalculating ? "Mengevaluasi ulang..." : "Evaluasi Ulang"}
            </button>
          </div>

          {typeof meta.model_llm === "string" && (
            <p className="text-center text-[11px] text-muted">
              Mesin evaluasi: {meta.model_llm}
            </p>
          )}
        </aside>
      </div>

      {/* Slide-over Transkrip (sama seperti desain sebelumnya) */}
      <TranscriptDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessionCode={sessionCode}
        durationSec={durationSec}
        transcript={transcript}
        clinicalItems={clinicalItems}
        pactCriteria={pactCriteria}
        criticalErrors={kkItems}
        studentSpeakerLabel="Anda"
      />
    </div>
  );
}
