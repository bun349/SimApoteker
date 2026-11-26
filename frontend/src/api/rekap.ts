import { supabase } from "@/lib/supabase";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";

export type RecapStatusFilter =
  | "semua"
  | "selesai"
  | "perlu_ditinjau"
  | "belum_mengerjakan"
  | "tidak_cukup_data";

export interface RecapKelasOption {
  id: string;
  nama_kelas: string;
  kode_kelas?: string | null;
}

export interface RecapTugasOption {
  id_tugas: string;
  id_skenario: string;
  id_kelas: string;
  nama_kelas: string;
  kode_skenario: string;
  versi: string;
  judul: string;
  jenis: string;
  deadline?: string | null;
  status: string;
}

export interface RecapSummary {
  total_mahasiswa: number;
  total_tuntas: number;
  tingkat_penyelesaian_persen: number;
  rata_rata_nilai: number | null;
  nilai_tertinggi: number | null;
  nilai_terendah: number | null;
  perlu_ditinjau_count: number;
  belum_mengerjakan_count: number;
  tidak_cukup_data_count: number;
  total_sesi_dinilai: number;
}

export interface PactPillarAggregate {
  kode: "A" | "B" | "C" | "D" | "E";
  label: string;
  rata_rata: number | null;
  jumlah_sampel: number;
}

export interface ClinicalRadarItem {
  kode: string;
  judul: string;
  kategori: string;
  tipe: "kesalahan_kritis" | "butir_terlewat";
  jumlah_praktikan: number;
  persentase: number;
}

export interface RecapTaskColumn {
  id_tugas: string;
  id_skenario: string;
  kode_skenario: string;
  versi: string;
  judul: string;
  jenis: string;
  deadline?: string | null;
  status: string;
}

export interface RecapTaskScoreCell {
  assigned: boolean;
  id_sesi: string | null;
  status_ui:
    | "selesai"
    | "perlu_ditinjau"
    | "tidak_cukup_data"
    | "belum_mengerjakan"
    | "tidak_ditugaskan";
  status_evaluasi: string | null;
  nilai_sistem: number | null;
  nilai_resmi: number | null;
  is_overridden: boolean;
  skor_komunikasi: number | null;
  skor_konten: number | null;
  jumlah_giliran: number;
}

export interface RecapStudentRow {
  id_mahasiswa: string;
  nama_lengkap: string;
  nomor_induk: string;
  id_kelas: string;
  nama_kelas: string;
  task_scores: Record<string, RecapTaskScoreCell>;
  rata_rata: number | null;
  status_ringkas: "selesai" | "perlu_ditinjau" | "tidak_cukup_data" | "belum_mengerjakan";
  latest_session_id: string | null;
}

export interface DosenRecapResponse {
  filters: {
    kelas_list: RecapKelasOption[];
    tugas_list: RecapTugasOption[];
  };
  selected_tugas: RecapTugasOption | null;
  summary: RecapSummary;
  pact_aggregate: PactPillarAggregate[];
  weakest_pillar: string | null;
  clinical_error_radar: ClinicalRadarItem[];
  task_columns: RecapTaskColumn[];
  students: RecapStudentRow[];
}

