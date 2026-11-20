import { Link, useParams, useSearchParams } from "react-router";
import { useCaseDetail } from "@/hooks/useCaseDetail";
import { SwamedikasiBrief, type SessionKind } from "@/components/simulation/SwamedikasiBrief";
import { ResepAkutBrief } from "@/components/simulation/ResepAkutBrief";
import { ResepKronisBrief } from "@/components/simulation/ResepKronisBrief";
import { Loader2 } from "lucide-react";

export default function CaseBriefPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const mode: SessionKind = sp.get("mode") === "mandiri" ? "mandiri" : "praktikum";
  const { data, isLoading, isError } = useCaseDetail(id, mode);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-muted">
        <Loader2 size={32} className="animate-spin text-gold-400" />
        <p className="mt-4 animate-pulse text-sm font-medium">Mempersiapkan rekam medis pasien...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        <p className="font-bold">Gagal memuat detail kasus.</p>
        <p className="mt-2 text-sm">Kasus tidak ditemukan atau terjadi gangguan jaringan.</p>
        <Link to="/" className="mt-4 inline-block font-semibold underline hover:text-red-900">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  // Proteksi jika kasus tidak mengizinkan mode yang sedang diakses
  if (!data.modes.includes(mode)) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
        <p className="font-bold">Akses Ditolak</p>
        <p className="mt-2 text-sm">Kasus ini tidak dikonfigurasi untuk mode <b>{mode}</b>.</p>
        <Link to={mode === "mandiri" ? "/simulasi" : "/"} className="mt-4 inline-block font-semibold underline hover:text-amber-950">
          Kembali
        </Link>
      </div>
    );
  }

  // Normalisasi kategori menjadi huruf besar semua agar aman dari typo dosen
  const category = (data.category || "").toUpperCase();

  // Deteksi cerdas berdasarkan kata kunci (keywords)
  if (category.includes("KRONIS")) {
    return <ResepKronisBrief c={data} mode={mode} />;
  } 
  else if (category.includes("AKUT") || (category.includes("RESEP") && !category.includes("KRONIS"))) {
    return <ResepAkutBrief c={data} mode={mode} />;
  } 
  else {
    // Fallback default: Jika bukan resep (atau jenis skenario baru), gunakan tampilan Swamedikasi 
    // karena ini adalah layout standar (data terbuka) paling aman.
    return <SwamedikasiBrief c={data} mode={mode} />;
  }
}