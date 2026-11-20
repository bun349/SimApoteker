import { useState } from "react";
import { Plus, Clock, Users, BookOpen} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { 
  fetchDaftarTugas, fetchKelasDosen, fetchSkenarioPraktikum, createTugas, updateStatusTugas 
} from "@/api/penugasan";
import { formatShortDate } from "@/lib/utils";

export default function PenugasanPage() {
  const profile = useAuthStore((s) => s.profile);
  const ownerId = profile?.id;
  const qc = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ id_skenario: "", id_kelas: "", deadline: "" });

  // --- QUERIES ---
  const qTugas = useQuery({
    queryKey: ["penugasan", "list"],
    queryFn: () => fetchDaftarTugas(ownerId!),
    enabled: !!ownerId,
  });

  const qKelas = useQuery({
    queryKey: ["kelas", "dropdown"],
    queryFn: () => fetchKelasDosen(ownerId!),
    enabled: isModalOpen && !!ownerId,
  });

  const qSkenario = useQuery({
    queryKey: ["skenario", "dropdown"],
    queryFn: () => fetchSkenarioPraktikum(ownerId!),
    enabled: isModalOpen && !!ownerId,
  });

  // --- MUTATIONS ---
  const mutCreate = useMutation({
    mutationFn: async () => {
      if (!ownerId) throw new Error("Sesi tidak valid");
      await createTugas(ownerId, form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["penugasan"] });
      setIsModalOpen(false);
      setForm({ id_skenario: "", id_kelas: "", deadline: "" });
    },
    onError: (err: any) => alert(err.message),
  });

  const mutStatus = useMutation({
    mutationFn: async (vars: { id: string; status: string }) => {
      if (!ownerId) throw new Error("Sesi tidak valid");
      await updateStatusTugas(vars.id, ownerId, vars.status);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["penugasan"] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id_skenario || !form.id_kelas || !form.deadline) {
      alert("Harap lengkapi semua kolom form.");
      return;
    }
    mutCreate.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Portal Dosen UNPAD / <span className="font-medium text-ink">Distribusi Tugas</span></p>
          <h1 className="mt-2 font-serif text-3xl font-bold">Penugasan Praktikum</h1>
          <p className="mt-1 text-sm text-muted">Jadwalkan skenario praktikum ke kelas mahasiswa beserta batas waktunya.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-navy-900 shadow-sm hover:brightness-95"
        >
          <Plus size={16} /> Buat Tugas Baru
        </button>
      </header>

      {/* TABEL DAFTAR TUGAS */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-4 font-semibold">Skenario Praktikum</th>
              <th className="px-5 py-4 font-semibold">Kelas Tujuan</th>
              <th className="px-5 py-4 font-semibold">Batas Waktu (Deadline)</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {qTugas.isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted">Memuat data...</td></tr>}
            {!qTugas.isLoading && qTugas.data?.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted">Belum ada tugas praktikum yang dibagikan.</td></tr>
            )}
            
            {qTugas.data?.map((t) => (
              <tr key={t.id} className="hover:bg-sky-50/30">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-navy-800">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-ink">{t.skenario?.judul}</p>
                      <p className="text-xs text-muted">{t.skenario?.kode_skenario} • v{t.skenario?.versi}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-muted" />
                    <span className="font-medium text-ink">{t.kelas?.nama_kelas}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-red-700" />
                    <span className="font-medium text-red-800">{formatShortDate(t.deadline)}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    t.status === "Aktif" ? "bg-lime-100 text-lime-800" : "bg-gray-100 text-gray-600"
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <select
                    className="cursor-pointer rounded-lg border border-line bg-white px-2 py-1 text-xs text-muted outline-none hover:border-navy-800"
                    value={t.status}
                    onChange={(e) => mutStatus.mutate({ id: t.id, status: e.target.value })}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Selesai">Tutup Sesi (Selesai)</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM TUGAS BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-serif text-xl font-bold text-ink">Buat Tugas Praktikum</h3>
            <p className="mt-1 text-sm text-muted">Mahasiswa di kelas tujuan akan melihat kasus ini di dasbor mereka.</p>
            
            <form onSubmit={handleCreate} className="mt-6 space-y-5">
              <label className="block">
                <span className="text-xs font-semibold text-muted">PILIH SKENARIO PRAKTIKUM</span>
                <select
                  required
                  value={form.id_skenario}
                  onChange={(e) => setForm({ ...form, id_skenario: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-navy-800"
                >
                  <option value="" disabled>-- Pilih Skenario (Yang sudah Rilis) --</option>
                  {qSkenario.data?.map(s => (
                    <option key={s.id} value={s.id}>{s.kode_skenario} - {s.judul} (v{s.versi})</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-muted">PILIH KELAS TUJUAN</span>
                <select
                  required
                  value={form.id_kelas}
                  onChange={(e) => setForm({ ...form, id_kelas: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-navy-800"
                >
                  <option value="" disabled>-- Pilih Kelas/Kelompok --</option>
                  {qKelas.data?.map(k => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-muted">BATAS WAKTU (DEADLINE) PENGERJAAN</span>
                <input
                  type="datetime-local"
                  required
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-navy-800"
                />
              </label>

              <div className="mt-8 flex justify-end gap-3 border-t border-line pt-5">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-muted transition hover:bg-cream"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={mutCreate.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-bold text-navy-900 shadow-sm transition hover:brightness-95 disabled:opacity-50"
                >
                  {mutCreate.isPending ? "Menyimpan..." : "Kirim Tugas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}