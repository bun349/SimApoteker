export type TabKey = "draf" | "beku" | "arsip" | "diterbitkan";
export type SortKey = "terbaru" | "judul" | "kode";

export interface Skenario {
  id: string;
  kode: string;
  versi: string;
  status: string;
  judul: string;
  jenis: string;
  memuatDdi: boolean;
  deskripsi: string;
  progresLangkah: number;
  beku: boolean;
  updatedAt: string; 
  butir: number;
}

export interface SkenarioQuery {
  tab: TabKey;
  search: string;
  jenis: string; 
  sort: SortKey;
  page: number;
}

export interface SkenarioPage {
  items: Skenario[];
  total: number;
}