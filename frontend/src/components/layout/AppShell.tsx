import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuthStore } from "@/store/authStore";
import { roleLabel } from "@/lib/roles"; // Pastikan path ini sesuai

export function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        user={profile ? {
          name: profile.nama_lengkap,          // Diperbarui dari fullName
          idLabel: profile.nomor_induk,        // Diperbarui dari identifier
          roleLabel: roleLabel[profile.peran], // Diperbarui dari role
          // avatarUrl: profile.avatarUrl -> Dihapus karena tidak ada di tabel pengguna
        } : undefined}
      />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 px-5 py-7 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}