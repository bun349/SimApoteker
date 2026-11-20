import { useState } from "react";
import {
  Calculator, CheckCircle2, ChevronDown, Lock, MessageSquare, ShieldAlert, ShieldCheck,
  SlidersHorizontal, TriangleAlert,
} from "lucide-react";
import { BOBOT, isBlank as rubrikBlank, type RubrikRow } from "@/lib/rubrik";
import { isBlank as penaltiBlank, type PenaltiRow } from "@/lib/penalti";
import { MAX_KOM, MIN_KOM, MODES, PRESETS, klinisOf, type ModeRilis, type Step8Form } from "@/lib/finalisasi";
import { formatShortDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const bobotBadge: Record<number, string> = {
  1: "bg-sky-100 text-navy-800",
  2: "bg-gold-100 text-amber-800",
  3: "bg-red-100 text-red-700",
};

const KOMUNIKASI_OTOMATIS = [
  "Membangun koneksi (salam dan perkenalan identitas)",
  "Mendengar aktif dan empati",
  "Teach-back (meminta pasien mengulang penjelasan)",
  "Penggunaan bahasa awam",
];

function Card({ icon, title, right, children }: {
  icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <h2 className="flex items-center gap-3 font-serif text-lg font-bold">{icon}{title}</h2>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

interface Props {
  form: Step8Form;
  onChange: (fn: (f: Step8Form) => Step8Form) => void;
  rubrik: RubrikRow[];
  penalti: PenaltiRow[];
  excluded: string[];       // isi "Butir Rubrik Tidak Berlaku" dari Langkah 3
  versiTarget: string;
  author: string;
  incomplete: string[];     // langkah 1-7 yang belum lengkap
  canFinalize: boolean;
  saving: boolean;
  onFinalize: () => void;
  versiLama: string[];            // contoh ["1.0"]; kosong = bukan revisi
  arsipLama: boolean;
  onArsipLama: (v: boolean) => void;
}

export function StepFinal(p: Props) {
  const { form } = p;
  const [open, setOpen] = useState(false);
  const klinis = klinisOf(form.kom);

  const rubrik = p.rubrik.filter((r) => !rubrikBlank(r));
  const penalti = p.penalti.filter((r) => !penaltiBlank(r));
  const excludedIds = new Set(p.excluded.flatMap((s) => s.match(/K-\d{2}/g) ?? []));

  const toggleMode = (m: ModeRilis) =>
    p.onChange((f) => ({
      ...f,
      modes: f.modes.includes(m) ? f.modes.filter((x) => x !== m) : [...f.modes, m],
    }));

  const sample = { kom: 75, klinis: 85 };
  const finalScore = (sample.kom * form.kom) / 100 + (sample.klinis * klinis) / 100;

  return (
    <div className="space-y-5">
      {/* 1. Komposisi nilai */}
      <Card
        icon={<SlidersHorizontal size={18} />}
        title="Komposisi Nilai Gabungan Praktikum"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-navy-800">
            <Lock size={11} /> Total: 100% Terkunci
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gold-400/40 bg-gold-100 p-5">
            <p className="flex items-center justify-between text-sm font-semibold">
              Skor Komunikasi PaCT <MessageSquare size={16} className="text-amber-700" />
            </p>
            <p className="mt-2 font-serif text-4xl font-bold text-amber-800">
              {form.kom}<span className="text-xl">%</span>
            </p>
            <p className="mt-1 text-xs text-muted">Dinilai otomatis oleh sistem.</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
            <p className="text-sm font-semibold">Skor Konten Klinis</p>
            <p className="mt-2 font-serif text-4xl font-bold text-navy-900">
              {klinis}<span className="text-xl">%</span>
            </p>
            <p className="mt-1 text-xs text-muted">Berdasarkan Kunci Konten dan penalti.</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-gold-400 transition-all" style={{ width: `${form.kom}%` }} />
            <div className="flex-1 bg-lime-700" />
          </div>
          <input
            type="range" min={MIN_KOM} max={MAX_KOM} step={5} value={form.kom}
            onChange={(e) => p.onChange((f) => ({ ...f, kom: Number(e.target.value) }))}
            aria-label="Bobot komunikasi PaCT dalam persen"
            className="mt-3 h-2 w-full cursor-pointer accent-navy-900"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-muted">
            <span>PaCT: min {MIN_KOM}%</span>
            <span>Klinis: min {100 - MAX_KOM}%</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Rasio preset:</span>
            {PRESETS.map((pr) => (
              <button
                key={pr.kom} type="button"
                onClick={() => p.onChange((f) => ({ ...f, kom: pr.kom }))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  form.kom === pr.kom
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-line bg-white hover:bg-cream",
                )}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-sky-50 p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-navy-900">
            <Calculator size={14} /> Simulasi Formula Nilai Mahasiswa
          </p>
          <p className="mt-2 font-mono text-sm leading-relaxed">
            Komunikasi {sample.kom} (×{form.kom}% = {((sample.kom * form.kom) / 100).toFixed(1)}) + Konten{" "}
            {sample.klinis} (×{klinis}% = {((sample.klinis * klinis) / 100).toFixed(1)}) →{" "}
            <b className="text-lime-800">Nilai Akhir: {finalScore.toFixed(1)}</b>
          </p>
        </div>
        {p.versiLama.length > 0 && (
        <label
          className={cn(
            "mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition",
            p.arsipLama ? "border-navy-800/30 bg-sky-50" : "border-line",
          )}
        >
          <input
            type="checkbox" checked={p.arsipLama} onChange={(e) => p.onArsipLama(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-navy-900"
          />
          <span>
            <b className="block">Arsipkan Versi Sebelumnya Secara Otomatis</b>
            <span className="mt-0.5 block text-xs text-muted">
              Saat versi ini terbit, v{p.versiLama.join(", v")} dipindahkan ke Arsip sehingga hanya versi terbaru
              yang muncul di bank soal. Datanya tetap tersimpan untuk riwayat ujian.
            </span>
          </span>
        </label>
      )}
      </Card>

      {/* 2. Mode rilis */}
      <Card icon={<CheckCircle2 size={18} />} title="Mode Rilis">
        <p className="mb-4 text-xs text-muted">
          Pilih bank tempat skenario ini muncul. Bobot di atas hanya berlaku untuk mode praktikum.
        </p>
        <div className="space-y-3">
          {MODES.map((m) => {
            const on = form.modes.includes(m.key);
            return (
              <div
                key={m.key}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-xl border p-4 transition",
                  on ? "border-navy-800/30 bg-sky-50" : "border-line",
                )}
              >
                <div className="text-sm">
                  <p className="font-semibold">{m.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{m.desc}</p>
                </div>
                <button
                  type="button" role="switch" aria-checked={on} aria-label={m.title}
                  onClick={() => toggleMode(m.key)}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-lime-700" : "bg-gray-300")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
        {form.modes.length === 0 && (
          <p className="mt-3 text-xs text-amber-700">Pilih minimal satu mode rilis.</p>
        )}
      </Card>

      {/* 3. Ringkasan instrumen penilaian */}
      <section className="rounded-2xl border border-line bg-white shadow-sm">
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="flex w-full items-center gap-3 px-6 py-5 text-left sm:px-7"
        >
          <ShieldCheck size={18} className="shrink-0 text-lime-700" />
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg font-bold">Ringkasan Instrumen Penilaian AI</span>
            <span className="block text-xs text-muted">
              Komunikasi otomatis • {rubrik.length} butir klinis • {penalti.length} penalti kritis
            </span>
          </span>
          <ChevronDown size={18} className={cn("shrink-0 text-muted transition", open && "rotate-180")} />
        </button>

        {open && (
          <div className="space-y-5 border-t border-line px-6 py-5 sm:px-7">
            {/* A */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                A. Penilaian Komunikasi (Otomatis oleh Sistem)
              </h3>
              <p className="mt-1 text-xs text-muted">Tidak perlu diatur manual oleh dosen.</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {KOMUNIKASI_OTOMATIS.map((t) => (
                  <li key={t} className="flex items-start gap-2 rounded-lg bg-gold-100 px-3 py-2.5 text-xs">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-amber-700" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* B */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                B. Penilaian Klinis (Berdasarkan Kunci Konten)
              </h3>
              <ul className="mt-3 space-y-2">
                {rubrik.map((r) => {
                  const off = excludedIds.has(r.id);
                  const b = BOBOT.find((x) => x.value === r.bobot);
                  return (
                    <li key={r.key} className="flex items-center gap-3 rounded-lg bg-sky-50 px-3 py-2.5 text-xs">
                      <span className="rounded bg-navy-900 px-1.5 py-0.5 font-mono font-bold text-white">{r.id}</span>
                      <span className={cn("min-w-0 flex-1 truncate", off && "text-muted line-through")}>
                        {r.butir || "(belum diisi)"}
                      </span>
                      {off ? (
                        <span className="whitespace-nowrap rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          Tidak berlaku
                        </span>
                      ) : (
                        b && (
                          <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold", bobotBadge[r.bobot])}>
                            {b.label}
                          </span>
                        )
                      )}
                    </li>
                  );
                })}
                {rubrik.length === 0 && <li className="text-xs text-muted">Belum ada butir rubrik.</li>}
              </ul>
              {p.excluded.length > 0 && (
                <p className="mt-2 text-[11px] text-muted">
                  Dieksklusi dari penilaian: {p.excluded.join(", ")}
                </p>
              )}
            </div>

            {/* C */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-700">
                C. Penalti Kesalahan Kritis
              </h3>
              <ul className="mt-3 space-y-2">
                {penalti.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-800">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span className="font-mono font-bold">{r.id}</span>
                    <span className="min-w-0 flex-1 truncate">{r.judul || "(belum diisi)"}</span>
                    <span className="whitespace-nowrap font-bold">
                      {r.gagal ? "Gagal Total" : `-${r.poin} Poin`}
                    </span>
                  </li>
                ))}
                {penalti.length === 0 && <li className="text-xs text-muted">Belum ada penalti.</li>}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* 4. Pengesahan */}
      <Card icon={<ShieldCheck size={18} />} title="Pengesahan & Pembekuan Skenario">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
          <p className="font-semibold text-navy-900">
            Dokumen akan dibekukan (freeze) sebagai rilis resmi v{p.versiTarget}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Setelah diterbitkan, skenario tidak dapat diubah lagi. Revisi substansi lanjutan akan
            menghasilkan nomor revisi baru.
          </p>
        </div>

        <dl className="mt-4 grid gap-4 rounded-xl bg-sky-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">Target Versi</dt>
            <dd className="mt-1 font-bold text-navy-900">v{p.versiTarget}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">Penyusun Utama</dt>
            <dd className="mt-1 font-medium">{p.author}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tanggal Pengesahan</dt>
            <dd className="mt-1 font-medium">{formatShortDate(new Date().toISOString())}</dd>
          </div>
        </dl>

        {p.incomplete.length > 0 && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>Langkah yang belum lengkap: {p.incomplete.join(", ")}.</span>
          </p>
        )}

        <button
          type="button" onClick={p.onFinalize} disabled={!p.canFinalize || p.saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-4 font-serif text-base font-bold text-white shadow-md transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
        >
          <ShieldCheck size={18} className="text-gold-400" />
          {p.saving ? "Menerbitkan..." : "Finalisasi & Terbitkan Skenario"}
        </button>
      </Card>
    </div>
  );
}