from typing import Literal
from pydantic import BaseModel, Field

# =========================================================
# 1. KONSTANTA PENANDA KHUSUS (sesi_simulasi.penanda_khusus)
# =========================================================
PENANDA_PERIKSA_AUDIO = "periksa_audio"
PENANDA_MEMPENGARUHI_PENILAIAN = "mencoba_memengaruhi_penilaian"
PENANDA_SESI_PENDEK = "sesi_terlalu_pendek"
PENANDA_PENILAIAN_TERLEWAT = "ada_penilaian_terlewat"
PENANDA_DATA_TERBATAS = "berdasar_data_terbatas"

# =========================================================
# 2. KONSTANTA ALASAN TINJAU DOSEN (sesi_simulasi.alasan_tinjau_dosen)
# =========================================================
ALASAN_KESALAHAN_KRITIS = "Terdapat kesalahan kritis yang terdeteksi dari transkrip."
ALASAN_BUTIR_KRITIS_AMBIGU = "Terdapat butir kritis dengan makna ambigu (dievaluasi sebagai rentang)."
ALASAN_AMBIGU_LEBIH_25_PERSEN = "Lebih dari 25% butir penilaian memiliki makna ambigu."
ALASAN_AUDIO_BUTIR_KRITIS = "Butir kritis tidak ditemukan dan terdapat giliran dengan kualitas audio/ASR meragukan."
ALASAN_KOREKSI_KESALAHAN_KRITIS = "Mahasiswa melakukan koreksi mandiri atas kesalahan kritis setelah respons pasien."


# =========================================================
# 3. SKEMA JSONB DETAIL PEMICU (rapor_penilaian.detail_pemicu)
# =========================================================
class TriggerTraceItem(BaseModel):
    kode: str = Field(..., description="Kode pemicu, misal IK-01, CUE-01, PRB-01")
    kategori: Literal["informasi_kunci", "cue", "probe"]
    mode: str | None = Field(
        default=None, description="Langsung / Bila Ditanya / Jelas / Samar / Opsional"
    )
    sudah_dimunculkan: bool = False
    giliran_pasien_muncul: int | None = None
    kode_giliran_pasien: str | None = None
    kutipan_pasien: str | None = None

    sudah_direspons: bool = False
    giliran_mahasiswa_respons: list[int] = Field(default_factory=list)
    kode_giliran_mahasiswa: list[str] = Field(default_factory=list)
    kutipan_mahasiswa: list[str] = Field(default_factory=list)
    status_pemicu: Literal[
        "tergali_dan_direspons",
        "muncul_belum_direspons",
        "belum_muncul",
        "tidak_dapat_dinilai",
    ] = "belum_muncul"


class SessionTriageResult(BaseModel):
    status_evaluasi: Literal[
        "berjalan",
        "selesai_otomatis",
        "perlu_ditinjau_dosen",
        "selesai_ditinjau",
        "tidak_cukup_data",
        "tidak_dapat_dinilai",
    ]
    perlu_ditinjau_dosen: bool = False
    alasan_tinjau_dosen: list[str] = Field(default_factory=list)
    penanda_khusus: list[str] = Field(default_factory=list)
    semua_pemicu_tergali: bool = False
    hapus_data_sesi: bool = False