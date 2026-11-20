import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  collapsed: boolean;   // desktop: true = rail ikon
  mobileOpen: boolean;  // mobile: true = drawer terbuka
  toggleSidebar: () => void;
  setMobileOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      mobileOpen: false,
      toggleSidebar: () => {
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
        if (isDesktop) set({ collapsed: !get().collapsed });
        else set({ mobileOpen: !get().mobileOpen });
      },
      setMobileOpen: (v) => set({ mobileOpen: v }),
    }),
    {
      name: "ui-store",
      partialize: (s) => ({ collapsed: s.collapsed }), // mobileOpen tidak disimpan
    },
  ),
);