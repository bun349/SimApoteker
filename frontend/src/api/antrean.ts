import { supabase } from "@/lib/supabase";
import type { RecapKelasOption, RecapTugasOption } from "@/api/rekap";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";

export type ReviewPriority = "tinggi" | "sedang" | "rendah";

export interface ReviewQueueItem {
  id_sesi: string;
  kode_sesi: string;
  id_mahasiswa: string;
  nama_mahasiswa: string;
  nomor_induk: string;
  id_kelas: string;
  nama_kelas: string;
  id_tugas: string | null;
  id_skenario: string;
  kode_skenario: string;
  versi_skenario: string;
  judul_skenario: string;
  jenis_skenario: string;
  waktu_selesai: string | null;
  nilai_sistem: number | null;
  skor_komunikasi: number | null;
  skor_konten: number | null;
  prioritas: ReviewPriority;
  priority_rank: number;
  pemicu_judul: string;
  pemicu_deskripsi: string;
  alasan_tinjau_dosen: string[];
  jumlah_kesalahan_kritis: number;
}

export interface DosenReviewQueueResponse {
  filters: {
    kelas_list: RecapKelasOption[];
    tugas_list: RecapTugasOption[];
  };
  total_antrean: number;
  items: ReviewQueueItem[];
}

export interface SubmitDosenReviewPayload {
  sessionId: string;
  idDosen: string;
  namaDosen?: string;
  isOverridden: boolean;
  skorKomunikasiDosen: number | null;
  skorKontenDosen: number | null;
  nilaiResmiAkhir: number;
  catatanOverrideButir?: Record<string, string>;
  komentarDosenUntukMahasiswa?: string;
  alasanPerubahan?: string;
}

