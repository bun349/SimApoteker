import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { ArrowRight, AtSign, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, ShieldPlus, TriangleAlert } from "lucide-react";
import { isUnpadEmail, sendPasswordReset, signIn } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { homeFor } from "@/lib/roles";

const input =
  "w-full rounded-lg border bg-sky-50 px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 " +
  "focus:border-navy-800 focus:bg-white focus:ring-4 focus:ring-navy-900/10";

export default function LoginPage() {
  // 1. SEMUA HOOKS HARUS BERADA DI PALING ATAS
  const { session, profile } = useAuthStore();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 2. LOGIKA PENGECEKAN SESI (EARLY RETURN) SETELAH HOOKS
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  if (session) {
    // kembali ke halaman yang dituju bila bukan "/", selain itu ke beranda sesuai peran
    const target = !profile ? "/" : from === "/" ? homeFor(profile.peran) : from;
    return <Navigate to={target} replace />;
  }

  const emailInvalid = touched && email.length > 0 && !isUnpadEmail(email);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setNotice(null);

    if (!isUnpadEmail(email)) return setError("Gunakan email institusi dengan domain @unpad.ac.id.");
    if (!password) return setError("Kata sandi wajib diisi.");

    setLoading(true);
    try {
      await signIn(email, password); // redirect otomatis lewat session di store
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function onForgot() {
    setError(null);
    setNotice(null);
    setTouched(true);
    if (!isUnpadEmail(email)) return setError("Isi email institusi Anda terlebih dahulu, lalu klik “Lupa kata sandi?”.");
    try {
      await sendPasswordReset(email);
      setNotice("Jika email terdaftar, tautan reset kata sandi telah dikirim. Periksa kotak masuk Anda.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream bg-[radial-gradient(60%_45%_at_50%_0%,#fdf3d3_0%,transparent_70%)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-900 font-serif text-lg font-bold text-gold-400">
          V
        </span>
        <div className="leading-tight">
          <p className="flex items-center gap-2 font-serif text-base font-bold text-navy-900">
            VIKIE
            <span className="rounded bg-gold-100 px-1.5 py-px font-sans text-[9px] font-bold uppercase tracking-wide text-amber-800">
              Simulator
            </span>
          </p>
          <p className="text-[11px] text-muted">Fakultas Farmasi Universitas Padjadjaran</p>
        </div>
      </header>

      {/* Kartu login */}
      <main className="grid flex-1 place-items-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-xl shadow-navy-900/5">
          <div className="text-center">
            <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-navy-900 text-gold-400 shadow-lg shadow-navy-900/20">
              <ShieldPlus size={30} />
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-lime-600" />
            </span>
            <h1 className="mt-4 font-serif text-3xl font-bold text-navy-900">VIKIE</h1>
            <p className="mt-1 font-serif text-base font-semibold text-navy-800">Virtual Patient KIE Simulator</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-navy-800/80">
              Fakultas Farmasi • Universitas Padjadjaran
            </p>
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-muted">
              Sistem Simulasi Konseling & Edukasi Farmasi Terpadu Berbasis Pasien Virtual
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-semibold">
                <AtSign size={14} /> Email Institusi <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="nama.pengguna@unpad.ac.id"
                aria-invalid={emailInvalid}
                className={cn(input, "mt-2", emailInvalid ? "border-red-400" : "border-transparent")}
              />
              <p className={cn("mt-2 flex items-center gap-1.5 text-[11px]", emailInvalid ? "text-red-600" : "text-muted")}>
                <ShieldCheck size={13} className={emailInvalid ? "text-red-500" : "text-lime-700"} />
                Wajib menggunakan alamat email resmi institusi dengan domain{" "}
                <b className="text-ink">@unpad.ac.id</b>
              </p>
            </div>

            {/* Kata sandi */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="flex items-center gap-1.5 text-sm font-semibold">
                  <KeyRound size={14} /> Kata Sandi <span className="text-red-600">*</span>
                </label>
                <button type="button" onClick={onForgot} className="text-[11px] font-semibold text-navy-800 hover:underline">
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative mt-2">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className={cn(input, "border-transparent pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Pesan */}
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            {notice && (
              <div role="status" className="flex items-start gap-2 rounded-lg bg-lime-100 px-4 py-3 text-xs text-lime-800">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold-400 py-3.5 text-sm font-bold text-navy-900 shadow-md shadow-gold-400/30 transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Memverifikasi...</>
              ) : (
                <>Masuk ke Sistem Simulasi <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-6 flex gap-3 rounded-xl bg-sky-50 p-4 text-[11px] leading-relaxed text-muted">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-navy-800" />
            <p>
              <b className="text-navy-900">Sistem Tertutup • Akses Terbatas</b>
              <br />
              Belum memiliki akun? Hubungi Admin Program Studi untuk mendapatkan akses. Verifikasi hak akses
              simulator dikelola terpusat oleh Departemen Farmakoterapi & Farmasi Komunitas Unpad.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 text-[11px] text-muted">
        <p>© 2026 Laboratorium Farmasi Komunitas & Klinis • Gedung 4 Kampus Jatinangor, Sumedang</p>
        <nav className="flex gap-4 font-medium text-ink">
          <a href="#" className="hover:underline">Ethical Access Policy</a>
          <a href="#" className="hover:underline">Ketentuan Simulasi</a>
          <a href="#" className="hover:underline">Pusat Bantuan</a>
        </nav>
      </footer>
    </div>
  );
}