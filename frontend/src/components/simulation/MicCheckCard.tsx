import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Headphones, ListChecks, Mic, SlidersHorizontal, Wifi, AudioLines } from "lucide-react";
import { useMicStore } from "@/store/micStore";
import { useMicMeter } from "@/hooks/useMicMeter";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

const verdictUi = {
  idle: { box: "bg-sky-50 text-navy-800", icon: Mic, text: "Klik “Uji Input Suara”, lalu ucapkan satu kalimat seperti saat konseling." },
  quiet: { box: "bg-amber-50 text-amber-800", icon: AlertTriangle, text: "Suara terlalu pelan. Dekatkan mikrofon atau naikkan volume input di sistem." },
  optimal: { box: "bg-sky-50 text-navy-800", icon: CheckCircle2, text: "Kualitas input jernih, bebas noise berlebih. Siap digunakan." },
  clipping: { box: "bg-red-50 text-red-700", icon: AlertTriangle, text: "Suara terlalu keras dan berpotensi pecah. Jauhkan mikrofon atau turunkan gain." },
} as const;

function Chip({ ok, icon: Icon, children }: { ok: boolean; icon: typeof Wifi; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium",
        ok ? "border-line bg-white text-ink" : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <Icon size={13} className={ok ? "text-lime-700" : "text-red-600"} />
      {children}
    </span>
  );
}
export function MicCheckCard({ compact = false }: { compact?: boolean }) {
  const { status, deviceLabel, devices, selectedId, check, select } = useMicStore();
  const { running, bars, level, verdict, start } = useMicMeter();
  const online = useOnline();
  const [showDevices, setShowDevices] = useState(false);

  useEffect(() => { void check(); }, [check]);

  const ready = status === "ready";
  const pct = Math.round(level * 100);
  const live = level > 0.97 ? "Clipping" : level < 0.12 ? "Pelan" : "Optimal";
  const v = verdictUi[verdict];
  const hasHeadset = !!deviceLabel && /head(set|phone)|usb|bluetooth|airpods/i.test(deviceLabel);

  const badge = ready
    ? { cls: "bg-lime-100 text-lime-800", text: "Aktif & Terdeteksi" }
    : status === "checking" || status === "idle"
      ? { cls: "bg-amber-100 text-amber-800", text: "Memeriksa..." }
      : { cls: "bg-red-100 text-red-700", text: status === "denied" ? "Izin Ditolak" : "Tidak Ditemukan" };

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Mic size={18} /> Pemeriksaan Mikrofon
        </h3>
        <span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold", badge.cls)}>
          {badge.text}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-cream p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Perangkat Input Utama</p>
        <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
          <Headphones size={16} className="shrink-0" />
          <span className="truncate">{deviceLabel ?? "Belum ada perangkat"}</span>
        </p>
      </div>

      {/* Waveform */}
      <div className="mt-3 rounded-xl bg-navy-900 p-4 text-white">
        <div className="flex items-start justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Level Input Suara Real-Time</p>
          <p className="text-[11px] font-bold text-gold-400">{running ? `${pct}% (${live})` : "—"}</p>
        </div>
        <div className="mt-3 flex h-16 items-center justify-between gap-[3px]" aria-hidden>
          {bars.map((b, i) => (
            <span
              key={i}
              className={cn("w-1 rounded-full transition-[height] duration-75", b > 0.5 ? "bg-gold-400" : "bg-lime-300")}
              style={{ height: `${Math.round(b * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-serif text-[10px] text-white/50">
          <span>Mute</span><span>Sensitivitas Ideal</span><span>Clipping</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => (ready ? start() : check())}
          disabled={running || status === "checking"}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-100 py-3 text-sm font-semibold text-navy-900 hover:bg-sky-200 disabled:opacity-60"
        >
          <AudioLines size={16} />
          {running ? "Mendengarkan..." : ready ? "Uji Input Suara (Tes Mic)" : "Coba Lagi"}
        </button>
        <button
          onClick={() => setShowDevices((s) => !s)}
          aria-label="Pilih perangkat mikrofon"
          aria-expanded={showDevices}
          className={cn("grid w-12 place-items-center rounded-lg border border-line hover:bg-cream", showDevices && "bg-cream")}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {showDevices && (
        <select
          value={selectedId ?? ""}
          onChange={(e) => select(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
        >
          {devices.length === 0 && <option value="">Tidak ada perangkat</option>}
          {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      )}

      {(!compact || verdict !== "idle") && (
        <div className={cn("mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm", v.box)}>
          <v.icon size={16} className="mt-0.5 shrink-0" />
          <span>{v.text}</span>
        </div>
      )}

      {!compact && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <ListChecks size={14} /> Status Kesiapan Teknis
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip ok={online} icon={Wifi}>{online ? "Koneksi AI Stabil" : "Koneksi Terputus"}</Chip>
            <Chip ok={ready} icon={Mic}>{ready ? "Izin Mic Aktif" : "Izin Mic Belum Aktif"}</Chip>
            <Chip ok={hasHeadset || !ready} icon={Headphones}>
              {hasHeadset ? "Headset Terdeteksi" : "Headset Disarankan"}
            </Chip>
          </div>
        </div>
      )}
    </section>
  );
}