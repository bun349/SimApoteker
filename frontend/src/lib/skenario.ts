import type { SortKey, TabKey } from "@/types/skenario";

export const PAGE_SIZE = 6;
export const TOTAL_LANGKAH = 8;

export const STATUS_GROUPS: Record<TabKey, string[]> = {
  diterbitkan: ["diterbitkan"],
  draf: ["draf"], 
  beku: ["beku"],
  arsip: ["arsip"],
};
export const STATUS_DITERBITKAN = "diterbitkan";
export const STATUS_DRAF = "draf";
export const STATUS_BEKU = "beku";
export const STATUS_ARSIP = "arsip";

export const TAB_LABEL: Record<TabKey, string> = {
  diterbitkan: "Rilis Resmi (Siap Pakai)",
  draf: "Draf & Revisi",
  beku: "Skenario Beku",
  arsip: "Arsip",
};

export const tabOf = (status: string): TabKey =>
  (Object.keys(STATUS_GROUPS) as TabKey[]).find((t) => STATUS_GROUPS[t].includes(status)) ?? "draf";

// Disesuaikan dengan nilai enum jenis_skenario_enum di database
export const JENIS_META: Record<string, { label: string; dot: string }> = {
  swamedikasi: { label: "Swamedikasi", dot: "bg-lime-600" },
  resep_akut: { label: "Resep Akut", dot: "bg-sky-500" },
  resep_kronis: { label: "Resep Kronis", dot: "bg-amber-500" },
};

export const jenisMeta = (j: string) =>
  JENIS_META[j] ?? {
    label: j.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    dot: "bg-gray-400",
  };

export const SORTS: Record<SortKey, { col: string; asc: boolean; label: string }> = {
  terbaru: { col: "updated_at", asc: false, label: "Terakhir Diperbarui" },
  judul: { col: "judul", asc: true, label: "Judul (A–Z)" },
  kode: { col: "kode_skenario", asc: true, label: "Kode Skenario" },
};