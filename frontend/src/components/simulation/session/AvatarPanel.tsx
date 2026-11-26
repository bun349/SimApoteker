import { AudioLines, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  avatarUrl?: string;
  name: string;
  subtitle: string;
  initials?: string;
  patientStatus?: string;
  audioLabel?: string;
  virtualStatus?: string;
  speaking?: boolean;
}

export function AvatarPanel({
  avatarUrl,
  name,
  subtitle,
  initials,
  patientStatus = "Pasien Mendengarkan",
  audioLabel = "Audio Siap",
  virtualStatus = "Siap berdialog",
  speaking = false,
}: Props) {
  const computedInitials =
    initials ??
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <section className="flex min-h-[420px] flex-col justify-between overflow-hidden rounded-xl border border-line bg-white lg:h-full lg:min-h-0">
      {/* Bar status atas yang tenang */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 text-xs">
        <span className="inline-flex items-center gap-2 font-medium text-ink">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              speaking ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
          {patientStatus}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <AudioLines size={13} /> {audioLabel}
        </span>
      </div>

      {/* Area avatar utama */}
      <div className="flex flex-1 items-center justify-center bg-slate-50/60 p-6">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="max-h-full w-full max-w-xs rounded-2xl object-cover"
          />
        ) : (
          <div className="grid aspect-square w-48 place-items-center rounded-full bg-white text-slate-400 ring-1 ring-line sm:w-56">
            <User size={76} strokeWidth={1.25} />
          </div>
        )}
      </div>

      {/* Bar identitas pasien di bawah */}
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-navy-900">
            {computedInitials}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted">
          {virtualStatus}
        </span>
      </div>
    </section>
  );
}
