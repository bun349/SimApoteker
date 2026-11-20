export const MAX_ROWS = 30;
export const MIN_BUTIR = 10;
export const ID_RE = /^K-\d{2}$/;

export const KATEGORI = [
  "Prosedur",
  "Penanganan Interaksi Obat (DDI)",
  "Kelengkapan Informasi",
] as const;

export const BOBOT = [
  { value: 1, label: "Pelengkap (1)" },
  { value: 2, label: "Penting (2)" },
  { value: 3, label: "Kritis (3)" },
];

export interface RubrikRow {
  key: string;
  id: string;
  kategori: string;
  bobot: number; // 0 = belum dipilih
  butir: string;
  komponen: string; // dipisah ';'
  alternatif: string;
  keliru: string;
  rujukan: string;
}
export interface Step6Form { rows: RubrikRow[] }

const uid = () => Math.random().toString(36).slice(2, 10);
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export const normalizeId = (s: string) => s.toUpperCase().replace(/[^K0-9-]/g, "").slice(0, 4);
export const splitList = (s: string) => s.split(";").map((x) => x.trim()).filter(Boolean);

export function nextId(rows: { id: string }[]): string {
  const used = new Set(rows.map((r) => r.id));
  for (let i = 1; i < 100; i++) {
    const id = `K-${String(i).padStart(2, "0")}`;
    if (!used.has(id)) return id;
  }
  return "";
}

export const newRow = (rows: RubrikRow[] = [], p: Partial<RubrikRow> = {}): RubrikRow => ({
  key: uid(), id: nextId(rows), kategori: "", bobot: 0,
  butir: "", komponen: "", alternatif: "", keliru: "", rujukan: "", ...p,
});

const asText = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").join("; ") : typeof v === "string" ? v : "";

export function parseStep6(kunci: Record<string, unknown>): Step6Form {
  const raw = Array.isArray(kunci.butir) ? kunci.butir : [];
  const rows: RubrikRow[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    rows.push(
      newRow(rows, {
        id: typeof x.id === "string" && x.id ? x.id : nextId(rows),
        kategori: typeof x.kategori === "string" ? x.kategori : "",
        bobot: typeof x.bobot === "number" ? x.bobot : 0,
        butir: typeof x.butir === "string" ? x.butir : "",
        komponen: asText(x.komponen),
        alternatif: asText(x.alternatif),
        keliru: asText(x.keliru),
        rujukan: typeof x.rujukan === "string" ? x.rujukan : "",
      }),
    );
  }
  return { rows: rows.length ? rows : [newRow()] };
}

export const isBlank = (r: RubrikRow) =>
  !r.kategori && !r.bobot && !r.butir.trim() && !r.komponen.trim() &&
  !r.alternatif.trim() && !r.keliru.trim() && !r.rujukan.trim();

// Menimpa hanya kunci "butir"; kunci lain di kunci_konten dipertahankan
export function buildKunci(existing: Record<string, unknown>, f: Step6Form): Record<string, unknown> {
  return {
    ...existing,
    butir: f.rows.filter((r) => !isBlank(r)).map((r) => ({
      id: r.id.trim(),
      kategori: r.kategori,
      bobot: r.bobot,
      butir: r.butir.trim(),
      komponen: splitList(r.komponen),
      alternatif: splitList(r.alternatif),
      keliru: splitList(r.keliru),
      rujukan: r.rujukan.trim(),
    })),
  };
}

export function dupIds(f: Step6Form): Set<string> {
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const r of f.rows) {
    const id = r.id.trim();
    if (!id) continue;
    if (seen.has(id)) { dup.add(r.key); dup.add(seen.get(id)!); } else seen.set(id, r.key);
  }
  return dup;
}

const kategoriOk = (k: string) => (KATEGORI as readonly string[]).includes(k);

export const rowComplete = (r: RubrikRow, dup: Set<string>) =>
  ID_RE.test(r.id) && !dup.has(r.key) && kategoriOk(r.kategori) &&
  r.butir.trim().length >= MIN_BUTIR && splitList(r.komponen).length > 0 &&
  r.bobot >= 1 && r.bobot <= 3;

export function step6Checks(f: Step6Form) {
  const used = f.rows.filter((r) => !isBlank(r));
  const dup = dupIds(f);
  return [
    {
      label: "Butir Rubrik Didefinisikan",
      ok: used.length > 0 && used.every((r) =>
        ID_RE.test(r.id) && !dup.has(r.key) && kategoriOk(r.kategori) && r.butir.trim().length >= MIN_BUTIR),
    },
    {
      label: "Komponen Wajib Terisi",
      ok: used.length > 0 && used.every((r) => splitList(r.komponen).length > 0),
    },
    {
      label: "Tingkat Bobot Ditetapkan",
      ok: used.length > 0 && used.every((r) => r.bobot >= 1 && r.bobot <= 3),
    },
    {
      label: "Minimal 1 Butir Prosedur & Kelengkapan Dibuat",
      ok: used.some((r) => r.kategori === "Prosedur" || r.kategori === "Kelengkapan Informasi"),
    },
  ];
}