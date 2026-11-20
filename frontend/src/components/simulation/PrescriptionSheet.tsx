import type { Prescription } from "@/types/simulation";

export function PrescriptionSheet({ rx }: { rx: Prescription }) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-line bg-white p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid select-none place-items-center font-serif text-[120px] font-bold tracking-widest text-navy-900/[0.04]"
      >
        UNPAD
      </span>

      <div className="relative">
        <div className="text-center">
          <h4 className="font-serif text-xl font-bold uppercase tracking-wide text-navy-900">{rx.clinic}</h4>
          <p className="mt-1 text-xs text-muted">{rx.address}</p>
          <p className="mt-2 inline-block rounded bg-sky-50 px-3 py-1 text-xs font-medium text-navy-900">
            {rx.doctor}
            {rx.sip && <><span className="mx-1 text-muted">|</span>{rx.sip}</>}
          </p>
        </div>

        <hr className="my-4 border-t-2 border-navy-900" />

        <div className="flex justify-between font-serif text-xs">
          <span>{rx.room && <><b>Ruang / Poli:</b> {rx.room}</>}</span>
          <span><b>Tanggal:</b> {rx.date}</span>
        </div>

        <ul className="mt-4 divide-y divide-line border-t border-line">
          {rx.items.map((it, i) => (
            <li key={`${it.drug}-${i}`} className="flex gap-4 py-4">
              <span className="font-serif text-3xl italic leading-none text-navy-800">R/</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-serif text-base font-semibold">{it.drug}</p>
                  <p className="flex items-baseline gap-3 whitespace-nowrap font-serif text-sm font-semibold">
                    {it.qty && <>No. {it.qty}</>}
                    <span className="font-hand text-lg font-medium italic text-navy-800/80" title="Paraf dokter">
                      dto.
                    </span>
                  </p>
                </div>
                <p className="mt-1 font-hand text-2xl text-navy-800">{it.signa}</p>
              </div>
            </li>
          ))}
        </ul>

        <hr className="border-t-2 border-navy-900" />
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
          <span><span className="text-muted">Pro (Pasien):</span> <b>{rx.patientName}</b></span>
          {rx.patientAddress && <span><span className="text-muted">Alamat:</span> <b>{rx.patientAddress}</b></span>}
        </div>
      </div>
    </div>
  );
}