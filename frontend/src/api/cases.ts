import { supabase } from "@/lib/supabase";
import type {
  CaseCategory,
  CaseDetail,
  CaseMode,
  ChronicPrescription,
  PatientCase,
  Prescription,
  PrescriptionItem,
} from "@/types/simulation";

// =========================================
// MOCK DATA DINONAKTIFKAN (SUDAH LIVE)
// =========================================
const USE_MOCK = false;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const CATEGORY: Record<string, CaseCategory> = {
  swamedikasi: "SWAMEDIKASI",
  resep_akut: "RESEP AKUT",
  resep_kronis: "RESEP KRONIS",
};

const DEFAULT_INSTRUKSI: Record<CaseCategory, string> = {
  SWAMEDIKASI:
    "Lakukan konseling awal dan penggalian riwayat secara menyeluruh untuk memberikan rekomendasi terapi yang rasional serta aman bagi pasien.",
  "RESEP AKUT":
    "Lakukan skrining kelayakan resep, konfirmasi riwayat alergi pada pasien, dan berikan konseling aturan pakai serta kepatuhan antibiotik hingga tuntas.",
  "RESEP KRONIS":
    "Lakukan skrining kelayakan resep kronis, verifikasi kepatuhan minum obat, dan berikan konseling serta rencana kepatuhan terapi jangka panjang.",
};

// Fungsi utilitas untuk mem-parsing JSONB profil pasien dan klinis (Katalog)
const extractNama = (p: unknown) =>
  isObj(p) ? str(p.nama_pasien) || str(p.nama) || "Pasien" : "Pasien";

const extractMeta = (p: unknown) => {
  if (!isObj(p)) return "Pasien";
  const peran = str(p.peran_komunikasi) || str(p.peran);
  const kategoriUsia = str(p.kategori_usia);
  const jk = str(p.jenis_kelamin);
  return [peran, kategoriUsia, jk].filter(Boolean).join(" · ") || "Pasien";
};

const normalizeCategory = (jenis: unknown): CaseCategory => {
  const low = str(jenis).toLowerCase();
  if (low === "resep_akut" || low === "resep akut") return "RESEP AKUT";
  if (low === "resep_kronis" || low === "resep kronis") return "RESEP KRONIS";
  return "SWAMEDIKASI";
};

const extractDiagnosis = (k: unknown, judul?: unknown, fokus?: unknown) => {
  const title = str(judul);
  if (title) return title;
  if (isObj(k)) {
    const akut = isObj(k.resep_akut) ? k.resep_akut : undefined;
    const swa = isObj(k.swamedikasi) ? k.swamedikasi : undefined;
    const kronis = isObj(k.resep_kronis) ? k.resep_kronis : undefined;
    const fromKlinis =
      str(akut?.diagnosis) ||
      str(swa?.jenis_keluhan) ||
      str(kronis?.diagnosis) ||
      str(k.keluhan_utama) ||
      str(k.diagnosis_utama);
    if (fromKlinis) return fromKlinis;
  }
  return str(fokus) || "Konseling KIE";
};

function splitDokter(s: string): { nama: string; sip: string } {
  const m = s.match(/^(.*?)[\s,|]*\(?\s*(SIP[^)]*)\)?\s*$/i);
  if (!m || !m[2]) return { nama: s, sip: "" };
  return { nama: m[1].trim(), sip: `SIP: ${m[2].replace(/^SIP[:\s]*/i, "").trim()}` };
}

const qtyOf = (s: string) => s.match(/No\.?\s*([IVXLCDM\d]+)/i)?.[1] ?? s;

function buildAcuteItems(r: Record<string, unknown>): PrescriptionItem[] {
  const fromArray = (Array.isArray(r.items) ? r.items : []).filter(isObj).map((x) => ({
    drug: str(x.obat ?? x.drug),
    qty: qtyOf(str(x.jumlah ?? x.qty)),
    signa: str(x.signa),
  }));
  const items = fromArray.filter((i) => i.drug);
  if (items.length) return items;
  return str(r.obat) ? [{ drug: str(r.obat), qty: qtyOf(str(r.jumlah)), signa: str(r.signa) }] : [];
}

