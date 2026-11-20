import { CheckCircle2, Headphones, ListChecks, XCircle } from "lucide-react";
import { useMicStore } from "@/store/micStore";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

function Row({ ok, label, on, off }: { ok: boolean; label: string; on: string; off: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-cream px-4 py-3 text-sm">
      <span className="flex items-center gap-3">
        {ok ? <CheckCircle2 size={18} className="text-lime-700" /> : <XCircle size={18} className="text-red-600" />}
        {label}
      </span>
      <span className={cn("whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold",
        ok ? "bg-lime-100 text-lime-800" : "bg-red-100 text-red-700")}>
        {ok ? on : off}
      </span>
    </div>
  );
}

export function TechChecklist() {
  const micReady = useMicStore((s) => s.status === "ready");
  const online = useOnline();

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
        <ListChecks size={18} className="text-lime-700" /> Checklist Kesiapan Teknis
      </h3>
      <div className="mt-4 space-y-2">
        <Row ok={online} label="Koneksi Mesin KIE Farmasi AI" on="Tersambung" off="Terputus" />
        <Row ok={micReady} label="Izin Akses Mikrofon Browser" on="Granted" off="Belum" />
        <div className="flex items-start gap-3 rounded-lg border border-line bg-cream px-4 py-3 text-sm">
          <Headphones size={18} className="mt-0.5 shrink-0 text-navy-900" />
          <p>
            <b>Rekomendasi:</b> Gunakan headset agar suara respons pasien virtual tidak memicu feedback audio.
          </p>
        </div>
      </div>
    </section>
  );
}