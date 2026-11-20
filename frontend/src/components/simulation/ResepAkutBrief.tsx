import { useEffect, useState } from "react";
import { ClipboardList, Clock, FileText, Quote, Stethoscope, User, UserRound, X, ZoomIn } from "lucide-react";
import type { CaseDetail } from "@/types/simulation";
import { MicCheckCard } from "./MicCheckCard";
import { TechChecklist } from "./TechChecklist";
import { PrescriptionSheet } from "./PrescriptionSheet";
import { BriefFooter, BriefTopBar, ProtocolCard, PushToTalkCard, StartButton } from "./BriefParts";
import type { SessionKind } from "./SwamedikasiBrief";

export function ResepAkutBrief({ c, mode }: { c: CaseDetail; mode: SessionKind }) {
  const [zoom, setZoom] = useState(false);
  const rx = c.prescription;

  useEffect(() => {
    if (!zoom) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoom]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <BriefTopBar mode={mode} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ===== Kolom kiri ===== */}
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="h-1 bg-linear-to-r from-lime-700 to-gold-400" />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-navy-900 px-3 py-1 text-[11px] font-bold tracking-wide text-white">
                  RESEP
                </span>
                {c.estimatedMinutes && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-100 px-2.5 py-1 text-xs text-amber-800">
                    <Clock size={12} /> {c.estimatedMinutes}
                  </span>
                )}
              </div>
              {c.caseLabel && (
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{c.caseLabel}</p>
              )}
              <h1 className="mt-1 font-serif text-3xl font-bold leading-tight">{c.title}</h1>
            </div>
          </section>

          <section className="flex gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy-900 text-white">
              <ClipboardList size={18} />
            </span>
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-navy-900">Instruksi Tugas:</p>
              <p className="mt-1">{c.instruction}</p>
            </div>
          </section>

          {/* Identitas pasien */}
          <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                <UserRound size={18} className="text-lime-700" /> Identitas Pasien &amp; Keluhan Terbuka
              </h2>
              {c.settingBadge && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-sky-100 px-3 py-1 text-[11px] font-medium text-navy-800">
                  <Stethoscope size={12} /> {c.settingBadge}
                </span>
              )}
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
                <p className="mt-2 text-sm font-semibold">{c.shortName}</p>
                <p className="text-xs text-muted">{c.patientSummary ?? c.ageLabel}</p>
              </div>

              <div className="min-w-0 rounded-lg bg-white p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                  <Quote size={13} /> Keluhan / Kalimat Pembuka Pasien:
                </p>
                <p className="mt-3 border-l-4 border-gold-400 pl-4 font-serif text-lg italic leading-relaxed text-ink/80">
                  “{c.openingLine}”
                </p>
                {c.refillStatus && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-cream px-4 py-2.5 text-sm">
                    <span className="text-muted">Status Tebus:</span>
                    <b className="text-navy-900">{c.refillStatus}</b>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Lembar resep */}
          {rx && (
            <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                  <FileText size={18} className="text-navy-900" /> Lembar Salinan Resep Dokter
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom(true)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-navy-900 hover:bg-cream"
                  >
                    <ZoomIn size={13} /> Perbesar Lembar Resep
                  </button>
                </div>
              </div>
              <hr className="my-4 border-line" />
              <PrescriptionSheet rx={rx} />
            </section>
          )}

          <BriefFooter />
        </div>

        {/* ===== Kolom kanan ===== */}
        <aside className="min-w-0 space-y-4">
          <MicCheckCard compact />
          <TechChecklist />
          <ProtocolCard graded={mode === "praktikum"} />
          <PushToTalkCard />
          <StartButton caseId={c.id} mode={mode} />
        </aside>
      </div>

      {/* Modal perbesar resep */}
      {zoom && rx && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setZoom(false)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoom(false)}
              aria-label="Tutup"
              className="absolute -top-3 -right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white shadow-lg"
            >
              <X size={18} />
            </button>
            <div style={{ zoom: 1.2 }}>
              <PrescriptionSheet rx={rx} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}