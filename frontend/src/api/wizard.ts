import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { STATUS_DRAF, STATUS_GROUPS, STATUS_ARSIP } from "@/lib/skenario";

export interface Draft {
  id: string;
  kode: string;
  versi: string;
  status: string;
  judul: string;
  jenis: string;
  progres: number;
  beku: boolean;
  createdAt: string;
  profil: Record<string, unknown>;
  kalimat: string;
  klinis: Record<string, unknown>;
  butir: string[];
  pemicu: Record<string, unknown>;
  kamus: unknown;
  kunci: Record<string, unknown>;
  kesalahan: Record<string, unknown>;
  bobotKomunikasi: number;
  modeRilis: string[];
  riwayatAlergi: string;
  kondisiPenyerta: string;
  obatLainSuplemen: string[];
  interaksiDitanam: string;
  memuatDdi: boolean;
}

export interface DraftPatch {
  kode?: string;
  jenis?: string;
  judul?: string;
  progres?: number;
  profil?: Record<string, unknown>;
  kalimat?: string;
  klinis?: Record<string, unknown>;
  butir?: string[];
  pemicu?: Record<string, unknown>;
  kamus?: unknown[];
  kunci?: Record<string, unknown>;
  kesalahan?: Record<string, unknown>;
  bobotKomunikasi?: number;
  bobotKonten?: number;
  modeRilis?: string[];
  riwayatAlergi?: string;
  kondisiPenyerta?: string;
  finalize?: { versi: string };
  obatLainSuplemen?: string[];
  interaksiDitanam?: string;
  memuatDdi?: boolean;
}

const COLS =
  "id, kode_skenario, versi, status_rilis, judul, jenis, progres_langkah, frozen_at, created_at, profil_pasien, kalimat_pembuka, riwayat_alergi, kondisi_penyerta, data_klinis_khusus, butir_tidak_berlaku, konfigurasi_pemicu, kamus_tambahan, kunci_konten, kesalahan_kritis, bobot_komunikasi, mode_rilis,obat_lain_suplemen, interaksi_ditanam, memuat_ddi";

interface Row {
  id: string;
  kode_skenario: string;
  versi: string;
  status_rilis: string;
  judul: string;
  jenis: string;
  progres_langkah: number;
  frozen_at: string | null;
  created_at: string;
  profil_pasien: Record<string, unknown> | null;
  kalimat_pembuka: string | null;
  riwayat_alergi: string | null;
  kondisi_penyerta: string | null;
  data_klinis_khusus: Record<string, unknown> | null;
  butir_tidak_berlaku: string[] | null;
  konfigurasi_pemicu: Record<string, unknown> | null;
  kamus_tambahan: unknown | null;
  kunci_konten: Record<string, unknown> | null;
  kesalahan_kritis: Record<string, unknown> | null;
  bobot_komunikasi: number | null;
  mode_rilis: string[] | null;
  obat_lain_suplemen: string[] | null;
  interaksi_ditanam: string | null;
  memuat_ddi: boolean | null;
}

const parseObatLain = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          const nama = typeof rec.obat === "string" ? rec.obat : typeof rec.nama === "string" ? rec.nama : "";
          return nama.trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const toDraft = (r: Row): Draft => ({
  id: r.id,
  kode: r.kode_skenario,
  versi: r.versi,
  status: r.status_rilis,
  judul: r.judul,
  jenis: r.jenis,
  progres: r.progres_langkah,
  beku: !!r.frozen_at,
  createdAt: r.created_at,
  profil: r.profil_pasien ?? {},
  kalimat: r.kalimat_pembuka ?? "",
  riwayatAlergi: r.riwayat_alergi ?? "",
  kondisiPenyerta: r.kondisi_penyerta ?? "",
  klinis: r.data_klinis_khusus ?? {},
  butir: Array.isArray(r.butir_tidak_berlaku) ? r.butir_tidak_berlaku : [],
  pemicu: r.konfigurasi_pemicu ?? {},
  kamus: r.kamus_tambahan ?? [],
  kunci: r.kunci_konten ?? {},
  kesalahan: r.kesalahan_kritis ?? {},
  bobotKomunikasi: Number(r.bobot_komunikasi ?? 20),
  modeRilis: r.mode_rilis ?? [],
  obatLainSuplemen: parseObatLain(r.obat_lain_suplemen),
  interaksiDitanam: typeof r.interaksi_ditanam === "string" ? r.interaksi_ditanam : "",
  memuatDdi: r.memuat_ddi === true || Boolean(r.interaksi_ditanam && r.interaksi_ditanam.trim()),
});

