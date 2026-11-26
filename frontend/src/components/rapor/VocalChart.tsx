import { Info, MicOff } from "lucide-react";
import type { VocalDataEntry } from "@/api/evaluation";
import { formatMmSs } from "@/hooks/useSimulationSession";

interface VocalChartProps {
  layakTampil: boolean;
  data: VocalDataEntry[];
  narasi: string | null;
}

export function VocalChart({ layakTampil, data, narasi }: VocalChartProps) {
  const summary = data.find((d) => d.tipe === "ringkasan") || data[0];
  const turns = data.filter((d) => d.tipe === "giliran");

  if (!layakTampil) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-cream/70 px-4 py-3 text-xs leading-relaxed text-ink">
          <span className="font-bold text-navy-900">[i Informasi Tambahan - Tidak Dinilai]:</span>{" "}
          Pengamatan vokal bersifat observasional (non-penalti) untuk memantau kecepatan bicara (WPM),
          rasio jeda hening, stabilitas volume RMS, dan validitas ASR. Metrik ini tidak mengurangi
          nilai gabungan sistem.
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-[#FAFAF8] px-6 py-8 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-muted">
            <MicOff size={18} />
          </div>
          <p className="mt-3 text-sm font-semibold text-navy-900">
            Grafik Pengamatan Vokal Belum Tersedia
          </p>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
            {narasi ||
              "Dibutuhkan minimal 3 giliran mahasiswa berbasis audio yang valid untuk menampilkan grafik prosodi suara."}
          </p>
          {typeof summary?.validitas_asr_persen === "number" && (
            <span className="mt-3 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium text-muted">
              Validitas Transkrip: {summary.validitas_asr_persen.toFixed(1)}% · Giliran Audio:{" "}
              {summary.audio_turns ?? 0}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Bangun koordinat grafik SVG sederhana namun tajam untuk 3 seri (Tempo, Pitch, Kekuatan)
  const width = 760;
  const height = 160;
  const padX = 36;
  const padY = 24;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const pointCount = Math.max(turns.length, 2);
  const xFor = (i: number) =>
    turns.length <= 1 ? width / 2 : padX + (i / (pointCount - 1)) * usableW;

  const normY = (val: number | null | undefined, minV: number, maxV: number) => {
    const safe = typeof val === "number" ? val : (minV + maxV) / 2;
    const ratio = Math.max(0, Math.min(1, (safe - minV) / (maxV - minV || 1)));
    return padY + (1 - ratio) * usableH;
  };

  const wpmPoints = turns.map((t, i) => ({ x: xFor(i), y: normY(t.wpm, 70, 200), val: t.wpm }));
  const pitchPoints = turns.map((t, i) => ({
    x: xFor(i),
    y: normY(t.pitch_hz, 100, 260),
    val: t.pitch_hz,
  }));
  const dbPoints = turns.map((t, i) => ({
    x: xFor(i),
    y: normY(t.kekuatan_db, 40, 85),
    val: t.kekuatan_db,
  }));

  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const peakWpm = wpmPoints.reduce<{
    idx: number;
    val: number | null;
    x: number;
    y: number;
  }>(
    (best, cur, idx) =>
      typeof cur.val === "number" && (best.val === null || cur.val > best.val)
        ? { idx, val: cur.val, x: cur.x, y: cur.y }
        : best,
    { idx: -1, val: null, x: 0, y: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-cream/70 px-4 py-3 text-xs leading-relaxed text-ink">
        <Info size={15} className="mt-0.5 shrink-0 text-navy-900" />
        <p>
          <span className="font-bold text-navy-900">[Informasi Tambahan - Tidak Dinilai]:</span>{" "}
          Monitoring parameter prosodi teknis (laju kata WPM, frekuensi fundamental pitch Hz, dan
          intensitas sinyal dB) di seluruh {turns.length} giliran audio. Perbandingan hanya dengan
          segmen lain pada sesi Anda sendiri dan tidak memengaruhi skor akhir.
        </p>
      </div>

      {/* Grafik SVG */}
      <div className="overflow-x-auto rounded-xl border border-line bg-[#FAFAF8] p-4">
        <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-44 w-full min-w-[520px]">
          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const y = padY + g * usableH;
            return (
              <line
                key={g}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="#E5E7EB"
                strokeDasharray="3 3"
              />
            );
          })}

          {turns.length > 0 && (
            <>
              <path d={toPath(wpmPoints)} fill="none" stroke="#172A46" strokeWidth="2.2" />
              <path d={toPath(pitchPoints)} fill="none" stroke="#D4A017" strokeWidth="2" />
              <path d={toPath(dbPoints)} fill="none" stroke="#65A30D" strokeWidth="2" />
            </>
          )}

          {peakWpm.idx >= 0 && peakWpm.val !== null && peakWpm.val > 150 && (
            <g>
              <circle cx={peakWpm.x} cy={peakWpm.y} r="4.5" fill="#B91C1C" />
              <text
                x={Math.min(width - 130, peakWpm.x + 8)}
                y={Math.max(14, peakWpm.y - 6)}
                fill="#B91C1C"
                fontSize="10"
                fontWeight="700"
              >
                Spike Laju Bicara ({Math.round(peakWpm.val)} WPM)
              </text>
            </g>
          )}

          {turns.map((t, idx) => (
            <text
              key={`${t.kode_giliran}-${idx}`}
              x={xFor(idx)}
              y={height + 14}
              textAnchor="middle"
              fill="#64748B"
              fontSize="10"
            >
              S{idx + 1} ({formatMmSs(t.waktu_mulai_detik || 0)})
            </text>
          ))}
        </svg>
      </div>

      {/* 3 Kartu Metrik */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-medium text-muted">Rata-rata Tempo</p>
          <p className="mt-1 font-serif text-xl font-bold text-navy-900">
            {summary?.wpm_rata_rata != null ? `${Math.round(summary.wpm_rata_rata)} WPM` : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700">Ideal (110 – 150 WPM)</p>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-medium text-muted">Rasio Jeda / Variasi Pitch</p>
          <p className="mt-1 font-serif text-xl font-bold text-navy-900">
            {summary?.rasio_jeda_persen != null
              ? `${summary.rasio_jeda_persen.toFixed(1)}%`
              : summary?.pitch_rata_rata_hz != null
                ? `${Math.round(summary.pitch_rata_rata_hz)} Hz`
                : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {summary?.rasio_jeda_persen != null
              ? "Target jeda hening < 20%"
              : "Rentang normal prosodi"}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-medium text-muted">Stabilitas Volume &amp; ASR</p>
          <p className="mt-1 font-serif text-xl font-bold text-navy-900">
            {summary?.intensitas_rata_rata_db != null
              ? `${Math.round(summary.intensitas_rata_rata_db)} dB`
              : summary?.stabilitas_volume_rms != null
                ? `RMS ${summary.stabilitas_volume_rms.toFixed(3)}`
                : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700">
            Validitas ASR{" "}
            {summary?.validitas_asr_persen != null
              ? `${summary.validitas_asr_persen.toFixed(1)}%`
              : "Baik"}
          </p>
        </div>
      </div>

      {narasi && (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-xs leading-relaxed text-muted">
          {narasi}
        </p>
      )}
    </div>
  );
}
