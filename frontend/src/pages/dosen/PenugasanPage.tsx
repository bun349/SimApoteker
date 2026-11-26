import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  Archive,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import {
  createTugas,
  fetchDaftarTugas,
  fetchKelasDosen,
  fetchSkenarioPraktikum,
  updateDeadlineTugas,
  updateStatusTugas,
  type StatusTugas,
  type TugasPraktikum,
} from "@/api/penugasan";
import { cn } from "@/lib/utils";

type StatusTab = "semua" | "Aktif" | "Selesai";

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(d);
  return `${datePart}, ${timePart.replace(".", ":")}`;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PenugasanPage() {
  const profile = useAuthStore((s) => s.profile);
  const ownerId = profile?.id;
  const qc = useQueryClient();

  const [statusTab, setStatusTab] = useState<StatusTab>("semua");
  const [search, setSearch] = useState("");
  const [kelasFilter, setKelasFilter] = useState<string>("semua");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Modal buat tugas baru
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    id_skenario: string;
    id_kelas: string;
    deadline: string;
    status: StatusTugas;
  }>({
    id_skenario: "",
    id_kelas: "",
    deadline: "",
    status: "Aktif",
  });

  // Modal edit deadline
  const [editingTask, setEditingTask] = useState<TugasPraktikum | null>(null);
  const [editDeadlineVal, setEditDeadlineVal] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Tutup dropdown aksi (⋮) saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!openMenuId) return;
    const handlePointer = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [openMenuId]);

  // --- QUERIES ---
  const qTugas = useQuery({
    queryKey: ["penugasan", "list", ownerId],
    queryFn: () => fetchDaftarTugas(ownerId!),
    enabled: !!ownerId,
  });

  const qKelas = useQuery({
    queryKey: ["kelas", "dropdown", ownerId],
    queryFn: () => fetchKelasDosen(ownerId!),
    enabled: !!ownerId,
  });

  const qSkenario = useQuery({
    queryKey: ["skenario", "dropdown", ownerId],
    queryFn: () => fetchSkenarioPraktikum(ownerId!),
    enabled: isCreateOpen && !!ownerId,
  });

  // --- MUTATIONS ---
  const mutCreate = useMutation({
    mutationFn: async () => {
      if (!ownerId) throw new Error("Sesi login dosen tidak valid.");
      await createTugas(ownerId, form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["penugasan"] });
      setIsCreateOpen(false);
      setCreateError(null);
      setForm({ id_skenario: "", id_kelas: "", deadline: "", status: "Aktif" });
    },
    onError: (err: unknown) => {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat tugas praktikum.");
    },
  });

  const mutStatus = useMutation({
    mutationFn: async (vars: { id: string; status: StatusTugas }) => {
      if (!ownerId) throw new Error("Sesi tidak valid.");
      await updateStatusTugas(vars.id, ownerId, vars.status);
    },
    onSuccess: () => {
      setOpenMenuId(null);
      void qc.invalidateQueries({ queryKey: ["penugasan"] });
    },
  });

  const mutDeadline = useMutation({
    mutationFn: async (vars: { id: string; deadline: string }) => {
      if (!ownerId) throw new Error("Sesi tidak valid.");
      await updateDeadlineTugas(vars.id, ownerId, vars.deadline);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["penugasan"] });
      setEditingTask(null);
      setEditDeadlineVal("");
      setEditError(null);
    },
    onError: (err: unknown) => {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui deadline.");
    },
  });

  const allTasks = qTugas.data ?? [];
  const visibleTasks = useMemo(
    () => allTasks.filter((t) => t.status !== "Diarsipkan"),
    [allTasks],
  );

  // Ringkasan KPI 3 kartu atas
  const counts = useMemo(() => {
    const aktif = visibleTasks.filter((t) => t.status === "Aktif").length;
    const selesai = visibleTasks.filter((t) => t.status === "Selesai").length;
    const perluDitinjau = visibleTasks.reduce(
      (sum, t) => sum + (t.progress.perluDitinjau > 0 ? t.progress.perluDitinjau : 0),
      0,
    );
    return { semua: visibleTasks.length, aktif, selesai, perluDitinjau };
  }, [visibleTasks]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const k of qKelas.data ?? []) {
      map.set(k.id, k.nama_kelas);
    }
    for (const t of visibleTasks) {
      if (t.kelas?.id && !map.has(t.kelas.id)) {
        map.set(t.kelas.id, t.kelas.nama_kelas);
      }
    }
    return Array.from(map.entries()).map(([id, nama_kelas]) => ({ id, nama_kelas }));
  }, [qKelas.data, visibleTasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleTasks.filter((t) => {
      if (statusTab !== "semua" && t.status !== statusTab) return false;
      if (kelasFilter !== "semua" && t.id_kelas !== kelasFilter) return false;
      if (q) {
        const hay = [
          t.skenario.judul,
          t.skenario.kode_skenario,
          t.skenario.versi,
          t.kelas.nama_kelas,
          t.kelas.kode_kelas || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleTasks, statusTab, kelasFilter, search]);

  // Kelompokkan daftar berdasarkan status (Aktif terlebih dahulu, lalu Selesai)
  const groupedSections = useMemo(() => {
    const aktifList = filteredTasks.filter((t) => t.status === "Aktif");
    const selesaiList = filteredTasks.filter((t) => t.status === "Selesai");
    const groups: Array<{
      key: "Aktif" | "Selesai";
      label: string;
      dotCls: string;
      items: TugasPraktikum[];
    }> = [];

    if (aktifList.length > 0) {
      groups.push({
        key: "Aktif",
        label: `Aktif · ${aktifList.length}`,
        dotCls: "bg-olive-600",
        items: aktifList,
      });
    }
    if (selesaiList.length > 0) {
      groups.push({
        key: "Selesai",
        label: `Selesai · ${selesaiList.length}`,
        dotCls: "bg-slate-400",
        items: selesaiList,
      });
    }
    return groups;
  }, [filteredTasks]);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!form.id_skenario || !form.id_kelas || !form.deadline) {
      setCreateError("Harap pilih skenario, kelas tujuan, dan batas waktu pengerjaan.");
      return;
    }
    mutCreate.mutate();
  };

  const openEditDeadline = (task: TugasPraktikum) => {
    setOpenMenuId(null);
    setEditingTask(task);
    setEditDeadlineVal(toDatetimeLocalValue(task.deadline));
    setEditError(null);
  };

  const handleSaveDeadline = (e: FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editDeadlineVal) {
      setEditError("Batas waktu tidak boleh kosong.");
      return;
    }
    mutDeadline.mutate({ id: editingTask.id, deadline: editDeadlineVal });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      {/* 1. Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted">
            Portal Dosen UNPAD /{" "}
            <span className="font-semibold text-olive-600">Distribusi Tugas</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">
            Penugasan Praktikum
          </h1>
          <p className="mt-1 text-sm text-muted">
            Jadwalkan skenario ke kelas dan pantau progres pengerjaan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
        >
          <Plus size={16} className="text-gold-400" /> Buat Tugas Baru
        </button>
      </header>

      {/* 2. Tiga Kartu KPI Ringkas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted">Tugas aktif</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-navy-900">{counts.aktif}</p>
        </div>

        <div className="rounded-2xl border border-gold-400/40 bg-gold-100/75 px-5 py-4">
          <p className="text-xs font-medium text-amber-900">Perlu ditinjau</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-amber-900">
            {counts.perluDitinjau}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted">Sesi selesai</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-navy-900">{counts.selesai}</p>
        </div>
      </div>

      {/* 3. Bar Filter & Pencarian */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tab Status Segmented */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-medium">
          {(
            [
              { id: "semua", label: "Semua", count: counts.semua },
              { id: "Aktif", label: "Aktif", count: counts.aktif },
              { id: "Selesai", label: "Selesai", count: counts.selesai },
            ] as const
          ).map((tab) => {
            const active = statusTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 transition",
                  active
                    ? "bg-white font-semibold text-navy-900 shadow-xs"
                    : "text-muted hover:text-ink",
                )}
              >
                {tab.label}{" "}
                <span className={cn("ml-0.5 tabular-nums", active ? "text-muted" : "opacity-75")}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pencarian & Filter Kelas */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[230px] sm:w-64">
            <Search
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau kode skenario"
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs text-ink outline-none placeholder:text-muted/70 focus:border-navy-900"
            />
          </div>

          <select
            value={kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            aria-label="Filter kelas"
            className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-medium text-ink outline-none focus:border-navy-900"
          >
            <option value="semua">Semua kelas</option>
            {classOptions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama_kelas}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Daftar Penugasan Terkelompok */}
      <section className="rounded-2xl border border-line bg-white">
        {/* Header Kolom */}
        <div className="hidden grid-cols-[minmax(0,1.9fr)_minmax(150px,0.9fr)_minmax(150px,0.8fr)_128px] items-center gap-4 border-b border-line px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>Skenario</span>
          <span>Batas Waktu</span>
          <span>Progres</span>
          <span className="sr-only">Aksi</span>
        </div>

        {qTugas.isLoading ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted">
            <Loader2 size={24} className="animate-spin text-navy-900" />
            <p className="mt-3 text-xs">Memuat penugasan praktikum...</p>
          </div>
        ) : qTugas.isError ? (
          <div className="p-8 text-center text-sm text-red-700">
            <p className="font-semibold">Gagal memuat daftar penugasan.</p>
            <button
              type="button"
              onClick={() => qTugas.refetch()}
              className="mt-2 text-xs font-medium text-navy-900 underline"
            >
              Coba muat ulang
            </button>
          </div>
        ) : groupedSections.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">
              {visibleTasks.length === 0
                ? "Belum ada tugas praktikum yang dibagikan."
                : "Tidak ada tugas yang cocok dengan filter."}
            </p>
            <p className="mt-1 text-xs text-muted">
              {visibleTasks.length === 0
                ? "Klik + Buat Tugas Baru untuk menjadwalkan skenario ke kelas."
                : "Ubah pencarian atau pilihan filter untuk melihat tugas lainnya."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {groupedSections.map((group) => (
              <div key={group.key}>
                {/* Bar Judul Grup */}
                <div className="flex items-center gap-2 border-b border-line bg-slate-50/70 px-6 py-2.5 text-xs font-semibold text-ink">
                  <span className={cn("h-2 w-2 rounded-full", group.dotCls)} />
                  <span>{group.label}</span>
                </div>

                {/* Baris Item */}
                <div className="divide-y divide-line">
                  {group.items.map((t) => {
                    const isActive = t.status === "Aktif";
                    const isPastDeadline =
                      isActive && new Date(t.deadline).getTime() < Date.now();
                    const needsReview = t.progress.perluDitinjau > 0;
                    const pct =
                      t.progress.totalMahasiswa > 0
                        ? Math.min(
                            100,
                            Math.round((t.progress.selesai / t.progress.totalMahasiswa) * 100),
                          )
                        : 0;
                    const menuOpen = openMenuId === t.id;

                    return (
                      <div
                        key={t.id}
                        className="grid grid-cols-1 items-center gap-4 px-6 py-4 transition hover:bg-slate-50/60 md:grid-cols-[minmax(0,1.9fr)_minmax(150px,0.9fr)_minmax(150px,0.8fr)_128px]"
                      >
                        {/* Kolom 1: Skenario */}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {t.skenario.judul}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {t.skenario.kode_skenario} · v{t.skenario.versi} · {t.kelas.nama_kelas}
                          </p>
                        </div>

                        {/* Kolom 2: Batas Waktu */}
                        <div className="text-xs tabular-nums">
                          <p
                            className={cn(
                              "font-medium",
                              isActive ? "text-ink" : "text-muted",
                            )}
                          >
                            {formatShortDateTime(t.deadline)}
                          </p>
                          {isPastDeadline && (
                            <p className="mt-0.5 font-medium text-amber-700">Lewat tenggat</p>
                          )}
                        </div>

                        {/* Kolom 3: Progres */}
                        <div>
                          <p className="text-xs tabular-nums text-muted">
                            <span className="font-semibold text-ink">
                              {t.progress.selesai}/{t.progress.totalMahasiswa}
                            </span>{" "}
                            selesai
                          </p>
                          <div className="mt-2 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-olive-600 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Kolom 4: Aksi */}
                        <div className="flex items-center justify-end gap-2">
                          {needsReview ? (
                            <Link
                              to={`/dosen/antrean?tugas=${encodeURIComponent(t.id)}`}
                              className="inline-flex min-w-[72px] items-center justify-center rounded-lg bg-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-gold-500"
                            >
                              Tinjau
                            </Link>
                          ) : (
                            <Link
                              to={`/dosen/rekap?tugas=${encodeURIComponent(t.id)}`}
                              className="inline-flex min-w-[72px] items-center justify-center rounded-lg border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-slate-50"
                            >
                              Rekap
                            </Link>
                          )}

                          {/* Menu Overflow ⋮ */}
                          <div
                            className="relative"
                            ref={menuOpen ? menuContainerRef : undefined}
                          >
                            <button
                              type="button"
                              aria-label="Aksi lainnya"
                              aria-expanded={menuOpen}
                              onClick={() => setOpenMenuId(menuOpen ? null : t.id)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                            >
                              <MoreVertical size={15} />
                            </button>

                            {menuOpen && (
                              <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-line bg-white p-1.5 shadow-lg">
                                {needsReview && (
                                  <Link
                                    to={`/dosen/rekap?tugas=${encodeURIComponent(t.id)}`}
                                    onClick={() => setOpenMenuId(null)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-slate-50"
                                  >
                                    <BarChart3 size={13} className="text-muted" />
                                    Lihat Rekap Tugas
                                  </Link>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditDeadline(t)}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-slate-50"
                                >
                                  <Pencil size={13} className="text-muted" />
                                  Edit Deadline
                                </button>

                                {isActive ? (
                                  <button
                                    type="button"
                                    disabled={mutStatus.isPending}
                                    onClick={() =>
                                      mutStatus.mutate({ id: t.id, status: "Selesai" })
                                    }
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-slate-50"
                                  >
                                    <CheckCircle2 size={13} className="text-muted" />
                                    Tutup Sesi (Selesai)
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={mutStatus.isPending}
                                    onClick={() =>
                                      mutStatus.mutate({ id: t.id, status: "Aktif" })
                                    }
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-slate-50"
                                  >
                                    <RotateCcw size={13} className="text-muted" />
                                    Aktifkan Kembali
                                  </button>
                                )}

                                <div className="my-1 border-t border-line" />

                                <button
                                  type="button"
                                  disabled={mutStatus.isPending}
                                  onClick={() =>
                                    mutStatus.mutate({ id: t.id, status: "Diarsipkan" })
                                  }
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  <Archive size={13} />
                                  Arsipkan Tugas
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL BUAT TUGAS BARU */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-tugas-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="create-tugas-title" className="text-lg font-bold text-navy-900">
                  Buat Tugas Praktikum Baru
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Mahasiswa di kelas tujuan akan melihat kasus ini di dasbor mereka sesuai status
                  yang dipilih.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-slate-100 hover:text-ink"
                aria-label="Tutup modal"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Skenario Praktikum
                </label>
                <select
                  required
                  value={form.id_skenario}
                  onChange={(e) => setForm({ ...form, id_skenario: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-900"
                >
                  <option value="" disabled>
                    {qSkenario.isLoading
                      ? "Memuat daftar skenario..."
                      : "-- Pilih Skenario Praktikum (Diterbitkan) --"}
                  </option>
                  {qSkenario.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.kode_skenario} · {s.judul} (v{s.versi})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">Kelas Tujuan</label>
                  <select
                    required
                    value={form.id_kelas}
                    onChange={(e) => setForm({ ...form, id_kelas: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-900"
                  >
                    <option value="" disabled>
                      -- Pilih Kelas --
                    </option>
                    {qKelas.data?.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama_kelas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">Status Awal</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as StatusTugas })
                    }
                    className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-900"
                  >
                    <option value="Aktif">Aktif (Langsung Dibuka)</option>
                    <option value="Selesai">Selesai (Ditutup)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">
                  Batas Waktu (Deadline) Pengerjaan
                </label>
                <input
                  type="datetime-local"
                  required
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-900"
                />
              </div>

              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:bg-slate-50 hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={mutCreate.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50"
                >
                  {mutCreate.isPending ? "Menyimpan..." : "Simpan & Distribusikan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT DEADLINE */}
      {editingTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-deadline-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-100 text-amber-900">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <h3 id="edit-deadline-title" className="text-base font-bold text-navy-900">
                    Ubah Batas Waktu Tugas
                  </h3>
                  <p className="text-xs text-muted">
                    {editingTask.skenario.kode_skenario} · {editingTask.kelas.nama_kelas}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded-lg p-1 text-muted hover:bg-slate-100 hover:text-ink"
                aria-label="Tutup modal"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDeadline} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Batas Waktu (Deadline) Baru
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editDeadlineVal}
                  onChange={(e) => setEditDeadlineVal(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-900"
                />
              </div>

              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-muted hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={mutDeadline.isPending}
                  className="rounded-xl bg-navy-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-50"
                >
                  {mutDeadline.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
