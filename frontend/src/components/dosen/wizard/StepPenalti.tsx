import { useState } from "react";
import { ChevronDown, Info, PlusCircle, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import {
  GLOBAL, KATEGORI, KOREKSI_MAKS_GILIRAN, MAX_ROWS, dupIds, isBlank, maxPenalty, newRow,
  normalizeId, rowComplete, type PenaltiRow, type Step7Form,
} from "@/lib/penalti";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border border-transparent px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:bg-white focus:ring-4 focus:ring-navy-900/10 disabled:cursor-not-allowed disabled:opacity-60";
const field = "bg-white focus:border-navy-800";
const lbl = "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted";

interface Props {
  form: Step7Form;
  onChange: (fn: (f: Step7Form) => Step7Form) => void;
}

export function StepPenalti({ form, onChange }: Props) {
  const [closed, setClosed] = useState<Set<string>>(() => {
    const dup = dupIds(form);
    return new Set(form.rows.filter((r) => !isBlank(r) && rowComplete(r, dup)).map((r) => r.key));
  });
  const dup = dupIds(form);
  const used = form.rows.filter((r) => !isBlank(r));

  const toggle = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  const set = (key: string, p: Partial<PenaltiRow>) =>
    onChange((f) => ({ rows: f.rows.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  const setGagal = (r: PenaltiRow, gagal: boolean) =>
    set(r.key, {
      gagal,
      kategori: gagal ? GLOBAL : "",
      koreksi: gagal ? false : r.koreksi,
    });

  const remove = (r: PenaltiRow) => {
    if (!isBlank(r) && !window.confirm(`Hapus penalti ${r.id}?`)) return;
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
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-red-700">
            <ShieldAlert size={14} /> Total Butir: {used.length} Terdefinisi
          </span>
          <span className="font-semibold text-red-700">Penalti Maksimal: -{maxPenalty(form)}%</span>
        </p>
        <button
          type="button" onClick={add} disabled={!canAdd}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gold-400 px-4 py-2.5 text-xs font-bold text-navy-900 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle size={15} /> Tambah Kesalahan Kritis
        </button>
      </section>

      {form.rows.map((r) => {
        const isClosed = closed.has(r.key);
        const complete = rowComplete(r, dup);
        const isDup = dup.has(r.key);
        const badId = r.id !== "" && !/^KK-\d{2}$/.test(r.id);
        const penaltyText = r.gagal ? "-100% (Gagal)" : r.poin ? `-${r.poin} Poin` : "Belum ditetapkan";

        return (
          <article key={r.key} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <button
              type="button" onClick={() => toggle(r.key)} aria-expanded={!isClosed}
              className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-cream/60"
            >
              <span className="rounded-md bg-navy-900 px-2 py-1 font-mono text-xs font-bold text-white">{r.id || "KK-??"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-base font-semibold">
                  {r.judul.trim() || <span className="text-muted">Kesalahan kritis baru (belum diisi)</span>}
                </span>
                {r.kategori && <span className="mt-0.5 block truncate text-xs text-muted">{r.kategori}</span>}
              </span>
              {!complete && !isBlank(r) && (
                <span className="hidden items-center gap-1 text-[11px] font-semibold text-amber-700 sm:inline-flex">
                  <TriangleAlert size={12} /> Belum lengkap
                </span>
              )}
              <span
                className={cn(
                  "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold",
                  r.gagal ? "bg-red-700 text-white" : "bg-red-100 text-red-700",
                )}
              >
                {penaltyText}
              </span>
              <ChevronDown size={18} className={cn("shrink-0 text-muted transition", !isClosed && "rotate-180")} />
            </button>

            {!isClosed && (
              <div className="space-y-4 border-t border-line bg-sky-50 p-5">
                <div>
                  <label className={lbl}>Judul Kesalahan Kritis</label>
                  <input
                    value={r.judul} maxLength={120}
                    onChange={(e) => set(r.key, { judul: e.target.value })}
                    placeholder="Contoh: Merekomendasikan NSAID (ibuprofen) tanpa skrining interaksi warfarin"
                    className={cn(base, field)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                  <div>
                    <label className={lbl}>ID Penalti</label>
                    <input
                      value={r.id} onChange={(e) => set(r.key, { id: normalizeId(e.target.value) })}
                      placeholder="KK-01" aria-invalid={isDup || badId}
                      className={cn(base, field, "text-center font-mono", (isDup || badId) && "border-red-400")}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Kategori Penalti</label>
                    <select
                      disabled={r.gagal}
                      value={r.gagal ? GLOBAL : (KATEGORI as readonly string[]).includes(r.kategori) ? r.kategori : ""}
                      onChange={(e) => set(r.key, { kategori: e.target.value })}
                      className={cn(base, field)}
                    >
                      {r.gagal ? (
                        <option value={GLOBAL}>{GLOBAL}</option>
                      ) : (
                        <>
                          <option value="" disabled>Pilih kategori...</option>
                          {KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
                        </>
                      )}
                    </select>
                  </div>
                </div>
                {(isDup || badId) && (
                  <p className="-mt-2 text-xs text-red-600">
                    {isDup ? "ID penalti ini dipakai lebih dari sekali." : "Format ID: KK- diikuti dua angka, contoh KK-01."}
                  </p>
                )}

                {/* Besar penalti */}
                <div>
                <label className={cn(lbl, "mb-0")}>Besar Penalti</label>

                {/* Gagal total + teks bantuan */}
                <div
                    className={cn(
                    "mt-2 rounded-lg border p-3 transition",
                    r.gagal ? "border-red-300 bg-red-50" : "border-transparent bg-white",
                    )}
                >
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-red-700">
                    <input
                        type="checkbox" checked={r.gagal} onChange={(e) => setGagal(r, e.target.checked)}
                        className="h-4 w-4 accent-red-700"
                    />
                    Gagal total (-100%)
                    </label>
                    <p className="mt-1.5 flex items-start gap-1.5 pl-6 text-[11px] text-muted">
                    <TriangleAlert size={11} className="mt-0.5 shrink-0 text-red-600" />
                    Mencentang ini akan membuat mahasiswa otomatis gagal (skor 0) di keseluruhan sesi skenario ini (Fatal Error).
                    </p>
                </div>

                {/* Slider + input poin */}
                <div className="mt-3 flex items-center gap-3">
                    <input
                    type="range" min={0} max={100} step={5} disabled={r.gagal}
                    value={r.gagal ? 100 : r.poin}
                    onChange={(e) => set(r.key, { poin: Number(e.target.value) })}
                    aria-label="Besar penalti dalam poin"
                    className="h-2 flex-1 cursor-pointer accent-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="relative w-28">
                    <input
                        inputMode="numeric" disabled={r.gagal}
                        value={r.gagal ? "100" : r.poin ? String(r.poin) : ""}
                        onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, "").slice(0, 3));
                        set(r.key, { poin: Math.min(100, n) });
                        }}
                        placeholder="0"
                        className={cn(base, field, "pr-12 text-right font-semibold text-red-700")}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">
                        {r.gagal ? "%" : "poin"}
                    </span>
                    </div>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {r.gagal
                    ? "Tidak berlaku untuk gagal total: seluruh nilai sesi menjadi 0."
                    : "Pemotongan poin angka hanya akan mengurangi nilai maksimal dari kategori penalti yang dipilih (misal: hanya menghabiskan nilai Prosedur)."}
                </p>
                </div>

                <div>
                  <label className={lbl}>Deskripsi Perilaku</label>
                  <textarea
                    rows={3} maxLength={500} value={r.deskripsi}
                    onChange={(e) => set(r.key, { deskripsi: e.target.value })}
                    placeholder="Jelaskan perilaku mahasiswa yang dianggap kesalahan kritis."
                    className={cn(base, field, "resize-none")}
                  />
                </div>

                <div>
                  <label className={cn(lbl, "text-red-700")}>Kriteria Eksekusi Penalti (Kapan penalti ini dijatuhkan?)</label>
                  <textarea
                    rows={3} maxLength={500} value={r.kriteria}
                    onChange={(e) => set(r.key, { kriteria: e.target.value })}
                    placeholder="Contoh: NSAID disebutkan sebagai solusi terapi sebelum riwayat obat rutin digali, atau mahasiswa menyatakan NSAID aman diminum bersama warfarin."
                    className={cn(base, "resize-none bg-red-50 focus:border-red-500")}
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    Cukup tulis kapan penalti dijatuhkan. Kondisi sebaliknya tidak perlu ditulis.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button" role="switch" aria-checked={r.koreksi} disabled={r.gagal}
                      onClick={() => set(r.key, { koreksi: !r.koreksi })}
                      className={cn(
                        "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
                        r.koreksi ? "bg-lime-700" : "bg-gray-300",
                      )}
                    >
                      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", r.koreksi ? "left-[22px]" : "left-0.5")} />
                    </button>
                    <div className="text-xs">
                      <p className="font-semibold">Bisa Dikoreksi Sendiri{!r.koreksi && " (Non-aktif)"}</p>
                      <p className="text-muted">
                        {r.gagal
                          ? "Kesalahan fatal tidak dapat dikoreksi."
                          : `Mahasiswa boleh mengoreksi sebelum sesi berakhir (koreksi dalam ≤ ${KOREKSI_MAKS_GILIRAN} giliran menghapus penalti).`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button" onClick={() => remove(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={14} /> Hapus Butir Penalti
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
        <PlusCircle size={17} /> Tambah Butir Kesalahan Kritis Baru
      </button>
    </div>
  );
}