import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireRole } from "@/components/auth/RequireRole";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import MandiriCatalogPage from "@/pages/MandiriCatalogPage";
import CaseBriefPage from "@/pages/CaseBriefPage";
import SessionPage from "@/pages/SessionPage";
import DocumentationPage from "@/pages/DocumentationPage";
import DocumentationEvaluationPage from "@/pages/DocumentationEvaluationPage";
import RaporPage from "@/pages/RaporPage";
import RiwayatSimulasiPage from "@/pages/RiwayatSimulasiPage";
import BankKasusPage from "@/pages/dosen/BankKasusPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import ScenarioWizardPage from "@/pages/dosen/ScenarioWizardPage";
import DetailKasusPage from "@/pages/dosen/DetailKasusPage";
import PenugasanPage from "@/pages/dosen/PenugasanPage";
import RekapKelasPage from "@/pages/dosen/RekapKelasPage";
import AntreanTinjauanPage from "@/pages/dosen/AntreanTinjauanPage";
import DosenRaporReviewPage from "@/pages/dosen/DosenRaporReviewPage";
import DosenDashboardPage from "@/pages/dosen/DosenDashboardPage";

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
              { path: "dokumentasi", element: <DocumentationPage /> },
              { path: "dokumentasi/penilaian", element: <DocumentationEvaluationPage /> },
              { path: "rapor", element: <RaporPage /> },
              { path: "rapor/:sessionId", element: <RaporPage /> },
              { path: "riwayat", element: <RiwayatSimulasiPage /> },
              // Placeholder untuk menu mahasiswa yang baru ditambahkan
              page("rekam-medis", "Arsip Rekam Medis (Formulir 5 & 7)"),
              page("pengaturan", "Pengaturan Akun"),
            ],
          },
          // ===== Dosen =====
          {
            element: <RequireRole allow={["dosen"]} />,
            children: [
              { path: "dosen", element: <DosenDashboardPage /> },
              { path: "dosen/antrean", element: <AntreanTinjauanPage /> },
              { path: "dosen/tinjauan", element: <AntreanTinjauanPage /> },
              { path: "dosen/rekap", element: <RekapKelasPage /> },
              { path: "dosen/kelas", element: <RekapKelasPage /> },
              { path: "dosen/rapor", element: <DosenRaporReviewPage /> },
              { path: "dosen/rapor/:sessionId", element: <DosenRaporReviewPage /> },
              { path: "dosen/dokumentasi/penilaian", element: <DocumentationEvaluationPage /> },
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