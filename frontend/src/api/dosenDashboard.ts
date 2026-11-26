import { supabase } from "@/lib/supabase";
import { fetchDosenRecapApi, type DosenRecapResponse } from "@/api/rekap";
import { fetchDosenReviewQueueApi } from "@/api/antrean";

export type DashboardSessionStatus =
  | "perlu_ditinjau"
  | "selesai"
  | "tidak_cukup_data";

export interface DashboardSessionSnippet {
  id_sesi: string;
  kode_sesi: string;
  id_mahasiswa: string;
  nama_mahasiswa: string;
  nomor_induk: string;
  id_kelas: string;
  nama_kelas: string;
  id_skenario: string;
  kode_skenario: string;
  versi_skenario: string;
  judul_skenario: string;
  waktu_selesai: string | null;
  nilai_sistem: number | null;
  nilai_resmi: number | null;
  is_overridden: boolean;
  status_ui: DashboardSessionStatus;
  diagnostik: string;
}

export interface DashboardScenarioQuickItem {
  id: string;
  kode_skenario: string;
  versi: string;
  judul: string;
  jenis: string;
  status_rilis: string;
  updated_at: string;
}

export interface KamusIstilahItem {
  id: number;
  kelompok: string;
  istilah: string;
  variasi_ejaan: string[];
  padanan_awam: string[];
}

export interface DosenDashboardData {
  recap: DosenRecapResponse;
  pendingReviewCount: number;
  recentSessions: DashboardSessionSnippet[];
  quickScenarios: DashboardScenarioQuickItem[];
  scenarioCounts: {
    diterbitkan: number;
    draf: number;
    total: number;
  };
  kamusCount: number;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n !== null ? Math.round(n) : null;
}

