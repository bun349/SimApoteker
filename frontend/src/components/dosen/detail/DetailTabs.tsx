import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert, CheckCircle2, Pencil, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { updateModeRilis } from "@/api/skenario";
import type { Draft } from "@/api/wizard";
import { KATEGORI_KHUSUS, parseStep2 } from "@/lib/wizard";
import { getKlinisConfig, parseKlinisTambahan, parseStep3 } from "@/lib/klinis";
import { parseStep5 } from "@/lib/kamus";
import { BOBOT, isBlank as rubrikBlank, parseStep6, splitList } from "@/lib/rubrik";
import { isBlank as penaltiBlank, parseStep7 } from "@/lib/penalti";
import { MODES, klinisOf, parseStep8 } from "@/lib/finalisasi";
import { cn } from "@/lib/utils";

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function Sec({ title, children, rightAction }: { title: string; children: ReactNode; rightAction?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-bold">{title}</h3>
        {rightAction}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Item({ label, children, danger }: { label: string; children?: ReactNode; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={cn("mt-1 whitespace-pre-line text-sm font-medium", danger && "text-red-700")}>
        {children || <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

const Chip = ({ children, tone = "sky" }: { children: ReactNode; tone?: "sky" | "gold" | "red" | "gray" }) => (
  <span
    className={cn(
      "inline-block rounded-md px-2 py-1 text-xs font-medium",
      tone === "sky" && "bg-sky-100 text-navy-800",
      tone === "gold" && "bg-gold-100 text-amber-800",
      tone === "red" && "bg-red-100 text-red-700",
      tone === "gray" && "bg-gray-100 text-gray-600",
    )}
  >
    {children}
  </span>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-line bg-cream p-8 text-center text-sm text-muted">
    {children}
  </div>
);

const bobotBadge: Record<number, string> = {
  1: "bg-sky-100 text-navy-800",
  2: "bg-gold-100 text-amber-800",
  3: "bg-red-100 text-red-700",
};

// ===== Tab 1: Profil & Persona =====
export function TabProfil({ d }: { d: Draft }) {
  const klinis = toRecord(d.klinis);
  const p2 = parseStep2(d.profil, d.kalimat, klinis, {
    riwayatAlergi: d.riwayatAlergi,
    kondisiPenyerta: d.kondisiPenyerta,
  });
  const p5 = parseStep5(d.kamus);
  const kamus = p5.rows.filter((r) => r.istilah.trim());
  const kategori = KATEGORI_KHUSUS.filter((k) => p2.kategori.includes(k.key));

  const str = (k: string) => (typeof d.profil[k] === "string" ? (d.profil[k] as string) : "");
  const kategoriUsia = str("kategori_usia") || p2.kategoriUsia;
  const peran = str("peran_komunikasi") || str("peran") || p2.peranKomunikasi;

  return (
    <div className="space-y-5">
      <Sec title="Demografi & Persona Pasien">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Nama Pasien">{p2.nama}</Item>
          <Item label="Kategori Usia">{kategoriUsia}</Item>
          <Item label="Jenis Kelamin">{p2.jenisKelamin}</Item>
          <Item label="Peran Komunikasi">{peran}</Item>
          <Item label="Riwayat Alergi">{p2.riwayatAlergi || "Tidak ada"}</Item>
          <Item label="Kondisi Penyerta">{p2.kondisiPenyerta || "Tidak ada"}</Item>
          <Item label="Gaya Bicara Agen Virtual">{p2.gayaBicara}</Item>
          <Item label="Tingkat Literasi Kesehatan">{p2.literasi}</Item>

          {p2.unitLayanan && (
            <Item label="Unit Layanan / Asal Resep">
              <span className="font-bold text-navy-900">{p2.unitLayanan}</span>
            </Item>
          )}
          {p2.statusKunjungan && (
            <Item label="Status Kunjungan (Iter)">
              <span className="font-bold text-navy-900">{p2.statusKunjungan}</span>
            </Item>
          )}
        </dl>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Kategori Kondisi Khusus (Permenkes 73/2016)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {kategori.length ? (
              kategori.map((k) => <Chip key={k.key}>{k.label}</Chip>)
            ) : (
              <span className="text-sm text-muted">—</span>
            )}
          </div>
        </div>
      </Sec>

      <Sec title="Pemicu & Kalimat Pembuka">
        <div className="space-y-5">
          <Item label="Kalimat Pembuka Pasien Virtual">
            <span className="mt-3 block border-l-4 border-gold-400 pl-4 font-serif text-lg italic leading-relaxed text-ink/80">
              “{d.kalimat || "—"}”
            </span>
          </Item>
          <Item label="Status Pemetaan">
            {p2.memuatIk ? (
              <Chip tone="sky">✅ Memuat Informasi Kunci (Terpetakan)</Chip>
            ) : (
              <Chip tone="gray">Tidak Memuat Informasi Kunci Utama</Chip>
            )}
          </Item>
        </div>
      </Sec>

      <Sec title="Kamus Istilah Medis">
        {kamus.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 pr-4 font-semibold">Istilah Medis</th>
                  <th className="pb-2 font-semibold">Padanan Awam Yang Diterima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kamus.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2.5 pr-4 font-semibold">{r.istilah}</td>
                    <td className="py-2.5">{r.padanan || <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Belum ada istilah tambahan.</p>
        )}
      </Sec>
    </div>
  );
}

// ===== Tab 2: Data Klinis Khusus =====
export function TabKlinis({ d }: { d: Draft }) {
  const cfg = getKlinisConfig(d.jenis);
  const tambahan = parseKlinisTambahan({
    obatLainSuplemen: d.obatLainSuplemen,
    interaksiDitanam: d.interaksiDitanam,
    memuatDdi: d.memuatDdi,
    klinis: toRecord(d.klinis),
  });

  if (!cfg) return <Empty>Jenis kasus <b className="text-ink">{d.jenis}</b> belum memiliki formulir klinis.</Empty>;
  const f = parseStep3(cfg, toRecord(d.klinis), d.butir, true);

  return (
    <div className="space-y-5">
      <Sec title="Obat Penyerta & Interaksi Obat (DDI)">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Status Memuat DDI">
            <Chip tone={tambahan.memuatDdi ? "gold" : "gray"}>
              {tambahan.memuatDdi ? "Ya (True)" : "Tidak (False)"}
            </Chip>
          </Item>
          <Item label="Obat / Suplemen Lain">
            {tambahan.obatLainSuplemen.length ? (
              <span className="flex flex-wrap gap-1.5">
                {tambahan.obatLainSuplemen.map((obat, idx) => (
                  <Chip key={`${obat}-${idx}`}>{obat}</Chip>
                ))}
              </span>
            ) : (
              "Tidak ada"
            )}
          </Item>
          <div className="sm:col-span-2">
            <Item label="Interaksi Obat yang Ditanam" danger={Boolean(tambahan.interaksiDitanam)}>
              {tambahan.interaksiDitanam || "Tidak ada"}
            </Item>
          </div>
        </dl>
      </Sec>

      {cfg.sections.map((s, i) => (
        <Sec key={s.id} title={`${i + 1}. ${s.title}`}>
          <dl className={cn("grid gap-4", s.cols === 2 && "sm:grid-cols-2")}>
            {s.fields.map((x) => (
              <div key={x.key} className={x.full ? "sm:col-span-2" : undefined}>
                <Item label={x.label} danger={x.tone === "danger"}>{f.values[x.key]}</Item>
              </div>
            ))}
          </dl>
          {s.chips && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{s.chips.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {f.butir.length ? (
                  f.butir.map((b, idx) => <Chip key={`${b}-${idx}`} tone="gray">{b}</Chip>)
                ) : (
                  <span className="text-sm text-muted">Tidak ada</span>
                )}
              </div>
            </div>
          )}
        </Sec>
      ))}
    </div>
  );
}

// ===== Tab 3: Instrumen Penilaian =====
export function TabInstrumen({ d }: { d: Draft }) {
  const cfg = getKlinisConfig(d.jenis);
  const excluded = cfg ? parseStep3(cfg, toRecord(d.klinis), d.butir, true).butir : d.butir;
  const excludedIds = new Set(excluded.flatMap((s) => s.match(/K-\d{2}/g) ?? []));
  const rubrik = parseStep6(d.kunci).rows.filter((r) => !rubrikBlank(r));
  const penalti = parseStep7(d.kesalahan).rows.filter((r) => !penaltiBlank(r));

  const KOMUNIKASI_OTOMATIS = [
    "Membangun koneksi (salam dan perkenalan identitas)",
    "Mendengar aktif dan empati",
    "Teach-back (meminta pasien mengulang penjelasan)",
    "Penggunaan bahasa awam",
  ];

  return (
    <div className="space-y-5">
      <Sec title="Penilaian Komunikasi PaCT (Otomatis oleh AI)">
        <p className="text-xs leading-relaxed text-muted">
          Instrumen penilaian komunikasi ini bersifat universal dan dinilai secara otomatis oleh sistem
          di sepanjang sesi (tidak perlu dikonfigurasi manual oleh dosen).
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {KOMUNIKASI_OTOMATIS.map((t) => (
            <li key={t} className="flex items-start gap-2 rounded-lg bg-gold-100 px-3 py-2.5 text-xs font-medium text-amber-900">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-amber-700" /> {t}
            </li>
          ))}
        </ul>
      </Sec>

      <Sec title={`Kunci Konten Klinis (${rubrik.length} Butir)`}>
        <div className="space-y-3">
          {rubrik.map((r) => {
            const off = excludedIds.has(r.id);
            const b = BOBOT.find((x) => x.value === r.bobot);
            return (
              <article key={r.key} className="rounded-xl bg-sky-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-navy-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{r.id}</span>
                  <span className="text-xs text-muted">{r.kategori || "Kategori belum dipilih"}</span>
                  <span className="flex-1" />
                  {off && <Chip tone="gray">Tidak berlaku</Chip>}
                  {b && (
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", bobotBadge[r.bobot])}>
                      {b.label}
                    </span>
                  )}
                </div>
                <p className={cn("mt-2 text-sm font-semibold", off && "text-muted line-through")}>{r.butir}</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Item label="Komponen Wajib">
                    <span className="flex flex-wrap gap-1.5">
                      {splitList(r.komponen).map((x, idx) => <Chip key={`${x}-${idx}`}>{x}</Chip>)}
                    </span>
                  </Item>
                  <Item label="Alternatif Diterima">
                    <span className="flex flex-wrap gap-1.5">
                      {splitList(r.alternatif).map((x, idx) => <Chip key={`${x}-${idx}`} tone="gold">{x}</Chip>)}
                    </span>
                  </Item>
                  <Item label="Pernyataan Keliru / Tidak Aman">
                    <span className="flex flex-wrap gap-1.5">
                      {splitList(r.keliru).map((x, idx) => <Chip key={`${x}-${idx}`} tone="red">{x}</Chip>)}
                    </span>
                  </Item>
                  <Item label="Rujukan Klinis">{r.rujukan}</Item>
                </dl>
              </article>
            );
          })}
          {!rubrik.length && <p className="text-sm text-muted">Belum ada butir rubrik klinis.</p>}
        </div>
      </Sec>

      <Sec title={`Kesalahan Kritis (${penalti.length} Butir)`}>
        <div className="space-y-3">
          {penalti.map((r) => (
            <article key={r.key} className="rounded-xl bg-red-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert size={15} className="text-red-700" />
                <span className="rounded bg-navy-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{r.id}</span>
                <span className="text-xs text-muted">{r.kategori}</span>
                <span className="flex-1" />
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold",
                    r.gagal ? "bg-red-700 text-white" : "bg-red-100 text-red-700",
                  )}
                >
                  {r.gagal ? "Gagal Total (-100%)" : `-${r.poin} Poin`}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold">{r.judul}</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Item label="Deskripsi Perilaku">{r.deskripsi}</Item>
                <Item label="Kriteria Eksekusi Penalti">{r.kriteria}</Item>
              </dl>
              <p className="mt-3 text-xs text-muted">
                {r.koreksi
                  ? "Dapat dikoreksi sendiri oleh mahasiswa (dalam batas toleransi giliran)."
                  : "Tidak dapat dikoreksi sendiri."}
              </p>
            </article>
          ))}
          {!penalti.length && <p className="text-sm text-muted">Belum ada penalti.</p>}
        </div>
      </Sec>
    </div>
  );
}

// ===== Tab 4: Konfigurasi Nilai & Mode Rilis =====
export function TabNilai({ d }: { d: Draft }) {
  const f = parseStep8(d.bobotKomunikasi, d.modeRilis);
  const klinis = klinisOf(f.kom);
  const sample = { kom: 75, klinis: 85 };
  const total = (sample.kom * f.kom) / 100 + (sample.klinis * klinis) / 100;

  const [isEditing, setIsEditing] = useState(false);
  const [tempModes, setTempModes] = useState<string[]>(f.modes);

  useEffect(() => {
    if (!isEditing) setTempModes(f.modes);
  }, [f.modes, isEditing]);

  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  const update = useMutation({
    mutationFn: async (modes: string[]) => {
      if (!profile?.id) throw new Error("Sesi tidak valid");
      await updateModeRilis(profile.id, d.id, modes);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["skenario"] });
      setIsEditing(false);
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : "Gagal memperbarui mode rilis.");
    },
  });

  const toggleMode = (mKey: string) => {
    setTempModes((prev) => (prev.includes(mKey) ? prev.filter((x) => x !== mKey) : [...prev, mKey]));
  };

  const handleSave = () => {
    if (tempModes.length === 0) {
      alert("Pilih minimal satu mode rilis.");
      return;
    }
    update.mutate(tempModes);
  };

  const editButton = d.beku ? (
    <button
      type="button"
      onClick={() => {
        setTempModes(f.modes);
        setIsEditing(true);
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-cream px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-gold-100"
    >
      <Pencil size={13} /> Ubah Akses
    </button>
  ) : undefined;

  return (
    <div className="relative space-y-5">
      <Sec title="Komposisi Nilai Gabungan Praktikum">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gold-400/40 bg-gold-100 p-5">
            <p className="text-sm font-semibold">Skor Komunikasi PaCT</p>
            <p className="mt-2 font-serif text-4xl font-bold text-amber-800">
              {f.kom}
              <span className="text-xl">%</span>
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
            <p className="text-sm font-semibold">Skor Konten Klinis</p>
            <p className="mt-2 font-serif text-4xl font-bold text-navy-900">
              {klinis}
              <span className="text-xl">%</span>
            </p>
          </div>
        </div>
        <div className="mt-5 flex h-3 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-gold-400" style={{ width: `${f.kom}%` }} />
          <div className="flex-1 bg-lime-700" />
        </div>
        <p className="mt-4 rounded-lg bg-sky-50 px-4 py-3 font-mono text-xs leading-relaxed">
          Contoh: Komunikasi {sample.kom} (×{f.kom}%) + Konten {sample.klinis} (×{klinis}%) →{" "}
          <b className="text-lime-800">Nilai Akhir: {total.toFixed(1)}</b>
        </p>
      </Sec>

      <Sec title="Mode Rilis" rightAction={editButton}>
        <p className="mb-4 text-xs text-muted">Hak akses penggunaan skenario ini di portal mahasiswa.</p>
        <ul className="space-y-2">
          {MODES.map((m) => {
            const on = f.modes.includes(m.key);
            return (
              <li
                key={m.key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-4 text-sm",
                  on ? "border-navy-800/30 bg-sky-50" : "border-line text-muted",
                )}
              >
                <span>
                  <b className={on ? "text-ink" : ""}>{m.title}</b>
                  <span className="mt-0.5 block text-xs">{m.desc}</span>
                </span>
                <Chip tone={on ? "sky" : "gray"}>{on ? "Aktif" : "Tidak aktif"}</Chip>
              </li>
            );
          })}
        </ul>
      </Sec>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-serif text-xl font-bold text-ink">Ubah Akses Rilis</h3>
            <p className="mt-2 text-sm text-muted">Centang mode penggunaan skenario ini untuk mahasiswa.</p>

            <div className="mt-5 space-y-3">
              {MODES.map((m) => {
                const on = tempModes.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                      on ? "border-navy-800 bg-sky-50/50" : "border-line hover:border-navy-800/30",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleMode(m.key)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-navy-800 focus:ring-navy-800"
                    />
                    <div>
                      <p className="font-bold text-ink">{m.title}</p>
                      <p className="mt-1 text-xs text-muted">{m.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={update.isPending}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-cream disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={update.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-4 py-2 text-sm font-bold text-navy-900 shadow-sm transition hover:brightness-95 disabled:opacity-50"
              >
                {update.isPending && <Loader2 size={14} className="animate-spin" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}