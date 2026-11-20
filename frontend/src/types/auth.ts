export type Role = "mahasiswa" | "dosen" | "admin";

export interface Profile {
  id: string;                // ID unik dari tabel pengguna (contoh: 4d99...)
  auth_user_id: string;      // UUID yang tersambung ke tabel auth.users Supabase
  nama_lengkap: string;      // Menggantikan fullName
  peran: Role;               // Menggantikan role
  nomor_induk: string;       // Menggantikan identifier
  email: string;
  id_kelas?: string | null;  // Menggantikan classId
  created_at?: string;       // Timestamp pembuatan akun
}