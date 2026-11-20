// components/dashboard/MicStatus.tsx
import { useEffect } from "react";
import { Mic, Volume2 } from "lucide-react";
import { useMicStore } from "@/store/micStore";
import { cn } from "@/lib/utils";

export function MicStatus() {
  const { status, deviceLabel, level, check, test } = useMicStore();
  useEffect(() => { check(); }, [check]);

  const label = {
    idle: "Memeriksa...", checking: "Memeriksa...",
    ready: "Mikrofon Siap:", denied: "Izin Mikrofon Ditolak",
    not_found: "Mikrofon Tidak Ditemukan",
  }[status];

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-4 py-2 text-xs shadow-sm">
      <span className={cn("h-2 w-2 rounded-full",
        status === "ready" ? "bg-lime-500" : status === "checking" ? "bg-amber-400" : "bg-red-500")} />
      <Mic size={12} className="text-muted" />
      <span>
        <b className="font-semibold">{label}</b>{" "}
        {status === "ready" && <span className="text-muted">{deviceLabel} terdeteksi</span>}
      </span>
      <button
        onClick={status === "ready" ? test : check}
        className="flex items-center gap-1 font-semibold text-navy-900"
      >
        <Volume2 size={12} /> {status === "ready" ? "Uji" : "Coba Lagi"}
      </button>
      {level > 0 && (
        <span className="h-1.5 w-16 overflow-hidden rounded bg-gray-200">
          <span className="block h-full bg-lime-500 transition-all" style={{ width: `${level * 100}%` }} />
        </span>
      )}
    </div>
  );
}