import { useEffect } from "react";
import { Mic, Volume2 } from "lucide-react";
import { useMicStore } from "@/store/micStore";
import { cn } from "@/lib/utils";

export function MicStatus() {
  const { status, deviceLabel, level, check, test } = useMicStore();
  useEffect(() => {
    check();
  }, [check]);

  const label = {
    idle: "Memeriksa mikrofon...",
    checking: "Memeriksa mikrofon...",
    ready: "Mikrofon siap",
    denied: "Izin mikrofon ditolak",
    not_found: "Mikrofon tidak ditemukan",
  }[status];

  return (
    <div className="inline-flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-muted">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "ready"
            ? "bg-emerald-500"
            : status === "checking" || status === "idle"
              ? "bg-amber-400"
              : "bg-red-500",
        )}
      />
      <Mic size={13} />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {status === "ready" && deviceLabel ? ` · ${deviceLabel}` : ""}
      </span>
      <button
        type="button"
        onClick={status === "ready" ? test : check}
        className="inline-flex items-center gap-1 font-medium text-navy-900 hover:underline"
      >
        <Volume2 size={12} /> {status === "ready" ? "Uji" : "Coba lagi"}
      </button>
      {level > 0 && (
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
          <span
            className="block h-full bg-emerald-500 transition-all"
            style={{ width: `${level * 100}%` }}
          />
        </span>
      )}
    </div>
  );
}
