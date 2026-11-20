import { CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  JENIS_CUE, MAX_ROWS, MODE_IK, SIFAT_PROBE, SYARAT_PAMIT, newCue, newIk, newProbe,
  type CueRow, type IkRow, type ProbeRow, type Step4Form,
} from "@/lib/pemicu";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-transparent bg-white px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:border-navy-800 focus:ring-4 focus:ring-navy-900/10";
const sub = "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted";

function Block({
  n, title, onAdd, canAdd, children,
}: { n: number; title: string; onAdd?: () => void; canAdd?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-serif text-sm font-bold uppercase tracking-wide">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-navy-900 text-xs text-white">{n}</span>
          {title}
        </h2>
        {onAdd && (
          <button
            type="button" onClick={onAdd} disabled={!canAdd}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} /> Tambah Baris
          </button>
        )}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Card({ label, onRemove, children }: { label: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-sky-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold text-navy-800">{label}</span>
        <button type="button" onClick={onRemove} aria-label={`Hapus ${label}`} className="text-muted hover:text-red-600">
          <Trash2 size={15} />
        </button>
      </div>
      {children}
    </div>
  );
}

const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
    {(options.includes(value) ? options : [value, ...options]).map((o) => <option key={o}>{o}</option>)}
  </select>
);

const num = (p: string, i: number) => `${p}-${String(i + 1).padStart(2, "0")}`;

interface Props {
  form: Step4Form;
  onChange: (fn: (f: Step4Form) => Step4Form) => void;
}

export function StepPemicu({ form, onChange }: Props) {
  const setCue = (key: string, p: Partial<CueRow>) =>
    onChange((f) => ({ ...f, cues: f.cues.map((r) => (r.key === key ? { ...r, ...p } : r)) }));
  const setProbe = (key: string, p: Partial<ProbeRow>) =>
    onChange((f) => ({ ...f, probes: f.probes.map((r) => (r.key === key ? { ...r, ...p } : r)) }));
  const setIk = (key: string, p: Partial<IkRow>) =>
    onChange((f) => ({ ...f, iks: f.iks.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  return (
    <div className="space-y-5">
      <Block n={1} title="Isyarat Emosi (Cue) Pasien"
        canAdd={form.cues.length < MAX_ROWS}
        onAdd={() => onChange((f) => ({ ...f, cues: [...f.cues, newCue()] }))}>
        {form.cues.map((c, i) => (
          <Card key={c.key} label={num("CUE", i)} onRemove={() => onChange((f) => ({ ...f, cues: f.cues.filter((r) => r.key !== c.key) }))}>
            <label className={sub}>Kalimat Cue</label>
            <textarea rows={2} maxLength={200} value={c.kalimat} onChange={(e) => setCue(c.key, { kalimat: e.target.value })}
              placeholder="Contoh: Saya takut lambung saya makin perih kalau minum obat nyeri terus, Mbak."
              className={cn(field, "resize-none")} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><label className={sub}>Jenis</label><Select value={c.jenis} onChange={(v) => setCue(c.key, { jenis: v })} options={JENIS_CUE} /></div>
              <div><label className={sub}>Kapan Muncul</label>
                <input value={c.kapan} maxLength={80} onChange={(e) => setCue(c.key, { kapan: e.target.value })} placeholder="Setelah giliran ke-3" className={field} /></div>
            </div>
          </Card>
        ))}
      </Block>

      <Block n={2} title="Probe Pasien Bingung"
        canAdd={form.probes.length < MAX_ROWS}
        onAdd={() => onChange((f) => ({ ...f, probes: [...f.probes, newProbe()] }))}>
        {form.probes.map((p, i) => (
          <Card key={p.key} label={num("PRB", i)} onRemove={() => onChange((f) => ({ ...f, probes: f.probes.filter((r) => r.key !== p.key) }))}>
            <label className={sub}>Kalimat Probe</label>
            <textarea rows={2} maxLength={200} value={p.kalimat} onChange={(e) => setProbe(p.key, { kalimat: e.target.value })}
              placeholder="Contoh: Maaf Mbak apoteker, tadi penjelasannya agak cepat, boleh tolong diulang aturan minumnya?"
              className={cn(field, "resize-none")} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><label className={sub}>Sifat</label><Select value={p.sifat} onChange={(v) => setProbe(p.key, { sifat: v })} options={SIFAT_PROBE} /></div>
              <div><label className={sub}>Kapan Muncul</label>
                <input value={p.kapan} maxLength={80} onChange={(e) => setProbe(p.key, { kapan: e.target.value })} placeholder="Setelah penjelasan aturan pakai" className={field} /></div>
            </div>
          </Card>
        ))}
      </Block>

      <Block n={3} title="Informasi Kunci (Key Information)"
        canAdd={form.iks.length < MAX_ROWS}
        onAdd={() => onChange((f) => ({ ...f, iks: [...f.iks, newIk()] }))}>
        {form.iks.map((k, i) => (
          <Card key={k.key} label={num("IK", i)} onRemove={() => onChange((f) => ({ ...f, iks: f.iks.filter((r) => r.key !== k.key) }))}>
            <label className={sub}>Hal yang Harus Ditangkap</label>
            <textarea rows={2} maxLength={200} value={k.hal} onChange={(e) => setIk(k.key, { hal: e.target.value })}
              placeholder="Contoh: Riwayat rutin mengonsumsi warfarin 2 mg setiap malam untuk jantung."
              className={cn(field, "resize-none")} />
            <div className="mt-3">
              <label className={sub}>Mode Penyampaian</label>
              <Select value={k.mode} onChange={(v) => setIk(k.key, { mode: v })} options={MODE_IK} />
            </div>
          </Card>
        ))}
      </Block>

      <Block n={4} title="Urutan Kronologis & Akhir Sesi">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl bg-sky-50 p-4 text-sm">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-navy-800" />
            <div>
              <p className="font-semibold text-navy-900">Urutan Pemicu</p>
              <p className="mt-1 text-muted">
                Sistem AI akan memunculkan pemicu secara dinamis berdasarkan alur pertanyaan mahasiswa.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-sky-50 p-4 text-sm">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-lime-700" />
            <div>
              <p className="font-semibold text-navy-900">Kapan Pasien Pamit?</p>
              <p className="mt-1 text-muted">{SYARAT_PAMIT}</p>
              <p className="mt-2 text-xs text-muted">Aturan baku sistem, tidak perlu diisi.</p>
            </div>
          </div>
        </div>
      </Block>
    </div>
  );
}