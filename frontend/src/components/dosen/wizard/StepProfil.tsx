import { useId } from "react";
import { ChevronDown } from "lucide-react";
import {
  GAYA_BICARA,
  JENIS_KELAMIN,
  KALIMAT_MAX,
  KATEGORI_KHUSUS,
  KATEGORI_USIA,
  LITERASI,
  PERAN_KOMUNIKASI,
  type Step2Form,
} from "@/lib/wizard";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-transparent bg-sky-50 px-4 py-3 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:border-navy-800 focus:bg-white focus:ring-4 focus:ring-navy-900/10";
const lbl = "mb-2 block text-sm font-semibold";

function Section({ n, title, children }: { n: number | string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
      <h2 className="flex items-center gap-3 font-serif text-base font-bold uppercase tracking-wide">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-100 text-sm text-navy-800">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// Select yang tetap menampilkan nilai lama di database walau tidak ada di daftar opsi
function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const list = options.some((o) => o.value === value) || !value ? options : [{ value, label: value }, ...options];
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(field, "appearance-none pr-10")}
      >
        {!value && (
          <option value="" disabled>
            Pilih...
          </option>
        )}
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

interface Props {
  form: Step2Form;
  onChange: (patch: Partial<Step2Form>) => void;
  // Prop jenis diteruskan dari wizard utama untuk mengecek tipe kasus
  jenisSkenario: string;
}

export function StepProfil({ form, onChange, jenisSkenario }: Props) {
  const uid = useId();

  const isCustomGaya = !GAYA_BICARA.some((g) => g.value === form.gayaBicara) && form.gayaBicara !== "";

  // Cek apakah jenis skenario adalah resep kronis
  const isResepKronis = jenisSkenario === "resep_kronis" || jenisSkenario === "RESEP KRONIS";

  const toggle = (key: string) =>
    onChange({
      kategori: form.kategori.includes(key) ? form.kategori.filter((k) => k !== key) : [...form.kategori, key],
    });

  const warnings = [
    form.kategori.includes("pediatri") &&
      ["Dewasa", "Lansia"].includes(form.kategoriUsia) &&
      "Kategori Pediatri wajib ditujukan untuk pasien Anak-anak atau Balita.",
    form.kategori.includes("geriatri") &&
      ["Balita", "Anak-anak", "Remaja", "Dewasa"].includes(form.kategoriUsia) &&
      "Kategori Geriatri khusus untuk pasien dengan usia Lansia (≥60 tahun).",
  ].filter(Boolean) as string[];

  // Opsi dropdown dinamis untuk Resep Kronis
  const UNIT_LAYANAN_OPSI = [
    { value: "Poli Jantung & Pembuluh Darah", label: "Poli Jantung & Pembuluh Darah" },
    { value: "Poli Penyakit Dalam", label: "Poli Penyakit Dalam" },
    { value: "Poli Anak", label: "Poli Anak" },
    { value: "Klinik Umum", label: "Klinik Umum" },
  ];

  const STATUS_KUNJUNGAN_OPSI = [
    { value: "Pasien Baru (Resep Baru)", label: "Pasien Baru (Resep Baru)" },
    { value: "Rawat Jalan Rutin", label: "Rawat Jalan Rutin" },
    { value: "Pasien Rujuk Balik (PRB)", label: "Pasien Rujuk Balik (PRB)" },
    { value: "Iter 1x (Pengambilan Ke-1)", label: "Iter 1x (Pengambilan Ke-1)" },
    { value: "Iter 2x (Jadwal Pengambilan Ke-2)", label: "Iter 2x (Jadwal Pengambilan Ke-2)" },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Demografi & Riwayat Dasar */}
      <Section n={1} title="Demografi Pasien">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-nama`} className={lbl}>
              Nama Pasien <span className="text-red-600">*</span>
            </label>
            <input
              id={`${uid}-nama`}
              value={form.nama}
              maxLength={60}
              onChange={(e) => onChange({ nama: e.target.value })}
              placeholder="Contoh: Bpk. Budi Santoso"
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-usia`} className={lbl}>
              Kategori Usia <span className="text-red-600">*</span>
            </label>
            <Select
              id={`${uid}-usia`}
              value={form.kategoriUsia}
              onChange={(v) => onChange({ kategoriUsia: v })}
              options={KATEGORI_USIA.map((u) => ({ value: u, label: u }))}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-jk`} className={lbl}>
              Jenis Kelamin <span className="text-red-600">*</span>
            </label>
            <Select
              id={`${uid}-jk`}
              value={form.jenisKelamin}
              onChange={(v) => onChange({ jenisKelamin: v })}
              options={JENIS_KELAMIN.map((j) => ({ value: j, label: j }))}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-peran`} className={lbl}>
              Peran Komunikasi <span className="text-red-600">*</span>
            </label>
            <Select
              id={`${uid}-peran`}
              value={form.peranKomunikasi}
              onChange={(v) => onChange({ peranKomunikasi: v })}
              options={PERAN_KOMUNIKASI.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </div>

        <hr className="my-6 border-line" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-alergi`} className={lbl}>
              Riwayat Alergi
            </label>
            <input
              id={`${uid}-alergi`}
              value={form.riwayatAlergi}
              maxLength={160}
              onChange={(e) => onChange({ riwayatAlergi: e.target.value })}
              placeholder="Contoh: Alergi Penisilin / Udang, atau Tidak ada"
              className={field}
            />
            <p className="mt-1.5 text-[11px] text-muted">
              Kosongkan jika belum ada; otomatis disimpan sebagai &ldquo;Tidak ada&rdquo;.
            </p>
          </div>
          <div>
            <label htmlFor={`${uid}-penyerta`} className={lbl}>
              Kondisi Penyerta
            </label>
            <input
              id={`${uid}-penyerta`}
              value={form.kondisiPenyerta}
              maxLength={160}
              onChange={(e) => onChange({ kondisiPenyerta: e.target.value })}
              placeholder="Contoh: Riwayat gastritis / hipertensi, atau Tidak ada"
              className={field}
            />
            <p className="mt-1.5 text-[11px] text-muted">
              Kosongkan jika belum ada; otomatis disimpan sebagai &ldquo;Tidak ada&rdquo;.
            </p>
          </div>
        </div>

        <hr className="my-6 border-line" />

        <fieldset>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <legend className="text-sm font-semibold text-navy-900">
              Kategori Pasien Kondisi Khusus (Permenkes No. 73/2016)
              <span className="mt-0.5 block text-xs font-normal text-muted">
                Kriteria pasien prioritas konseling farmasi klinis (Pilih jika relevan dengan kasus):
              </span>
            </legend>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
              Opsional
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {KATEGORI_KHUSUS.map((k) => {
              const on = form.kategori.includes(k.key);
              return (
                <label
                  key={k.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition",
                    on ? "border-navy-800/30 bg-sky-50 font-medium" : "border-line hover:bg-cream",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(k.key)}
                    className="h-4 w-4 shrink-0 accent-navy-900"
                  />
                  <span>
                    {k.label} {k.hint && <span className="text-xs text-muted">{k.hint}</span>}
                  </span>
                </label>
              );
            })}
          </div>

          {warnings.map((w) => (
            <p key={w} className="mt-3 text-xs font-medium text-amber-700">
              {w}
            </p>
          ))}
        </fieldset>
      </Section>

      {/* 1.5. Konteks Pelayanan & Resep (KHUSUS RESEP KRONIS) */}
      {isResepKronis && (
        <Section n="!" title="Konteks Pelayanan & Legalitas (Khusus Resep Kronis)">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Catatan:</strong> Informasi ini akan langsung terlihat oleh mahasiswa di halaman <i>Briefing Kasus</i>.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-unit`} className={lbl}>
                Asal Resep / Unit Pelayanan <span className="text-red-600">*</span>
              </label>
              <Select
                id={`${uid}-unit`}
                value={form.unitLayanan || ""}
                onChange={(v) => onChange({ unitLayanan: v })}
                options={UNIT_LAYANAN_OPSI}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-iter`} className={lbl}>
                Status Kunjungan &amp; Pengulangan (Iter) <span className="text-red-600">*</span>
              </label>
              <Select
                id={`${uid}-iter`}
                value={form.statusKunjungan || ""}
                onChange={(v) => onChange({ statusKunjungan: v })}
                options={STATUS_KUNJUNGAN_OPSI}
              />
            </div>
          </div>
        </Section>
      )}

      {/* 2. Persona */}
      <Section n={isResepKronis ? 3 : 2} title="Persona & Gaya Komunikasi">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* GAYA BICARA */}
          <div>
            <label htmlFor={`${uid}-gaya`} className={lbl}>
              Gaya Bicara Agen Virtual <span className="text-red-600">*</span>
            </label>

            <Select
              id={`${uid}-gaya`}
              value={isCustomGaya ? "LAINNYA" : form.gayaBicara}
              onChange={(v) => onChange({ gayaBicara: v === "LAINNYA" ? "" : v })}
              options={GAYA_BICARA}
            />

            {(isCustomGaya || form.gayaBicara === "") && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  autoFocus
                  value={form.gayaBicara}
                  onChange={(e) => onChange({ gayaBicara: e.target.value })}
                  placeholder="Ketik deskripsi gaya bicara spesifik..."
                  className={cn(field, form.gayaBicara.trim() === "" && "border-red-400 focus:border-red-500")}
                />
                <p
                  className={cn(
                    "mt-1.5 text-[11px]",
                    form.gayaBicara.trim() === "" ? "text-red-600" : "text-muted",
                  )}
                >
                  {form.gayaBicara.trim() === ""
                    ? "Gaya bicara khusus tidak boleh kosong."
                    : "Deskripsi ini akan diinstruksikan langsung kepada AI Pasien Virtual."}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor={`${uid}-lit`} className={lbl}>
              Tingkat Literasi Kesehatan <span className="text-red-600">*</span>
            </label>
            <Select
              id={`${uid}-lit`}
              value={form.literasi}
              onChange={(v) => onChange({ literasi: v })}
              options={LITERASI}
            />
          </div>
        </div>
      </Section>

      {/* 3. Dialog awal */}
      <Section n={isResepKronis ? 4 : 3} title="Dialog Awal (Trigger Pertama)">
        <label htmlFor={`${uid}-kal`} className={lbl}>
          Kalimat Pembuka Pasien Virtual <span className="text-red-600">*</span>
        </label>
        <div className="relative">
          <textarea
            id={`${uid}-kal`}
            rows={4}
            maxLength={KALIMAT_MAX}
            value={form.kalimat}
            onChange={(e) => onChange({ kalimat: e.target.value.replace(/\n/g, " ") })}
            placeholder="Contoh: Mbak, ada obat buat nyeri lutut? Saya biasa minum ibuprofen tapi belakangan lambung sering perih."
            className={cn(field, "resize-none pb-8 leading-relaxed")}
          />
          <span className="pointer-events-none absolute bottom-2.5 right-4 font-mono text-[11px] text-muted">
            {form.kalimat.length} / {KALIMAT_MAX} karakter
          </span>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-sky-50 px-4 py-3.5 text-sm">
          <input
            type="checkbox"
            checked={form.memuatIk}
            onChange={(e) => onChange({ memuatIk: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-navy-900"
          />
          <span className="flex-1 font-semibold">
            Kalimat ini memuat Informasi Kunci
            <span className="block text-xs font-normal text-muted">
              Pemetaan butir informasi kunci diatur di Langkah 4.
            </span>
          </span>
          {form.memuatIk && (
            <span className="whitespace-nowrap rounded-full bg-lime-700 px-3 py-1 text-[11px] font-semibold text-white">
              Terpetakan
            </span>
          )}
        </label>
      </Section>
    </div>
  );
}