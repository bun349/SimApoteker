export const MIN_KOM = 10; // PaCT minimal 10%
export const MAX_KOM = 50; // Klinis minimal 50%
export const DEFAULT_KOM = 20;

export const PRESETS = [
  { kom: 15, label: "15% : 85%" },
  { kom: 20, label: "20% : 80% (Standar)" },
  { kom: 30, label: "30% : 70%" },
];

export type ModeRilis = "praktikum" | "mandiri";
export const MODES: { key: ModeRilis; title: string; desc: string }[] = [
  {
    key: "praktikum",
    title: "Bank Praktikum Terjadwal",
    desc: "Sesi dinilai resmi dengan rubrik PaCT dan ditinjau dosen penguji.",
  },
  {
    key: "mandiri",
    title: "Bank Latihan Mandiri",
    desc: "Tanpa penilaian resmi. Mahasiswa mendapat umpan balik formatif dari AI.",
  },
];

export interface Step8Form { kom: number; modes: ModeRilis[] }

export function parseStep8(kom: number, modes: string[]): Step8Form {
  const k = Number.isFinite(kom) ? kom : DEFAULT_KOM;
  return {
    kom: Math.min(MAX_KOM, Math.max(MIN_KOM, Math.round(k / 5) * 5)),
    modes: modes.filter((m): m is ModeRilis => m === "praktikum" || m === "mandiri"),
  };
}

export const klinisOf = (kom: number) => 100 - kom;
export const rasioOk = (kom: number) => kom >= MIN_KOM && kom <= MAX_KOM;

// 0.1 -> 1.0 saat pertama kali dirilis; versi lain dipertahankan
export const targetVersi = (v: string) => (/^0\./.test(v) ? "1.0" : v);

export function step8Checks(f: Step8Form, allStepsOk: boolean) {
  const rasio = rasioOk(f.kom);
  return [
    { label: "Rasio Bobot Ditetapkan", ok: rasio },
    { label: "Validasi Seluruh Langkah Aman", ok: allStepsOk },
    { label: "Skenario Siap Diterbitkan", ok: rasio && allStepsOk && f.modes.length > 0 },
  ];
}