import type { Prescription } from "@/types/simulation";

interface PrescriptionSheetProps {
  rx: Prescription;
  prescriptionNumber?: string;
  badgeText?: string;
  stampText?: string;
}

export function PrescriptionSheet({
  rx,
  prescriptionNumber,
  badgeText = "Salinan Sah",
  stampText = "SALINAN RESEP SESUAI ASLI - CAP LEGALISIR FARMASI",
}: PrescriptionSheetProps) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      {/* Top Header Row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2 text-navy-900">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-700">
            Rx
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
            Lembar Salinan Resep Dokter
          </h3>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-100/80 px-3 py-1 text-xs font-medium text-lime-800">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-600" />
          {badgeText}
        </span>
      </div>

      {/* Inner Sheet */}
      <div className="rounded-lg border border-line bg-white p-5">
        {/* Clinic & Doctor Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700">
            +
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 sm:text-sm">
              {rx.clinic}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">{rx.address}</p>
            <p className="mt-0.5 text-xs font-semibold text-amber-700">
              {rx.doctor}
              {rx.sip && (
                <span className="ml-1.5 font-normal text-slate-500">| {rx.sip}</span>
              )}
            </p>

            {(prescriptionNumber || rx.room || rx.date) && (
              <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-slate-600">
                {prescriptionNumber && (
                  <div>
                    No. Resep:{" "}
                    <span className="font-semibold text-slate-800">{prescriptionNumber}</span>
                  </div>
                )}
                {rx.room && (
                  <div>
                    Ruang / Poli: <span className="text-slate-700">{rx.room}</span>
                  </div>
                )}
                {rx.date && (
                  <div>
                    Tgl Resep: <span className="text-slate-700">{rx.date}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <hr className="my-4 border-line" />

        {/* R/ Cards */}
        <ul className="space-y-3">
          {rx.items.map((it, i) => (
            <li
              key={`${it.drug}-${i}`}
              className="flex items-start justify-between gap-4 rounded-lg border border-line bg-white px-4 py-3.5"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="font-serif text-xl font-bold italic leading-none text-sky-900">
                  R/
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{it.drug}</p>
                    <span className="rounded bg-sky-100/80 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                      {it.qty ? `No. ${it.qty}` : "No. XXX"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs italic text-slate-600">
                    Signa: <span className="text-slate-700">{it.signa}</span>
                  </p>
                </div>
              </div>

              <span
                className="shrink-0 font-serif text-xs italic text-slate-400"
                title="Paraf dokter"
              >
                dto.
              </span>
            </li>
          ))}
        </ul>

        {/* Patient & Legal Stamp Footer */}
        <div className="mt-5 space-y-3">
          <div className="space-y-0.5 text-xs text-slate-600">
            <div>
              Pro: <span className="font-medium text-slate-800">{rx.patientName}</span>
            </div>
            {rx.patientAddress && (
              <div>
                Alamat: <span className="text-slate-700">{rx.patientAddress}</span>
              </div>
            )}
          </div>

          {stampText && (
            <div className="inline-block rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-amber-800">
              {stampText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}