interface FetchQueueParams {
  idDosen: string;
  authUserId?: string | null;
  idKelas?: string;
  idTugas?: string;
  search?: string;
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

async function fetchDosenReviewQueueFromSupabase(
  params: FetchQueueParams,
): Promise<DosenReviewQueueResponse> {
  const dosenCandidates = Array.from(
    new Set([params.idDosen, params.authUserId].filter((x): x is string => Boolean(x))),
  );

  // 1. Kelas milik dosen (kelas.id_dosen -> pengguna.id)
  const { data: kelasData, error: kelasErr } = await supabase
    .from("kelas")
    .select("id, nama_kelas, kode_kelas, id_dosen")
    .in("id_dosen", dosenCandidates)
    .order("nama_kelas", { ascending: true });

  if (kelasErr) throw new Error("Gagal memuat daftar kelas.");

  const kelasRows = ((kelasData || []) as Array<Record<string, any>>).slice();
  const kelasMap = new Map<string, Record<string, any>>();
  for (const k of kelasRows) {
    if (k.id) kelasMap.set(String(k.id), k);
  }
  const allKelasIds = Array.from(kelasMap.keys());

  // 2. Tugas praktikum untuk kelas milik dosen + dibuat dosen ini
  const tugasById = new Map<string, Record<string, any>>();
  const tugasQueries: PromiseLike<{ data: any[] | null }>[] = [];
  if (allKelasIds.length > 0) {
    tugasQueries.push(
      supabase
        .from("tugas_praktikum")
        .select("id, id_skenario, id_kelas, deadline, status, id_dosen_penugasan, created_at")
        .in("id_kelas", allKelasIds)
        .neq("status", "Diarsipkan")
        .order("created_at", { ascending: true }),
    );
  }
  if (dosenCandidates.length > 0) {
    tugasQueries.push(
      supabase
        .from("tugas_praktikum")
        .select("id, id_skenario, id_kelas, deadline, status, id_dosen_penugasan, created_at")
        .in("id_dosen_penugasan", dosenCandidates)
        .neq("status", "Diarsipkan")
        .order("created_at", { ascending: true }),
    );
  }

  const tugasResults = await Promise.all(tugasQueries);
  for (const res of tugasResults) {
    for (const t of (res.data || []) as Array<Record<string, any>>) {
      if (t.id && !tugasById.has(String(t.id))) {
        tugasById.set(String(t.id), t);
      }
    }
  }

  const tugasRowsRaw = Array.from(tugasById.values()).sort((a, b) =>
    String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );

  const missingKelasIds = Array.from(
    new Set(
      tugasRowsRaw
        .map((t) => String(t.id_kelas || ""))
        .filter((id) => id && !kelasMap.has(id)),
    ),
  );
  if (missingKelasIds.length > 0) {
    const { data: extraKelas } = await supabase
      .from("kelas")
      .select("id, nama_kelas, kode_kelas, id_dosen")
      .in("id", missingKelasIds);
    for (const k of (extraKelas || []) as Array<Record<string, any>>) {
      if (k.id && !kelasMap.has(String(k.id))) {
        kelasMap.set(String(k.id), k);
        kelasRows.push(k);
      }
    }
    kelasRows.sort((a, b) => String(a.nama_kelas || "").localeCompare(String(b.nama_kelas || "")));
  }

  const finalAllKelasIds = Array.from(kelasMap.keys());

  const skenarioIds = Array.from(
    new Set(tugasRowsRaw.map((t) => String(t.id_skenario || "")).filter(Boolean)),
  );
  const skenarioMap = new Map<string, Record<string, any>>();
  if (skenarioIds.length > 0) {
    const { data: skenData } = await supabase
      .from("skenario_praktikum")
      .select("id, kode_skenario, versi, judul, jenis")
      .in("id", skenarioIds);
    for (const sc of (skenData || []) as Array<Record<string, any>>) {
      if (sc.id) skenarioMap.set(String(sc.id), sc);
    }
  }

  const allTugas: RecapTugasOption[] = [];
  const tugasByKelasSken = new Map<string, RecapTugasOption>();
  for (const t of tugasRowsRaw) {
    const skId = String(t.id_skenario || "");
    const klsId = String(t.id_kelas || "");
    const sken = skenarioMap.get(skId) || {};
    const kls = kelasMap.get(klsId) || {};
    const opt: RecapTugasOption = {
      id_tugas: String(t.id),
      id_skenario: skId,
      id_kelas: klsId,
      nama_kelas: String(kls.nama_kelas || "Kelas"),
      kode_skenario: String(sken.kode_skenario || "-"),
      versi: String(sken.versi || "0.1"),
      judul: String(sken.judul || "Skenario Praktikum"),
      jenis: String(sken.jenis || "swamedikasi"),
      deadline: t.deadline ? String(t.deadline) : null,
      status: String(t.status || "Aktif"),
    };
    allTugas.push(opt);
    tugasByKelasSken.set(`${klsId}::${skId}`, opt);
  }

  const selectedTugasObj =
    params.idTugas && params.idTugas !== "semua"
      ? allTugas.find((t) => t.id_tugas === params.idTugas) || null
      : null;

  const activeKelasIds =
    params.idKelas && params.idKelas !== "semua" && kelasMap.has(params.idKelas)
      ? [params.idKelas]
      : selectedTugasObj && kelasMap.has(selectedTugasObj.id_kelas)
        ? [selectedTugasObj.id_kelas]
        : finalAllKelasIds;

  // 3. Mahasiswa pada kelas aktif
  let studentRows: Array<Record<string, any>> = [];
  if (activeKelasIds.length > 0) {
    const { data: mhsData } = await supabase
      .from("pengguna")
      .select("id, nama_lengkap, nomor_induk, email, id_kelas")
      .eq("peran", "mahasiswa")
      .in("id_kelas", activeKelasIds);
    studentRows = (mhsData || []) as Array<Record<string, any>>;
  }

  const studentMap = new Map<string, Record<string, any>>();
  for (const m of studentRows) {
    if (m.id) studentMap.set(String(m.id), m);
  }
  const studentIds = Array.from(studentMap.keys());

  // 4. Sesi praktikum
  let sessionsRaw: Array<Record<string, any>> = [];
  if (studentIds.length > 0) {
    let sessQ = supabase
      .from("sesi_simulasi")
      .select(
        "id, kode_sesi, id_mahasiswa, id_skenario, mode, jumlah_giliran_mahasiswa, jumlah_giliran_valid, status_evaluasi, perlu_ditinjau_dosen, alasan_tinjau_dosen, penanda_khusus, waktu_mulai, waktu_selesai, durasi_aktif_detik",
      )
      .eq("mode", "praktikum")
      .in("id_mahasiswa", studentIds)
      .order("waktu_selesai", { ascending: false });
    if (selectedTugasObj) {
      sessQ = sessQ.eq("id_skenario", selectedTugasObj.id_skenario);
    }
    const { data: sessData } = await sessQ;
    sessionsRaw = (sessData || []) as Array<Record<string, any>>;
  }

  const missingSkenIds = Array.from(
    new Set(
      sessionsRaw
        .map((s) => String(s.id_skenario || ""))
        .filter((id) => id && !skenarioMap.has(id)),
    ),
  );
  if (missingSkenIds.length > 0) {
    const { data: exSken } = await supabase
      .from("skenario_praktikum")
      .select("id, kode_skenario, versi, judul, jenis")
      .in("id", missingSkenIds);
    for (const sc of (exSken || []) as Array<Record<string, any>>) {
      if (sc.id) skenarioMap.set(String(sc.id), sc);
    }
  }

  // 5. Rapor penilaian
  const sessIds = sessionsRaw.map((s) => String(s.id)).filter(Boolean);
  const raporMap = new Map<string, Record<string, any>>();
  if (sessIds.length > 0) {
    const { data: rpData } = await supabase
      .from("rapor_penilaian")
      .select(
        "id_sesi, skor_komunikasi_tampil, skor_komunikasi_mentah, skor_konten_tampil, skor_konten_mentah, nilai_gabungan_sistem_tampil, nilai_gabungan_sistem_mentah, nilai_resmi_akhir, detail_kesalahan_kritis, detail_butir_konten, status_rapor, metadata_evaluasi",
      )
      .in("id_sesi", sessIds);
    for (const rp of (rpData || []) as Array<Record<string, any>>) {
      if (rp.id_sesi) raporMap.set(String(rp.id_sesi), rp);
    }
  }

  const searchQ = (params.search || "").trim().toLowerCase();
  const queueItems: ReviewQueueItem[] = [];

  for (const s of sessionsRaw) {
    const sid = String(s.id);
    const stEval = String(s.status_evaluasi || "berjalan");
    const rp = raporMap.get(sid);
    const rpSt = String(rp?.status_rapor || "");

    if (stEval === "selesai_ditinjau" || rpSt === "selesai_ditinjau") continue;
    if (stEval === "berjalan") continue;

    const needsReview =
      stEval === "perlu_ditinjau_dosen" ||
      rpSt === "perlu_ditinjau_dosen" ||
      (Boolean(s.perlu_ditinjau_dosen) && rpSt !== "otomatis");

    if (!needsReview) continue;

    const mid = String(s.id_mahasiswa || "");
    const mhs = studentMap.get(mid) || {};
    const namaMhs = String(mhs.nama_lengkap || "Mahasiswa");
    const npm = String(mhs.nomor_induk || "-");
    const klsId = String(mhs.id_kelas || "");
    const namaKelas = String(kelasMap.get(klsId)?.nama_kelas || "-");

    if (searchQ && !namaMhs.toLowerCase().includes(searchQ) && !npm.toLowerCase().includes(searchQ)) {
      continue;
    }

    const skId = String(s.id_skenario || "");
    const sc = skenarioMap.get(skId) || {};
    const matchedTugas = tugasByKelasSken.get(`${klsId}::${skId}`);

    const kkRaw = rp?.detail_kesalahan_kritis;
    const kkItems: Array<Record<string, any>> = Array.isArray(kkRaw)
      ? kkRaw
      : Array.isArray(kkRaw?.items)
        ? kkRaw.items
        : [];
    const activeKk = kkItems.filter((kk) => kk && typeof kk === "object" && !kk.dikoreksi);
    const lateKk = activeKk.filter((kk) =>
      String(kk.status_koreksi || "")
        .toLowerCase()
        .includes("terlambat"),
    );

    const butirRaw = rp?.detail_butir_konten;
    const butirItems: Array<Record<string, any>> = Array.isArray(butirRaw)
      ? butirRaw
      : Array.isArray(butirRaw?.items)
        ? butirRaw.items
        : [];
    const ambigItems = butirItems.filter((b) => b && typeof b === "object" && Boolean(b.ambigu));

    const alasanList: string[] = Array.isArray(s.alasan_tinjau_dosen)
      ? s.alasan_tinjau_dosen.map(String)
      : [];
    const metaAlasan = rp?.metadata_evaluasi?.alasan_tinjau_dosen;
    if (Array.isArray(metaAlasan)) {
      for (const a of metaAlasan) {
        if (!alasanList.includes(String(a))) alasanList.push(String(a));
      }
    }

    let priorityRank = 3;
    let prioritas: ReviewPriority = "rendah";
    let pemicuJudul = "Verifikasi manual diperlukan";
    let pemicuDeskripsi = "Sesi ditandai perlu ditinjau sebelum nilai resmi diterbitkan.";

    if (lateKk.length > 0) {
      const first = lateKk[0];
      priorityRank = 2;
      prioritas = "sedang";
      pemicuJudul = "Koreksi mandiri terlambat";
      pemicuDeskripsi = String(
        first.status_koreksi ||
          first.deskripsi ||
          first.judul ||
          "Koreksi dilakukan melewati batas toleransi giliran.",
      );
    } else if (activeKk.length > 0) {
      const first = activeKk[0];
      priorityRank = 1;
      prioritas = "tinggi";
      const kkCode = String(first.id || first.kode || "KK");
      pemicuJudul = `Kesalahan kritis ${kkCode}`;
      pemicuDeskripsi = String(
        first.deskripsi ||
          first.judul ||
          "Terdeteksi kesalahan klinis kritis yang memerlukan verifikasi dosen.",
      );
    } else if (ambigItems.length > 0) {
      const first = ambigItems[0];
      priorityRank = 3;
      prioritas = "rendah";
      pemicuJudul = "Butir kritis ambigu";
      pemicuDeskripsi = `Butir ${first.kode || "K"} (${first.parameter || "butir klinis"}) perlu verifikasi dosen.`;
    } else if (alasanList.length > 0) {
      priorityRank = alasanList.some((a) => a.toLowerCase().includes("kritis")) ? 2 : 3;
      prioritas = priorityRank === 2 ? "sedang" : "rendah";
      pemicuJudul = "Perlu verifikasi dosen";
      pemicuDeskripsi = alasanList[0];
    }

    const nilaiSistem =
      toInt(rp?.nilai_gabungan_sistem_tampil) ?? toInt(rp?.nilai_gabungan_sistem_mentah);
    const skorKom = toInt(rp?.skor_komunikasi_tampil) ?? toInt(rp?.skor_komunikasi_mentah);
    const skorKon = toInt(rp?.skor_konten_tampil) ?? toInt(rp?.skor_konten_mentah);

    queueItems.push({
      id_sesi: sid,
      kode_sesi: String(s.kode_sesi || ""),
      id_mahasiswa: mid,
      nama_mahasiswa: namaMhs,
      nomor_induk: npm,
      id_kelas: klsId,
      nama_kelas: namaKelas,
      id_tugas: matchedTugas?.id_tugas ?? null,
      id_skenario: skId,
      kode_skenario: String(sc.kode_skenario || "-"),
      versi_skenario: String(sc.versi || "0.1"),
      judul_skenario: String(sc.judul || "Skenario Praktikum"),
      jenis_skenario: String(sc.jenis || "swamedikasi"),
      waktu_selesai: (s.waktu_selesai || s.waktu_mulai) ? String(s.waktu_selesai || s.waktu_mulai) : null,
      nilai_sistem: nilaiSistem,
      skor_komunikasi: skorKom,
      skor_konten: skorKon,
      prioritas,
      priority_rank: priorityRank,
      pemicu_judul: pemicuJudul,
      pemicu_deskripsi: pemicuDeskripsi,
      alasan_tinjau_dosen: alasanList,
      jumlah_kesalahan_kritis: activeKk.length,
    });
  }

  queueItems.sort((a, b) => {
    if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
    if (b.jumlah_kesalahan_kritis !== a.jumlah_kesalahan_kritis) {
      return b.jumlah_kesalahan_kritis - a.jumlah_kesalahan_kritis;
    }
    return String(b.waktu_selesai || "").localeCompare(String(a.waktu_selesai || ""));
  });

  return {
    filters: {
      kelas_list: kelasRows.map((k) => ({
        id: String(k.id),
        nama_kelas: String(k.nama_kelas || "Kelas"),
        kode_kelas: k.kode_kelas ? String(k.kode_kelas) : null,
      })),
      tugas_list: allTugas,
    },
    total_antrean: queueItems.length,
    items: queueItems,
  };
}

export async function fetchDosenReviewQueueApi(
  params: FetchQueueParams,
): Promise<DosenReviewQueueResponse> {
  try {
    const qs = new URLSearchParams();
    qs.set("id_dosen", params.idDosen);
    if (params.idKelas && params.idKelas !== "semua") qs.set("id_kelas", params.idKelas);
    if (params.idTugas && params.idTugas !== "semua") qs.set("id_tugas", params.idTugas);
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());

    const res = await fetch(`${API_BASE}/api/evaluation/dosen/antrean?${qs.toString()}`);
    if (res.ok) {
      const json = (await res.json()) as DosenReviewQueueResponse;
      if (json && json.filters && Array.isArray(json.items)) {
        return json;
      }
    }
  } catch {
    // Fallback langsung ke Supabase jika backend belum direstart / tidak terjangkau
  }

