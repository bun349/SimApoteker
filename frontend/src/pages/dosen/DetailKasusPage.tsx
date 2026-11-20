import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ClipboardCheck,
  FilePlus2,
  Pencil,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { buatVersiBaru, fetchDraft } from "@/api/wizard";
import { useAuthStore } from "@/store/authStore";
import { useChangeStatus } from "@/hooks/useSkenario";
import { jenisMeta } from "@/lib/skenario";
import { MODES } from "@/lib/finalisasi";
import { cn } from "@/lib/utils";
import { TabInstrumen, TabKlinis, TabNilai, TabProfil } from "@/components/dosen/detail/DetailTabs";

const TABS = [
  { key: "profil", label: "Profil & Persona Pasien", icon: UserRound },
  { key: "klinis", label: "Data Klinis Khusus", icon: Stethoscope },
  { key: "instrumen", label: "Instrumen Penilaian", icon: ClipboardCheck },
  { key: "nilai", label: "Konfigurasi Nilai", icon: SlidersHorizontal },
] as const;

const nextGuess = (v: string) => {
  const m = v.match(/^(\d+)\.(\d+)$/);
  return m ? `${m[1]}.${Number(m[2]) + 1}` : v;
};

function Dialog({
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dlg-title" className="font-serif text-lg font-bold">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold hover:bg-cream disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-bold text-navy-900 hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const Notice = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 text-center text-sm shadow-sm">
    {children}
    <p className="mt-4">
      <Link to="/dosen/kasus" className="font-semibold text-navy-900 underline">
        Kembali ke Bank Kasus
      </Link>
    </p>
  </div>
);

export default function DetailKasusPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const ownerId = useAuthStore((s) => s.profile?.id);
  const [dialog, setDialog] = useState(false);

  const q = useQuery({
    queryKey: ["skenario", "draft", id],
    queryFn: () => fetchDraft(id!, ownerId!),
    enabled: !!id && !!ownerId,
  });

  const change = useChangeStatus(ownerId);

  const revise = useMutation({
    mutationFn: () => {
      if (!ownerId) throw new Error("Sesi tidak valid");
      return buatVersiBaru(id!, ownerId);
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["skenario"] });
      navigate(`/dosen/kasus/${r.id}/susun?langkah=1`);
    },
  });

  if (q.isLoading) return <div className="animate-pulse text-muted">Memuat detail skenario...</div>;
  if (q.isError) return <Notice>Gagal memuat skenario.</Notice>;
  if (!q.data) return <Notice>Skenario tidak ditemukan atau bukan milik Anda.</Notice>;

  const d = q.data;
  const tab = TABS.find((t) => t.key === sp.get("tab"))?.key ?? "profil";
  const meta = jenisMeta(d.jenis);

  const statusLabel =
    d.status === "diterbitkan"
      ? "Rilis Resmi • Beku"
      : d.status === "arsip"
        ? "Arsip"
        : d.status === "beku"
          ? "Siap Rilis • Beku"
          : "Draf";

  const statusCls =
    d.status === "diterbitkan"
      ? "bg-lime-100 text-lime-800"
      : d.status === "arsip"
        ? "bg-gray-200 text-gray-700"
        : "bg-gold-100 text-amber-800";

  const modes = MODES.filter((m) => d.modeRilis.includes(m.key));
  const canRevise = d.status === "diterbitkan";
  const archived = d.status === "arsip";

  const toggleArchive = () => {
    if (!archived && !window.confirm(`Arsipkan ${d.kode} v${d.versi}? Skenario tidak akan muncul di bank soal.`)) {
      return;
    }
    change.mutate({
      id: d.id,
      status: archived ? (d.beku ? "diterbitkan" : "draf") : "arsip",
    });
  };

  const btn =
    "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <Link to="/dosen/kasus" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Kembali ke Bank Kasus &amp; Studio
      </Link>

      {/* Header */}
      <header className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">{d.kode}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} /> {meta.label}
              </span>
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-navy-800">
                v{d.versi}
              </span>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusCls)}>{statusLabel}</span>
              {modes.map((m) => (
                <span key={m.key} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium">
                  {m.key === "praktikum" ? "Bank Praktikum" : "Bank Mandiri"}
                </span>
              ))}
            </div>
            <h1 className="mt-3 font-serif text-2xl font-bold leading-snug sm:text-3xl">{d.judul}</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/dosen/kasus/${d.id}/uji`} className={cn(btn, "border border-line bg-white hover:bg-cream")}>
              <Play size={15} /> Uji Coba Skenario
            </Link>
            {canRevise && (
              <button
                type="button"
                onClick={() => setDialog(true)}
                className={cn(btn, "bg-gold-400 font-bold text-navy-900 hover:brightness-95")}
              >
                <FilePlus2 size={15} /> Buat Versi Baru
              </button>
            )}
            {!d.beku && !archived && (
              <Link
                to={`/dosen/kasus/${d.id}/susun`}
                className={cn(btn, "bg-gold-400 font-bold text-navy-900 hover:brightness-95")}
              >
                <Pencil size={15} /> Lanjutkan Penyusunan
              </Link>
            )}
            <button
              type="button"
              onClick={toggleArchive}
              disabled={change.isPending}
              className={cn(btn, "border border-line bg-white hover:bg-cream")}
            >
              {archived ? (
                <>
                  <RotateCcw size={15} /> Pulihkan
                </>
              ) : (
                <>
                  <Archive size={15} /> Arsipkan Kasus
                </>
              )}
            </button>
          </div>
        </div>
        {change.isError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Gagal mengubah status skenario. Coba lagi.
          </p>
        )}
      </header>

      {/* Tab */}
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setSp({ tab: t.key }, { replace: true })}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold transition",
              tab === t.key ? "bg-navy-900 text-white" : "text-muted hover:text-ink",
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "profil" && <TabProfil d={d} />}
        {tab === "klinis" && <TabKlinis d={d} />}
        {tab === "instrumen" && <TabInstrumen d={d} />}
        {tab === "nilai" && <TabNilai d={d} />}
      </div>

      {dialog && (
        <Dialog
          title="Buat Versi Baru?"
          confirmLabel="Lanjutkan"
          busy={revise.isPending}
          error={revise.isError ? (revise.error as Error).message : null}
          onConfirm={() => revise.mutate()}
          onClose={() => setDialog(false)}
        >
          Revisi pada skenario ini akan menghasilkan dokumen draf versi baru (misal v{nextGuess(d.versi)}).
          Skenario versi lama (v{d.versi}) akan tetap tersimpan untuk riwayat ujian. Lanjutkan?
        </Dialog>
      )}
    </div>
  );
}