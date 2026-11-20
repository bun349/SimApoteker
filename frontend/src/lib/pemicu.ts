export const MAX_ROWS = 8;
export const MIN_TEXT = 5;

export const SYARAT_PAMIT =
  "Sesi dapat diakhiri ketika seluruh pemicu (Cue, Probe, IK) telah tergali DAN mahasiswa telah menyampaikan Rencana Tindak Lanjut.";

export const JENIS_CUE = ["Jelas", "Samar"];
export const SIFAT_PROBE = ["Wajib", "Opsional"];
export const MODE_IK = ["Bila Ditanya", "Langsung"];

export interface CueRow { key: string; kalimat: string; jenis: string; kapan: string }
export interface ProbeRow { key: string; kalimat: string; sifat: string; kapan: string }
export interface IkRow { key: string; hal: string; mode: string }

export interface Step4Form {
  cues: CueRow[];
  probes: ProbeRow[];
  iks: IkRow[];
}

const uid = () => Math.random().toString(36).slice(2, 10);
export const newCue = (): CueRow => ({ key: uid(), kalimat: "", jenis: JENIS_CUE[0], kapan: "" });
export const newProbe = (): ProbeRow => ({ key: uid(), kalimat: "", sifat: SIFAT_PROBE[0], kapan: "" });
export const newIk = (): IkRow => ({ key: uid(), hal: "", mode: MODE_IK[1] });

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (o: Record<string, unknown>, k: string, d = "") => (typeof o[k] === "string" ? (o[k] as string) : d);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseStep4(cfg: Record<string, unknown>): Step4Form {
  const cues = list(cfg.isyarat_emosi).map((x): CueRow => {
    const o = isObj(x) ? x : { kalimat: String(x) };
    return { key: uid(), kalimat: str(o, "kalimat"), jenis: str(o, "jenis", JENIS_CUE[0]), kapan: str(o, "kapan") };
  });
  const probes = list(cfg.probe_bingung).map((x): ProbeRow => {
    const o = isObj(x) ? x : { kalimat: String(x) };
    return { key: uid(), kalimat: str(o, "kalimat"), sifat: str(o, "sifat", SIFAT_PROBE[0]), kapan: str(o, "kapan") };
  });
  const iks = list(cfg.informasi_kunci).map((x): IkRow => {
    const o = isObj(x) ? x : { hal: String(x) };
    return { key: uid(), hal: str(o, "hal"), mode: str(o, "mode", MODE_IK[1]) };
  });
  return {
    cues: cues.length ? cues : [newCue()],
    probes: probes.length ? probes : [newProbe()],
    iks: iks.length ? iks : [newIk()],
  };
}

const code = (p: string, i: number) => `${p}-${String(i + 1).padStart(2, "0")}`;

export function buildPemicu(existing: Record<string, unknown>, f: Step4Form): Record<string, unknown> {
  const t = (s: string) => s.trim();
  return {
    ...existing, // urutan_pemicu dan kunci lain tidak disentuh
    isyarat_emosi: f.cues.filter((c) => t(c.kalimat)).map((c, i) => ({
      kode: code("CUE", i), kalimat: t(c.kalimat), jenis: c.jenis, kapan: t(c.kapan),
    })),
    probe_bingung: f.probes.filter((p) => t(p.kalimat)).map((p, i) => ({
      kode: code("PRB", i), kalimat: t(p.kalimat), sifat: p.sifat, kapan: t(p.kapan),
    })),
    informasi_kunci: f.iks.filter((k) => t(k.hal)).map((k, i) => ({
      kode: code("IK", i), hal: t(k.hal), mode: k.mode,
    })),
    syarat_pamit: SYARAT_PAMIT,
  };
}

// Baris yang sebagian terisi dianggap belum valid; baris kosong total diabaikan
const rowsOk = (rows: { text: string; kapan?: string }[]) => {
  const used = rows.filter((r) => r.text.trim() || (r.kapan ?? "").trim());
  return used.length > 0 && used.every((r) => r.text.trim().length >= MIN_TEXT);
};

export const step4Checks = (f: Step4Form) => [
  { label: "Isyarat Emosi (Cue) Terisi", ok: rowsOk(f.cues.map((c) => ({ text: c.kalimat, kapan: c.kapan }))) },
  { label: "Probe Pasien Ditetapkan", ok: rowsOk(f.probes.map((p) => ({ text: p.kalimat, kapan: p.kapan }))) },
  { label: "Informasi Kunci Ditetapkan", ok: rowsOk(f.iks.map((k) => ({ text: k.hal }))) },
  { label: "Akhir Sesi (Pamit) Ditetapkan", ok: true }, // aturan baku dari sistem
];