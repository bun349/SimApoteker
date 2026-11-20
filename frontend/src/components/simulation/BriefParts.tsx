import { ArrowLeft, ArrowRight, Info, Keyboard } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMicStore } from "@/store/micStore";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";
import type { SessionKind } from "./SwamedikasiBrief";

export function BriefTopBar({ mode, crumb }: { mode: SessionKind; crumb?: string }) {
  const graded = mode === "praktikum";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-4 py-2 font-medium hover:bg-cream"
        >
          <ArrowLeft size={15} /> Kembali ke Dashboard
        </Link>
        {crumb && (<><span className="text-muted">/</span><span className="font-semibold">{crumb}</span></>)}
      </div>
      {graded ? (
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-navy-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-gold-400">
          <span className="h-2 w-2 rounded-full bg-gold-400" /> Praktikum: Sesi Dinilai Resmi
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-navy-900">
          <span className="h-2 w-2 rounded-full bg-lime-600" /> Latihan Mandiri: Tidak Dinilai
        </span>
      )}
    </div>
  );
}

export function ProtocolCard({ graded }: { graded: boolean }) {
  return (
    <section className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5">
      <Info size={18} className="mt-0.5 shrink-0 text-navy-800" />
      <div className="text-sm">
        <p className="font-semibold text-navy-800">
          {graded ? "Ketentuan Protokol Evaluasi:" : "Ketentuan Latihan Mandiri:"}
        </p>
        <p className="mt-1">
          {graded ? (
            <>Dalam mode praktikum, tombol <b>“Selesaikan Sesi”</b> hanya akan aktif setelah penggalian
            informasi klinis terpenuhi dengan tuntas sesuai ambang rubrik KIE.</>
          ) : (
            <>Sesi latihan mandiri tidak dinilai resmi. Anda boleh mengakhiri sesi kapan saja dan mendapat
            umpan balik formatif dari AI.</>
          )}
        </p>
      </div>
    </section>
  );
}

export function PushToTalkCard() {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-gold-400/50 bg-gold-100 p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-400/40 text-amber-800">
        <Keyboard size={18} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold text-navy-900">Mekanisme Suara: Push-to-Talk Aktif</p>
        <p className="mt-1">
          Gunakan tombol <b>Space</b> atau klik ikon mikrofon untuk berbicara. Tekan sekali untuk merekam,
          lalu tekan kembali untuk mengirim pesan Anda ke pasien.
        </p>
      </div>
      <kbd className="rounded-lg border border-line bg-white px-3 py-2 font-serif text-xs font-bold shadow-sm">
        SPACE
      </kbd>
    </section>
  );
}

export function StartButton({ caseId, mode }: { caseId: string; mode: SessionKind }) {
  const navigate = useNavigate();
  const micReady = useMicStore((s) => s.status === "ready");
  const online = useOnline();
  const canStart = micReady && online;

  return (
    <>
      <button
        disabled={!canStart}
        onClick={() => navigate(`/simulasi/${caseId}/sesi?mode=${mode}`)}
        className={cn(
          "flex w-full items-center justify-center gap-3 rounded-2xl py-4 font-serif text-lg font-bold shadow-md transition",
          canStart ? "bg-gold-400 text-navy-900 hover:brightness-95" : "cursor-not-allowed bg-gray-200 text-gray-500 shadow-none",
        )}
      >
        {mode === "mandiri" ? "Mulai Sesi Mandiri" : "Mulai Simulasi Sekarang"} <ArrowRight size={20} />
      </button>
      {!canStart && (
        <p className="text-center text-xs text-muted">
          {!online ? "Koneksi internet terputus." : "Aktifkan mikrofon terlebih dahulu untuk memulai sesi."}
        </p>
      )}
    </>
  );
}

export function BriefFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
      <Link to="/tata-tertib" className="inline-flex items-center gap-2 underline decoration-dotted underline-offset-4">
        <Info size={14} /> Lihat Tata Tertib & Panduan Simulasi
      </Link>
      <span>Fakultas Farmasi Universitas Padjadjaran</span>
    </footer>
  );
}