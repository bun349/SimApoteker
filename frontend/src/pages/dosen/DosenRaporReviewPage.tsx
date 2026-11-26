import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Flag,
  History,
  Loader2,
  MessageSquare,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Target,
  Trash2,
  UserCheck,
  Volume2,
  Wrench,
} from "lucide-react";
import {
  fetchSessionRaporApi,
  type DocumentationRecord,
  type RaporBundleResponse,
  type StatusRapor,
} from "@/api/evaluation";
import { submitDosenReviewApi } from "@/api/antrean";
import { TranscriptDrawer } from "@/components/rapor/TranscriptDrawer";
import { VocalChart } from "@/components/rapor/VocalChart";
import { formatMmSs } from "@/hooks/useSimulationSession";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

type EvidenceTab = "klinis" | "pact" | "umpanBalik" | "vokal" | "dokumentasi" | "audit";

interface OverrideNoteEntry {
  id: string;
  butir: string;
  catatan: string;
}

const OVERRIDE_TARGET_PRESETS = [
  "Tool A (Koneksi)",
  "Tool B (Perspektif)",
  "Tool C (Empati)",
  "Tool D (Edukasi)",
  "Tool E (Finesse)",
  "Prosedur Klinis",
  "Penanganan DDI",
  "Kelengkapan Konseling",
  "Penalti Kesalahan Kritis",
  "Dokumentasi Konseling",
] as const;

const DOC_FIELDS: Array<{
  key: keyof DocumentationRecord;
  label: string;
  section: string;
  optional?: boolean;
}> = [
  { key: "nama_pasien", label: "Nama Pasien / Pendamping", section: "1. Identitas Pasien & Dokter" },
  { key: "usia_pasien", label: "Usia / Kategori Usia", section: "1. Identitas Pasien & Dokter" },
  { key: "jenis_kelamin", label: "Jenis Kelamin", section: "1. Identitas Pasien & Dokter" },
  {
    key: "nama_dokter",
    label: "Nama Dokter (Opsional)",
    section: "1. Identitas Pasien & Dokter",
    optional: true,
  },
  { key: "keluhan_diagnosa", label: "Keluhan Utama / Diagnosa", section: "2. Asesmen & Keluhan" },
  { key: "riwayat_alergi", label: "Riwayat Alergi Obat", section: "2. Asesmen & Keluhan" },
  { key: "obat_lain_penyerta", label: "Obat Lain / Kondisi Penyerta", section: "2. Asesmen & Keluhan" },
  {
    key: "nama_obat_dosis",
    label: "Nama Obat, Dosis & Aturan Pakai",
    section: "3. Terapi & Rekomendasi Obat",
  },
  {
    key: "instruksi_khusus",
    label: "Instruksi Khusus & Penyimpanan",
    section: "3. Terapi & Rekomendasi Obat",
  },
  {
    key: "edukasi_tindak_lanjut",
    label: "Edukasi & Rencana Tindak Lanjut",
    section: "4. Edukasi & Tindak Lanjut",
  },
];

const STATUS_BADGE: Record<
  StatusRapor,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  otomatis: {
    label: "Otomatis (AI)",
    cls: "border border-olive-600/25 bg-olive-100 text-olive-700",
    icon: CheckCircle2,
  },
  perlu_ditinjau_dosen: {
    label: "Perlu Ditinjau Dosen",
    cls: "border border-gold-400/60 bg-gold-100 text-amber-900",
    icon: Flag,
  },
  selesai_ditinjau: {
    label: "Selesai Ditinjau",
    cls: "border border-navy-900/20 bg-navy-900 text-white",
    icon: UserCheck,
  },
  tidak_cukup_data: {
    label: "Tidak Cukup Data",
    cls: "border border-amber-300 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  tidak_dapat_dinilai: {
    label: "Tidak Dapat Dinilai",
    cls: "border border-red-200 bg-red-50 text-red-700",
    icon: ShieldAlert,
  },
};

function formatDateTimeWib(iso?: string | null): string {
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

function pactTone(score: number | null): string {
  if (score === null) return "bg-slate-200";
  if (score >= 75) return "bg-olive-600";
  if (score >= 55) return "bg-gold-400";
  return "bg-red-600";
}

function parseOverrideNotes(raw: Record<string, unknown> | null | undefined): OverrideNoteEntry[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([butir, catatan], idx) => ({
      id: `note-${idx}-${butir}`,
      butir,
      catatan: String(catatan),
    }));
}

