import { supabase } from "@/lib/supabase";

export type StatusTugas = "Aktif" | "Selesai" | "Diarsipkan";

export interface KelasDropdown {
  id: string;
  nama_kelas: string;
  kode_kelas?: string;
}

export interface SkenarioDropdown {
  id: string;
  kode_skenario: string;
  judul: string;
  versi: string;
  jenis: string;
}

export interface TugasPraktikum {
  id: string;
  id_skenario: string;
  id_kelas: string;
  deadline: string;
  status: StatusTugas;
  created_at: string;
  updated_at?: string;
  skenario: {
    id: string;
    kode_skenario: string;
    judul: string;
    versi: string;
    jenis: string;
  };
  kelas: {
    id: string;
    nama_kelas: string;
    kode_kelas?: string;
  };
  progress: {
    selesai: number;
    totalMahasiswa: number;
    perluDitinjau: number;
  };
}

const COMPLETED_STATUSES = [
  "selesai_otomatis",
  "perlu_ditinjau_dosen",
  "selesai_ditinjau",
] as const;

// 1. Ambil daftar kelas milik dosen ini
export async function fetchKelasDosen(dosenId: string): Promise<KelasDropdown[]> {
  const { data, error } = await supabase
    .from("kelas")
    .select("id, nama_kelas, kode_kelas")
    .eq("id_dosen", dosenId)
    .order("nama_kelas", { ascending: true });

  if (error) throw new Error("Gagal mengambil data kelas.");
  return (data || []) as KelasDropdown[];
}

// 2. Ambil skenario yang rilis dan memuat tag 'praktikum'
export async function fetchSkenarioPraktikum(dosenId: string): Promise<SkenarioDropdown[]> {
  const { data, error } = await supabase
    .from("skenario_praktikum")
    .select("id, kode_skenario, judul, versi, jenis")
    .eq("id_dosen_penyusun", dosenId)
    .eq("status_rilis", "diterbitkan")
    .contains("mode_rilis", ["praktikum"])
    .order("created_at", { ascending: false });

  if (error) throw new Error("Gagal mengambil daftar skenario.");
  return (data || []) as SkenarioDropdown[];
}

