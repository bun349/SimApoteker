import { CalendarDays, CheckCircle2, ChevronDown, CircleAlert, Loader2, UserRound } from "lucide-react";
import { JENIS_META, jenisMeta } from "@/lib/skenario";
import { JUDUL_MAX, KODE_MAX, type Step1Form } from "@/lib/wizard";
import type { KodeStatus } from "@/hooks/useKodeAvailability";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-transparent bg-sky-50 px-4 py-3 text-sm outline-none transition " +
  "placeholder:text-muted/60 focus:border-navy-800 focus:bg-white focus:ring-4 focus:ring-navy-900/10";
const label = "mb-2 block text-sm font-semibold";

const hints: Partial<Record<KodeStatus, string>> = {
  format: "Gunakan huruf kapital dan angka dipisah tanda hubung, contoh: SW-02.",
  taken: "Kode ini sudah dipakai skenario lain.",
  error: "Gagal memeriksa ketersediaan kode. Coba lagi.",
};

interface Props {
  form: Step1Form;
  onChange: (patch: Partial<Step1Form>) => void;
  kodeStatus: KodeStatus;
  versi: string;
  beku: boolean;
  author: string;
  dateLabel: string;
  isLocked?: boolean; // <-- PROPS TAMBAHAN UNTUK MENGUNCI JENIS SKENARIO
}

export function StepIdentitas({ form, onChange, kodeStatus, versi, beku, author, dateLabel, isLocked }: Props) {
  const bad = kodeStatus === "format" || kodeStatus === "taken" || kodeStatus === "error";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
        {/* Kode */}
        <div>
          <label htmlFor="kode" className={label}>Kode Skenario <span className="text-red-600">*</span></label>
          <div className="relative">
            <input
              id="kode"
              value={form.kode}
              maxLength={KODE_MAX}
              onChange={(e) => onChange({ kode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })}
              placeholder="SW-02"
              aria-invalid={bad}
              className={cn(field, "pr-10 font-mono", bad && "border-red-400")}
            />
            <span className="absolute inset-y-0 right-3 grid place-items-center">
              {kodeStatus === "ok" && <CheckCircle2 size={17} className="text-lime-700" />}
              {kodeStatus === "checking" && <Loader2 size={16} className="animate-spin text-muted" />}
              {bad && <CircleAlert size={17} className="text-red-500" />}
            </span>
          </div>
        </div>

        {/* Jenis */}
        <div>
          <label htmlFor="jenis" className={label}>Jenis Skenario <span className="text-red-600">*</span></label>
          <div className="relative">
            <select
              id="jenis"
              value={form.jenis}
              onChange={(e) => onChange({ jenis: e.target.value })}
              disabled={isLocked} // <-- PENGUNCI DIAKTIFKAN DI SINI
              className={cn(
                field, 
                "appearance-none pr-10",
                isLocked && "cursor-not-allowed bg-gray-100 text-muted opacity-80"
              )}
            >
              <option value="" disabled>Pilih jenis...</option>
              {Object.keys(JENIS_META).map((k) => (
                <option key={k} value={k}>{jenisMeta(k).label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
          {isLocked && <p className="mt-1 text-[11px] text-muted">Jenis kasus tidak dapat diubah setelah draf dibuat.</p>}
        </div>

        {/* Versi (Format diperbaiki) */}
        <div>
          <span className={label}>Versi Skenario</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-gold-100 px-3 py-2 text-xs font-semibold text-amber-800">
            v{versi} • {beku ? "Beku" : "Belum Beku"}
          </span>
        </div>
      </div>

      {hints[kodeStatus] && <p className="-mt-3 text-xs text-red-600">{hints[kodeStatus]}</p>}

      {/* Judul */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="judul" className="text-sm font-semibold">
            Judul Skenario Kasus Klinis <span className="text-red-600">*</span>
          </label>
          <span className="text-xs text-muted">{form.judul.length} / {JUDUL_MAX} Karakter</span>
        </div>
        <textarea
          id="judul"
          rows={4}
          maxLength={JUDUL_MAX}
          value={form.judul}
          onChange={(e) => onChange({ judul: e.target.value.replace(/\n/g, " ") })}
          placeholder="Contoh: Nyeri lutut lansia, pasien rutin mengonsumsi warfarin dengan risiko perdarahan lambung"
          className={cn(field, "resize-none leading-relaxed")}
        />
      </div>

      {/* Penyusun & tanggal (hanya baca) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Penyusun / Asesor Penanggung Jawab <span className="text-red-600">*</span></label>
          <div className="relative">
            <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input readOnly value={author} className={cn(field, "cursor-default pl-10")} />
          </div>
          <p className="mt-1.5 text-xs text-muted">Tercatat sebagai Lead Reviewer</p>
        </div>
        <div>
          <label className={label}>Tanggal Penyusunan <span className="text-red-600">*</span></label>
          <div className="relative">
            <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input readOnly value={dateLabel} className={cn(field, "cursor-default pl-10")} />
          </div>
          <p className="mt-1.5 text-xs text-muted">Waktu Indonesia Barat (WIB)</p>
        </div>
      </div>
    </div>
  );
}