import { ArrowLeft, ArrowRight, Circle, CircleCheck, ListChecks, Loader2, Save, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Msg { type: "ok" | "error"; text: string }

interface Props {
  checks: { label: string; ok: boolean }[];
  statusText: string;
  ready: boolean;
  nextLabel: string;
  nextDisabled: boolean;
  onNext: () => void;
  onSave: () => void;
  saving: boolean;
  msg: Msg | null;
  onPrev?: () => void;
  prevDisabled?: boolean;
  hideNext?: boolean;
}

export function WizardSidePanel(p: Props) {
  const okCount = p.checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-4 xl:sticky xl:top-24">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-base font-bold">
            <ListChecks size={17} /> Kelengkapan
          </h2>
          {p.checks.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-lime-800">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-600" /> {okCount}/{p.checks.length}
            </span>
          )}
        </div>

        {p.checks.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {p.checks.map((c) => (
              <li key={c.label} className={cn("flex items-start gap-2.5 text-sm font-medium", !c.ok && "text-muted")}>
                {c.ok
                  ? <CircleCheck size={17} className="mt-0.5 shrink-0 text-lime-700" />
                  : <Circle size={17} className="mt-0.5 shrink-0 text-muted/50" />}
                {c.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted">Belum ada aturan validasi untuk langkah ini.</p>
        )}

        <p className={cn("mt-4 rounded-lg px-3 py-2.5 text-xs font-semibold", p.ready ? "bg-sky-50 text-navy-800" : "bg-amber-50 text-amber-800")}>
          {p.statusText}
        </p>
      </section>

      <section className="space-y-2 rounded-2xl border border-line bg-white p-4 shadow-sm">
       {!p.hideNext && (
        <button
          onClick={p.onNext}
          disabled={p.nextDisabled}
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-gold-400 px-4 py-3.5 text-left text-sm font-bold text-navy-900 shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
        >
          <span>{p.nextLabel}</span>
          {p.saving ? <Loader2 size={17} className="shrink-0 animate-spin" /> : <ArrowRight size={17} className="shrink-0" />}
        </button>
       )}
        <div className={p.onPrev ? "grid grid-cols-2 gap-2" : ""}>
          {p.onPrev && (
            <button
              onClick={p.onPrev}
              disabled={p.prevDisabled}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-50 px-3 py-3 text-sm font-semibold text-navy-900 hover:bg-sky-100 disabled:opacity-60"
            >
              <ArrowLeft size={15} /> Kembali
            </button>
          )}
          <button
            onClick={p.onSave}
            disabled={p.saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-50 px-3 py-3 text-sm font-semibold text-navy-900 hover:bg-sky-100 disabled:opacity-60"
          >
            <Save size={15} /> {p.onPrev ? "Simpan" : "Simpan Draf (Ctrl+S)"}
          </button>
        </div>

        {p.msg && (
          <p
            role={p.msg.type === "error" ? "alert" : "status"}
            className={cn("flex items-start gap-1.5 px-1 pt-1 text-xs", p.msg.type === "error" ? "text-red-600" : "text-lime-800")}
          >
            {p.msg.type === "error" && <TriangleAlert size={13} className="mt-0.5 shrink-0" />}
            {p.msg.text}
          </p>
        )}
      </section>
    </div>
  );
}