// 3. Ambil daftar tugas yang sudah didistribusikan beserta progres pengerjaan ringkas per kelas
export async function fetchDaftarTugas(dosenId: string): Promise<TugasPraktikum[]> {
  // Ambil kelas milik dosen (kelas.id_dosen -> pengguna.id) agar tugas yang id_dosen_penugasan-nya auth.uid() tetap terbaca
  const { data: kelasOwned } = await supabase
    .from("kelas")
    .select("id, nama_kelas, kode_kelas")
    .eq("id_dosen", dosenId);

  const kelasMap = new Map<string, { id: string; nama_kelas: string; kode_kelas?: string }>();
  for (const k of (kelasOwned || []) as Array<Record<string, any>>) {
    if (k.id) {
      kelasMap.set(String(k.id), {
        id: String(k.id),
        nama_kelas: String(k.nama_kelas || "Kelas"),
        kode_kelas: k.kode_kelas ? String(k.kode_kelas) : undefined,
      });
    }
  }
  const ownedKelasIds = Array.from(kelasMap.keys());

  const tugasById = new Map<string, Record<string, any>>();
  const queries: PromiseLike<{ data: any[] | null; error: any }>[] = [];
  if (ownedKelasIds.length > 0) {
    queries.push(
      supabase
        .from("tugas_praktikum")
        .select("id, id_skenario, id_kelas, deadline, status, created_at, updated_at")
        .in("id_kelas", ownedKelasIds)
        .order("created_at", { ascending: false }),
    );
  }
  queries.push(
    supabase
      .from("tugas_praktikum")
      .select("id, id_skenario, id_kelas, deadline, status, created_at, updated_at")
      .eq("id_dosen_penugasan", dosenId)
      .order("created_at", { ascending: false }),
  );

  const results = await Promise.all(queries);
  for (const res of results) {
    if (res.error) continue;
    for (const row of (res.data || []) as Array<Record<string, any>>) {
      if (row.id && !tugasById.has(String(row.id))) {
        tugasById.set(String(row.id), row);
      }
    }
  }

  const rawRows = Array.from(tugasById.values()).sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || "")),
  );
  if (rawRows.length === 0) return [];

  const kelasIds = Array.from(
    new Set(rawRows.map((r) => String(r.id_kelas || "")).filter(Boolean)),
  );
  const skenarioIds = Array.from(
    new Set(rawRows.map((r) => String(r.id_skenario || "")).filter(Boolean)),
  );

  // Lengkapi kelas yang belum ada di kelasMap + ambil metadata skenario secara terpisah
  const missingKelasIds = kelasIds.filter((id) => !kelasMap.has(id));
  const [extraKelasRes, skenarioRes] = await Promise.all([
    missingKelasIds.length > 0
      ? supabase.from("kelas").select("id, nama_kelas, kode_kelas").in("id", missingKelasIds)
      : Promise.resolve({ data: [] as Record<string, any>[] }),
    skenarioIds.length > 0
      ? supabase
          .from("skenario_praktikum")
          .select("id, kode_skenario, judul, versi, jenis")
          .in("id", skenarioIds)
      : Promise.resolve({ data: [] as Record<string, any>[] }),
  ]);

  for (const k of (extraKelasRes.data || []) as Array<Record<string, any>>) {
    if (k.id) {
      kelasMap.set(String(k.id), {
        id: String(k.id),
        nama_kelas: String(k.nama_kelas || "Kelas"),
        kode_kelas: k.kode_kelas ? String(k.kode_kelas) : undefined,
      });
    }
  }

  const skenarioMap = new Map<string, Record<string, any>>();
  for (const s of (skenarioRes.data || []) as Array<Record<string, any>>) {
    if (s.id) skenarioMap.set(String(s.id), s);
  }

  // Hitung jumlah mahasiswa per kelas & progres sesi praktikum (graceful bila RLS membatasi)
  const studentsByClass = new Map<string, Set<string>>();
  const classOfStudent = new Map<string, string>();

  if (kelasIds.length > 0) {
    const { data: mhsRows } = await supabase
      .from("pengguna")
      .select("id, id_kelas")
      .eq("peran", "mahasiswa")
      .in("id_kelas", kelasIds);

    for (const m of (mhsRows || []) as Array<{ id: string; id_kelas: string | null }>) {
      if (!m.id_kelas) continue;
      if (!studentsByClass.has(m.id_kelas)) {
        studentsByClass.set(m.id_kelas, new Set());
      }
      studentsByClass.get(m.id_kelas)!.add(m.id);
      classOfStudent.set(m.id, m.id_kelas);
    }
  }

  // Key: `${id_kelas}::${id_skenario}`
  const completedByKey = new Map<string, Set<string>>();
  const reviewByKey = new Map<string, Set<string>>();

  if (skenarioIds.length > 0 && classOfStudent.size > 0) {
    const studentIds = Array.from(classOfStudent.keys());
    const { data: sesiRows } = await supabase
      .from("sesi_simulasi")
      .select("id_mahasiswa, id_skenario, status_evaluasi, perlu_ditinjau_dosen")
      .eq("mode", "praktikum")
      .in("id_skenario", skenarioIds)
      .in("id_mahasiswa", studentIds);

    for (const s of (sesiRows || []) as Array<{
      id_mahasiswa: string;
      id_skenario: string;
      status_evaluasi: string;
      perlu_ditinjau_dosen: boolean;
    }>) {
      const klsId = classOfStudent.get(s.id_mahasiswa);
      if (!klsId) continue;
      const key = `${klsId}::${s.id_skenario}`;

      if ((COMPLETED_STATUSES as readonly string[]).includes(s.status_evaluasi)) {
        if (!completedByKey.has(key)) completedByKey.set(key, new Set());
        completedByKey.get(key)!.add(s.id_mahasiswa);
      }

      if (
        s.status_evaluasi !== "selesai_ditinjau" &&
        (s.status_evaluasi === "perlu_ditinjau_dosen" || s.perlu_ditinjau_dosen)
      ) {
        if (!reviewByKey.has(key)) reviewByKey.set(key, new Set());
        reviewByKey.get(key)!.add(s.id_mahasiswa);
      }
    }
  }

  return rawRows.map((d) => {
    const sken = skenarioMap.get(String(d.id_skenario || ""));
    const kls = kelasMap.get(String(d.id_kelas || ""));
    const key = `${d.id_kelas}::${d.id_skenario}`;
    const totalMahasiswa = studentsByClass.get(String(d.id_kelas))?.size ?? 0;
    const selesai = completedByKey.get(key)?.size ?? 0;
    const perluDitinjau = reviewByKey.get(key)?.size ?? 0;

    return {
      id: String(d.id),
      id_skenario: String(d.id_skenario),
      id_kelas: String(d.id_kelas),
      deadline: String(d.deadline),
      status: (d.status || "Aktif") as StatusTugas,
      created_at: String(d.created_at),
      updated_at: d.updated_at ? String(d.updated_at) : undefined,
      skenario: {
        id: String(sken?.id || d.id_skenario),
        kode_skenario: String(sken?.kode_skenario || "-"),
        judul: String(sken?.judul || "Skenario Praktikum"),
        versi: String(sken?.versi || "0.1"),
        jenis: String(sken?.jenis || "swamedikasi"),
      },
      kelas: {
        id: String(kls?.id || d.id_kelas),
        nama_kelas: String(kls?.nama_kelas || "Kelas"),
        kode_kelas: kls?.kode_kelas,
      },
      progress: {
        selesai,
        totalMahasiswa,
        perluDitinjau,
      },
    };
  });
}

// 4. Simpan tugas baru
export async function createTugas(
  dosenId: string,
  payload: {
    id_skenario: string;
    id_kelas: string;
    deadline: string;
    status?: StatusTugas;
  },
) {
  const { error } = await supabase.from("tugas_praktikum").insert({
    id_skenario: payload.id_skenario,
    id_kelas: payload.id_kelas,
    deadline: new Date(payload.deadline).toISOString(),
    id_dosen_penugasan: dosenId,
    status: payload.status || "Aktif",
  });

  if (error) throw new Error("Gagal membuat tugas praktikum.");
}

// 5. Ubah status (Aktif / Selesai / Diarsipkan)
export async function updateStatusTugas(id: string, _dosenId: string, status: StatusTugas) {
  const { error } = await supabase
    .from("tugas_praktikum")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Gagal mengubah status tugas.");
}

// 6. Ubah tenggat waktu (deadline)
export async function updateDeadlineTugas(id: string, _dosenId: string, deadline: string) {
  const { error } = await supabase
    .from("tugas_praktikum")
    .update({
      deadline: new Date(deadline).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error("Gagal memperbarui batas waktu tugas.");
}