export default function DosenRaporReviewPage() {
  const { sessionId: paramSessionId } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  const sessionId = paramSessionId || sp.get("sesi") || "";
  const fromAntrean = sp.get("from") === "antrean";
  const backPath = fromAntrean ? "/dosen/antrean" : "/dosen/rekap";
  const backLabel = fromAntrean ? "Antrean & Tinjauan" : "Rekap Kelas & Analitik";

  const [bundle, setBundle] = useState<RaporBundleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EvidenceTab>("klinis");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter ringan untuk rincian di dalam masing-masing aspek
  const [klinisOnlyIssues, setKlinisOnlyIssues] = useState(false);
  const [pactOnlyIssues, setPactOnlyIssues] = useState(false);

  // State Form Tinjauan & Override Dosen
  const reviewFormRef = useRef<HTMLDivElement>(null);
  const finalScoreInputRef = useRef<HTMLInputElement>(null);
  const [formHighlight, setFormHighlight] = useState(false);

  const [komInput, setKomInput] = useState("");
  const [konInput, setKonInput] = useState("");
  const [autoCalcFinal, setAutoCalcFinal] = useState(true);
  const [finalInput, setFinalInput] = useState("");
  const [overrideNotes, setOverrideNotes] = useState<OverrideNoteEntry[]>([]);
  const [draftButir, setDraftButir] = useState<string>(OVERRIDE_TARGET_PRESETS[0]);
  const [draftNote, setDraftNote] = useState("");
  const [komentarInput, setKomentarInput] = useState("");
  const [alasanAuditInput, setAlasanAuditInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateFormFromBundle = useCallback((res: RaporBundleResponse) => {
    const r = res.rapor;
    setKomInput(
      r.skor_komunikasi_dosen != null
        ? String(Math.round(Number(r.skor_komunikasi_dosen)))
        : "",
    );
    setKonInput(
      r.skor_konten_dosen != null ? String(Math.round(Number(r.skor_konten_dosen))) : "",
    );
    const official = r.nilai_resmi_akhir ?? r.nilai_gabungan_sistem_tampil;
    setFinalInput(official != null ? String(Math.round(Number(official))) : "");
    setAutoCalcFinal(false);
    setOverrideNotes(parseOverrideNotes(r.catatan_override_butir));
    setKomentarInput(r.komentar_dosen_untuk_mahasiswa || "");
    setAlasanAuditInput("");
  }, []);

  const loadRapor = useCallback(async () => {
    if (!sessionId) {
      setError("ID sesi tidak ditemukan. Silakan pilih sesi dari Rekap Kelas atau Antrean Tinjauan.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSessionRaporApi(sessionId, { autoEvaluate: true });
      setBundle(res);
      hydrateFormFromBundle(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail rapor mahasiswa.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, hydrateFormFromBundle]);

  useEffect(() => {
    void loadRapor();
  }, [loadRapor]);

  const weights = useMemo(() => {
    const meta = (bundle?.rapor.metadata_evaluasi || {}) as Record<string, unknown>;
    const rawKom = Number(meta.bobot_komunikasi ?? bundle?.scenario.bobot_komunikasi ?? 0.4);
    const rawKon = Number(meta.bobot_konten ?? bundle?.scenario.bobot_konten ?? 0.6);
    const wKom = rawKom > 1 ? rawKom / 100 : rawKom;
    const wKon = rawKon > 1 ? rawKon / 100 : rawKon;
    const total = wKom + wKon || 1;
    return {
      kom: wKom / total,
      kon: wKon / total,
      komPct: Math.round((wKom / total) * 100),
      konPct: Math.round((wKon / total) * 100),
    };
  }, [bundle]);

  useEffect(() => {
    if (!bundle || !autoCalcFinal) return;
    const effKom =
      komInput.trim() !== ""
        ? Number(komInput)
        : (bundle.rapor.skor_komunikasi_tampil ?? bundle.rapor.skor_komunikasi_mentah);
    const effKon =
      konInput.trim() !== ""
        ? Number(konInput)
        : (bundle.rapor.skor_konten_tampil ?? bundle.rapor.skor_konten_mentah);

    if (
      typeof effKom === "number" &&
      Number.isFinite(effKom) &&
      typeof effKon === "number" &&
      Number.isFinite(effKon)
    ) {
      const calc = Math.max(0, Math.min(100, Math.round(effKom * weights.kom + effKon * weights.kon)));
      setFinalInput(String(calc));
    }
  }, [autoCalcFinal, komInput, konInput, bundle, weights]);

  const handleFocusReviewForm = () => {
    reviewFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFormHighlight(true);
    window.setTimeout(() => {
      finalScoreInputRef.current?.focus();
    }, 280);
    window.setTimeout(() => setFormHighlight(false), 1600);
  };

  const handleResetToSystem = () => {
    if (!bundle) return;
    const r = bundle.rapor;
    setKomInput("");
    setKonInput("");
    setAutoCalcFinal(false);
    const sysVal = r.nilai_gabungan_sistem_tampil ?? r.nilai_gabungan_sistem_mentah;
    setFinalInput(sysVal != null ? String(Math.round(Number(sysVal))) : "");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleAddOverrideNote = () => {
    const text = draftNote.trim();
    if (!text) return;
    setOverrideNotes((prev) => [
      ...prev,
      { id: `note-${Date.now()}`, butir: draftButir.trim() || "Umum", catatan: text },
    ]);
    setDraftNote("");
  };

  const handleRemoveOverrideNote = (id: string) => {
    setOverrideNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!bundle || !profile?.id || saving) return;

    setSaveError(null);
    setSaveSuccess(null);

    if (finalInput.trim() === "") {
      setSaveError("Nilai Resmi Akhir wajib diisi (0–100).");
      return;
    }

    const parsedFinal = Number(finalInput);
    if (!Number.isFinite(parsedFinal) || parsedFinal < 0 || parsedFinal > 100) {
      setSaveError("Nilai Resmi Akhir harus berupa angka antara 0 sampai 100.");
      return;
    }

    let parsedKom: number | null = null;
    if (komInput.trim() !== "") {
      const v = Number(komInput);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        setSaveError("Skor Komunikasi Dosen harus antara 0 sampai 100.");
        return;
      }
      parsedKom = Number(v.toFixed(2));
    }

    let parsedKon: number | null = null;
    if (konInput.trim() !== "") {
      const v = Number(konInput);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        setSaveError("Skor Konten Klinis Dosen harus antara 0 sampai 100.");
        return;
      }
      parsedKon = Number(v.toFixed(2));
    }

    const notesMap: Record<string, string> = {};
    for (const entry of overrideNotes) {
      const key = entry.butir.trim() || "Catatan";
      notesMap[key] = notesMap[key] ? `${notesMap[key]}; ${entry.catatan}` : entry.catatan;
    }
    if (draftNote.trim()) {
      const key = draftButir.trim() || "Catatan";
      notesMap[key] = notesMap[key]
        ? `${notesMap[key]}; ${draftNote.trim()}`
        : draftNote.trim();
    }

    setSaving(true);
    try {
      await submitDosenReviewApi({
        sessionId: bundle.session.id,
        idDosen: profile.id,
        namaDosen: profile.nama_lengkap,
        isOverridden: true,
        skorKomunikasiDosen: parsedKom,
        skorKontenDosen: parsedKon,
        nilaiResmiAkhir: Math.round(parsedFinal),
        catatanOverrideButir: notesMap,
        komentarDosenUntukMahasiswa: komentarInput,
        alasanPerubahan: alasanAuditInput,
      });

      void qc.invalidateQueries({ queryKey: ["dosen"] });
      void qc.invalidateQueries({ queryKey: ["penugasan"] });

      setDraftNote("");
      await loadRapor();
      setSaveSuccess(
        "Tinjauan dosen berhasil disimpan. Nilai Resmi Akhir & log audit telah diperbarui.",
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan tinjauan dosen.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-muted">
        <Loader2 size={30} className="animate-spin text-navy-900" />
        <p className="mt-3 text-sm font-medium text-ink">
          Memuat Detail Rapor &amp; Tinjauan Dosen...
        </p>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center">
        <ShieldAlert size={34} className="mx-auto text-red-600" />
        <h2 className="mt-3 text-lg font-bold text-navy-900">Detail Rapor Tidak Dapat Dimuat</h2>
        <p className="mt-1.5 text-sm text-muted">{error || "Data rapor tidak ditemukan."}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => void loadRapor()}
            className="rounded-xl bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800"
          >
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50"
          >
            Kembali ke {backLabel}
          </button>
        </div>
      </div>
    );
  }

  const { rapor, session, scenario, student, reviewer, documentation, transcript } = bundle;
  const statusMeta = STATUS_BADGE[rapor.status_rapor] || STATUS_BADGE.otomatis;
  const StatusIcon = statusMeta.icon;

  const isUnratable =
    rapor.status_rapor === "tidak_dapat_dinilai" &&
    Number(session.jumlah_giliran_valid ?? 0) === 0;
  const isInsufficientData = rapor.status_rapor === "tidak_cukup_data";

  const sysFinal = rapor.nilai_gabungan_sistem_tampil;
  const sysFinalRaw = rapor.nilai_gabungan_sistem_mentah;
  const officialFinal = rapor.nilai_resmi_akhir ?? sysFinal;
  const sessionCode = session.kode_sesi || `SES-${session.id.slice(0, 8).toUpperCase()}`;
  const durationSec = session.durasi_aktif_detik || 0;

  const parsedFinalPreview = finalInput.trim() !== "" ? Number(finalInput) : null;
  const deltaVsSystem =
    parsedFinalPreview !== null && Number.isFinite(parsedFinalPreview) && sysFinal !== null
      ? Math.round(parsedFinalPreview) - sysFinal
      : null;

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
  const pactList = (["A", "B", "C", "D", "E"] as const).map((k) => {
    const colScore: Record<string, number | null> = {
      A: rapor.skor_tool_a,
      B: rapor.skor_tool_b,
      C: rapor.skor_tool_c,
      D: rapor.skor_tool_d,
      E: rapor.skor_tool_e,
    };
    const fallbackName: Record<string, string> = {
      A: "Membangun Koneksi & Hubungan Awal",
      B: "Eksplorasi Perspektif Pasien",
      C: "Respons Empatik & Dukungan",
      D: "Edukasi Kolaboratif & Bahasa Awam",
      E: "Komunikasi Efektif & Penstrukturan",
    };
    const t = pactToolsMap[k];
    const score = t?.skor ?? colScore[k];
    return {
      kode: k,
      nama: t?.nama || fallbackName[k],
      skor: typeof score === "number" ? score : score != null ? Number(score) : null,
      alasan: t?.alasan || "Belum ada catatan evaluator.",
      kutipan: t?.kutipan || "",
      bukti: t?.bukti_giliran || [],
    };
  });

  const fbKuat = rapor.umpan_balik_rapor?.find((f) => f.kategori === "kekuatan_utama");
  const fbPerbaikan = rapor.umpan_balik_rapor?.find((f) => f.kategori === "area_perbaikan");
  const fbSaran = rapor.umpan_balik_rapor?.find((f) => f.kategori === "saran_praktik");

  const requiredDocFields = DOC_FIELDS.filter((f) => !f.optional);
  const filledRequiredDoc = documentation
    ? requiredDocFields.filter((f) => String(documentation[f.key] ?? "").trim().length > 0).length
    : 0;
  const docCompleteness = Math.round((filledRequiredDoc / requiredDocFields.length) * 100);
  const docSections = Array.from(new Set(DOC_FIELDS.map((f) => f.section)));

  const auditLogs = rapor.log_audit_sistem || [];

  const tabs: Array<{ key: EvidenceTab; label: string; count?: number }> = [
    { key: "klinis", label: "Konten Klinis & KK", count: kkItems.length || undefined },
    { key: "pact", label: "PaCT (A–E)" },
    { key: "umpanBalik", label: "Umpan Balik" },
    { key: "vokal", label: "Vokal" },
    { key: "dokumentasi", label: "Dokumentasi" },
    { key: "audit", label: "Log Audit", count: auditLogs.length || undefined },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-14">
      {/* ================================================================
          BAGIAN A: HEADER & RINGKASAN STATUS RAPOR
         ================================================================ */}
      <header className="space-y-4 border-b border-line pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Link
              to={backPath}
              className="inline-flex items-center gap-1 text-navy-900 hover:underline"
            >
              <ArrowLeft size={13} /> {backLabel}
            </Link>
            <span>/</span>
            <span className="font-semibold text-olive-600">Detail Rapor &amp; Tinjauan</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
            >
              <FileText size={14} /> Lihat Transkrip Lengkap ({transcript.length})
            </button>
            <button
              type="button"
              disabled={isUnratable}
              onClick={handleFocusReviewForm}
              className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PencilLine size={14} /> Ubah / Tinjau Nilai
            </button>
          </div>
        </div>

        {/* Identitas Mahasiswa, Sesi & Badge Status */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
                {student?.nama_lengkap || "Praktikan"}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  statusMeta.cls,
                )}
              >
                <StatusIcon size={13} /> {statusMeta.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="font-mono font-semibold text-ink">{student?.nomor_induk || "—"}</span>
              {student?.nama_kelas && (
                <>
                  <span>·</span>
                  <span className="font-medium text-ink">{student.nama_kelas}</span>
                </>
              )}
              <span>·</span>
              <span className="font-semibold text-navy-900">
                {scenario.kode_skenario || "—"} v{scenario.versi || "0.1"}
              </span>
              <span>{scenario.judul || "Skenario Praktikum"}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar size={13} /> Selesai{" "}
                {formatDateTimeWib(session.waktu_selesai || session.waktu_mulai)}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock size={13} /> Durasi {formatMmSs(durationSec)}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MessageSquare size={13} />{" "}
                {session.jumlah_giliran_valid ?? session.jumlah_giliran_mahasiswa ?? 0} giliran valid
              </span>
              <span className="font-mono text-[11px]">{sessionCode}</span>
            </div>
          </div>
        </div>

        {/* Kartu Perbandingan Nilai Sistem vs. Nilai Resmi */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-muted">Nilai Gabungan Sistem (AI)</p>
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
                Rekam Jejak AI
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

          <div className="rounded-2xl border border-navy-900/20 bg-navy-900 p-5 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-sky-200">Nilai Resmi Akhir</p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {officialFinal ?? "—"}
                  </span>
                  <span className="text-xs text-sky-200">/ 100</span>
                  {rapor.is_overridden &&
                    sysFinal != null &&
                    officialFinal != null &&
                    officialFinal !== sysFinal && (
                      <span className="rounded-md bg-gold-400 px-2 py-0.5 text-[11px] font-bold text-navy-900 tabular-nums">
                        {officialFinal - sysFinal > 0
                          ? `+${officialFinal - sysFinal}`
                          : officialFinal - sysFinal}{" "}
                        vs sistem
                      </span>
                    )}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                  rapor.is_overridden ? "bg-gold-400 text-navy-900" : "bg-white/15 text-white",
                )}
              >
                {rapor.is_overridden ? "Override / Diverifikasi Dosen" : "Basis: Sistem"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3 text-xs text-sky-100">
              {rapor.is_overridden || rapor.waktu_ditinjau ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck size={13} className="text-gold-400" />
                  Ditinjau oleh{" "}
                  <b className="text-white">{reviewer?.nama_lengkap || "Dosen Penguji"}</b> ·{" "}
                  {formatDateTimeWib(rapor.waktu_ditinjau)}
                </span>
              ) : (
                <span>Belum ada penyesuaian dosen. Anda dapat mengubah nilai kapan saja.</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================
          GRID UTAMA: BAGIAN B (BUKTI EVALUASI) + BAGIAN C (FORM OVERRIDE)
         ================================================================ */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* BAGIAN B: PANEL BUKTI EVALUASI (TANPA TAB TRANSKRIP) */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5">
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

          {/* TAB 1: KONTEN KLINIS & KESALAHAN KRITIS (BESERTA RINCIAN BUTIRNYA) */}
          {activeTab === "klinis" && (
            <div className="space-y-4">
              {/* Temuan Kesalahan Kritis */}
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
                      Perlu Perhatian
                    </span>
                  )}
                </div>

                {kkItems.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    Tidak ada temuan kesalahan kritis pada sesi ini. Seluruh pilar bebas penalti
                    kesalahan kritis.
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
                            <span className="rounded bg-red-100 px-2 py-0.5 font-mono text-[11px] font-bold text-red-700">
                              {kk.id}
                            </span>
                            <span className="font-semibold text-ink">{kk.judul}</span>
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
                              ? kk.status_koreksi || "Koreksi diri berhasil"
                              : `Penalti -${kk.penalti_diterapkan} poin`}
                          </span>
                        </div>
                        {kk.deskripsi && (
                          <p className="mt-2 leading-relaxed text-muted">{kk.deskripsi}</p>
                        )}
                        {kk.kutipan && (
                          <p className="mt-2 rounded-lg border border-line bg-white px-3 py-2 italic text-ink">
                            &ldquo;{kk.kutipan}&rdquo;
                            {kk.kode_giliran_terjadi && (
                              <span className="ml-2 not-italic font-mono text-[10px] text-muted">
                                [{kk.kode_giliran_terjadi}]
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Pilar Skor & Penalti */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Prosedur Klinis",
                    score: rapor.skor_prosedur,
                    penalty: rapor.total_penalti_prosedur,
                  },
                  {
                    label: "Penanganan DDI",
                    score: rapor.skor_penanganan_ddi,
                    penalty: rapor.total_penalti_ddi,
                  },
                  {
                    label: "Kelengkapan Konseling",
                    score: rapor.skor_kelengkapan,
                    penalty: rapor.total_penalti_kelengkapan,
                  },
                ].map((p) => (
                  <div key={p.label} className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs font-medium text-muted">{p.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-navy-900">
                      {p.score != null ? Math.round(Number(p.score)) : "—"}
                      <span className="ml-1 text-xs font-normal text-muted">/ 100</span>
                    </p>
                    <p className="mt-1.5 text-[11px] tabular-nums text-muted">
                      {Number(p.penalty || 0) > 0 ? (
                        <span className="font-semibold text-red-700">
                          Penalti aktif: -{Number(p.penalty)} poin
                        </span>
                      ) : (
                        "Tanpa penalti"
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* Rincian Kriteria Butir Konten Klinis (langsung di aspek klinis) */}
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
                      Belum Tuntas
                    </button>
                  </div>
                </div>
                {visibleClinicalItems.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-muted">
                    {klinisOnlyIssues
                      ? "Seluruh butir konten klinis terpenuhi."
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
                              {item.ambigu && (
                                <span className="rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                  Ambigu
                                </span>
                              )}
                            </div>
                            {item.kutipan ? (
                              <p className="mt-1.5 italic text-muted">
                                &ldquo;{item.kutipan}&rdquo;
                                {item.kode_giliran && (
                                  <span className="ml-1.5 not-italic font-mono text-[10px]">
                                    [{item.kode_giliran}]
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
                                    ? "Kutipan Ditolak (0)"
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

          {/* TAB 2: KOMUNIKASI PaCT (TOOL A - E + RINCIAN KRITERIANYA) */}
          {activeTab === "pact" && (
            <div className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-navy-900">
                      Komunikasi Terapeutik PaCT (Tool A–E)
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Skor sistem komunikasi: <b>{rapor.skor_komunikasi_tampil ?? "—"}</b> / 100
                      {rapor.skor_komunikasi_mentah != null && (
                        <> (mentah: {Number(rapor.skor_komunikasi_mentah).toFixed(2)})</>
                      )}
                      {rapor.skor_komunikasi_dosen != null && (
                        <>
                          {" "}
                          · Override dosen:{" "}
                          <b className="text-navy-900">
                            {Math.round(Number(rapor.skor_komunikasi_dosen))}
                          </b>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {pactList.map((tool) => (
                    <div key={tool.kode} className="rounded-xl border border-line bg-cream/50 p-4">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-ink">
                          <span className="mr-1.5 font-mono font-bold text-navy-900">
                            Tool {tool.kode}
                          </span>
                          {tool.nama}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-navy-900">
                          {tool.skor !== null ? Math.round(tool.skor) : "—"}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className={cn("h-full rounded-full", pactTone(tool.skor))}
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
                  ))}
                </div>

                {(rapor.detail_pact?.pelanggaran_jargon || []).length > 0 && (
                  <div className="rounded-xl border border-gold-400/50 bg-gold-100/60 p-4 text-xs">
                    <p className="font-semibold text-amber-900">
                      Jargon Medis Tanpa Padanan Awam
                    </p>
                    <ul className="mt-2 space-y-1 text-amber-950">
                      {rapor.detail_pact.pelanggaran_jargon!.map((j, i) => (
                        <li key={`${j.istilah}-${i}`}>
                          <b>{j.istilah}</b>
                          {j.padanan_diharapkan?.length
                            ? ` — padanan awam: ${j.padanan_diharapkan.join(", ")}`
                            : ""}
                          {j.penalti ? ` (-${j.penalti} poin Tool D)` : ""}
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
                        Belum Tuntas
                      </button>
                    </div>
                  </div>
                  {visiblePactCriteria.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-muted">
                      Seluruh kriteria komunikasi PaCT terpenuhi.
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
                                <span className="text-[11px] text-muted">
                                  · Pilar {k.pilar}
                                </span>
                              </div>
                              {k.kutipan ? (
                                <p className="mt-1.5 italic text-muted">
                                  &ldquo;{k.kutipan}&rdquo;
                                  {k.kode_giliran && (
                                    <span className="ml-1.5 not-italic font-mono text-[10px]">
                                      [{k.kode_giliran}]
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
                <h2 className="text-sm font-bold text-navy-900">
                  Umpan Balik Kualitatif Rapor
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Rangkuman refleksi klinis otomatis yang juga diterima mahasiswa pada rapor.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Yang Sudah Baik */}
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

                {/* Perlu Ditingkatkan */}
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

                {/* Fokus Latihan Berikut */}
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

          {/* TAB 4: PENGAMATAN VOKAL (FORMATIF) */}
          {activeTab === "vokal" && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
                <Volume2 size={16} className="text-navy-900" />
                <div>
                  <h2 className="text-sm font-bold text-navy-900">
                    Pengamatan Vokal Praktikan (Formatif · Non-Nilai)
                  </h2>
                  <p className="text-xs text-muted">
                    Catatan pendukung prosodi suara (WPM, pitch Hz, intensitas dB).
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

          {/* TAB 5: DOKUMENTASI KONSELING */}
          {activeTab === "dokumentasi" && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck size={17} className="text-navy-900" />
                  <div>
                    <h2 className="text-sm font-bold text-navy-900">
                      Dokumentasi Konseling (Formulir 5 &amp; 7 Permenkes 73/2016)
                    </h2>
                    <p className="text-xs text-muted">
                      Bandingkan isian mahasiswa dengan bukti percakapan pada transkrip.
                    </p>
                  </div>
                </div>
                {documentation && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-lg bg-olive-100 px-2.5 py-1 font-bold text-olive-700 tabular-nums">
                      Kelengkapan {docCompleteness}%
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-muted tabular-nums">
                      {formatMmSs(documentation.durasi_pengisian_detik || 0)}
                    </span>
                  </div>
                )}
              </div>

              {!documentation ? (
                <p className="py-10 text-center text-xs text-muted">
                  Mahasiswa belum mengisi formulir dokumentasi konseling untuk sesi ini.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {docSections.map((sec) => (
                    <div key={sec} className="rounded-xl border border-line bg-cream/50 p-4">
                      <h3 className="text-xs font-bold text-navy-900">{sec}</h3>
                      <div className="mt-2.5 divide-y divide-line">
                        {DOC_FIELDS.filter((f) => f.section === sec).map((f) => {
                          const val = String(documentation[f.key] ?? "").trim();
                          return (
                            <div
                              key={f.key}
                              className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-4"
                            >
                              <span className="text-xs font-medium text-muted sm:w-52 sm:shrink-0">
                                {f.label}
                              </span>
                              <span
                                className={cn(
                                  "flex-1 whitespace-pre-wrap text-xs",
                                  val ? "text-ink" : "italic text-muted",
                                )}
                              >
                                {val || (f.optional ? "Tidak diisi (opsional)" : "Kosong")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: LOG AUDIT SISTEM */}
          {activeTab === "audit" && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <History size={16} className="text-navy-900" />
                <div>
                  <h2 className="text-sm font-bold text-navy-900">
                    Log Audit Sistem &amp; Riwayat Perubahan Nilai
                  </h2>
                  <p className="text-xs text-muted">
                    Setiap evaluasi otomatis dan perubahan nilai oleh dosen terekam kronologis.
                  </p>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted">
                  Belum ada catatan audit tersimpan.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {auditLogs.map((entry, idx) => {
                    const isDosenLog = entry.startsWith("[TINJAUAN DOSEN]");
                    return (
                      <li
                        key={`${idx}-${entry.slice(0, 24)}`}
                        className={cn(
                          "rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed",
                          isDosenLog
                            ? "border-navy-900/20 bg-sky-50/70 font-medium text-navy-900"
                            : "border-line bg-cream/60 font-mono text-[11px] text-muted",
                        )}
                      >
                        {entry}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* ================================================================
            BAGIAN C: FORM TINJAUAN & OVERRIDE NILAI DOSEN (SELALU BISA DIAKSES)
           ================================================================ */}
        <aside
          ref={reviewFormRef}
          className={cn(
            "rounded-2xl border bg-white p-5 transition lg:sticky lg:top-20",
            formHighlight ? "border-navy-900 ring-2 ring-navy-900/15" : "border-line",
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-line pb-3.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-olive-600">
                Form Tinjauan Dosen
              </p>
              <h2 className="mt-0.5 text-base font-bold text-navy-900">
                {rapor.status_rapor === "selesai_ditinjau"
                  ? "Perbarui Nilai & Catatan"
                  : rapor.status_rapor === "otomatis"
                    ? "Koreksi / Override Rapor Otomatis"
                    : "Tinjau & Tetapkan Nilai Resmi"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleResetToSystem}
              disabled={isUnratable}
              title="Kembalikan input ke nilai awal sistem"
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted hover:bg-slate-50 hover:text-ink disabled:opacity-40"
            >
              <RotateCcw size={11} /> Sistem
            </button>
          </div>

          {isUnratable ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <p className="font-semibold">Sesi Tidak Dapat Dinilai</p>
              <p className="mt-1 leading-relaxed">
                Sesi ini tidak memiliki giliran percakapan mahasiswa yang valid sehingga belum dapat
                diberikan nilai resmi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
              {isInsufficientData && (
                <div className="flex items-start gap-2 rounded-xl border border-gold-400/60 bg-gold-100/75 px-3 py-2.5 text-xs text-amber-950">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-700" />
                  <p>
                    Sesi ini berstatus <b>Tidak Cukup Data</b> (&lt; 5 giliran valid). Anda tetap
                    diizinkan menetapkan nilai manual jika diperlukan.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink">Komunikasi Dosen</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={komInput}
                    onChange={(e) => {
                      setKomInput(e.target.value);
                      setAutoCalcFinal(true);
                    }}
                    placeholder={
                      rapor.skor_komunikasi_tampil != null
                        ? `Sistem: ${rapor.skor_komunikasi_tampil}`
                        : "0–100"
                    }
                    className="mt-1.5 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm font-semibold tabular-nums text-ink outline-none transition focus:border-navy-900 focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-muted">Opsional · bobot {weights.komPct}%</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">
                    Konten Klinis Dosen
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={konInput}
                    onChange={(e) => {
                      setKonInput(e.target.value);
                      setAutoCalcFinal(true);
                    }}
                    placeholder={
                      rapor.skor_konten_tampil != null
                        ? `Sistem: ${rapor.skor_konten_tampil}`
                        : "0–100"
                    }
                    className="mt-1.5 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm font-semibold tabular-nums text-ink outline-none transition focus:border-navy-900 focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-muted">Opsional · bobot {weights.konPct}%</p>
                </div>
              </div>

              <div className="rounded-xl border border-navy-900/15 bg-cream/70 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-navy-900">
                    Nilai Resmi Akhir (0–100) *
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={autoCalcFinal}
                      onChange={(e) => setAutoCalcFinal(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-navy-900"
                    />
                    Hitung otomatis
                  </label>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <input
                    ref={finalScoreInputRef}
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={finalInput}
                    onChange={(e) => {
                      setAutoCalcFinal(false);
                      setFinalInput(e.target.value);
                    }}
                    className="w-28 rounded-xl border border-navy-900/30 bg-white px-3.5 py-2 text-xl font-bold tabular-nums text-navy-900 outline-none focus:border-navy-900"
                  />
                  <div className="text-xs">
                    <p className="font-medium text-ink">
                      {deltaVsSystem === null
                        ? "Nilai baru ditetapkan manual"
                        : deltaVsSystem === 0
                          ? "Sama dengan nilai sistem"
                          : `${deltaVsSystem > 0 ? `+${deltaVsSystem}` : deltaVsSystem} poin dari sistem (${sysFinal})`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Nilai sistem AI tetap tersimpan terpisah.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-ink">
                  Catatan Override per Butir (Opsional)
                </label>

                {overrideNotes.length > 0 && (
                  <div className="space-y-1.5">
                    {overrideNotes.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-2 rounded-xl border border-line bg-cream px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-navy-900">{entry.butir}</p>
                          <p className="mt-0.5 text-muted">{entry.catatan}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOverrideNote(entry.id)}
                          aria-label="Hapus catatan"
                          className="shrink-0 rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 rounded-xl border border-dashed border-line bg-cream/40 p-2.5">
                  <select
                    value={draftButir}
                    onChange={(e) => setDraftButir(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink outline-none focus:border-navy-900"
                  >
                    {OVERRIDE_TARGET_PRESETS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOverrideNote();
                        }
                      }}
                      placeholder="Misal: Edukasi penyimpanan ada di MHS-04"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-navy-900"
                    />
                    <button
                      type="button"
                      onClick={handleAddOverrideNote}
                      disabled={!draftNote.trim()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Plus size={12} /> Tambah
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">
                  Komentar Dosen untuk Mahasiswa
                </label>
                <textarea
                  rows={3}
                  value={komentarInput}
                  onChange={(e) => setKomentarInput(e.target.value)}
                  placeholder="Tulis umpan balik langsung yang akan tampil di rapor mahasiswa..."
                  className="mt-1.5 w-full rounded-xl border border-line bg-cream px-3 py-2 text-xs leading-relaxed text-ink outline-none transition focus:border-navy-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">
                  Alasan Perubahan (Log Audit · Opsional)
                </label>
                <input
                  type="text"
                  value={alasanAuditInput}
                  onChange={(e) => setAlasanAuditInput(e.target.value)}
                  placeholder="Ringkas untuk riwayat audit perubahan nilai..."
                  className="mt-1.5 w-full rounded-xl border border-line bg-cream px-3 py-2 text-xs text-ink outline-none transition focus:border-navy-900 focus:bg-white"
                />
              </div>

              {saveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="rounded-xl border border-olive-600/25 bg-olive-100 px-3 py-2.5 text-xs font-medium text-olive-700">
                  {saveSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {rapor.status_rapor === "selesai_ditinjau"
                  ? "Perbarui Nilai Resmi"
                  : "Simpan Tinjauan & Tetapkan Nilai Resmi"}
              </button>

              <p className="text-center text-[11px] text-muted">
                Status rapor otomatis berubah menjadi <b>Selesai Ditinjau</b> dan tetap dapat diubah
                kembali kapan saja.
              </p>
            </form>
          )}
        </aside>
      </div>

      {/* Slide-over Transkrip (sama seperti tampilan mahasiswa sebelumnya) */}
      <TranscriptDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessionCode={sessionCode}
        durationSec={durationSec}
        transcript={transcript}
        clinicalItems={clinicalItems}
        pactCriteria={pactCriteria}
        criticalErrors={kkItems}
        studentSpeakerLabel="Mahasiswa"
      />
    </div>
  );
}
