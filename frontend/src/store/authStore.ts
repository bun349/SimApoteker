import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/api/auth";
import type { Profile } from "@/types/auth";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  initializing: boolean;
  init: () => () => void;
  clearSession: () => void; // Tambahan fungsi pembantu untuk logout
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  initializing: true,

  clearSession: () => set({ session: null, profile: null, initializing: false }),

  init: () => {
    const apply = async (session: Session | null) => {
      if (!session) {
        return set({ session: null, profile: null, initializing: false });
      }
      
      try {
        // Mengambil data dari tabel 'pengguna' menggunakan session.user.id (auth_user_id)
        const profile = await fetchProfile(session.user.id);
        set({ session, profile, initializing: false });
      } catch (error) {
        console.error("Gagal memuat profil:", error);
        // PENTING: Jika profil gagal dimuat (misal terhapus di database namun token masih ada),
        // paksa state menjadi null agar UI tidak me-render halaman tanpa 'role' yang valid.
        set({ session: null, profile: null, initializing: false });
      }
    };

    // 1. Cek sesi saat aplikasi pertama kali dimuat
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    
    // 2. Dengarkan perubahan status login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Menggunakan setTimeout untuk menghindari race-condition bawaan React/Supabase
      setTimeout(() => void apply(session), 0);
    });
    
    // 3. Fungsi pembersih (cleanup) saat komponen/store di-unmount
    return () => subscription.unsubscribe();
  },
}));