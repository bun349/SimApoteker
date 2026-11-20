import { useState } from "react";
import { ChevronDown, Info, PlusCircle, Trash2, TriangleAlert } from "lucide-react";
import {
  BOBOT, KATEGORI, MAX_ROWS, dupIds, isBlank, newRow, normalizeId, rowComplete, splitList,
  type RubrikRow, type Step6Form,
} from "@/lib/rubrik";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border border-transparent px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:bg-white focus:ring-4 focus:ring-navy-900/10";
const tone = {
  default: "bg-white focus:border-navy-800",
  danger: "bg-red-50 focus:border-red-500",
};
const lbl = "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted";

const bobotBadge: Record<number, string> = {
  1: "bg-sky-100 text-navy-800",
  2: "bg-gold-100 text-amber-800",
  3: "bg-red-100 text-red-700",
};

function Help({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted">
      <Info size={11} className="mt-0.5 shrink-0" /> {children}
    </p>
  );
}

interface Props {
  form: Step6Form;
  onChange: (fn: (f: Step6Form) => Step6Form) => void;
}

export function StepRubrik({ form, onChange }: Props) {
  // butir yang sudah lengkap terlipat saat halaman dibuka; butir baru terbuka
  const [closed, setClosed] = useState<Set<string>>(() => {
    const dup = dupIds(form);
    return new Set(form.rows.filter((r) => !isBlank(r) && rowComplete(r, dup)).map((r) => r.key));
  });
  const dup = dupIds(form);

  const toggle = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  const set = (key: string, p: Partial<RubrikRow>) =>
    onChange((f) => ({ rows: f.rows.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  const remove = (r: RubrikRow) => {
    if (!isBlank(r) && !window.confirm(`Hapus butir ${r.id}? Tindakan ini tidak dapat dibatalkan setelah disimpan.`)) return;
    onChange((f) => {
      const rows = f.rows.filter((x) => x.key !== r.key);
      return { rows: rows.length ? rows : [newRow()] };
    });
  };

  const add = () => onChange((f) => ({ rows: [...f.rows, newRow(f.rows)] }));
  const canAdd = form.rows.length < MAX_ROWS;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-serif text-sm font-bold uppercase tracking-wide">Daftar Butir Penilaian Klinis</h2>
        <button
          type="button" onClick={add} disabled={!canAdd}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gold-400 px-4 py-2.5 text-xs font-bold text-navy-900 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle size={15} /> Tambah Butir Rubrik
        </button>
      </section>

      {form.rows.map((r) => {
        const isClosed = closed.has(r.key);
        const complete = rowComplete(r, dup);
        const isDup = dup.has(r.key);
        const badId = r.id !== "" && !/^K-\d{2}$/.test(r.id);
        const komponen = splitList(r.komponen);

        return (
          <article key={r.key} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <button
              type="button" onClick={() => toggle(r.key)} aria-expanded={!isClosed}
              className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-cream/60"
            >
              <span className="rounded-md bg-navy-900 px-2 py-1 font-mono text-xs font-bold text-white">{r.id || "K-??"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-base font-semibold">
                  {r.butir.trim() || <span className="text-muted">Butir baru (belum diisi)</span>}
                </span>
                {isClosed && komponen.length > 0 && (
                  <span className="mt-0.5 block truncate text-xs text-muted">{komponen.join(" • ")}</span>
                )}
              </span>
              {!complete && !isBlank(r) && (
                <span className="hidden items-center gap-1 text-[11px] font-semibold text-amber-700 sm:inline-flex">
                  <TriangleAlert size={12} /> Belum lengkap
                </span>
              )}
              {r.bobot > 0 && (
                <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold", bobotBadge[r.bobot])}>
                  Bobot: {BOBOT.find((b) => b.value === r.bobot)?.label}
                </span>
              )}
              <ChevronDown size={18} className={cn("shrink-0 text-muted transition", !isClosed && "rotate-180")} />
            </button>

            {!isClosed && (
              <div className="space-y-4 border-t border-line bg-sky-50 p-5">
                <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <label className={lbl}>ID Butir</label>
                    <input
                      value={r.id} onChange={(e) => set(r.key, { id: normalizeId(e.target.value) })}
                      placeholder="K-01" aria-invalid={isDup || badId}
                      className={cn(base, tone.default, "text-center font-mono", (isDup || badId) && "border-red-400")}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Kategori Kompetensi</label>
                    <select
                      value={(KATEGORI as readonly string[]).includes(r.kategori) ? r.kategori : ""}
                      onChange={(e) => set(r.key, { kategori: e.target.value })}
                      className={cn(base, tone.default)}
                    >
                      <option value="" disabled>Pilih kategori...</option>
                      {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Tingkat Bobot</label>
                    <select
                      value={r.bobot ? String(r.bobot) : ""}
                      onChange={(e) => set(r.key, { bobot: Number(e.target.value) })}
                      className={cn(base, tone.default)}
                    >
                      <option value="" disabled>Pilih bobot...</option>
                      {BOBOT.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </div>
                </div>
                {(isDup || badId) && (
                  <p className="-mt-2 text-xs text-red-600">
                    {isDup ? "ID butir ini dipakai lebih dari sekali." : "Format ID: K- diikuti dua angka, contoh K-07."}
                  </p>
                )}

                <div>
                  <label className={lbl}>Butir yang Dinilai</label>
                  <textarea
                    rows={2} maxLength={300} value={r.butir}
                    onChange={(e) => set(r.key, { butir: e.target.value })}
                    placeholder="Contoh: Menanyakan riwayat konsumsi obat rutin, suplemen, dan obat bebas yang sedang dikonsumsi pasien"
                    className={cn(base, tone.default, "resize-none")}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={lbl}>Komponen Wajib (pisahkan dengan titik koma ';')</label>
                    <textarea
                      rows={4} maxLength={500} value={r.komponen}
                      onChange={(e) => set(r.key, { komponen: e.target.value })}
                      placeholder="obat rutin apa yang diminum; nama obat rutin; obat resep sebelumnya"
                      className={cn(base, tone.default, "resize-none")}
                    />
                    <Help>Tulis konsep atau frasa, bukan kata persis. AI menilai kesesuaian makna.</Help>
                  </div>
                  <div>
                    <label className={lbl}>Alternatif Diterima (opsional)</label>
                    <textarea
                      rows={4} maxLength={500} value={r.alternatif}
                      onChange={(e) => set(r.key, { alternatif: e.target.value })}
                      placeholder="obat jantung yang biasa diminum; tablet dari dokter spesialis"
                      className={cn(base, tone.default, "resize-none")}
                    />
                    <Help>Padanan ucapan lain yang tetap dianggap benar.</Help>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={cn(lbl, "text-red-700")}>Pernyataan Keliru / Tidak Aman (opsional)</label>
                    <textarea
                      rows={3} maxLength={500} value={r.keliru}
                      onChange={(e) => set(r.key, { keliru: e.target.value })}
                      placeholder="Langsung merekomendasikan NSAID tanpa menanyakan obat rutin"
                      className={cn(base, tone.danger, "resize-none")}
                    />
                    <Help>Pisahkan dengan titik koma untuk beberapa pernyataan.</Help>
                  </div>
                  <div>
                    <label className={lbl}>Rujukan Klinis / Literatur (opsional)</label>
                    <textarea
                      rows={3} maxLength={300} value={r.rujukan}
                      onChange={(e) => set(r.key, { rujukan: e.target.value.replace(/\n/g, " ") })}
                      placeholder="Stockley's Drug Interactions; PIONAS"
                      className={cn(base, tone.default, "resize-none")}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button" onClick={() => remove(r)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={14} /> Hapus Butir
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}

      <button
        type="button" onClick={add} disabled={!canAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-white py-4 text-sm font-semibold text-navy-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusCircle size={17} /> Tambah Butir Rubrik Baru
      </button>
    </div>
  );
}