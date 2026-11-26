import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Clock, FileText, Send } from "lucide-react";
import { saveSimulationDocumentationApi } from "@/api/simulation";
import { formatMmSs } from "@/hooks/useSimulationSession";

const MAX_DOC_SECONDS = 180; // 3 menit

export default function DocumentationPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = sp.get("sesi") ?? "";

  const [remainingSec, setRemainingSec] = useState(MAX_DOC_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nama_pasien: "",
    usia_pasien: "",
    jenis_kelamin: "",
    nama_dokter: "",
    keluhan_diagnosa: "",
    riwayat_alergi: "",
    obat_lain_penyerta: "",
    nama_obat_dosis: "",
    instruksi_khusus: "",
    edukasi_tindak_lanjut: "",
  });

  const formRef = useRef(form);
  const remainingRef = useRef(remainingSec);
  const submittedRef = useRef(false);

  formRef.current = form;
  remainingRef.current = remainingSec;

  const submitDocumentation = useCallback(
    async (isTimeout: boolean) => {
      if (!sessionId || submittedRef.current) return;
      submittedRef.current = true;
      setIsSubmitting(true);
      setError(null);

      try {
        await saveSimulationDocumentationApi(sessionId, {
          ...formRef.current,
          durasi_pengisian_detik: Math.max(0, MAX_DOC_SECONDS - remainingRef.current),
          waktu_habis: isTimeout,
        });
        navigate(`/rapor?sesi=${encodeURIComponent(sessionId)}`, { replace: true });
      } catch (err) {
        submittedRef.current = false;
        setIsSubmitting(false);
        setError(err instanceof Error ? err.message : "Gagal menyimpan dokumentasi.");
      }
    },
    [sessionId, navigate],
  );

  // Timer mundur 3 menit
  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void submitDocumentation(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionId, submitDocumentation]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitDocumentation(false);
  };

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-muted">ID sesi tidak ditemukan.</p>
        <button
          type="button"
          onClick={() => navigate("/simulasi")}
          className="mt-4 rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white"
        >
          Kembali ke Simulasi
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-10">
      {/* Header & Timer */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-navy-900">
            <FileText size={20} />
          </span>
          <div>
            <h1 className="font-serif text-lg font-bold text-navy-900">
              Dokumentasi Rekam Medis Kefarmasian
            </h1>
            <p className="text-xs text-muted">
              Catat hasil konseling sesuai standar Formulir 5 &amp; 7 Permenkes 73/2016.
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-sm font-bold ${
            remainingSec <= 30
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <Clock size={16} />
          <span>Sisa Waktu: {formatMmSs(remainingSec)}</span>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Blok 1: Identitas Pasien & Dokter */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-sm font-bold text-navy-900">
            1. Identitas Pasien &amp; Dokter
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Nama Pasien / Pendamping
              </label>
              <input
                type="text"
                value={form.nama_pasien}
                onChange={(e) => updateField("nama_pasien", e.target.value)}
                placeholder="Contoh: Ibu Ratna (Ibu Kevin)"
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Usia / Kategori Usia
              </label>
              <input
                type="text"
                value={form.usia_pasien}
                onChange={(e) => updateField("usia_pasien", e.target.value)}
                placeholder="Contoh: Anak / Dewasa"
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Jenis Kelamin
              </label>
              <select
                value={form.jenis_kelamin}
                onChange={(e) => updateField("jenis_kelamin", e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy-900"
              >
                <option value="">Pilih...</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Nama Dokter <span className="font-normal text-muted">(Opsional)</span>
              </label>
              <input
                type="text"
                value={form.nama_dokter}
                onChange={(e) => updateField("nama_dokter", e.target.value)}
                placeholder='Isi nama dokter, atau "-" / "Swamedikasi" jika tanpa resep'
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
              />
            </div>
          </div>
        </section>

        {/* Blok 2: Asesmen & Keluhan */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-sm font-bold text-navy-900">
            2. Asesmen &amp; Keluhan
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Keluhan Utama / Diagnosa
              </label>
              <textarea
                rows={2}
                value={form.keluhan_diagnosa}
                onChange={(e) => updateField("keluhan_diagnosa", e.target.value)}
                placeholder="Ringkas keluhan utama atau diagnosa yang disampaikan pasien..."
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy-900">
                  Riwayat Alergi Obat
                </label>
                <input
                  type="text"
                  value={form.riwayat_alergi}
                  onChange={(e) => updateField("riwayat_alergi", e.target.value)}
                  placeholder="Contoh: Tidak ada / Alergi penisilin"
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-navy-900">
                  Obat Lain / Kondisi Penyerta
                </label>
                <input
                  type="text"
                  value={form.obat_lain_penyerta}
                  onChange={(e) => updateField("obat_lain_penyerta", e.target.value)}
                  placeholder="Contoh: Paracetamol sirup / Tidak ada"
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Blok 3: Terapi & Rekomendasi Obat */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-sm font-bold text-navy-900">
            3. Terapi &amp; Rekomendasi Obat
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Nama Obat, Dosis &amp; Aturan Pakai
              </label>
              <textarea
                rows={2}
                value={form.nama_obat_dosis}
                onChange={(e) => updateField("nama_obat_dosis", e.target.value)}
                placeholder="Contoh: Amoxicillin Sirup Kering 125 mg/5 mL, 3x sehari 1 sendok takar (5 mL), dihabiskan..."
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-navy-900">
                Instruksi Khusus &amp; Penyimpanan
              </label>
              <textarea
                rows={2}
                value={form.instruksi_khusus}
                onChange={(e) => updateField("instruksi_khusus", e.target.value)}
                placeholder="Contoh: Larutkan serbuk dengan air matang sampai batas tanda, kocok sebelum diminum..."
                className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
              />
            </div>
          </div>
        </section>

        {/* Blok 4: Edukasi & Tindak Lanjut */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-sm font-bold text-navy-900">
            4. Edukasi &amp; Rencana Tindak Lanjut
          </h2>
          <textarea
            rows={3}
            value={form.edukasi_tindak_lanjut}
            onChange={(e) => updateField("edukasi_tindak_lanjut", e.target.value)}
            placeholder="Catat poin efek samping yang perlu diwaspadai, red flags, dan kapan pasien harus kontrol ke dokter..."
            className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-navy-900"
          />
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            {isSubmitting ? "Menyimpan Dokumentasi..." : "Simpan & Lanjut ke Rapor"}
          </button>
        </div>
      </form>
    </div>
  );
}
