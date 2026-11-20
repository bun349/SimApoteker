import { supabase } from "@/lib/supabase";

export interface KelasDropdown {
  id: string;
  nama_kelas: string;
}

export interface SkenarioDropdown {
  id: string;
  kode_skenario: string;
  judul: string;
  versi: string;
}

export interface TugasPraktikum {
  id: string;
  deadline: string;
  status: string;
  skenario: { kode_skenario: string; judul: string; versi: string };
  kelas: { nama_kelas: string };
}

// 1. Ambil daftar kelas milik dosen ini
export async function fetchKelasDosen(dosenId: string): Promise<KelasDropdown[]> {
  const { data, error } = await supabase
    .from("kelas")
    .select("id, nama_kelas")
    .eq("id_dosen", dosenId)
    .order("nama_kelas", { ascending: true });
    
  if (error) throw new Error("Gagal mengambil data kelas.");
  return data || [];
}

// 2. Ambil skenario yang rilis dan memuat tag 'praktikum'
export async function fetchSkenarioPraktikum(dosenId: string): Promise<SkenarioDropdown[]> {
  const { data, error } = await supabase
    .from("skenario_praktikum")
    .select("id, kode_skenario, judul, versi")
    .eq("id_dosen_penyusun", dosenId)
    .eq("status_rilis", "diterbitkan")
    .not("frozen_at", "is", null)
    .contains("mode_rilis", ["praktikum"]) // HANYA ambil yang mode-nya praktikum
    .order("created_at", { ascending: false });
    
  if (error) throw new Error("Gagal mengambil daftar skenario.");
  return data || [];
}

// 3. Ambil daftar tugas yang sudah didistribusikan
export async function fetchDaftarTugas(dosenId: string): Promise<TugasPraktikum[]> {
  const { data, error } = await supabase
    .from("tugas_praktikum")
    .select(`
      id, deadline, status,
      skenario:skenario_praktikum(kode_skenario, judul, versi),
      kelas:kelas(nama_kelas)
    `)
    .eq("id_dosen_penugasan", dosenId)
    .order("created_at", { ascending: false });
    
  if (error) throw new Error("Gagal mengambil daftar penugasan.");
  
  // Normalisasi hasil join dari Supabase
  return (data || []).map((d: any) => ({
    ...d,
    skenario: Array.isArray(d.skenario) ? d.skenario[0] : d.skenario,
    kelas: Array.isArray(d.kelas) ? d.kelas[0] : d.kelas,
  }));
}

// 4. Simpan tugas baru
export async function createTugas(
  dosenId: string,
  payload: { id_skenario: string; id_kelas: string; deadline: string }
) {
  const { error } = await supabase
    .from("tugas_praktikum")
    .insert({
      id_skenario: payload.id_skenario,
      id_kelas: payload.id_kelas,
      deadline: new Date(payload.deadline).toISOString(),
      id_dosen_penugasan: dosenId,
      status: "Aktif",
    });
    
  if (error) throw new Error("Gagal membuat tugas praktikum.");
}

// 5. Ubah status (Aktif/Selesai/Arsip)
export async function updateStatusTugas(id: string, dosenId: string, status: string) {
  const { error } = await supabase
    .from("tugas_praktikum")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("id_dosen_penugasan", dosenId);
    
  if (error) throw new Error("Gagal mengubah status tugas.");
}