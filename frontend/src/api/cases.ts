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
const extractNama = (p: unknown) => (isObj(p) ? str(p.nama_pasien) || "Pasien Anonim" : "Pasien Anonim");

const extractMeta = (p: unknown) => {
  if (!isObj(p)) return "Tidak ada data demografi";
  const kategoriUsia = str(p.kategori_usia);
  const jk = str(p.jenis_kelamin);
  return [kategoriUsia, jk].filter(Boolean).join(" • ") || "Tidak ada data demografi";
};

const extractDiagnosis = (k: unknown) => {
  if (!isObj(k)) return "Konseling KIE";
  const akut = isObj(k.resep_akut) ? k.resep_akut : undefined;
  const swa = isObj(k.swamedikasi) ? k.swamedikasi : undefined;
  const kronis = isObj(k.resep_kronis) ? k.resep_kronis : undefined;
  return str(akut?.diagnosis) || str(swa?.jenis_keluhan) || str(kronis?.diagnosis) || "Konseling KIE";
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
      .select("id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, data_klinis_khusus")
      .eq("status_rilis", "diterbitkan")
      .not("frozen_at", "is", null)
      .contains("mode_rilis", ["mandiri"]);

    if (error) throw error;

    return (data || []).map((r: any) => ({
      id: r.id,
      category: r.jenis,
      modes: r.mode_rilis || ["mandiri"],
      estimatedMinutes: "~10 - 15 Menit",
      patientName: extractNama(r.profil_pasien),
      patientMeta: extractMeta(r.profil_pasien),
      diagnosis: extractDiagnosis(r.data_klinis_khusus),
      focus: r.fokus_kie || "Latihan KIE Mandiri",
    }));
  }

  const { data, error } = await supabase
    .from("tugas_praktikum")
    .select(`
      id, deadline, status,
      skenario:skenario_praktikum (
        id, kode_skenario, versi, judul, jenis, mode_rilis, profil_pasien, fokus_kie, data_klinis_khusus
      )
    `)
    .eq("status", "Aktif");

  if (error) throw error;

  return (data || []).map((t: any) => {
    const s = Array.isArray(t.skenario) ? t.skenario[0] : t.skenario;
    return {
      id: s.id,
      tugasId: t.id,
      category: s.jenis,
      modes: s.mode_rilis || ["praktikum"],
      estimatedMinutes: "~15 - 20 Menit",
      patientName: extractNama(s.profil_pasien),
      patientMeta: extractMeta(s.profil_pasien),
      diagnosis: extractDiagnosis(s.data_klinis_khusus),
      focus: s.fokus_kie || "Ujian Praktikum KIE",
      deadline: t.deadline,
    };
  });
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