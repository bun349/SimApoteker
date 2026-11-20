import { AudioLines, Ear, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  avatarUrl?: string;
  name: string;            // "Pak Budi"
  subtitle: string;        // "58 th · Pensiunan Guru"
  initials?: string;       // "PB"
  patientStatus?: string;  // sudut kiri atas
  audioLabel?: string;     // sudut kanan atas
  virtualStatus?: string;  // sudut kanan bawah
  speaking?: boolean;
}

const chip = "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm";

export function AvatarPanel({
  avatarUrl, name, subtitle, initials, patientStatus = "Pasien Mendengarkan",
  audioLabel = "16kHz Audio Aktif", virtualStatus = "Virtual Pasien Standby", speaking = false,
}: Props) {
  return (
    <section className="relative flex min-h-[460px] flex-col rounded-2xl border border-line bg-white p-4 shadow-sm lg:min-h-0 lg:h-full">
      {/* Sudut kiri atas */}
      <div className="absolute left-4 top-4 z-10">
        <span className={cn(chip, "border border-line bg-white")}>
          <span className={cn("h-2 w-2 rounded-full", speaking ? "bg-amber-500" : "bg-lime-600")} />
          {patientStatus}
        </span>
      </div>

      {/* Sudut kanan atas */}
      <div className="absolute right-4 top-4 z-10">
        <span className={cn(chip, "border border-line bg-white font-mono text-navy-900")}>
          <AudioLines size={14} className="text-lime-700" /> {audioLabel}
        </span>
      </div>

      {/* Avatar */}
      <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-14">
        {avatarUrl ? (
          <img
            src={avatarUrl} alt={name}
            className="max-h-full w-full max-w-sm rounded-3xl object-cover"
          />
        ) : (
          <div className="grid aspect-square w-full max-w-xs place-items-center rounded-3xl bg-sky-50 text-navy-900">
            <User size={96} strokeWidth={1.2} />
          </div>
        )}
      </div>

      {/* Sudut kiri bawah */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-sm font-bold text-navy-900">
            {initials ?? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="leading-tight">
            <p className="font-serif text-sm font-bold">{name}</p>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Sudut kanan bawah */}
      <div className="absolute bottom-4 right-4 z-10">
        <span className={cn(chip, "bg-navy-900 text-white")}>
          <MessageCircle size={14} className="text-gold-400" /> {virtualStatus}
        </span>
      </div>
    </section>
  );
}