  return fetchDosenReviewQueueFromSupabase(params);
}

export async function submitDosenReviewApi(payload: SubmitDosenReviewPayload): Promise<void> {
  const requestBody = JSON.stringify({
    id_dosen: payload.idDosen,
    is_overridden: true,
    skor_komunikasi_dosen: payload.skorKomunikasiDosen,
    skor_konten_dosen: payload.skorKontenDosen,
    nilai_resmi_akhir: payload.nilaiResmiAkhir,
    catatan_override_butir: payload.catatanOverrideButir ?? {},
    komentar_dosen_untuk_mahasiswa: payload.komentarDosenUntukMahasiswa ?? null,
    alasan_perubahan: payload.alasanPerubahan ?? null,
  });

  // 1. Coba endpoint PUT /api/evaluation/dosen/rapor/{session_id}/review (lalu POST alias bila perlu)
  try {
    const res = await fetch(
      `${API_BASE}/api/evaluation/dosen/rapor/${encodeURIComponent(payload.sessionId)}/review`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      },
    );
    if (res.ok) return;
    if (res.status === 400) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || "Sesi tidak memenuhi syarat untuk dinilai.");
    }
  } catch (err) {
    if (err instanceof Error && /tidak memenuhi syarat|tidak dapat diberi nilai/i.test(err.message)) {
      throw err;
    }
  }

  // 2. Fallback langsung ke Supabase (tetap menjaga skor sistem AI & menambahkan log_audit_sistem)
  const { data: existingRows, error: fetchErr } = await supabase
    .from("rapor_penilaian")
    .select("nilai_resmi_akhir, nilai_gabungan_sistem_tampil, status_rapor, log_audit_sistem")
    .eq("id_sesi", payload.sessionId)
    .limit(1);

  if (fetchErr || !existingRows || existingRows.length === 0) {
    throw new Error("Rapor untuk sesi ini belum tersedia untuk ditinjau.");
  }

  const existing = existingRows[0] as Record<string, any>;
  if (String(existing.status_rapor || "") === "tidak_dapat_dinilai") {
    const { data: sessCheck } = await supabase
      .from("sesi_simulasi")
      .select("jumlah_giliran_valid")
      .eq("id", payload.sessionId)
      .limit(1);
    const validTurns = Number((sessCheck || [])[0]?.jumlah_giliran_valid || 0);
    if (validTurns === 0) {
      throw new Error(
        "Sesi berstatus tidak_dapat_dinilai tanpa percakapan valid tidak dapat diberi nilai resmi.",
      );
    }
  }

  const nowIso = new Date().toISOString();
  const waktuWib = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const prevScore = existing.nilai_resmi_akhir ?? existing.nilai_gabungan_sistem_tampil ?? "—";
  const prevStatus = String(existing.status_rapor || "otomatis");
  const cleanButir = payload.catatanOverrideButir ?? {};
  const butirSummary = Object.entries(cleanButir)
    .filter(([, v]) => v.trim().length > 0)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("; ");
  const reasonNote =
    payload.alasanPerubahan?.trim() ||
    butirSummary ||
    payload.komentarDosenUntukMahasiswa?.trim() ||
    "";

  const auditEntry =
    `[TINJAUAN DOSEN] Nilai resmi diperbarui dari ${prevScore} menjadi ${payload.nilaiResmiAkhir} ` +
    `(status sebelumnya: ${prevStatus}) oleh ${payload.namaDosen || "Dosen Penguji"} pada ${waktuWib} WIB` +
    (reasonNote ? ` — catatan: ${reasonNote.slice(0, 220)}` : "");

  const nextLogs = [
    ...(Array.isArray(existing.log_audit_sistem) ? existing.log_audit_sistem.map(String) : []),
    auditEntry,
  ];

  const { error: rpErr } = await supabase
    .from("rapor_penilaian")
    .update({
      is_overridden: true,
      id_dosen_peninjau: payload.idDosen,
      skor_komunikasi_dosen: payload.skorKomunikasiDosen,
      skor_konten_dosen: payload.skorKontenDosen,
      nilai_resmi_akhir: payload.nilaiResmiAkhir,
      catatan_override_butir: cleanButir,
      komentar_dosen_untuk_mahasiswa: payload.komentarDosenUntukMahasiswa?.trim() || null,
      waktu_ditinjau: nowIso,
      status_rapor: "selesai_ditinjau",
      log_audit_sistem: nextLogs,
      updated_at: nowIso,
    })
    .eq("id_sesi", payload.sessionId);

  if (rpErr) throw new Error("Gagal menyimpan hasil tinjauan pada rapor penilaian.");

  const { error: sessErr } = await supabase
    .from("sesi_simulasi")
    .update({
      status_evaluasi: "selesai_ditinjau",
      perlu_ditinjau_dosen: false,
    })
    .eq("id", payload.sessionId);

  if (sessErr) throw new Error("Gagal memperbarui status sesi simulasi.");
}
