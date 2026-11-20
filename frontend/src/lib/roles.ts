import { 
  ClipboardList, 
  Database, 
  LayoutDashboard, 
  Settings, 
  Users, 
  Stethoscope,
  FolderPen,
  type LucideIcon, 
  ClipboardCheck,
  FolderOpen,
  BarChart3
} from "lucide-react";
import type { Role } from "@/types/auth";

export const homeFor = (role: Role) =>
  role === "admin" ? "/admin" : role === "dosen" ? "/dosen" : "/";

export const roleLabel: Record<Role, string> = {
  mahasiswa: "Mahasiswa / Praktikan",
  dosen: "Dosen Pengampu",
  admin: "Administrator",
};

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavGroup { heading: string; items: NavItem[] }

export const navByRole: Record<Role, NavGroup[]> = {
  mahasiswa: [
    { heading: "Praktikum & Simulasi", items: [
      { to: "/", label: "Dashboard Mahasiswa", icon: LayoutDashboard, end: true },
      { to: "/simulasi", label: "Daftar Kasus OSCE", icon: Stethoscope },
      { to: "/rekam-medis", label: "Arsip Rekam Medis", icon: FolderPen }, // Tempat melihat riwayat ketikan form 5 & 7
      { to: "/rapor", label: "Rapor & Evaluasi", icon: ClipboardList },
    ]},
    { heading: "Akun & Preferensi", items: [
      { to: "/pengaturan", label: "Pengaturan Akun", icon: Settings },
    ]},
  ],
  dosen: [
    { heading: "Panel Dosen Penguji", items: [
      { to: "/dosen", label: "Dashboard Dosen", icon: LayoutDashboard, end: true },
      { to: "/dosen/antrean", label: "Antrean & Tinjauan", icon: ClipboardCheck },
      { to: "/dosen/rekap", label: "Rekap Kelas & Analitik", icon: BarChart3 },
      { to: "/dosen/kasus", label: "Bank Kasus & Studio", icon: FolderOpen },
    ]},
    { heading: "Akun & Preferensi", items: [
      { to: "/dosen/pengaturan", label: "Pengaturan Akun", icon: Settings },
    ]},
  ],
  admin: [
    { heading: "Administrasi Sistem", items: [
      { to: "/admin", label: "Dashboard Admin", icon: LayoutDashboard, end: true },
      { to: "/admin/pengguna", label: "Registrasi Pengguna", icon: Users }, // Admin mendaftarkan Dosen & Mahasiswa, serta memasukkan Mahasiswa ke Kelas
      { to: "/admin/database", label: "Database Master", icon: Database }, // Opsional: mengelola master data obat/DDI jika diperlukan
    ]},
    { heading: "Akun & Preferensi", items: [
      { to: "/admin/pengaturan", label: "Pengaturan Akun", icon: Settings },
    ]},
  ],
};