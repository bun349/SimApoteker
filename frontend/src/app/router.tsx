import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import MandiriCatalogPage from "@/pages/MandiriCatalogPage";
import CaseBriefPage from "@/pages/CaseBriefPage";
import SessionPage from "@/pages/SessionPage";
import BankKasusPage from "@/pages/dosen/BankKasusPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import ScenarioWizardPage from "@/pages/dosen/ScenarioWizardPage";
import DetailKasusPage from "@/pages/dosen/DetailKasusPage";
import PenugasanPage from "@/pages/dosen/PenugasanPage";

const page = (path: string, title: string) => ({
  path,
  element: <PlaceholderPage title={title} />,
});

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          // ===== Mahasiswa =====
          {
            element: <RequireRole allow={["mahasiswa"]} />,
            children: [
              { index: true, element: <DashboardPage /> },
              // Mengubah path 'mandiri' menjadi 'simulasi' agar selaras dengan menu Sidebar
              { path: "simulasi", element: <MandiriCatalogPage /> },
              { path: "simulasi/:id", element: <CaseBriefPage /> },
              { path: "simulasi/:id/sesi", element: <SessionPage /> },
              // Placeholder untuk menu mahasiswa yang baru ditambahkan
              page("rekam-medis", "Arsip Rekam Medis (Formulir 5 & 7)"),
              page("rapor", "Rapor & Evaluasi"),
              page("riwayat", "Riwayat Simulasi"),
              page("pengaturan", "Pengaturan Akun"),
            ],
          },
          // ===== Dosen =====
          {
            element: <RequireRole allow={["dosen"]} />,
            children: [
              page("dosen", "Dashboard Dosen"),
              page("dosen/antrean", "Antrean & Tinjauan"),
              page("dosen/rekap", "Rekap Kelas & Analitik"),
              { path: "dosen/kasus", element: <BankKasusPage /> },
              { path: "dosen/kasus/baru", element: <ScenarioWizardPage /> },
              { path: "dosen/kasus/:id/susun", element: <ScenarioWizardPage /> },
              { path: "dosen/kasus/:id", element: <DetailKasusPage /> },
              page("dosen/kasus/:id/uji", "Uji Coba Skenario"),
              { path: "dosen/penugasan", element: <PenugasanPage /> },
              page("dosen/pengaturan", "Pengaturan Akun"),
            ],
          },
          // ===== Admin =====
          {
            element: <RequireRole allow={["admin"]} />,
            children: [
              page("admin", "Dashboard Admin"),
              page("admin/pengguna", "Registrasi & Manajemen Pengguna"),
              page("admin/database", "Database Master & Referensi"),
              page("admin/pengaturan", "Pengaturan Akun"),
            ],
          },
        ],
      },
    ],
  },
]);