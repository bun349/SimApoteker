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
    <section className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm lg:h-full lg:min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-sky-50/60 px-5 py-4">
        <h2 className="flex items-center gap-2 font-serif text-base font-bold">
          <MessagesSquare size={18} /> Transkrip Percakapan
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 font-sans text-[11px] font-semibold text-navy-800">
            {messages.length} Pesan
          </span>
        </h2>
        <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white text-xs font-bold">
          <button
            type="button"
            onClick={() => onFontSize(-1)}
            aria-label="Perkecil teks"
            className="px-3 py-1.5 hover:bg-cream"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => onFontSize(1)}
            aria-label="Perbesar teks"
            className="border-l border-line px-3 py-1.5 hover:bg-cream"
          >
            A+
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5" style={{ fontSize }} aria-live="polite">
        {messages.map((m) => {
          const me = m.from === "anda";
          return (
            <div key={m.id} className={cn("flex flex-col", me ? "items-end" : "items-start")}>
              <div className={cn("mb-1 flex items-center gap-3 text-[11px] font-semibold", me && "flex-row-reverse")}>
                <span className={me ? "text-amber-700" : "text-navy-900"}>{m.name}</span>
                <span className="font-mono text-muted">{m.time}</span>
              </div>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl border px-5 py-3.5 font-serif leading-relaxed",
                  me ? "border-gold-400/50 bg-gold-100" : "border-line bg-white",
                )}
              >
                {m.text}
              </p>
            </div>
          );
        })}

        {typing && (
          <p className="flex items-center gap-3 pt-1 text-xs italic text-muted">
            <span className="flex gap-1" aria-hidden>
              <span className="h-2 w-2 animate-bounce rounded-full bg-navy-800/60 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-navy-800/60 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-navy-800/60" />
            </span>
            Pasien sedang menanggapi...
          </p>
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}