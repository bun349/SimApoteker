import { ClipboardList, Clock, FileText, Quote, Repeat, ShieldCheck, User, UserRound } from "lucide-react";
import type { CaseDetail } from "@/types/simulation";
import { MicCheckCard } from "./MicCheckCard";
import { TechChecklist } from "./TechChecklist";
import { ChronicPrescriptionSheet } from "./ChronicPrescriptionSheet";
import { BriefFooter, BriefTopBar, ProtocolCard, PushToTalkCard, StartButton } from "./BriefParts";
import type { SessionKind } from "./SwamedikasiBrief";

export function ResepKronisBrief({ c, mode }: { c: CaseDetail; mode: SessionKind }) {
  const rx = c.chronicRx;
  const hasVisitInfo = Boolean(c.visitStatus || c.clinicUnit);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <BriefTopBar mode={mode} />

      {/* Kartu judul, membentang penuh */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="h-1 bg-linear-to-r from-lime-700 to-gold-400" />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-navy-900 px-3 py-1 text-[11px] font-bold tracking-wide text-white">
              RESEP
            </span>
            {c.estimatedMinutes && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-cream px-2.5 py-1 text-xs text-muted">
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ===== Kolom kiri ===== */}
        <div className="min-w-0 space-y-6">
          <section className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <ClipboardList size={18} className="mt-0.5 shrink-0 text-navy-900" />
            <p className="text-sm leading-relaxed">
              <b className="text-navy-900">Instruksi Tugas:</b> {c.instruction}
            </p>
          </section>

          {/* Identitas pasien */}
          <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                <UserRound size={18} className="text-lime-700" /> Identitas Pasien &amp; Keluhan Terbuka
              </h2>
              {c.refillBadge && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lime-100 px-3 py-1 text-[11px] font-medium text-lime-800">
                  <Repeat size={12} /> {c.refillBadge}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-5 rounded-xl bg-cream p-5 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <div className="relative h-44 w-40 overflow-hidden rounded-xl bg-sky-50">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.shortName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-navy-900">
                      <User size={40} />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded bg-navy-900/80 px-1.5 py-0.5 font-serif text-[10px] text-white">
                    {c.avatarCode}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold">{c.shortName}</p>
                <p className="text-xs text-muted">{c.patientSummary ?? c.ageLabel}</p>
              </div>

              <div className="min-w-0 space-y-3">
                {hasVisitInfo && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {c.visitStatus && (
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-[11px] text-muted">Status Kunjungan</p>
                        <p className="mt-0.5 truncate text-sm font-semibold">{c.visitStatus}</p>
                      </div>
                    )}
                    {c.clinicUnit && (
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-[11px] text-muted">Poli / DPJP</p>
                        <p className="mt-0.5 truncate text-sm font-semibold" title={c.clinicUnit}>
                          {c.clinicUnit}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                    <Quote size={13} /> Kalimat Pembuka Pasien:
                  </p>
                  <p className="mt-2 font-serif text-lg italic leading-relaxed text-ink/80">
                    “{c.openingLine}”
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Lembar resep */}
          {rx && (
            <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
                  <FileText size={18} className="text-navy-900" /> Lembar Salinan Resep Dokter Pasien Kronis
                </h2>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lime-100 px-3 py-1.5 text-[11px] font-medium text-lime-800">
                  <ShieldCheck size={13} /> Salinan Sah
                </span>
              </div>
              <div className="mt-4">
                <ChronicPrescriptionSheet rx={rx} />
              </div>
            </section>
          )}
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

      <BriefFooter />
    </div>
  );
}