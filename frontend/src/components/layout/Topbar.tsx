import { Link } from "react-router";
import { LogOut, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/api/auth";
import { useUiStore } from "@/store/uiStore";

export interface TopbarUser {
  name: string;
  idLabel?: string | null;
  roleLabel: string;
  avatarUrl?: string | null;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar({ user }: { user?: TopbarUser }) {
  const { toggleSidebar } = useUiStore();
  const qc = useQueryClient();

  const logout = async () => {
    await signOut();
    qc.clear();
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-white/95 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Toggle Sidebar"
          onClick={toggleSidebar}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
        >
          <Menu size={18} />
        </button>

        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-sm font-bold text-gold-400">
            V
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-navy-900">VIKIE</div>
            <div className="text-[11px] font-medium text-muted">Farmasi Unpad</div>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden items-center gap-2.5 sm:flex">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-ink">
                {user.name}
                {user.idLabel ? (
                  <span className="ml-1 font-normal text-muted">({user.idLabel})</span>
                ) : null}
              </div>
              <div className="text-xs text-muted">{user.roleLabel}</div>
            </div>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-100 text-xs font-bold text-navy-900">
              {getInitials(user.name) || "U"}
            </span>
          </div>
        )}

        <div className="hidden h-5 w-px bg-line sm:block" />

        <button
          type="button"
          onClick={logout}
          aria-label="Keluar"
          title="Keluar"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-slate-100 hover:text-ink"
        >
          <LogOut size={15} />
          <span className="hidden md:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