function fail(e: PostgrestError): Error {
  if (e.code === "23505") return new Error("Kode dan versi skenario ini sudah dipakai.");
  if (e.code === "23503") return new Error("Akun Anda belum terdaftar di tabel pengguna sebagai dosen penyusun.");
  if (e.code === "42501") return new Error("Anda tidak punya izin untuk menyimpan skenario ini.");
  if (e.code === "PGRST116") return new Error("Skenario tidak dapat diubah (sudah dirilis atau dibekukan).");
  return new Error("Gagal menyimpan ke server. Periksa koneksi lalu coba lagi.");
}

export async function fetchDraft(id: string, ownerId: string): Promise<Draft | null> {
  const { data, error } = await supabase
    .from("skenario_praktikum")
    .select(COLS)
    .eq("id", id)
    .eq("id_dosen_penyusun", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? toDraft(data as Row) : null;
}

export async function createDraft(
  ownerId: string,
  v: { kode: string; jenis: string; judul: string; progres: number },
): Promise<Draft> {
  const { data, error } = await supabase
    .from("skenario_praktikum")
    .insert({
      kode_skenario: v.kode,
      jenis: v.jenis,
      judul: v.judul,
      status_rilis: STATUS_DRAF,
      progres_langkah: v.progres,
      kalimat_pembuka: "",
      id_dosen_penyusun: ownerId,
    })
    .select(COLS)
    .single();
  if (error) throw fail(error);
  return toDraft(data as Row);
}

export async function updateDraft(id: string, ownerId: string, p: DraftPatch): Promise<Draft> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.kode !== undefined) row.kode_skenario = p.kode;
  if (p.jenis !== undefined) row.jenis = p.jenis;
  if (p.judul !== undefined) row.judul = p.judul;
  if (p.progres !== undefined) row.progres_langkah = p.progres;
  if (p.profil !== undefined) row.profil_pasien = p.profil;
  if (p.kalimat !== undefined) row.kalimat_pembuka = p.kalimat;
  if (p.riwayatAlergi !== undefined) row.riwayat_alergi = p.riwayatAlergi.trim() || "Tidak ada";
  if (p.kondisiPenyerta !== undefined) row.kondisi_penyerta = p.kondisiPenyerta.trim() || "Tidak ada";
  if (p.klinis !== undefined) row.data_klinis_khusus = p.klinis;
  if (p.butir !== undefined) row.butir_tidak_berlaku = p.butir;
  if (p.pemicu !== undefined) row.konfigurasi_pemicu = p.pemicu;
  if (p.kamus !== undefined) row.kamus_tambahan = p.kamus;
  if (p.kunci !== undefined) row.kunci_konten = p.kunci;
  if (p.kesalahan !== undefined) row.kesalahan_kritis = p.kesalahan;
  if (p.obatLainSuplemen !== undefined) {
    row.obat_lain_suplemen = p.obatLainSuplemen.map((s) => s.trim()).filter(Boolean);
  }
  if (p.interaksiDitanam !== undefined) {
    const trimmedInteraksi = p.interaksiDitanam.trim();
    row.interaksi_ditanam = trimmedInteraksi || null;
    // Jika ada interaksi ditanam, memuat_ddi otomatis true; jika tidak, pakai flag eksplisit jika ada atau false
    row.memuat_ddi = trimmedInteraksi.length > 0 ? true : Boolean(p.memuatDdi);
  } else if (p.memuatDdi !== undefined) {
    row.memuat_ddi = p.memuatDdi;
  }
  if (p.bobotKomunikasi !== undefined && p.bobotKonten !== undefined) {
    // keduanya selalu dikirim bersama agar constraint total 100 terpenuhi
    row.bobot_komunikasi = p.bobotKomunikasi;
    row.bobot_konten = p.bobotKonten;
  }
  if (p.modeRilis !== undefined) row.mode_rilis = p.modeRilis;
  if (p.finalize) {
    row.status_rilis = STATUS_GROUPS.diterbitkan[0];
    row.frozen_at = new Date().toISOString();
    row.versi = p.finalize.versi;
    row.progres_langkah = 8;
  }

  const { data, error } = await supabase
    .from("skenario_praktikum")
    .update(row)
    .eq("id", id)
    .eq("id_dosen_penyusun", ownerId)
    .in("status_rilis", STATUS_GROUPS.draf) // rilis/arsip tidak boleh diubah dari wizard
    .is("frozen_at", null)
    .select(COLS)
    .single();
  if (error) throw fail(error);
  return toDraft(data as Row);
}

