import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { homeFor } from "@/lib/roles";
import type { Role } from "@/types/auth";

export function RequireRole({ allow }: { allow: Role[] }) {
  const profile = useAuthStore((s) => s.profile);
  
  if (!profile) return null; // sudah ditangani RequireAuth
  
  // UBAH: Gunakan profile.peran sesuai dengan interface Profile terbaru Anda
  if (!allow.includes(profile.peran)) return <Navigate to={homeFor(profile.peran)} replace />;
  
  return <Outlet />;
}