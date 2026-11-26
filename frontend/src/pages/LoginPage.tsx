import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react";
import { isUnpadEmail, sendPasswordReset, signIn } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { homeFor } from "@/lib/roles";

const inputCls =
  "w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-muted/60 " +
  "focus:border-navy-900 focus:ring-2 focus:ring-navy-900/12";

const HIGHLIGHTS = [
  {
    icon: MessageSquareText,
    title: "Simulasi KIE Realistis",
    desc: "Skenario swamedikasi, resep akut, dan resep kronis berbasis pasien virtual adaptif.",
  },
  {
    icon: ClipboardCheck,
    title: "Evaluasi PaCT & Konten Klinis",
    desc: "Penilaian transparan berbasis bukti kutipan verbatim transkrip dan rubrik dosen.",
  },
  {
    icon: FileText,
    title: "Dokumentasi Kefarmasian",
    desc: "Latihan pencatatan konseling sesuai standar Formulir 5 & 7 Permenkes 73/2016.",
  },
];

export default function LoginPage() {
  const { session, profile } = useAuthStore();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  if (session) {
    const target = !profile ? "/" : from === "/" ? homeFor(profile.peran) : from;
    return <Navigate to={target} replace />;
  }

  const emailInvalid = touched && email.length > 0 && !isUnpadEmail(email);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setNotice(null);

    if (!isUnpadEmail(email)) {
      return setError("Gunakan email institusi dengan domain @mail.unpad.ac.id.");
    }
    if (!password) return setError("Kata sandi wajib diisi.");

    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function onForgot() {
    setError(null);
    setNotice(null);
    setTouched(true);
    if (!isUnpadEmail(email)) {
      return setError(
        "Isi email institusi (@mail.unpad.ac.id) terlebih dahulu, lalu klik “Lupa kata sandi?”.",
      );
    }
    try {
      await sendPasswordReset(email);
      setNotice(
        "Jika email terdaftar, tautan reset kata sandi telah dikirim. Periksa kotak masuk Anda.",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* Panel Kiri: Identitas Klinis-Akademik (#062A4D Primary + #7F8F2A Secondary + #F5B820 Tertiary) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex xl:p-14">
        {/* Garis aksen palet tipis di bagian atas */}
        <div className="absolute inset-x-0 top-0 flex h-1">
          <span className="flex-1 bg-gold-400" />
          <span className="w-28 bg-olive-600" />
        </div>

        {/* Pola grid geometris halus */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-400 text-base font-bold text-navy-900">
            V
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-white">VIKIE</p>
            <p className="text-xs text-slate-300">Fakultas Farmasi Universitas Padjadjaran</p>
          </div>
        </div>

        {/* Pesan Utama & Fitur Ringkas */}
        <div className="relative z-10 my-auto max-w-lg py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
            <span className="h-2 w-2 rounded-full bg-olive-600" />
            Clinical Academic Simulator
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Latih Konseling Klinis dengan Pasien Virtual.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Platform praktikum dan latihan mandiri Komunikasi, Informasi, dan Edukasi (KIE)
            kefarmasian untuk mahasiswa dan dosen penguji.
          </p>

          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-gold-400">
                  <item.icon size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Kiri */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
          <span>Laboratorium Farmasi Komunitas &amp; Klinis · Jatinangor</span>
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-olive-600" /> Sistem Aktif
          </span>
        </div>
      </aside>

      {/* Panel Kanan: Formulir Masuk */}
      <div className="flex flex-col justify-between bg-cream px-6 py-8 sm:px-10 lg:bg-white lg:px-14">
        {/* Header Mobile */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-900 text-sm font-bold text-gold-400">
            V
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-navy-900">VIKIE</p>
            <p className="text-xs text-muted">Fakultas Farmasi Unpad</p>
          </div>
        </div>

        <main className="mx-auto my-auto w-full max-w-md py-10">
          <div className="rounded-2xl border border-line bg-white p-7 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-olive-600">
                Portal Autentikasi
              </p>
              <h2 className="mt-1.5 text-2xl font-bold text-ink">Masuk ke Akun Anda</h2>
              <p className="mt-1.5 text-sm text-muted">
                Masuk menggunakan akun resmi institusi untuk mengakses simulasi dan rapor evaluasi.
              </p>
            </div>

            <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink">
                  Email Institusi
                </label>
                <div className="relative mt-1.5">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder="nama@mail.unpad.ac.id"
                    aria-invalid={emailInvalid}
                    className={cn(inputCls, emailInvalid ? "border-red-400" : "border-line")}
                  />
                </div>
                <p className={cn("mt-1.5 text-xs", emailInvalid ? "text-red-600" : "text-muted")}>
                  Gunakan domain resmi{" "}
                  <span className="font-medium text-ink">@mail.unpad.ac.id</span>.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-ink">
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={onForgot}
                    className="text-xs font-medium text-navy-900 hover:underline"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className={cn(inputCls, "border-line pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted transition hover:text-ink"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                >
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-olive-600/30 bg-olive-50 px-3.5 py-2.5 text-xs text-olive-700"
                >
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white transition hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk ke Simulator <ArrowRight size={15} className="text-gold-400" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 rounded-xl border border-line bg-cream p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">Akses Terkelola Program Studi</p>
              <p className="mt-1">
                Akun mahasiswa dan dosen didaftarkan oleh Admin Fakultas Farmasi Unpad. Hubungi
                admin jika mengalami kendala login.
              </p>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-muted lg:text-left">
          © 2026 VIKIE · Fakultas Farmasi Universitas Padjadjaran
        </footer>
      </div>
    </div>
  );
}