export async function isKodeAvailable(kode: string, excludeId?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("kode_skenario_tersedia", {
    p_kode: kode,
    p_exclude: excludeId ?? null,
  });
  if (error) throw error;
  return data as boolean;
}

export async function deleteSkenario(id: string, ownerId: string): Promise<void> {
  const { error } = await supabase
    .from("skenario_praktikum")
    .delete()
    .eq("id", id)
    .eq("id_dosen_penyusun", ownerId)
    .is("frozen_at", null);

  if (error) {
    console.error("🔥 SUPABASE RAW ERROR:", error);
    throw new Error("Gagal menghapus skenario. Periksa koneksi Anda.");
  }
}

export async function buatVersiBaru(
  id: string,
  ownerId: string,
): Promise<{ id: string; versi: string; dibuat: boolean }> {
  const { data, error } = await supabase.rpc("buat_versi_baru", { p_id: id, p_owner_id: ownerId });

  if (error) {
    if (/skenario_belum_dirilis/.test(error.message))
      throw new Error("Hanya skenario yang sudah dirilis yang dapat dibuatkan versi baru.");
    if (/skenario_tidak_ditemukan/.test(error.message))
      throw new Error("Skenario tidak ditemukan atau bukan milik Anda.");
    throw new Error("Gagal membuat versi baru. Periksa koneksi lalu coba lagi.");
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { id_baru: string; versi_baru: string; dibuat: boolean }
    | undefined;

  if (!row) throw new Error("Gagal membuat versi baru.");
  return { id: row.id_baru, versi: row.versi_baru, dibuat: row.dibuat };
}

export async function fetchVersiRilis(kode: string, ownerId: string, exceptId: string) {
  const { data, error } = await supabase
    .from("skenario_praktikum")
    .select("id, versi")
    .eq("kode_skenario", kode)
    .eq("id_dosen_penyusun", ownerId)
    .neq("id", exceptId)
    .in("status_rilis", STATUS_GROUPS.diterbitkan)
    .not("frozen_at", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as { id: string; versi: string }[];
}

export async function arsipkanVersiLama(kode: string, ownerId: string, exceptId: string) {
  const { error } = await supabase
    .from("skenario_praktikum")
    .update({ status_rilis: STATUS_ARSIP, updated_at: new Date().toISOString() })
    .eq("kode_skenario", kode)
    .eq("id_dosen_penyusun", ownerId)
    .neq("id", exceptId)
    .in("status_rilis", STATUS_GROUPS.diterbitkan)
    .not("frozen_at", "is", null);
  if (error) throw error;
}