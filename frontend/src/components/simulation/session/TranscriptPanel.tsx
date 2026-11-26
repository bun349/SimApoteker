import { useEffect, useRef } from "react";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Msg {
  id: string;
  from: "pasien" | "anda";
  name: string;
  time: string;
  text: string;
}

interface Props {
  messages: Msg[];
  fontSize: number;
  onFontSize: (delta: number) => void;
  typing?: boolean;
}

export function TranscriptPanel({ messages, fontSize, onFontSize, typing = false }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  return (
    <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-line bg-white lg:h-full lg:min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MessagesSquare size={16} className="text-muted" /> Transkrip Percakapan
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted">
            {messages.length}
          </span>
        </h2>
        <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white text-xs font-medium text-muted">
          <button
            type="button"
            onClick={() => onFontSize(-1)}
            aria-label="Perkecil teks"
            className="px-2.5 py-1 transition hover:bg-slate-50 hover:text-ink"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => onFontSize(1)}
            aria-label="Perbesar teks"
            className="border-l border-line px-2.5 py-1 transition hover:bg-slate-50 hover:text-ink"
          >
            A+
          </button>
        </div>
      </div>

      <div
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        style={{ fontSize }}
        aria-live="polite"
      >
        {messages.map((m) => {
          const me = m.from === "anda";
          return (
            <div key={m.id} className={cn("flex flex-col", me ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "mb-1 flex items-center gap-2 text-xs text-muted",
                  me && "flex-row-reverse",
                )}
              >
                <span className="font-medium text-ink">{m.name}</span>
                <span className="tabular-nums">{m.time}</span>
              </div>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 leading-relaxed",
                  me
                    ? "bg-navy-900 text-white"
                    : "border border-line bg-slate-50 text-ink",
                )}
              >
                {m.text}
              </p>
            </div>
          );
        })}

        {typing && (
          <p className="flex items-center gap-2.5 pt-1 text-xs text-muted">
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </span>
            Pasien sedang menanggapi...
          </p>
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