const todayLong = () =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

function mapBrief(raw: unknown): CaseDetail {
  if (!isObj(raw)) throw new Error("Kasus tidak ditemukan");

  const jenis = str(raw.jenis);
  const category = CATEGORY[jenis] ?? "SWAMEDIKASI";
  const pasien = isObj(raw.pasien) ? raw.pasien : {};
  const r = isObj(raw.resep) ? raw.resep : {};
  const rk = isObj(raw.resep_kronis) ? raw.resep_kronis : {};

  const nama = str(pasien.nama) || "Pasien";
  const kategoriUsia = str(pasien.kategori_usia);
  const jk = str(pasien.jk);
  const dokter = splitDokter(str(r.dokter));

  const prescription: Prescription | undefined =
    category === "RESEP AKUT"
      ? {
          clinic: str(r.klinik) || "Klinik Pratama Universitas Padjadjaran",
          address: str(r.alamat) || "Jl. Raya Bandung-Sumedang Km. 21, Jatinangor, Sumedang",
          doctor: dokter.nama,
          sip: dokter.sip,
          room: str(r.poli),
          date: str(r.tanggal) || todayLong(),
          items: buildAcuteItems(r),
          patientName: kategoriUsia ? `${nama} (${kategoriUsia})` : nama,
          patientAddress: "",
        }
      : undefined;

  let chronicRx: ChronicPrescription | undefined;
  if (category === "RESEP KRONIS") {
    const obatList = str(rk.obat_utama)
      ? str(rk.obat_utama)
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : [];
    const signaList = str(rk.aturan_pakai)
      ? str(rk.aturan_pakai)
          .split(".")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    chronicRx = {
      facility: str(rk.klinik) || "Klinik Pratama Universitas Padjadjaran",
      address: str(rk.alamat) || "Jl. Raya Bandung-Sumedang Km. 21, Jatinangor, Sumedang",
      doctor: str(rk.dokter) || "dr. Suryo Pratomo, Sp.PD",
      rxNumber: `RX-${new Date().getFullYear()}-${str(raw.kode)}`,
      date: str(rk.tanggal) || todayLong(),
      items: obatList.map((obat, idx) => ({
        drug: obat,
        qty: "XXX",
        signa: signaList[idx] || "S 1 dd 1 tab",
      })),
      patientLine: kategoriUsia ? `${nama} (${kategoriUsia})` : nama,
      addressLine: "Sesuai Data Rekam Medis",
      stamp: "SALINAN RESEP SESUAI ASLI - CAP LEGALISIR FARMASI",
    };
  }

  const visitStatus = str(rk.status_resep) || "Rawat Jalan Rutin";
  const clinicUnit = str(rk.unit_layanan) || "Poli Penyakit Dalam";

  return {
    id: str(raw.id),
    category,
    modes: (Array.isArray(raw.modes) ? raw.modes : []).filter(
      (m): m is CaseMode => m === "praktikum" || m === "mandiri",
    ),
    patientName: nama,
    patientMeta: "",
    diagnosis: "", // sengaja kosong: tidak boleh sampai ke mahasiswa
    deadline: "",
    focus: "",
    title: str(raw.judul),
    shortName: nama,
    ageLabel: kategoriUsia,
    gender: jk,
    patientSummary: [kategoriUsia, jk].filter(Boolean).join(" • "),
    avatarCode: `VP-${str(raw.kode)}`,
    caseLabel: category === "RESEP AKUT" ? "Kasus Praktik Resep Rawat Jalan" : undefined,
    refillStatus: category === "RESEP AKUT" ? "Resep Baru" : undefined,
    visitStatus: category === "RESEP KRONIS" ? visitStatus : undefined,
    clinicUnit: category === "RESEP KRONIS" ? clinicUnit : undefined,
    refillBadge:
      category === "RESEP KRONIS" && visitStatus.includes("Iter") ? visitStatus : undefined,
    instruction: str(raw.instruksi) || DEFAULT_INSTRUKSI[category],
    openingLine: str(raw.kalimat),
    prescription,
    chronicRx,
  };
}

