// components/layout/Topbar.tsx
import { Bell, HelpCircle, Search } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/api/auth";

export interface TopbarUser {
  name: string;
  idLabel?: string | null;
  roleLabel: string;
  avatarUrl?: string | null;
}

export function Topbar({ user }: { user?: TopbarUser }){
  const { toggleSidebar } = useUiStore();
  const qc = useQueryClient();
  const logout = async () => {
    await signOut();
    qc.clear(); // buang cache data pengguna sebelumnya
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-6 border-b-2 border-gold-400 bg-navy-900 px-6 text-white">
      <button
        aria-label="Toggle Sidebar"
        className="flex items-center justify-center rounded-md p-2 hover:bg-white/10"
        onClick={toggleSidebar}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 010 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div className="leading-tight">
        <div className="font-serif text-lg font-bold tracking-wide">VIKIE</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">
          Farmasi Unpad
        </div>
      </div>

      <div className="flex flex-1 items-center gap-2 text-sm text-white/90">
        <Search size={14} className="text-white/60" />
        <input
          placeholder="Cari skenario, kasus klinis, atau riwayat..."
          className="w-full max-w-md bg-transparent font-medium outline-none placeholder:text-white/90"
        />
      </div>

      <button aria-label="Notifikasi"><Bell size={16} /></button>
      <button aria-label="Bantuan"><HelpCircle size={16} /></button>
      <div className="h-6 w-px bg-white/20" />

      {user && (
        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">
              {user.name}{user.idLabel ? ` (${user.idLabel})` : ""}
            </div>
            <span className="mt-0.5 inline-block rounded-full bg-emerald-600 px-2 py-px text-[10px] font-semibold">
              {user.roleLabel}
            </span>
          </div>
          <img
            src={user.avatarUrl ?? "https://i.pravatar.cc/80?img=5"}
            className="h-9 w-9 rounded-full border-2 border-gold-400 object-cover"
            alt=""
          />
        </div>
      )}
      <button onClick={logout} aria-label="Keluar" title="Keluar" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10">
        <LogOut size={16} />
      </button>
      
    </header>
  );
}