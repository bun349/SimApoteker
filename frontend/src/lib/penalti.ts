export const MAX_ROWS = 20;
export const ID_RE = /^KK-\d{2}$/;
export const MIN_JUDUL = 5;
export const MIN_TEXT = 15;
export const KOREKSI_MAKS_GILIRAN = 2;

export const KATEGORI = [
  "Prosedur",
  "Kelengkapan Informasi",
  "Penanganan Interaksi Obat (DDI)",
] as const;
export const GLOBAL = "Global (Seluruh Nilai)";

export interface PenaltiRow {
  key: string;
  id: string;
  judul: string;
  kategori: string;
  gagal: boolean; // true = -100% (gagal total)
  poin: number;   // 0 = belum ditetapkan
  deskripsi: string;
  kriteria: string;
  koreksi: boolean;
}
export interface Step7Form { rows: PenaltiRow[] }

const uid = () => Math.random().toString(36).slice(2, 10);
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export const normalizeId = (s: string) => s.toUpperCase().replace(/[^K0-9-]/g, "").slice(0, 5);

export function nextId(rows: { id: string }[]): string {
  const used = new Set(rows.map((r) => r.id));
  for (let i = 1; i < 100; i++) {
    const id = `KK-${String(i).padStart(2, "0")}`;
    if (!used.has(id)) return id;
  }
  return "";
}

export const newRow = (rows: PenaltiRow[] = [], p: Partial<PenaltiRow> = {}): PenaltiRow => ({
  key: uid(), id: nextId(rows), judul: "", kategori: "", gagal: false, poin: 0,
  deskripsi: "", kriteria: "", koreksi: false, ...p,
});

export function parseStep7(kk: Record<string, unknown>): Step7Form {
  const raw = Array.isArray(kk.butir) ? kk.butir : [];
  const rows: PenaltiRow[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    const s = (k: string) => (typeof x[k] === "string" ? (x[k] as string) : "");
    const gagal = x.gagal === true;
    rows.push(
      newRow(rows, {
        id: s("id") || nextId(rows),
        judul: s("judul"),
        kategori: gagal ? GLOBAL : s("kategori"),
        gagal,
        poin: typeof x.poin === "number" ? x.poin : 0,
        deskripsi: s("deskripsi"),
        kriteria: s("kriteria"),
        koreksi: !gagal && x.koreksi === true,
      }),
    );
  }
  return { rows: rows.length ? rows : [newRow()] };
}

export const isBlank = (r: PenaltiRow) =>
  !r.judul.trim() && !r.deskripsi.trim() && !r.kriteria.trim() && !r.kategori && !r.gagal && !r.poin;

// Hanya menimpa kunci "butir"; kunci lain dipertahankan
export function buildKesalahan(existing: Record<string, unknown>, f: Step7Form): Record<string, unknown> {
  return {
    ...existing,
    butir: f.rows.filter((r) => !isBlank(r)).map((r) => ({
      id: r.id.trim(),
      judul: r.judul.trim(),
      kategori: r.gagal ? GLOBAL : r.kategori,
      gagal: r.gagal,
      poin: r.gagal ? 100 : r.poin,
      deskripsi: r.deskripsi.trim(),
      kriteria: r.kriteria.trim(),
      koreksi: r.gagal ? false : r.koreksi,
      koreksi_maks_giliran: KOREKSI_MAKS_GILIRAN,
    })),
  };
}

export function dupIds(f: Step7Form): Set<string> {
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const r of f.rows) {
    const id = r.id.trim();
    if (!id) continue;
    if (seen.has(id)) { dup.add(r.key); dup.add(seen.get(id)!); } else seen.set(id, r.key);
  }
  return dup;
}

const kategoriOk = (r: PenaltiRow) =>
  r.gagal || (KATEGORI as readonly string[]).includes(r.kategori);
const poinOk = (r: PenaltiRow) => r.gagal || (r.poin >= 1 && r.poin <= 100);

export const rowComplete = (r: PenaltiRow, dup: Set<string>) =>
  ID_RE.test(r.id) && !dup.has(r.key) && r.judul.trim().length >= MIN_JUDUL &&
  r.deskripsi.trim().length >= MIN_TEXT && r.kriteria.trim().length >= MIN_TEXT &&
  kategoriOk(r) && poinOk(r);

// Penalti maksimal: gagal total = 100%, selain itu jumlah poin dibatasi 100
export function maxPenalty(f: Step7Form): number {
  const used = f.rows.filter((r) => !isBlank(r));
  if (used.some((r) => r.gagal)) return 100;
  return Math.min(100, used.reduce((n, r) => n + r.poin, 0));
}

export function step7Checks(f: Step7Form) {
  const used = f.rows.filter((r) => !isBlank(r));
  const dup = dupIds(f);
  return [
    {
      label: "Kesalahan Kritis Didefinisikan",
      ok: used.length > 0 && used.every((r) =>
        ID_RE.test(r.id) && !dup.has(r.key) && r.judul.trim().length >= MIN_JUDUL &&
        r.deskripsi.trim().length >= MIN_TEXT),
    },
    {
      label: "Syarat Penalti Ditetapkan",
      ok: used.length > 0 && used.every((r) => r.kriteria.trim().length >= MIN_TEXT),
    },
    {
      label: "Besaran Pemotongan Nilai Valid",
      ok: used.length > 0 && used.every((r) => kategoriOk(r) && poinOk(r)),
    },
  ];
}