import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/auth";

// Hanya menerima email dengan akhiran persis @mail.unpad.ac.id
export const isUnpadEmail = (email: string) =>
  /^[^\s@]+@mail\.unpad\.ac\.id$/i.test(email.trim());

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (/invalid login credentials/i.test(error.message))
      throw new Error("Email atau kata sandi salah.");
    if (/email not confirmed/i.test(error.message))
      throw new Error("Email belum diverifikasi. Hubungi Admin Program Studi.");
    if (/rate limit|too many/i.test(error.message))
      throw new Error("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
    throw new Error("Gagal masuk. Periksa koneksi Anda lalu coba lagi.");
  }
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error("Gagal mengirim tautan reset. Coba lagi nanti.");
}

export const signOut = () => supabase.auth.signOut();

export async function fetchProfile(authUserId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("pengguna")
    // Tambahkan created_at sesuai dengan interface Profile yang baru
    .select("id, auth_user_id, nama_lengkap, peran, nomor_induk, email, id_kelas, created_at")
    .eq("auth_user_id", authUserId)
    .single();

  if (error) throw error;

  // Karena interface Profile sudah kita ubah 100% selaras dengan kolom database,
  // kita tidak perlu lagi memetakan (mapping) manual satu per satu.
  // Profile.id sekarang otomatis terisi dengan data.id (UUID pengguna: 4d99...).
  return data as Profile;
}