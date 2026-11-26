import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  Database,
  FolderOpen,
  History,
  LayoutDashboard,
  Library,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { fetchDosenReviewQueueApi } from "@/api/antrean";
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

const navByRole: Record<Role, NavGroup[]> = {
  mahasiswa: [
    {
      heading: "SIMULASI",
      items: [
        { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/simulasi", label: "Katalog Kasus", icon: FolderOpen },
        { to: "/riwayat", label: "Riwayat Simulasi", icon: History },
      ],
    },
    {
      heading: "AKUN",
      items: [{ to: "/pengaturan", label: "Pengaturan", icon: Settings }],
    },
  ],
  dosen: [
    {
      heading: "Pengajaran",
      items: [
        { to: "/dosen", label: "Dashboard Dosen", icon: LayoutDashboard, end: true },
        { to: "/dosen/antrean", label: "Antrean Tinjauan", icon: BookOpenCheck },
        { to: "/dosen/rekap", label: "Rekap Kelas", icon: BarChart3 },
        { to: "/dosen/kasus", label: "Bank Kasus", icon: Library },
        { to: "/dosen/penugasan", label: "Penugasan Praktikum", icon: CalendarClock },
      ],
    },
    {
      heading: "Akun",
      items: [{ to: "/dosen/pengaturan", label: "Pengaturan", icon: Settings }],
    },
  ],
  admin: [
    {
      heading: "Administrasi",
      items: [
        { to: "/admin", label: "Dashboard Admin", icon: LayoutDashboard, end: true },
        { to: "/admin/pengguna", label: "Manajemen Pengguna", icon: Users },
        { to: "/admin/database", label: "Database Master", icon: Database },
      ],
    },
    {
      heading: "Akun",
      items: [{ to: "/admin/pengaturan", label: "Pengaturan", icon: Settings }],
    },
  ],
};

function Item({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  badgeCount,
}: NavItem & { collapsed: boolean; badgeCount?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
          collapsed && "lg:justify-center lg:px-0",
          isActive
            ? "bg-navy-900 font-semibold text-white"
            : "font-medium text-muted hover:bg-slate-100 hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={17}
            className={cn("shrink-0", isActive ? "text-gold-400" : "text-muted")}
          />
          <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>{label}</span>
          {typeof badgeCount === "number" && badgeCount > 0 && (
            <span
              className={cn(
                "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                isActive ? "bg-gold-400 text-navy-900" : "bg-gold-100 text-amber-900",
                collapsed && "lg:hidden",
              )}
            >
              {badgeCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useUiStore();
  const { pathname } = useLocation();
  const profile = useAuthStore((s) => s.profile);

  const role = profile?.peran || "mahasiswa";
  const navGroups = navByRole[role];

  const qAntreanCount = useQuery({
    queryKey: ["dosen", "antrean", "badge", profile?.id ?? "", profile?.auth_user_id ?? ""],
    queryFn: () =>
      fetchDosenReviewQueueApi({
        idDosen: profile!.id,
        authUserId: profile?.auth_user_id,
      }),
    enabled: role === "dosen" && Boolean(profile?.id),
    staleTime: 30_000,
  });
  const pendingReviewCount = qAntreanCount.data?.total_antrean ?? 0;

  useEffect(() => setMobileOpen(false), [pathname, setMobileOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMobileOpen]);

  const headingClass = cn(
    "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/80",
    collapsed && "lg:hidden",
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 top-16 z-30 bg-slate-900/25 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "flex w-60 shrink-0 flex-col justify-between border-r border-line bg-white transition-all duration-200",
          "fixed bottom-0 left-0 top-16 z-40",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:bottom-auto lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:self-start",
          collapsed ? "lg:w-16" : "lg:w-60",
        )}
      >
        <div className="overflow-y-auto overflow-x-hidden p-3">
          {navGroups.map((group, index) => (
            <div key={group.heading} className={cn(index > 0 && "mt-5 border-t border-line pt-4")}>
              <p className={headingClass}>{group.heading}</p>
              <nav className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <Item
                    key={item.to}
                    {...item}
                    collapsed={collapsed}
                    badgeCount={item.to === "/dosen/antrean" ? pendingReviewCount : undefined}
                  />
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-4 py-3.5 text-xs text-muted">
          <div
            className={cn("flex items-center gap-2", collapsed && "lg:justify-center")}
            title={collapsed ? "Server Aktif" : undefined}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-olive-600" />
            <span className={cn("font-medium text-ink", collapsed && "lg:hidden")}>
              Server Aktif
            </span>
          </div>
          <p className={cn("mt-0.5 text-[11px] text-muted", collapsed && "lg:hidden")}>
            VIKIE • Farmasi Unpad
          </p>
        </div>
      </aside>
    </>
  );
}
