export const MAX_ROWS = 50;
export const MIN_TEXT = 2;

export interface KamusRow { key: string; istilah: string; padanan: string }
export interface Step5Form { rows: KamusRow[] }

const uid = () => Math.random().toString(36).slice(2, 10);
export const newRow = (p: Partial<KamusRow> = {}): KamusRow => ({
  key: uid(), istilah: "", padanan: "", ...p,
});

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export function parseStep5(raw: unknown): Step5Form {
  const rows = (Array.isArray(raw) ? raw : []).map((x): KamusRow => {
    const o = isObj(x) ? x : { istilah: String(x) };
    const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
    return newRow({ istilah: s("istilah"), padanan: s("padanan") });
  });
  return { rows: rows.length ? rows : [newRow()] };
}

export const buildKamus = (f: Step5Form) =>
  f.rows
    .filter((r) => r.istilah.trim())
    .map((r) => ({ istilah: r.istilah.trim(), padanan: r.padanan.trim() }));

const used = (f: Step5Form) => f.rows.filter((r) => r.istilah.trim() || r.padanan.trim());
// key baris yang istilahnya kembar (tidak membedakan huruf besar/kecil)
export function duplicateKeys(f: Step5Form): Set<string> {
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const r of f.rows) {
    const k = r.istilah.trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) { dup.add(r.key); dup.add(seen.get(k)!); } else seen.set(k, r.key);
  }
  return dup;
}

export const step5Checks = (f: Step5Form) => {
  const u = used(f);
  const dup = duplicateKeys(f);
  return [
    {
      label: "Istilah Tambahan Diidentifikasi",
      ok: u.length > 0 && u.every((r) => r.istilah.trim().length >= MIN_TEXT && !dup.has(r.key)),
    },
    {
      label: "Padanan Awam Ditetapkan",
      ok: u.length > 0 && u.every((r) => r.padanan.trim().length >= MIN_TEXT),
    },
  ];
};

// Impor CSV: kolom istilah, padanan, butir. Pemisah koma, titik koma, atau tab.
export function parseCsv(text: string): Omit<KamusRow, "key">[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delim = [";", "\t", ","].find((d) => lines[0].includes(d)) ?? ",";

  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
      } else if (ch === delim && !quoted) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const rows = lines.map(split);
  const start = /istilah/i.test(rows[0][0]) ? 1 : 0; // lewati baris judul
  return rows
    .slice(start)
    .filter((r) => r[0])
    .map((r) => ({ istilah: r[0], padanan: r[1] ?? "" }));
}