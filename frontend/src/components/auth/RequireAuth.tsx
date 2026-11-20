import { Navigate, Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { signOut } from "@/api/auth";

export function RequireAuth() {
  const { session, profile, initializing } = useAuthStore();
  const location = useLocation();
  const qc = useQueryClient();

  if (initializing)
    return <div className="grid min-h-screen animate-pulse place-items-center text-muted">Memuat...</div>;

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;

  if (!profile)
    return (
      <div className="grid min-h-screen place-items-center bg-cream p-6">
        <div className="max-w-sm rounded-2xl border border-line bg-white p-6 text-center text-sm shadow-sm">
          <p className="font-semibold text-navy-900">Akun belum memiliki peran</p>
          <p className="mt-2 text-muted">
            Akun Anda berhasil masuk, tetapi belum terdaftar sebagai mahasiswa, dosen, atau admin.
            Hubungi Admin Program Studi.
          </p>
          <button
            onClick={async () => { await signOut(); qc.clear(); }}
            className="mt-4 rounded-lg bg-navy-900 px-4 py-2 font-semibold text-white"
          >
            Keluar
          </button>
        </div>
      </div>
    );

  return <Outlet />;
}