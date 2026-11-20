import { Hospital, PenTool } from "lucide-react";
import type { ChronicPrescription } from "@/types/simulation";

export function ChronicPrescriptionSheet({ rx }: { rx: ChronicPrescription }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-line bg-white p-5">
      <div className="flex gap-3">
        <Hospital size={20} className="mt-0.5 shrink-0 text-lime-700" />
        <div className="min-w-0 text-sm">
          <h4 className="font-bold uppercase leading-snug text-navy-900">{rx.facility}</h4>
          {rx.address && <p className="mt-1 text-xs text-muted">{rx.address}</p>}
          {rx.doctor && <p className="mt-1 text-xs font-semibold text-amber-700">{rx.doctor}</p>}
          <p className="mt-3 text-xs text-muted">
            No. Resep: <b className="font-mono text-ink">{rx.rxNumber}</b>
          </p>
          <p className="text-xs text-muted">Tgl Resep: {rx.date}</p>
        </div>
      </div>

      <hr className="my-4 border-line" />

      <ul className="space-y-3">
        {rx.items.map((it, idx) => (
          <li key={`${it.drug}-${idx}`} className="rounded-lg border border-line bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-serif text-xl font-bold italic text-navy-800">R/</span>
                <span className="text-sm font-medium text-ink">{it.drug}</span>
                {it.qty && (
                  <span className="rounded bg-sky-100 px-2 py-0.5 font-mono text-[11px] text-navy-800">
                    No. {it.qty}
                  </span>
                )}
              </div>

              <span
                className="inline-flex shrink-0 items-center gap-1 font-serif text-sm italic text-navy-800/80"
                title="Paraf dokter"
              >
                <PenTool size={13} className="opacity-60" />
                dto.
              </span>
            </div>

            {it.signa && (
              <p className="mt-1.5 pl-7 text-xs text-muted">
                Signa: <span className="font-mono italic text-navy-900">{it.signa}</span>
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-0.5 text-xs text-muted">
        <p>Pro: {rx.patientLine}</p>
        {rx.addressLine && <p>Alamat: {rx.addressLine}</p>}
      </div>

      {rx.stamp && (
        <p className="mt-3 inline-block rounded border border-gold-400/60 bg-gold-100 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          {rx.stamp}
        </p>
      )}
    </div>
  );
}