export async function fetchDosenDashboardData(params: {
  idDosen: string;
  authUserId?: string | null;
}): Promise<DosenDashboardData> {
  const { idDosen, authUserId } = params;

  // 1. Ambil rekap kelas & antrean secara paralel (menggunakan endpoint backend + fallback Supabase)
  const [recap, queueRes, skenarioRes, kamusRes] = await Promise.all([
    fetchDosenRecapApi({ idDosen, authUserId }),
    fetchDosenReviewQueueApi({ idDosen, authUserId }),
    supabase
      .from("skenario_praktikum")
      .select("id, kode_skenario, versi, judul, jenis, status_rilis, updated_at, created_at")
      .eq("id_dosen_penyusun", idDosen)
      .neq("status_rilis", "diarsipkan")
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("kamus_istilah_umum")
      .select("id", { count: "exact", head: true })
      .eq("aktif", true),
  ]);

  const rawScenarios = ((skenarioRes.data || []) as Array<Record<string, any>>).map((s) => ({
    id: String(s.id),
    kode_skenario: String(s.kode_skenario || "-"),
    versi: String(s.versi || "0.1"),
    judul: String(s.judul || "Skenario Praktikum"),
    jenis: String(s.jenis || "swamedikasi"),
    status_rilis: String(s.status_rilis || "draf"),
    updated_at: String(s.updated_at || s.created_at || ""),
  }));

  const diterbitkanCount = rawScenarios.filter((s) => s.status_rilis === "diterbitkan").length;
  const drafCount = rawScenarios.filter((s) => s.status_rilis === "draf").length;

  // Prioritaskan draf & diterbitkan terbaru untuk 4 kartu cepat studio
  const quickScenarios = [
    ...rawScenarios.filter((s) => s.status_rilis === "draf").slice(0, 2),
    ...rawScenarios.filter((s) => s.status_rilis === "diterbitkan").slice(0, 4),
  ].slice(0, 4);

  // 2. Ambil daftar cuplikan sesi mahasiswa terbaru dari kelas milik dosen
  const kelasIds = recap.filters.kelas_list.map((k) => k.id).filter(Boolean);
  const kelasMap = new Map(recap.filters.kelas_list.map((k) => [k.id, k.nama_kelas]));
  const studentMap = new Map(
    recap.students.map((st) => [
      st.id_mahasiswa,
      {
        nama_lengkap: st.nama_lengkap,
        nomor_induk: st.nomor_induk,
        id_kelas: st.id_kelas,
        nama_kelas: st.nama_kelas,
      },
    ]),
  );

  // Bila daftar studentMap masih kosong namun ada kelas, coba ambil mahasiswa langsung
  if (studentMap.size === 0 && kelasIds.length > 0) {
    const { data: mhsRows } = await supabase
      .from("pengguna")
      .select("id, nama_lengkap, nomor_induk, id_kelas")
      .eq("peran", "mahasiswa")
      .in("id_kelas", kelasIds);
    for (const m of (mhsRows || []) as Array<Record<string, any>>) {
      if (!m.id) continue;
      const kId = String(m.id_kelas || "");
      studentMap.set(String(m.id), {
        nama_lengkap: String(m.nama_lengkap || "Mahasiswa"),
        nomor_induk: String(m.nomor_induk || "-"),
        id_kelas: kId,
        nama_kelas: kelasMap.get(kId) || "-",
      });
    }
  }

  const studentIds = Array.from(studentMap.keys());
  const queueBySessionId = new Map(queueRes.items.map((q) => [q.id_sesi, q]));

  let recentSessions: DashboardSessionSnippet[] = [];

  if (studentIds.length > 0) {
    const { data: sessRows } = await supabase
      .from("sesi_simulasi")
      .select(
        "id, kode_sesi, id_mahasiswa, id_skenario, status_evaluasi, perlu_ditinjau_dosen, alasan_tinjau_dosen, waktu_mulai, waktu_selesai",
      )
      .eq("mode", "praktikum")
      .neq("status_evaluasi", "berjalan")
      .in("id_mahasiswa", studentIds)
      .order("waktu_selesai", { ascending: false })
      .limit(30);

    const sessions = (sessRows || []) as Array<Record<string, any>>;
    const sessIds = sessions.map((s) => String(s.id)).filter(Boolean);
    const skenIds = Array.from(
      new Set(sessions.map((s) => String(s.id_skenario || "")).filter(Boolean)),
    );

    const [rpRes, skRes] = await Promise.all([
      sessIds.length > 0
        ? supabase
            .from("rapor_penilaian")
            .select(
              "id_sesi, nilai_gabungan_sistem_tampil, nilai_gabungan_sistem_mentah, nilai_resmi_akhir, is_overridden, status_rapor, detail_kesalahan_kritis",
            )
            .in("id_sesi", sessIds)
        : Promise.resolve({ data: [] as Record<string, any>[] }),
      skenIds.length > 0
        ? supabase
            .from("skenario_praktikum")
            .select("id, kode_skenario, versi, judul")
            .in("id", skenIds)
        : Promise.resolve({ data: [] as Record<string, any>[] }),
    ]);

    const raporMap = new Map<string, Record<string, any>>();
    for (const rp of (rpRes.data || []) as Array<Record<string, any>>) {
      if (rp.id_sesi) raporMap.set(String(rp.id_sesi), rp);
    }
    const skenMap = new Map<string, Record<string, any>>();
    for (const sc of (skRes.data || []) as Array<Record<string, any>>) {
      if (sc.id) skenMap.set(String(sc.id), sc);
    }

    recentSessions = sessions.map((s) => {
      const sid = String(s.id);
      const mid = String(s.id_mahasiswa || "");
      const skId = String(s.id_skenario || "");
      const mhs = studentMap.get(mid);
      const sc = skenMap.get(skId);
      const rp = raporMap.get(sid);
      const qMatch = queueBySessionId.get(sid);

      const stEval = String(s.status_evaluasi || "selesai_otomatis");
      const rpSt = String(rp?.status_rapor || "");

      let statusUi: DashboardSessionStatus = "selesai";
      if (stEval === "selesai_ditinjau" || rpSt === "selesai_ditinjau") {
        statusUi = "selesai";
      } else if (
        qMatch ||
        stEval === "perlu_ditinjau_dosen" ||
        rpSt === "perlu_ditinjau_dosen" ||
        (Boolean(s.perlu_ditinjau_dosen) && rpSt !== "otomatis")
      ) {
        statusUi = "perlu_ditinjau";
      } else if (
        stEval === "tidak_cukup_data" ||
        stEval === "tidak_dapat_dinilai" ||
        rpSt === "tidak_cukup_data" ||
        rpSt === "tidak_dapat_dinilai"
      ) {
        statusUi = "tidak_cukup_data";
      }

      const kkRaw = rp?.detail_kesalahan_kritis;
      const kkItems: Array<Record<string, any>> = Array.isArray(kkRaw)
        ? kkRaw
        : Array.isArray(kkRaw?.items)
          ? kkRaw.items
          : [];
      const activeKkCount = kkItems.filter((k) => k && !k.dikoreksi).length;

      let diagnostik = "Evaluasi otomatis";
      if (qMatch?.pemicu_judul) {
        diagnostik = qMatch.pemicu_judul;
      } else if (statusUi === "perlu_ditinjau") {
        diagnostik =
          activeKkCount > 0
            ? `${activeKkCount} kesalahan kritis terdeteksi`
            : Array.isArray(s.alasan_tinjau_dosen) && s.alasan_tinjau_dosen[0]
              ? String(s.alasan_tinjau_dosen[0])
              : "Perlu verifikasi manual";
      } else if (statusUi === "tidak_cukup_data") {
        diagnostik = "Giliran valid belum mencukupi";
      } else if (rp?.is_overridden || stEval === "selesai_ditinjau") {
        diagnostik = "Diverifikasi dosen";
      } else if (activeKkCount === 0) {
        diagnostik = "Tanpa kesalahan kritis";
      }

      const nilaiSistem =
        toInt(rp?.nilai_gabungan_sistem_tampil) ?? toInt(rp?.nilai_gabungan_sistem_mentah);
      const nilaiResmi = toInt(rp?.nilai_resmi_akhir) ?? nilaiSistem;

      return {
        id_sesi: sid,
        kode_sesi: String(s.kode_sesi || ""),
        id_mahasiswa: mid,
        nama_mahasiswa: mhs?.nama_lengkap || "Mahasiswa",
        nomor_induk: mhs?.nomor_induk || "-",
        id_kelas: mhs?.id_kelas || "",
        nama_kelas: mhs?.nama_kelas || "-",
        id_skenario: skId,
        kode_skenario: String(sc?.kode_skenario || "-"),
        versi_skenario: String(sc?.versi || "0.1"),
        judul_skenario: String(sc?.judul || "Skenario Praktikum"),
        waktu_selesai: (s.waktu_selesai || s.waktu_mulai)
          ? String(s.waktu_selesai || s.waktu_mulai)
          : null,
        nilai_sistem: nilaiSistem,
        nilai_resmi: nilaiResmi,
        is_overridden: Boolean(rp?.is_overridden),
        status_ui: statusUi,
        diagnostik,
      };
    });
  }

  // Pastikan item dari antrean (jika Supabase RLS membatasi query langsung) tetap ikut tampil di tabel cuplikan
  const seenSess = new Set(recentSessions.map((r) => r.id_sesi));
  for (const q of queueRes.items) {
    if (seenSess.has(q.id_sesi)) continue;
    recentSessions.unshift({
      id_sesi: q.id_sesi,
      kode_sesi: q.kode_sesi,
      id_mahasiswa: q.id_mahasiswa,
      nama_mahasiswa: q.nama_mahasiswa,
      nomor_induk: q.nomor_induk,
      id_kelas: q.id_kelas,
      nama_kelas: q.nama_kelas,
      id_skenario: q.id_skenario,
      kode_skenario: q.kode_skenario,
      versi_skenario: q.versi_skenario,
      judul_skenario: q.judul_skenario,
      waktu_selesai: q.waktu_selesai,
      nilai_sistem: q.nilai_sistem,
      nilai_resmi: q.nilai_sistem,
      is_overridden: false,
      status_ui: "perlu_ditinjau",
      diagnostik: q.pemicu_judul,
    });
  }

  return {
    recap,
    pendingReviewCount: queueRes.total_antrean,
    recentSessions,
    quickScenarios,
    scenarioCounts: {
      diterbitkan: diterbitkanCount,
      draf: drafCount,
      total: rawScenarios.length,
    },
    kamusCount: kamusRes.count ?? 0,
  };
}

export async function fetchKamusIstilahUmum(): Promise<KamusIstilahItem[]> {
  const { data, error } = await supabase
    .from("kamus_istilah_umum")
    .select("id, kelompok, istilah, variasi_ejaan, padanan_awam")
    .eq("aktif", true)
    .order("kelompok", { ascending: true })
    .order("istilah", { ascending: true });

  if (error) throw new Error("Gagal memuat kamus istilah medis.");
  return ((data || []) as Array<Record<string, any>>).map((row) => ({
    id: Number(row.id),
    kelompok: String(row.kelompok || "Umum"),
    istilah: String(row.istilah || ""),
    variasi_ejaan: Array.isArray(row.variasi_ejaan) ? row.variasi_ejaan.map(String) : [],
    padanan_awam: Array.isArray(row.padanan_awam) ? row.padanan_awam.map(String) : [],
  }));
}
