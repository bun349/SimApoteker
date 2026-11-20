import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  ClipboardList, 
  History, 
  Settings,
  BookOpenCheck,
  BarChart3,
  Library,
  Users,
  Database,
  CalendarClock,
  type LucideIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@/types/auth";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

// Konfigurasi dinamis berdasarkan role pengguna
const navByRole: Record<Role, NavGroup[]> = {
  mahasiswa: [
    {
      heading: "Praktikum & Simulasi",
      items: [
        { to: "/", label: "Dashboard Mahasiswa", icon: LayoutDashboard, end: true },
        { to: "/rapor", label: "Rapor Evaluasi", icon: ClipboardList },
        { to: "/riwayat", label: "Riwayat Simulasi", icon: History },
      ],
    },
    {
      heading: "Akun & Preferensi",
      items: [
        { to: "/pengaturan", label: "Pengaturan Akun", icon: Settings },
      ],
    },
  ],
  dosen: [
    {
      heading: "Panel Dosen Penguji",
      items: [
        { to: "/dosen", label: "Dashboard Dosen", icon: LayoutDashboard, end: true },
        { to: "/dosen/tinjauan", label: "Antrean & Tinjauan", icon: BookOpenCheck },
        { to: "/dosen/kelas", label: "Rekap Kelas & Analitik", icon: BarChart3 },
        { to: "/dosen/kasus", label: "Bank Kasus & Studio Skenario", icon: Library },
        { to: "/dosen/penugasan", label: "Penugasan Praktikum", icon: CalendarClock },
      ],
    },
    {
      heading: "Pengaturan",
      items: [
        { to: "/dosen/pengaturan", label: "Pengaturan Akun", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      heading: "Administrasi Sistem",
      items: [
        { to: "/admin", label: "Dashboard Admin", icon: LayoutDashboard, end: true },
        { to: "/admin/pengguna", label: "Registrasi Pengguna", icon: Users },
        { to: "/admin/database", label: "Database Master", icon: Database },
      ],
    },
    {
      heading: "Pengaturan",
      items: [
        { to: "/admin/pengaturan", label: "Pengaturan Akun", icon: Settings },
      ],
    },
  ],
};

function Item({ to, label, icon: Icon, end, collapsed }: NavItem & { collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          collapsed && "lg:justify-center lg:px-0",
          isActive ? "bg-navy-900 text-white" : "text-ink hover:bg-black/5",
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      <span className={cn("truncate", collapsed && "lg:hidden")}>{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useUiStore();
  const { pathname } = useLocation();
  const profile = useAuthStore((s) => s.profile);
  
  const role = profile?.peran || "mahasiswa";
  const navGroups = navByRole[role];

  // Tutup drawer saat pindah halaman
  useEffect(() => setMobileOpen(false), [pathname, setMobileOpen]);

  // Tutup drawer dengan tombol Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMobileOpen]);

  const headingClass = cn(
    "px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted",
    collapsed && "lg:hidden",
  );

  return (
    <>
      {/* Backdrop (mobile saja) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "flex w-60 shrink-0 flex-col justify-between border-r border-line bg-white",
          "transition-all duration-200",
          // mobile: drawer
          "fixed bottom-0 left-0 top-16 z-40",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // desktop: menempel di bawah topbar, tinggi penuh layar
          "lg:sticky lg:bottom-auto lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:self-start",
          collapsed ? "lg:w-16" : "lg:w-60",
        )}
      >
        <div className="overflow-y-auto overflow-x-hidden p-2">
          {navGroups.map((group, index) => (
            <div key={group.heading} className={cn(index > 0 && "mt-4 border-t border-line pt-4")}>
              <p className={headingClass}>{group.heading}</p>
              <nav className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <Item key={item.to} {...item} collapsed={collapsed} />
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-line p-4 text-xs">
          <div
            className={cn("flex items-center gap-2 text-ink", collapsed && "lg:justify-center")}
            title={collapsed ? "Server KIE Aktif" : undefined}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-lime-500" />
            <span className={cn(collapsed && "lg:hidden")}>Server KIE Aktif</span>
          </div>
          <div className={cn("mt-1 font-serif text-[11px] text-muted", collapsed && "lg:hidden")}>
            v2.4.1-rc • Unpad Farmasi
          </div>
        </div>
      </aside>
    </>
  );
}