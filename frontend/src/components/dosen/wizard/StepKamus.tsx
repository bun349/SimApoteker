import { useRef, useState } from "react";
import { FileUp, Plus, PlusCircle, Trash2 } from "lucide-react";
import {
  MAX_ROWS, duplicateKeys, newRow, parseCsv,
  type KamusRow, type Step5Form,
} from "@/lib/kamus";
import { cn } from "@/lib/utils";

const cell =
  "w-full rounded-lg border border-transparent bg-white px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:border-navy-800 focus:ring-4 focus:ring-navy-900/10";
const GRID = "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_32px]";

interface Props {
  form: Step5Form;
  onChange: (fn: (f: Step5Form) => Step5Form) => void;
}

export function StepKamus({ form, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<string | null>(null);
  const dup = duplicateKeys(form);

  const set = (key: string, p: Partial<KamusRow>) =>
    onChange((f) => ({ rows: f.rows.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  const remove = (key: string) =>
    onChange((f) => {
      const rows = f.rows.filter((r) => r.key !== key);
      return { rows: rows.length ? rows : [newRow()] };
    });

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const incoming = parseCsv(await file.text());
      if (!incoming.length) return setInfo("File kosong atau formatnya tidak dikenali.");

      let added = 0;
      let skipped = 0;
      onChange((f) => {
        const kept = f.rows.filter((r) => r.istilah.trim() || r.padanan.trim());
        const seen = new Set(kept.map((r) => r.istilah.trim().toLowerCase()));
        const next = [...kept];
        added = 0;
        skipped = 0;
        for (const x of incoming) {
          const k = x.istilah.toLowerCase();
          if (seen.has(k) || next.length >= MAX_ROWS) { skipped++; continue; }
          seen.add(k);
          next.push(newRow(x));
          added++;
        }
        return { rows: next.length ? next : [newRow()] };
      });
      // updater berjalan sinkron saat state dihitung; tunda pembacaan hitungan sampai selesai
      setTimeout(() => setInfo(`${added} istilah diimpor${skipped ? `, ${skipped} dilewati (kembar atau melebihi batas)` : ""}.`), 0);
    } catch {
      setInfo("Gagal membaca file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-serif text-sm font-bold uppercase tracking-wide">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-navy-900 text-xs text-white">1</span>
          Daftar Istilah Medis & Padanan Awam
        </h2>
        <button
          type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-cream px-3 py-2 text-xs font-semibold hover:bg-sky-50"
        >
          <FileUp size={14} /> Impor CSV
        </button>
        <input
          ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {info && <p role="status" className="mt-3 text-xs text-muted">{info}</p>}

      <hr className="my-5 border-line" />

      <div className={cn("hidden gap-3 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted sm:grid", GRID)}>
        <span>Istilah Medis</span>
        <span>Padanan Awam yang Diterima</span>
        <span className="sr-only">Aksi</span>
      </div>

      <div className="space-y-2">
      {form.rows.map((r) => {
        const isDup = dup.has(r.key);
        return (
          <div key={r.key} className={cn("grid items-center gap-3 rounded-xl bg-sky-50 p-3", GRID)}>
            <input
              aria-label="Istilah medis" value={r.istilah} maxLength={60}
              onChange={(e) => set(r.key, { istilah: e.target.value })}
              placeholder="hematoma" aria-invalid={isDup}
              className={cn(cell, "font-medium", isDup && "border-red-400")}
            />
            <input
              aria-label="Padanan awam yang diterima" value={r.padanan} maxLength={120}
              onChange={(e) => set(r.key, { padanan: e.target.value })}
              placeholder="memar; kebiruan"
              className={cell}
            />
            <button
              type="button" onClick={() => remove(r.key)} aria-label={`Hapus ${r.istilah || "baris"}`}
              className="grid h-8 w-8 place-items-center justify-self-end text-red-500 hover:text-red-700"
            >
              <Trash2 size={16} />
            </button>
            {isDup && (
              <p className="text-xs text-red-600 sm:col-span-3">Istilah ini muncul lebih dari sekali.</p>
            )}
          </div>
        );
      })}
      </div>

      <button
        type="button"
        disabled={form.rows.length >= MAX_ROWS}
        onClick={() => onChange((f) => ({ rows: [...f.rows, newRow()] }))}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-3.5 text-sm font-semibold text-navy-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusCircle size={17} /> Tambah Istilah Baru
      </button>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
        <Plus size={12} className="mt-0.5 shrink-0 rotate-45" />
        Beberapa padanan awam dipisah titik koma.CSV: kolom istilah, padanan, butir.
      </p>
    </section>
  );
}