// =========================================
// 1. FETCH KATALOG MANDIRI / PRAKTIKUM
// =========================================
export async function fetchCaseCatalog(mode: CaseMode): Promise<PatientCase[]> {
  if (USE_MOCK) {
    return [];
  }

  if (mode === "mandiri") {
    const { data, error } = await supabase
      .from("skenario_praktikum")
      .select(
        "id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, instruksi_tugas, data_klinis_khusus, created_at",
      )
      .eq("status_rilis", "diterbitkan")
      .contains("mode_rilis", ["mandiri"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((r: any) => ({
      id: r.id,
      category: normalizeCategory(r.jenis),
      modes: r.mode_rilis || ["mandiri"],
      estimatedMinutes: "~10 - 15 Menit",
      patientName: extractNama(r.profil_pasien),
      patientMeta: extractMeta(r.profil_pasien),
      diagnosis: extractDiagnosis(r.data_klinis_khusus, r.judul, r.fokus_kie),
      focus: str(r.fokus_kie) || str(r.instruksi_tugas) || "Latihan KIE Mandiri",
    }));
  }

  const completedPracticumSet = new Set<string>();
  let studentClassId: string | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profil } = await supabase
      .from("pengguna")
      .select("id, id_kelas")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profil?.id_kelas) {
      studentClassId = profil.id_kelas;
    }

    if (profil?.id) {
      const { data: completedRows } = await supabase
        .from("sesi_simulasi")
        .select("id_skenario")
        .eq("id_mahasiswa", profil.id)
        .eq("mode", "praktikum")
        .in("status_evaluasi", [
          "selesai_otomatis",
          "perlu_ditinjau_dosen",
          "selesai_ditinjau",
        ]);

      for (const row of (completedRows as Array<{ id_skenario?: string | null }> | null) || []) {
        if (typeof row.id_skenario === "string" && row.id_skenario) {
          completedPracticumSet.add(row.id_skenario);
        }
      }
    }
  }

  let tugasQuery = supabase
    .from("tugas_praktikum")
    .select(`
      id, id_kelas, deadline, status,
      skenario:skenario_praktikum (
        id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, instruksi_tugas, data_klinis_khusus
      )
    `)
    .eq("status", "Aktif")
    .order("deadline", { ascending: true });

  if (studentClassId) {
    tugasQuery = tugasQuery.eq("id_kelas", studentClassId);
  }

  const { data, error } = await tugasQuery;
  if (error) throw error;

  return (data || [])
    .map((t: any): PatientCase | null => {
      const s = Array.isArray(t.skenario) ? t.skenario[0] : t.skenario;
      if (!s?.id) return null;
      return {
        id: s.id,
        tugasId: t.id,
        category: normalizeCategory(s.jenis),
        modes: s.mode_rilis || ["praktikum"],
        estimatedMinutes: "~15 - 20 Menit",
        patientName: extractNama(s.profil_pasien),
        patientMeta: extractMeta(s.profil_pasien),
        diagnosis: extractDiagnosis(s.data_klinis_khusus, s.judul, s.fokus_kie),
        focus: str(s.fokus_kie) || str(s.instruksi_tugas) || "Ujian Praktikum KIE",
        deadline: t.deadline,
        isPracticumCompleted: completedPracticumSet.has(s.id),
      };
    })
    .filter((item): item is PatientCase => item !== null);
}

// =========================================
// 2. FETCH DETAIL KASUS (SAAT MASUK SIMULASI)
// =========================================
export async function fetchCaseDetail(id: string, mode: CaseMode): Promise<CaseDetail> {
  if (USE_MOCK) {
    return {} as CaseDetail;
  }

  const { data, error } = await supabase.rpc("ambil_brief_kasus", {
    p_id: id,
    p_mode: mode,
  });

  if (error || !data) {
    console.error("Supabase RPC Error ambil_brief_kasus:", error);
    throw new Error("Kasus tidak ditemukan");
  }

  return mapBrief(data);
}