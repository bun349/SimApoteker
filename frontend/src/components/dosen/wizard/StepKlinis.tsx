import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { FileText, Info, X, Plus, AlertTriangle } from "lucide-react";
import { applyInteraksiChange, type KConfig, type KField, type KSection, type Step3Form } from "@/lib/klinis";
import { cn } from "@/lib/utils";

export interface KlinisInteraksiPatch {
  obatLainSuplemen?: string[];
  interaksiDitanam?: string;
  memuatDdi?: boolean;
}

const base =
  "w-full rounded-lg border border-transparent px-4 py-3 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:bg-white focus:ring-4 focus:ring-navy-900/10";
const tones = {
  default: "bg-sky-50 focus:border-navy-800",
  warn: "bg-amber-50 focus:border-amber-600",
  danger: "bg-red-50 focus:border-red-500",
};

function Help({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
      <Info size={12} className="mt-0.5 shrink-0" /> {children}
    </p>
  );
}

function Field({
  f,
  id,
  value,
  onChange,
}: {
  f: KField;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = cn(base, tones[f.tone ?? "default"]);
  return (
    <div className={f.full ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className={cn("mb-2 block text-sm font-semibold", f.tone === "danger" && "text-red-700")}
      >
        {f.label} {!f.optional && <span className="text-red-600">*</span>}
      </label>
      {f.kind === "input" ? (
        <input
          id={id}
          value={value}
          maxLength={200}
          placeholder={f.placeholder}
          className={cls}
          onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        />
      ) : (
        <textarea
          id={id}
          rows={f.rows ?? 3}
          value={value}
          maxLength={600}
          placeholder={f.placeholder}
          className={cn(cls, "resize-none leading-relaxed")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {f.help && <Help>{f.help}</Help>}
    </div>
  );
}

function ChipInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className={cn(base, tones.default, "flex flex-wrap items-center gap-2 py-2.5")}>
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold ring-1 ring-line"
        >
          {v}
          <button
            type="button"
            aria-label={`Hapus ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="text-muted hover:text-red-600"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-48 flex-1 bg-transparent outline-none placeholder:text-muted/60"
      />
    </div>
  );
}

function RubrikHelpPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
      >
        <Info size={13} />
        Panduan Pengecualian
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-ink">Panduan Mengecualikan Butir</h3>
              <button
                type="button"
                aria-label="Tutup panduan"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-cream hover:text-red-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm leading-relaxed text-muted">
              <p>
                Kolom ini hanya diisi dengan butir rubrik yang secara <b>default wajib</b> di kategori skenario ini,
                namun <b>tidak relevan/tidak diperlukan</b> untuk kasus spesifik pasien Anda.
              </p>
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Sistem VIKIE sudah memfilter butir lintas-kategori secara otomatis (misal: 3PQ tidak akan ditagih di
                Swamedikasi). Anda <b>tidak perlu</b> mengecualikan hal yang sudah pasti tidak dinilai.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <h4 className="font-bold text-ink">💊 Swamedikasi</h4>
                  <ul className="ml-4 list-disc space-y-1 text-xs">
                    <li>
                      <b>Aturan Pakai &amp; BUD:</b> Jika skenario memuat <i>Red Flags</i> fatal sehingga keputusan
                      akhirnya adalah rujuk ke dokter (tidak ada obat yang diserahkan).
                    </li>
                    <li>
                      <b>Edukasi Sediaan Khusus:</b> Jika rekomendasi hanya berupa obat minum biasa.
                    </li>
                    <li>
                      <b>Deteksi DDI:</b> Jika pasien diset tidak meminum obat/suplemen penyerta apa pun.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-ink">📄 Resep Akut</h4>
                  <ul className="ml-4 list-disc space-y-1 text-xs">
                    <li>
                      <b>Instruksi Khusus Antibiotik:</b> Jika resep dokter hanya berisi pereda nyeri/simtomatik (bukan
                      antibiotik).
                    </li>
                    <li>
                      <b>Edukasi Alat Kesehatan:</b> Jika peresepan hanya obat oral biasa (bukan tetes telinga/ovula).
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-ink">🔄 Resep Kronis</h4>
                  <ul className="ml-4 list-disc space-y-1 text-xs">
                    <li>
                      <b>Edukasi Alat Khusus:</b> Jika terapi pemeliharaan murni obat tablet (tanpa pen
                      insulin/inhaler).
                    </li>
                    <li>
                      <b>Tanda Bahaya (Red Flags):</b> Jika kunjungan pasien adalah <i>refill</i> rutin tanpa perburukan
                      kondisi.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-navy-900 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-800"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Block({ n, s, children }: { n: number; s: KSection; children: React.ReactNode }) {
  const isRxHeader = s.id === "kop_resep";

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="flex items-start gap-3 font-serif text-base font-bold leading-snug">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sky-100 text-sm text-navy-800">
            {n}
          </span>
          <span className="pt-0.5">{s.title}</span>
        </h2>
        {isRxHeader && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-navy-800 ring-1 ring-sky-200">
            <FileText size={12} />
            Tampil di Lembar Resep Brief
          </span>
        )}
      </div>
      {s.desc && <p className="mt-2 pl-10 text-xs text-muted">{s.desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

interface Props {
  cfg: KConfig;
  form: Step3Form;
  onValue: (key: string, v: string) => void;
  onButir: (v: string[]) => void;
  obatLainSuplemen?: string[];
  interaksiDitanam?: string;
  memuatDdi?: boolean;
  onInteraksiChange?: (patch: KlinisInteraksiPatch) => void;
}

export function StepKlinis({
  cfg,
  form,
  onValue,
  onButir,
  obatLainSuplemen = [],
  interaksiDitanam = "",
  memuatDdi = false,
  onInteraksiChange,
}: Props) {
  const uid = useId();
  return (
    <div className="space-y-5">
      {cfg.sections.map((s, i) => (
        <Block key={s.id} n={i + 1} s={s}>
          <div className={s.cols === 2 ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
            {s.fields.map((f) => (
              <Field
                key={f.key}
                f={f}
                id={`${uid}-${f.key}`}
                value={form.values[f.key] ?? ""}
                onChange={(v) => onValue(f.key, v)}
              />
            ))}
          </div>
          {s.chips && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-line">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`${uid}-butir`} className="block text-sm font-bold text-ink">
                  {s.chips.label}
                </label>
                <RubrikHelpPopup />
              </div>
              <ChipInput id={`${uid}-butir`} value={form.butir} onChange={onButir} placeholder={s.chips.placeholder} />
              {s.chips.help && <Help>{s.chips.help}</Help>}
            </div>
          )}
        </Block>
      ))}

      {onInteraksiChange && (
        <KlinisInteraksiSection
          obatLainSuplemen={obatLainSuplemen}
          interaksiDitanam={interaksiDitanam}
          memuatDdi={memuatDdi}
          onChange={onInteraksiChange}
        />
      )}
    </div>
  );
}

interface KlinisInteraksiSectionProps {
  obatLainSuplemen: string[];
  interaksiDitanam: string;
  memuatDdi: boolean;
  onChange: (patch: KlinisInteraksiPatch) => void;
}

export function KlinisInteraksiSection({
  obatLainSuplemen,
  interaksiDitanam,
  memuatDdi,
  onChange,
}: KlinisInteraksiSectionProps) {
  const [obatInput, setObatInput] = useState("");

  const addObat = () => {
    const clean = obatInput.trim();
    if (!clean) return;
    if (!obatLainSuplemen.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      onChange({ obatLainSuplemen: [...obatLainSuplemen, clean] });
    }
    setObatInput("");
  };

  const removeObat = (idx: number) => {
    onChange({
      obatLainSuplemen: obatLainSuplemen.filter((_, i) => i !== idx),
    });
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addObat();
    }
  };

  const handleInteraksiChange = (val: string) => {
    const next = applyInteraksiChange(val, memuatDdi);
    onChange({
      interaksiDitanam: next.interaksiDitanam,
      memuatDdi: next.memuatDdi,
    });
  };

  const hasInteraksiText = interaksiDitanam.trim().length > 0;

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-base font-bold uppercase tracking-wide">
          Obat Penyerta &amp; Interaksi Obat (DDI)
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            memuatDdi ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-muted",
          )}
        >
          <AlertTriangle size={13} />
          {memuatDdi ? "Memuat DDI: Aktif (True)" : "Memuat DDI: Tidak Aktif"}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="obat-lain-suplemen" className="mb-2 block text-sm font-semibold">
            Obat / Suplemen Lain yang Sedang Dikonsumsi
          </label>
          <div className="flex gap-2">
            <input
              id="obat-lain-suplemen"
              type="text"
              value={obatInput}
              onChange={(e) => setObatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contoh: Paracetamol sirup, Suplemen zat besi, atau Antasida..."
              className="w-full rounded-lg border border-transparent bg-sky-50 px-4 py-3 text-sm outline-none transition placeholder:text-muted/60 focus:border-navy-800 focus:bg-white focus:ring-4 focus:ring-navy-900/10"
            />
            <button
              type="button"
              onClick={addObat}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Plus size={16} /> Tambah
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Tekan <b>Enter</b> atau klik <b>Tambah</b> untuk menambahkan item obat/suplemen penyerta.
          </p>

          {obatLainSuplemen.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {obatLainSuplemen.map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-100 px-2.5 py-1 text-xs font-medium text-navy-900"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeObat(idx)}
                    aria-label={`Hapus ${item}`}
                    className="rounded p-0.5 hover:bg-sky-200/80"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="interaksi-ditanam" className="mb-2 block text-sm font-semibold">
            Interaksi Obat yang Ditanam (`interaksi_ditanam`)
          </label>
          <textarea
            id="interaksi-ditanam"
            rows={3}
            value={interaksiDitanam}
            onChange={(e) => handleInteraksiChange(e.target.value)}
            placeholder="Contoh: Adsorben/Attapulgit menurunkan absorpsi obat oral lain jika diberikan bersamaan tanpa jeda waktu."
            className="w-full rounded-lg border border-transparent bg-sky-50 px-4 py-3 text-sm outline-none transition placeholder:text-muted/60 focus:border-navy-800 focus:bg-white focus:ring-4 focus:ring-navy-900/10"
          />
          <p className="mt-1.5 text-[11px] text-muted">
            {hasInteraksiText
              ? "Interaksi terdeteksi: status memuat_ddi otomatis disetel menjadi true."
              : "Jika diisi, memuat_ddi otomatis menjadi true. Jika dikosongkan, memuat_ddi kembali false."}
          </p>
        </div>
      </div>
    </section>
  );
}