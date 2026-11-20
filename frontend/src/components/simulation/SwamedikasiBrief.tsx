import { ArrowLeft, ArrowRight, ClipboardList, Clock, Info, Lightbulb, LockOpen, Quote, User, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router"; 
import type { CaseDetail } from "@/types/simulation";
import { MicCheckCard } from "./MicCheckCard";
import { useMicStore } from "@/store/micStore";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

export type SessionKind = "praktikum" | "mandiri";

export function SwamedikasiBrief({ c, mode }: { c: CaseDetail; mode: SessionKind }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  const tugasId = searchParams.get("tugas"); 

  const micReady = useMicStore((s) => s.status === "ready");
  const online = useOnline();
  const canStart = micReady && online;
  const graded = mode === "praktikum";

  const handleStartSimulation = () => {
    let targetUrl = `/simulasi/${c.id}/sesi?mode=${mode}`;
    
    if (tugasId) {
      targetUrl += `&tugas=${tugasId}`;
    }
    
    navigate(targetUrl);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      {/* Bar atas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-4 py-2 font-medium hover:bg-cream"
          >
            <ArrowLeft size={15} /> Kembali ke Dashboard
          </Link>
          <span className="text-muted">/</span>
          <span className="font-semibold">Detail Kasus {c.category || "Swamedikasi"}</span>
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Kolom kiri */}
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="h-1 bg-linear-to-r from-lime-700 to-gold-400" />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-sky-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-navy-800 uppercase">
                  {c.category || "SKENARIO KIE"}
                </span>
                {c.estimatedMinutes && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-cream px-2.5 py-1 text-xs text-muted">
                    <Clock size={12} /> {c.estimatedMinutes}
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-serif text-3xl font-bold leading-tight">{c.title}</h1>
            </div>
          </section>

          <section className="flex gap-3 rounded-2xl border border-line border-l-4 border-l-navy-900 bg-white p-5 shadow-sm">
            <ClipboardList size={18} className="mt-0.5 shrink-0 text-navy-900" />
            <p className="text-sm leading-relaxed">
              <b className="text-navy-900">Instruksi Tugas:</b> {c.instruction}
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                <UserRound size={18} className="text-lime-700" /> Identitas Pasien & Keluhan Terbuka
              </h2>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lime-100 px-3 py-1 text-[11px] font-medium text-lime-800">
                <LockOpen size={12} /> Data Terbuka Awal
              </span>
            </div>

            <div className="mt-4 grid gap-5 rounded-xl bg-cream p-5 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <div className="relative h-44 w-40 overflow-hidden rounded-xl bg-sky-50">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.shortName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-navy-900"><User size={40} /></div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded bg-navy-900/80 px-1.5 py-0.5 font-serif text-[10px] text-white">
                    {c.avatarCode}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold">{c.shortName}</p>
                <p className="text-[11px] text-muted mt-1 leading-tight">{c.patientMeta}</p>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="rounded-lg bg-white p-4 h-full">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                    <Quote size={13} /> Ucapan Pembuka Pasien Virtual:
                  </p>
                  <p className="mt-2 font-serif text-lg italic leading-relaxed text-ink/80">
                    “{c.openingLine}”
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <Info size={18} className="mt-0.5 shrink-0 text-navy-800" />
            <div className="text-sm">
              <p className="font-semibold text-navy-800">
                {graded ? "Ketentuan Protokol Evaluasi:" : "Ketentuan Latihan Mandiri:"}
              </p>
              <p className="mt-1">
                {graded ? (
                  <>
                    Dalam mode praktikum, tombol <b>“Selesaikan Sesi”</b> hanya akan aktif setelah penggalian
                    informasi klinis terpenuhi dengan tuntas sesuai ambang rubrik KIE (termasuk verifikasi alergi, kepatuhan, atau pertanyaan Three Prime Questions).
                  </>
                ) : (
                  <>
                    Sesi latihan mandiri tidak dinilai resmi. Anda boleh mengakhiri sesi kapan saja dan
                    mendapat umpan balik formatif dari AI.
                  </>
                )}
              </p>
            </div>
          </section>

          <section className="flex gap-3 rounded-2xl border border-gold-400/50 bg-gold-100 p-5">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <p className="text-sm leading-relaxed">
              <b className="text-navy-900">Mekanisme Suara:</b> Gunakan tombol{" "}
              <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-serif text-xs">Space</kbd>{" "}
              atau klik ikon mikrofon untuk berbicara (Push-to-Talk). Tekan sekali untuk merekam, lalu tekan
              kembali untuk mengirim pesan Anda ke pasien.
            </p>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <Link to="/tata-tertib" className="inline-flex items-center gap-2 underline decoration-dotted underline-offset-4">
              <Info size={14} /> Lihat Tata Tertib & Panduan Simulasi
            </Link>
            <span>Fakultas Farmasi Universitas Padjadjaran</span>
          </footer>
        </div>

        {/* Kolom kanan */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <MicCheckCard />
          <button
            disabled={!canStart}
            onClick={handleStartSimulation} 
            className={cn(
              "flex w-full items-center justify-center gap-3 rounded-2xl py-4 font-serif text-lg font-bold shadow-md transition",
              canStart ? "bg-gold-400 text-navy-900 hover:brightness-95" : "cursor-not-allowed bg-gray-200 text-gray-500 shadow-none",
            )}
          >
            {graded ? "Mulai Simulasi Sekarang" : "Mulai Sesi Mandiri"} <ArrowRight size={20} />
          </button>
          {!canStart && (
            <p className="text-center text-xs text-muted">
              {!online ? "Koneksi internet terputus." : "Aktifkan mikrofon terlebih dahulu untuk memulai sesi."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}