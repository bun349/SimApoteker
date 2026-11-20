import { supabase } from "@/lib/supabase";
import { PAGE_SIZE, SORTS, STATUS_GROUPS, tabOf } from "@/lib/skenario";
import type { Skenario, SkenarioPage, SkenarioQuery, TabKey } from "@/types/skenario";

const COLS =
  "id, kode_skenario, versi, status_rilis, judul, jenis, memuat_ddi, fokus_kie, instruksi_tugas, progres_langkah, frozen_at, updated_at, kunci_konten";

interface Row {
  id: string;
  kode_skenario: string;
  versi: string;
  status_rilis: string;
  judul: string;
  jenis: string;
  memuat_ddi: boolean;
  fokus_kie: string | null;
  instruksi_tugas: string | null;
  progres_langkah: number;
  frozen_at: string | null;
  updated_at: string;
  kunci_konten: unknown;
}

// Asumsi: kunci_konten = { kelompok: [butir, ...] }. Sesuaikan jika struktur JSON Anda berbeda.
function countButir(k: unknown): number {
  if (!k || typeof k !== "object") return 0;
  return Object.values(k).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 1), 0);
}

const toSkenario = (r: Row): Skenario => ({
  id: r.id,
  kode: r.kode_skenario,
  versi: r.versi,
  status: r.status_rilis,
  judul: r.judul,
  jenis: r.jenis,
  memuatDdi: r.memuat_ddi,
  deskripsi: r.fokus_kie ?? r.instruksi_tugas ?? "",
  progresLangkah: r.progres_langkah,
  beku: !!r.frozen_at,
  updatedAt: r.updated_at,
  butir: countButir(r.kunci_konten),
});

export async function fetchSkenario(ownerId: string, q: SkenarioQuery): Promise<SkenarioPage> {
  const from = (q.page - 1) * PAGE_SIZE;

  let query = supabase
    .from("skenario_praktikum")
    .select(COLS, { count: "exact" })
    .eq("id_dosen_penyusun", ownerId)
    .in("status_rilis", STATUS_GROUPS[q.tab]);

  if (q.jenis !== "semua") query = query.eq("jenis", q.jenis);

  // Buang karakter yang merusak sintaks filter PostgREST
  const term = q.search.trim().replace(/[%,()*]/g, " ").trim();
  if (term) {
    query = query.or(
      `judul.ilike.%${term}%,kode_skenario.ilike.%${term}%,fokus_kie.ilike.%${term}%,instruksi_tugas.ilike.%${term}%`
    );
  }

  const s = SORTS[q.sort];
  const { data, error, count } = await query
    .order(s.col, { ascending: s.asc })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;
  return { items: ((data ?? []) as Row[]).map(toSkenario), total: count ?? 0 };
}

// UBAH: Sesuaikan property dengan TabKey terbaru ("diterbitkan" dan "beku")
export interface TabCounts {
  diterbitkan: number;
  draf: number;
  beku: number;
  arsip: number;
  total: number;
}

export async function fetchTabCounts(ownerId: string): Promise<TabCounts> {
  const { data, error } = await supabase
    .from("skenario_praktikum")
    .select("status_rilis")
    .eq("id_dosen_penyusun", ownerId);
  
  if (error) throw error;

  // UBAH: Inisialisasi awal menggunakan key yang baru
  const counts: TabCounts = { diterbitkan: 0, draf: 0, beku: 0, arsip: 0, total: 0 };
  
  for (const r of (data ?? []) as { status_rilis: string }[]) {
    // Fungsi tabOf dari @/lib/skenario akan memastikan status_rilis di-map ke TabKey yang valid
    counts[tabOf(r.status_rilis) as TabKey] += 1;
    counts.total += 1;
  }
  
  return counts;
}

export async function setStatusRilis(ownerId: string, id: string, status: string) {
  const { error } = await supabase
    .from("skenario_praktikum")
    .update({ status_rilis: status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("id_dosen_penyusun", ownerId);
  if (error) throw error;
}

export async function updateModeRilis(ownerId: string, id: string, modes: string[]) {
  const { error } = await supabase
    .from("skenario_praktikum")
    .update({ 
      mode_rilis: modes, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)
    .eq("id_dosen_penyusun", ownerId);
    
  if (error) {
    console.error("Gagal update mode rilis:", error);
    throw new Error("Gagal mengubah akses rilis. Periksa koneksi Anda.");
  }
}