interface FetchDosenRecapParams {
  idDosen: string;
  authUserId?: string | null;
  idKelas?: string;
  idTugas?: string;
  status?: RecapStatusFilter;
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

const STATUS_PRIORITY: Record<string, number> = {
  selesai_ditinjau: 6,
  perlu_ditinjau_dosen: 5,
  selesai_otomatis: 4,
  tidak_cukup_data: 3,
  tidak_dapat_dinilai: 2,
  berjalan: 1,
};

const PACT_LABELS: Record<"A" | "B" | "C" | "D" | "E", string> = {
  A: "Membangun Koneksi",
  B: "Perspektif Pasien",
  C: "Respons Empatik",
  D: "Edukasi Kolaboratif",
  E: "Komunikasi Efektif",
};

function classifySessionStatus(
  sess: Record<string, any> | undefined,
  rapor: Record<string, any> | undefined,
): "selesai" | "perlu_ditinjau" | "tidak_cukup_data" | "belum_mengerjakan" {
  if (!sess) return "belum_mengerjakan";
  const st = String(sess.status_evaluasi || "berjalan");
  const rpSt = String(rapor?.status_rapor || "");

  if (st === "selesai_ditinjau" || rpSt === "selesai_ditinjau") return "selesai";
  if (st === "perlu_ditinjau_dosen" || rpSt === "perlu_ditinjau_dosen") return "perlu_ditinjau";
  if (
    st === "tidak_cukup_data" ||
    st === "tidak_dapat_dinilai" ||
    rpSt === "tidak_cukup_data" ||
    rpSt === "tidak_dapat_dinilai"
  ) {
    return "tidak_cukup_data";
  }
  if (st === "selesai_otomatis" || rpSt === "otomatis") {
    return sess.perlu_ditinjau_dosen && rpSt !== "otomatis" ? "perlu_ditinjau" : "selesai";
  }
  if (st === "berjalan") {
    if (
      rapor &&
      (toNum(rapor.nilai_resmi_akhir) !== null ||
        toNum(rapor.nilai_gabungan_sistem_tampil) !== null ||
        toNum(rapor.nilai_gabungan_sistem_mentah) !== null)
    ) {
      return "selesai";
    }
    return "belum_mengerjakan";
  }
  return sess.perlu_ditinjau_dosen ? "perlu_ditinjau" : "selesai";
}

async function fetchDosenRecapFromSupabase(
  params: FetchDosenRecapParams,
): Promise<DosenRecapResponse> {
  const dosenCandidates = Array.from(
    new Set([params.idDosen, params.authUserId].filter((x): x is string => Boolean(x))),
  );

  // 1. Ambil kelas milik dosen (kelas.id_dosen -> pengguna.id)
  const { data: kelasData, error: kelasErr } = await supabase
    .from("kelas")
    .select("id, nama_kelas, kode_kelas, id_dosen")
    .in("id_dosen", dosenCandidates)
    .order("nama_kelas", { ascending: true });

  if (kelasErr) throw new Error("Gagal mengambil data kelas dosen.");

  const kelasRows = ((kelasData || []) as Array<Record<string, any>>).slice();
  const kelasMap = new Map<string, Record<string, any>>();
  for (const k of kelasRows) {
    if (k.id) kelasMap.set(String(k.id), k);
  }
  const allKelasIds = Array.from(kelasMap.keys());

  // 2. Ambil tugas_praktikum berdasarkan id_kelas milik dosen + id_dosen_penugasan (pengguna.id / auth.uid())
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

  // Lengkapi kelas yang mungkin muncul dari id_dosen_penugasan
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

  // Ambil metadata skenario terpisah
  const skenarioIds = Array.from(
    new Set(tugasRowsRaw.map((t) => String(t.id_skenario || "")).filter(Boolean)),
  );
  const skenarioMap = new Map<string, Record<string, any>>();
  if (skenarioIds.length > 0) {
    const { data: skenRows } = await supabase
      .from("skenario_praktikum")
      .select("id, kode_skenario, versi, judul, jenis")
      .in("id", skenarioIds);
    for (const sc of (skenRows || []) as Array<Record<string, any>>) {
      if (sc.id) skenarioMap.set(String(sc.id), sc);
    }
  }

  const allTugas: RecapTugasOption[] = tugasRowsRaw.map((t) => {
    const skId = String(t.id_skenario || "");
    const sken = skenarioMap.get(skId) || {};
    const klsId = String(t.id_kelas || "");
    const kls = kelasMap.get(klsId) || {};
    return {
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
  });

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

  const activeTugas = selectedTugasObj
    ? [selectedTugasObj]
    : allTugas.filter((t) => activeKelasIds.includes(t.id_kelas));

  const taskColumns: RecapTaskColumn[] = [];
  const seenSken = new Set<string>();
  for (const t of activeTugas) {
    if (t.id_skenario && !seenSken.has(t.id_skenario)) {
      seenSken.add(t.id_skenario);
      taskColumns.push({
        id_tugas: t.id_tugas,
        id_skenario: t.id_skenario,
        kode_skenario: t.kode_skenario,
        versi: t.versi,
        judul: t.judul,
        jenis: t.jenis,
        deadline: t.deadline,
        status: t.status,
      });
    }
  }

  // 3. Ambil mahasiswa pada cakupan kelas aktif
  let studentRows: Array<Record<string, any>> = [];
  if (activeKelasIds.length > 0) {
    const { data: mhsData } = await supabase
      .from("pengguna")
      .select("id, nama_lengkap, nomor_induk, email, id_kelas")
      .eq("peran", "mahasiswa")
      .in("id_kelas", activeKelasIds)
      .order("nama_lengkap", { ascending: true });
    studentRows = (mhsData || []) as Array<Record<string, any>>;
  }

  const studentIds = studentRows.map((m) => String(m.id)).filter(Boolean);
  const activeSkenIds = taskColumns.map((c) => c.id_skenario).filter(Boolean);

  // 4. Ambil sesi praktikum mahasiswa
  let sessionsRaw: Array<Record<string, any>> = [];
  if (studentIds.length > 0) {
    let sessQuery = supabase
      .from("sesi_simulasi")
      .select(
        "id, kode_sesi, id_mahasiswa, id_skenario, mode, jumlah_giliran_mahasiswa, jumlah_giliran_valid, status_evaluasi, perlu_ditinjau_dosen, penanda_khusus, waktu_mulai, waktu_selesai, durasi_aktif_detik",
      )
      .eq("mode", "praktikum")
      .in("id_mahasiswa", studentIds)
      .order("waktu_mulai", { ascending: false });
    if (activeSkenIds.length > 0) {
      sessQuery = sessQuery.in("id_skenario", activeSkenIds);
    }
    const { data: sessData } = await sessQuery;
    sessionsRaw = (sessData || []) as Array<Record<string, any>>;
  }

  // Fallback kolom jika belum ada tugas_praktikum tetapi sudah ada sesi praktikum
  if (taskColumns.length === 0 && sessionsRaw.length > 0) {
    const extraIds = Array.from(
      new Set(sessionsRaw.map((s) => String(s.id_skenario || "")).filter(Boolean)),
    );
    if (extraIds.length > 0) {
      const { data: exSken } = await supabase
        .from("skenario_praktikum")
        .select("id, kode_skenario, versi, judul, jenis")
        .in("id", extraIds);
      for (const sc of (exSken || []) as Array<Record<string, any>>) {
        if (sc.id) skenarioMap.set(String(sc.id), sc);
      }
      for (const skId of extraIds) {
        const sc = skenarioMap.get(skId) || {};
        taskColumns.push({
          id_tugas: skId,
          id_skenario: skId,
          kode_skenario: String(sc.kode_skenario || "-"),
          versi: String(sc.versi || "0.1"),
          judul: String(sc.judul || "Skenario Praktikum"),
          jenis: String(sc.jenis || "swamedikasi"),
          deadline: null,
          status: "Aktif",
        });
      }
    }
  }

  // Pilih 1 sesi terbaik per (id_mahasiswa, id_skenario)
  const bestSessionByPair = new Map<string, Record<string, any>>();
  for (const s of sessionsRaw) {
    const key = `${s.id_mahasiswa}::${s.id_skenario}`;
    const cur = bestSessionByPair.get(key);
    if (!cur) {
      bestSessionByPair.set(key, s);
    } else {
      const pNew = STATUS_PRIORITY[String(s.status_evaluasi || "")] ?? 0;
      const pCur = STATUS_PRIORITY[String(cur.status_evaluasi || "")] ?? 0;
      if (pNew > pCur) bestSessionByPair.set(key, s);
    }
  }

  const chosenSessionIds = Array.from(bestSessionByPair.values())
    .map((s) => String(s.id))
    .filter(Boolean);

  // 5. Ambil rapor_penilaian
  const raporMap = new Map<string, Record<string, any>>();
  if (chosenSessionIds.length > 0) {
    const { data: rpData } = await supabase
      .from("rapor_penilaian")
      .select(
        "id_sesi, skor_tool_a, skor_tool_b, skor_tool_c, skor_tool_d, skor_tool_e, skor_komunikasi_mentah, skor_komunikasi_tampil, detail_pact, skor_prosedur, skor_penanganan_ddi, skor_kelengkapan, skor_konten_mentah, skor_konten_tampil, detail_butir_konten, detail_kesalahan_kritis, nilai_gabungan_sistem_mentah, nilai_gabungan_sistem_tampil, is_overridden, skor_komunikasi_dosen, skor_konten_dosen, nilai_resmi_akhir, status_rapor",
      )
      .in("id_sesi", chosenSessionIds);
    for (const rp of (rpData || []) as Array<Record<string, any>>) {
      if (rp.id_sesi) raporMap.set(String(rp.id_sesi), rp);
    }
  }

  const assignedSkenByClass = new Map<string, Set<string>>();
  const activeOnlySkenByClass = new Map<string, Set<string>>();
  for (const t of activeTugas) {
    if (!assignedSkenByClass.has(t.id_kelas)) assignedSkenByClass.set(t.id_kelas, new Set());
    assignedSkenByClass.get(t.id_kelas)!.add(t.id_skenario);
    if (t.status === "Aktif") {
      if (!activeOnlySkenByClass.has(t.id_kelas)) activeOnlySkenByClass.set(t.id_kelas, new Set());
      activeOnlySkenByClass.get(t.id_kelas)!.add(t.id_skenario);
    }
  }
  const hasExplicitTugas = activeTugas.length > 0;

  const searchQ = (params.search || "").trim().toLowerCase();
  const normStatus = (params.status || "semua").trim().toLowerCase();

  const filteredStudents: RecapStudentRow[] = [];
  const scopedSessions: Array<{
    mid: string;
    sess: Record<string, any>;
    rp: Record<string, any> | undefined;
  }> = [];

  for (const m of studentRows) {
    const mid = String(m.id);
    const nama = String(m.nama_lengkap || "Mahasiswa");
    const npm = String(m.nomor_induk || "-");
    const klsId = String(m.id_kelas || "");
    const klsName = String(kelasMap.get(klsId)?.nama_kelas || "-");

    if (searchQ && !nama.toLowerCase().includes(searchQ) && !npm.toLowerCase().includes(searchQ)) {
      continue;
    }

    const classSkenSet = hasExplicitTugas
      ? assignedSkenByClass.get(klsId) || new Set<string>()
      : new Set(taskColumns.map((c) => c.id_skenario));
    const classActiveSkenSet = activeOnlySkenByClass.get(klsId) || new Set<string>();

    const taskCells: Record<string, RecapTaskScoreCell> = {};
    const studentScores: number[] = [];
    const cellStatuses: Array<RecapStudentRow["status_ringkas"]> = [];
    const activeCellStatuses: Array<RecapStudentRow["status_ringkas"]> = [];
    let latestSessionId: string | null = null;
    let latestTs = "";

    for (const col of taskColumns) {
      const skId = col.id_skenario;
      if (!classSkenSet.has(skId)) {
        taskCells[skId] = {
          assigned: false,
          id_sesi: null,
          status_ui: "tidak_ditugaskan",
          status_evaluasi: null,
          nilai_sistem: null,
          nilai_resmi: null,
          is_overridden: false,
          skor_komunikasi: null,
          skor_konten: null,
          jumlah_giliran: 0,
        };
        continue;
      }

      const sess = bestSessionByPair.get(`${mid}::${skId}`);
      const rp = sess ? raporMap.get(String(sess.id)) : undefined;
      const stUi = classifySessionStatus(sess, rp);
      cellStatuses.push(stUi);
      if (classActiveSkenSet.has(skId)) activeCellStatuses.push(stUi);

      const nilaiSistem =
        toInt(rp?.nilai_gabungan_sistem_tampil) ?? toInt(rp?.nilai_gabungan_sistem_mentah);
      const nilaiResmi = toInt(rp?.nilai_resmi_akhir) ?? nilaiSistem;
      const isOverridden = Boolean(rp?.is_overridden);
      const skorKom =
        (isOverridden ? toInt(rp?.skor_komunikasi_dosen) : null) ??
        toInt(rp?.skor_komunikasi_tampil) ??
        toInt(rp?.skor_komunikasi_mentah);
      const skorKon =
        (isOverridden ? toInt(rp?.skor_konten_dosen) : null) ??
        toInt(rp?.skor_konten_tampil) ??
        toInt(rp?.skor_konten_mentah);

      if (nilaiResmi !== null) studentScores.push(nilaiResmi);

      if (sess) {
        const ts = String(sess.waktu_selesai || sess.waktu_mulai || "");
        if (!latestSessionId || ts >= latestTs) {
          latestSessionId = String(sess.id);
          latestTs = ts;
        }
      }

      taskCells[skId] = {
        assigned: true,
        id_sesi: sess ? String(sess.id) : null,
        status_ui: stUi,
        status_evaluasi: sess?.status_evaluasi ? String(sess.status_evaluasi) : null,
        nilai_sistem: nilaiSistem,
        nilai_resmi: nilaiResmi,
        is_overridden: isOverridden,
        skor_komunikasi: skorKom,
        skor_konten: skorKon,
        jumlah_giliran: sess ? Number(sess.jumlah_giliran_mahasiswa || 0) : 0,
      };
    }

    const evalStatuses =
      !selectedTugasObj && activeCellStatuses.length > 0 ? activeCellStatuses : cellStatuses;

    let statusRingkas: RecapStudentRow["status_ringkas"];
    if (evalStatuses.length === 0) {
      statusRingkas = "belum_mengerjakan";
    } else if (cellStatuses.includes("perlu_ditinjau")) {
      statusRingkas = "perlu_ditinjau";
    } else if (evalStatuses.every((st) => st === "selesai")) {
      statusRingkas = "selesai";
    } else if (evalStatuses.includes("tidak_cukup_data")) {
      statusRingkas = "tidak_cukup_data";
    } else {
      statusRingkas = "belum_mengerjakan";
    }

    if (normStatus !== "semua" && statusRingkas !== normStatus) continue;

    const rataRata =
      studentScores.length > 0
        ? Number((studentScores.reduce((a, b) => a + b, 0) / studentScores.length).toFixed(1))
        : null;

    for (const col of taskColumns) {
      if (classSkenSet.has(col.id_skenario)) {
        const sess = bestSessionByPair.get(`${mid}::${col.id_skenario}`);
        if (sess) {
          scopedSessions.push({ mid, sess, rp: raporMap.get(String(sess.id)) });
        }
      }
    }

    filteredStudents.push({
      id_mahasiswa: mid,
      nama_lengkap: nama,
      nomor_induk: npm,
      id_kelas: klsId,
      nama_kelas: klsName,
      task_scores: taskCells,
      rata_rata: rataRata,
      status_ringkas: statusRingkas,
      latest_session_id: latestSessionId,
    });
  }

  // 7. Hitung Summary, 5 Pilar PaCT, dan Radar Kesalahan Klinis
  const totalMhs = filteredStudents.length;
  const tuntasMhs = filteredStudents.filter(
    (s) => s.status_ringkas === "selesai" || s.status_ringkas === "perlu_ditinjau",
  ).length;
  const perluDitinjauMhs = filteredStudents.filter(
    (s) => s.status_ringkas === "perlu_ditinjau",
  ).length;
  const belumMhs = filteredStudents.filter(
    (s) => s.status_ringkas === "belum_mengerjakan",
  ).length;
  const tidakCukupMhs = filteredStudents.filter(
    (s) => s.status_ringkas === "tidak_cukup_data",
  ).length;

  const allScores: number[] = [];
  const pactBuckets: Record<"A" | "B" | "C" | "D" | "E", number[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
  };
  const evaluatedStudentIds = new Set<string>();
  const errorMap = new Map<
    string,
    {
      kode: string;
      judul: string;
      kategori: string;
      tipe: "kesalahan_kritis" | "butir_terlewat";
      students: Set<string>;
    }
  >();

  for (const { mid, rp } of scopedSessions) {
    if (!rp) continue;
    const score =
      toNum(rp.nilai_resmi_akhir) ??
      toNum(rp.nilai_gabungan_sistem_tampil) ??
      toNum(rp.nilai_gabungan_sistem_mentah);
    if (score !== null) {
      allScores.push(score);
      evaluatedStudentIds.add(mid);
    }

    const pactTools =
      rp.detail_pact && typeof rp.detail_pact === "object" && rp.detail_pact.tools
        ? (rp.detail_pact.tools as Record<string, any>)
        : {};

    const toolCols: Array<["A" | "B" | "C" | "D" | "E", string]> = [
      ["A", "skor_tool_a"],
      ["B", "skor_tool_b"],
      ["C", "skor_tool_c"],
      ["D", "skor_tool_d"],
      ["E", "skor_tool_e"],
    ];
    for (const [k, colName] of toolCols) {
      const v = toNum(rp[colName]) ?? toNum(pactTools?.[k]?.skor);
      if (v !== null) pactBuckets[k].push(v);
    }

    const kkRaw = rp.detail_kesalahan_kritis;
    const kkItems: Array<Record<string, any>> = Array.isArray(kkRaw)
      ? kkRaw
      : Array.isArray(kkRaw?.items)
        ? kkRaw.items
        : [];
    for (const kk of kkItems) {
      if (!kk || typeof kk !== "object") continue;
      const kode = String(kk.id || kk.kode || "KK");
      const judul = String(kk.judul || kk.deskripsi || kode);
      const key = `KK::${kode}::${judul}`;
      if (!errorMap.has(key)) {
        errorMap.set(key, {
          kode,
          judul,
          kategori: String(kk.kategori || "Kesalahan Kritis"),
          tipe: "kesalahan_kritis",
          students: new Set(),
        });
      }
      errorMap.get(key)!.students.add(mid);
    }

    const butirRaw = rp.detail_butir_konten;
    const butirItems: Array<Record<string, any>> = Array.isArray(butirRaw)
      ? butirRaw
      : Array.isArray(butirRaw?.items)
        ? butirRaw.items
        : [];
    for (const b of butirItems) {
      if (!b || typeof b !== "object" || b.berlaku === false) continue;
      const stB = String(b.status || "").toLowerCase();
      if (
        stB === "terlewat" ||
        stB === "tidak_terpenuhi" ||
        stB === "ditolak" ||
        stB === "parsial"
      ) {
        const kode = String(b.kode || "K");
        const param = String(b.parameter || kode);
        const key = `BUTIR::${kode}::${param}`;
        if (!errorMap.has(key)) {
          errorMap.set(key, {
            kode,
            judul: param,
            kategori: String(b.kategori || "Konten Klinis"),
            tipe: "butir_terlewat",
            students: new Set(),
          });
        }
        errorMap.get(key)!.students.add(mid);
      }
    }
  }

  const pactAggregate: PactPillarAggregate[] = (["A", "B", "C", "D", "E"] as const).map((k) => {
    const vals = pactBuckets[k];
    return {
      kode: k,
      label: PACT_LABELS[k],
      rata_rata:
        vals.length > 0
          ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
          : null,
      jumlah_sampel: vals.length,
    };
  });

  const scoredPillars = pactAggregate.filter((p) => p.rata_rata !== null);
  const weakestPillar =
    scoredPillars.length > 0
      ? scoredPillars.reduce((min, cur) =>
          (cur.rata_rata ?? 999) < (min.rata_rata ?? 999) ? cur : min,
        ).kode
      : null;

  const denomEval = Math.max(evaluatedStudentIds.size, 1);
  const radarList: ClinicalRadarItem[] = Array.from(errorMap.values())
    .map((item) => ({
      kode: item.kode,
      judul: item.judul,
      kategori: item.kategori,
      tipe: item.tipe,
      jumlah_praktikan: item.students.size,
      persentase: Number(((item.students.size / denomEval) * 100).toFixed(1)),
    }))
    .sort((a, b) => {
      if (a.tipe !== b.tipe) return a.tipe === "kesalahan_kritis" ? -1 : 1;
      if (b.jumlah_praktikan !== a.jumlah_praktikan) return b.jumlah_praktikan - a.jumlah_praktikan;
      return a.kode.localeCompare(b.kode);
    })
    .slice(0, 6);

  return {
    filters: {
      kelas_list: kelasRows.map((k) => ({
        id: String(k.id),
        nama_kelas: String(k.nama_kelas || "Kelas"),
        kode_kelas: k.kode_kelas ? String(k.kode_kelas) : null,
      })),
      tugas_list: allTugas,
    },
    selected_tugas: selectedTugasObj,
    summary: {
      total_mahasiswa: totalMhs,
      total_tuntas: tuntasMhs,
      tingkat_penyelesaian_persen:
        totalMhs > 0 ? Number(((tuntasMhs / totalMhs) * 100).toFixed(1)) : 0,
      rata_rata_nilai:
        allScores.length > 0
          ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1))
          : null,
      nilai_tertinggi: allScores.length > 0 ? Math.round(Math.max(...allScores)) : null,
      nilai_terendah: allScores.length > 0 ? Math.round(Math.min(...allScores)) : null,
      perlu_ditinjau_count: perluDitinjauMhs,
      belum_mengerjakan_count: belumMhs,
      tidak_cukup_data_count: tidakCukupMhs,
      total_sesi_dinilai: allScores.length,
    },
    pact_aggregate: pactAggregate,
    weakest_pillar: weakestPillar,
    clinical_error_radar: radarList,
    task_columns: taskColumns,
    students: filteredStudents,
  };
}

export async function fetchDosenRecapApi(
  params: FetchDosenRecapParams,
): Promise<DosenRecapResponse> {
  // Coba endpoint FastAPI terlebih dahulu (menggunakan service-role key sehingga bebas batas RLS)
  try {
    const qs = new URLSearchParams();
    qs.set("id_dosen", params.idDosen);
    if (params.idKelas && params.idKelas !== "semua") qs.set("id_kelas", params.idKelas);
    if (params.idTugas && params.idTugas !== "semua") qs.set("id_tugas", params.idTugas);
    if (params.status && params.status !== "semua") qs.set("status", params.status);
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());

    const res = await fetch(`${API_BASE}/api/evaluation/dosen/rekap?${qs.toString()}`);
    if (res.ok) {
      const json = (await res.json()) as DosenRecapResponse;
      if (json && json.filters && Array.isArray(json.students)) {
        return json;
      }
    }
  } catch {
    // Fallback langsung ke Supabase jika backend sedang tidak terjangkau / belum direstart
  }

  return fetchDosenRecapFromSupabase(params);
}
