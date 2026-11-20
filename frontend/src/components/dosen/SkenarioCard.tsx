import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Archive, CalendarDays, CheckCircle2, ListChecks, MoreVertical, RotateCcw, Trash2, UserRound, Zap } from "lucide-react";
import type { Skenario } from "@/types/skenario";
import { TOTAL_LANGKAH, jenisMeta, tabOf } from "@/lib/skenario";
import { formatShortDate } from "@/lib/utils";

interface Props {
  s: Skenario;
  author: string;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

export function SkenarioCard({ s, author, busy, onArchive, onRestore, onDelete }: Props) {
  const meta = jenisMeta(s.jenis);
  const tab = tabOf(s.status);
  const isDraft = tab === "draf";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <div className="flex items-center gap-1.5">
          {s.memuatDdi && (
            <span
              title="Memuat Interaksi Obat (DDI)"
              aria-label="Memuat Interaksi Obat (DDI)"
              className="grid h-6 w-6 place-items-center rounded-md bg-amber-100 text-amber-700"
            >
              <Zap size={13} />
            </span>
          )}
          <span className="whitespace-nowrap rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-navy-800">
            v{s.versi}{s.beku && " (Beku)"}
          </span>
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] text-muted">{s.kode}</p>
      <h3 className="mt-1 font-serif text-lg font-bold leading-snug">{s.judul}</h3>
      <p className="mt-2 line-clamp-3 min-h-15 text-sm leading-relaxed text-muted">{s.deskripsi}</p>

      <div className="mt-4 space-y-2 rounded-lg bg-cream p-3 text-xs">
        <p className="flex items-center gap-2"><UserRound size={13} className="shrink-0 text-muted" /> <span className="truncate">{author}</span></p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted">
            <CalendarDays size={13} /> {formatShortDate(s.updatedAt)}
          </span>
          {isDraft ? (
            <span className="flex items-center gap-1.5 font-medium text-amber-700">
              <ListChecks size={13} /> Berhenti di Langkah {s.progresLangkah}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-lime-800">
              <CheckCircle2 size={13} /> {TOTAL_LANGKAH} Langkah{s.butir > 0 && ` (${s.butir} Butir)`}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to={`/dosen/kasus/${s.id}`}
          className="flex-1 rounded-lg border border-line py-2.5 text-center text-xs font-semibold text-navy-900 hover:bg-cream"
        >
          Lihat Detail Kasus
        </Link>

        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Aksi lainnya"
            aria-expanded={open}
            disabled={busy}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-cream disabled:opacity-50"
          >
            <MoreVertical size={15} />
          </button>
          
          {open && (
            <div className="absolute bottom-full right-0 z-10 mb-1 w-48 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
              {tab === "arsip" ? (
                <button
                  onClick={() => { setOpen(false); onRestore(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-cream"
                >
                  <RotateCcw size={14} /> Pulihkan ke Draf
                </button>
              ) : (
                <button
                  onClick={() => { setOpen(false); onArchive(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-cream"
                >
                  <Archive size={14} /> Arsipkan
                </button>
              )}
              
              <hr className="my-1 border-line" />
              
              <button
                onClick={() => {
                  setOpen(false);
                  const yakin = window.confirm(`Apakah Anda yakin ingin menghapus skenario "${s.judul}" secara permanen?`);
                  if (yakin) onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Hapus Skenario
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}