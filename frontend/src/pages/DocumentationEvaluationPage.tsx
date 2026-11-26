import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileEdit,
  Loader2,
} from "lucide-react";
import { fetchSessionDocumentationApi, type DocumentationRecord } from "@/api/evaluation";
import { formatMmSs } from "@/hooks/useSimulationSession";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface FieldCheck {
  key: keyof DocumentationRecord;
  label: string;
  section: string;
  optional?: boolean;
}

const DOC_FIELDS: FieldCheck[] = [
  { key: "nama_pasien", label: "Nama Pasien / Pendamping", section: "1. Identitas Pasien & Dokter" },
  { key: "usia_pasien", label: "Usia / Kategori Usia", section: "1. Identitas Pasien & Dokter" },
  { key: "jenis_kelamin", label: "Jenis Kelamin", section: "1. Identitas Pasien & Dokter" },
  { key: "nama_dokter", label: "Nama Dokter (Opsional)", section: "1. Identitas Pasien & Dokter", optional: true },
  { key: "keluhan_diagnosa", label: "Keluhan Utama / Diagnosa", section: "2. Asesmen & Keluhan" },
  { key: "riwayat_alergi", label: "Riwayat Alergi Obat", section: "2. Asesmen & Keluhan" },
  { key: "obat_lain_penyerta", label: "Obat Lain / Kondisi Penyerta", section: "2. Asesmen & Keluhan" },
  { key: "nama_obat_dosis", label: "Nama Obat, Dosis & Aturan Pakai", section: "3. Terapi & Rekomendasi Obat" },
  { key: "instruksi_khusus", label: "Instruksi Khusus & Penyimpanan", section: "3. Terapi & Rekomendasi Obat" },
  { key: "edukasi_tindak_lanjut", label: "Edukasi & Rencana Tindak Lanjut", section: "4. Edukasi & Tindak Lanjut" },
];

export default function DocumentationEvaluationPage() {
  const [sp] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const isDosenView = profile?.peran === "dosen" || location.pathname.startsWith("/dosen");
  const sessionId = sp.get("sesi") ?? "";
  const raporPath = isDosenView ? "/dosen/rapor" : "/rapor";

  const [doc, setDoc] = useState<DocumentationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDoc = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSessionDocumentationApi(sessionId);
      setDoc(res.documentation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat penilaian dokumentasi.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadDoc();
  }, [loadDoc]);

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-muted">ID sesi tidak ditemukan.</p>
        <button
          type="button"
          onClick={() => navigate(isDosenView ? "/dosen/rekap" : "/rapor")}
          className="mt-4 rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white"
        >
          {isDosenView ? "Kembali ke Rekap Kelas" : "Kembali ke Rapor"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-muted">
        <Loader2 size={30} className="animate-spin text-gold-400" />
        <p className="mt-3 text-sm font-medium">Memuat Data Dokumentasi Kefarmasian...</p>
      </div>
    );
  }

  const requiredFields = DOC_FIELDS.filter((f) => !f.optional);
  const filledRequired = doc
    ? requiredFields.filter((f) => String(doc[f.key] ?? "").trim().length > 0).length
    : 0;
  const completenessPct = Math.round((filledRequired / requiredFields.length) * 100);

  const sections = Array.from(new Set(DOC_FIELDS.map((f) => f.section)));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`${raporPath}?sesi=${encodeURIComponent(sessionId)}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-900 hover:underline"
        >
          <ArrowLeft size={14} /> Kembali ke Rapor Evaluasi KIE
        </Link>

        {!isDosenView && (
          <Link
            to={`/dokumentasi?sesi=${encodeURIComponent(sessionId)}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 hover:bg-cream"
          >
            <FileEdit size={14} /> {doc ? "Buka Formulir Dokumentasi" : "Isi Dokumentasi Sekarang"}
          </Link>
        )}
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-900 text-gold-400">
            <ClipboardCheck size={22} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Formulir 5 &amp; 7 Permenkes 73/2016
            </p>
            <h1 className="font-serif text-xl font-bold text-navy-900">
              Penilaian &amp; Tinjauan Dokumentasi Kefarmasian
            </h1>
          </div>
        </div>

        {doc && (
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-line bg-cream px-4 py-2 text-right">
              <p className="text-[10px] font-bold uppercase text-muted">Kelengkapan Isian</p>
              <p className="font-serif text-xl font-bold text-navy-900">{completenessPct}%</p>
            </div>
            <div className="rounded-xl border border-line bg-white px-4 py-2 text-xs text-muted">
              <p className="flex items-center gap-1 font-semibold text-ink">
                <Clock size={13} /> {formatMmSs(doc.durasi_pengisian_detik || 0)}
              </p>
              <p className="mt-0.5 text-[11px]">
                {doc.waktu_habis ? "Disimpan otomatis (waktu habis)" : "Disimpan sebelum batas waktu"}
              </p>
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {!doc ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center shadow-sm">
          <AlertCircle size={32} className="mx-auto text-amber-600" />
          <h2 className="mt-3 font-serif text-base font-bold text-navy-900">
            Dokumentasi Belum Diisi untuk Sesi Ini
          </h2>
          <p className="mt-1 text-xs text-muted">
            {isDosenView
              ? "Praktikan belum mengisi formulir dokumentasi konseling untuk sesi ini."
              : "Silakan lengkapi formulir dokumentasi konseling agar dapat ditinjau bersama rapor KIE."}
          </p>
          {!isDosenView && (
            <Link
              to={`/dokumentasi?sesi=${encodeURIComponent(sessionId)}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-navy-800"
            >
              <FileEdit size={14} /> Mulai Isi Dokumentasi
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => {
            const fields = DOC_FIELDS.filter((f) => f.section === sec);
            return (
              <section
                key={sec}
                className="rounded-2xl border border-line bg-white p-5 shadow-sm"
              >
                <h2 className="mb-3 font-serif text-sm font-bold text-navy-900">{sec}</h2>
                <div className="divide-y divide-line">
                  {fields.map((f) => {
                    const val = String(doc[f.key] ?? "").trim();
                    const filled = val.length > 0;
                    return (
                      <div
                        key={f.key}
                        className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-navy-900">{f.label}</p>
                          <p
                            className={cn(
                              "mt-1 whitespace-pre-wrap text-sm",
                              filled ? "text-ink" : "italic text-muted",
                            )}
                          >
                            {filled ? val : "Belum diisi"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2.5 py-1 text-[11px] font-bold",
                            filled
                              ? "bg-emerald-50 text-emerald-800"
                              : f.optional
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-100 text-amber-900",
                          )}
                        >
                          {filled ? (
                            <>
                              <CheckCircle2 size={12} /> Terisi
                            </>
                          ) : f.optional ? (
                            "Opsional"
                          ) : (
                            "Kosong"
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
