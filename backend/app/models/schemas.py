from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class TranscriptTurn(BaseModel):
    giliran: int
    pembicara: str
    teks: str


class EvaluationRequest(BaseModel):
    id_sesi: str
    id_skenario: str
    transkrip: List[TranscriptTurn]


ModeSesi = Literal["mandiri", "praktikum"]
JenisSkenario = Literal["swamedikasi", "resep_akut", "resep_kronis"]
StatusEvaluasi = Literal[
    "berjalan",
    "selesai otomatis",
    "perlu ditinjau dosen",
    "selesai ditinjau",
    "tidak cukup data",
    "tidak dapat dinilai",
]


class SafePatientInfo(BaseModel):
    nama: str
    kategori_usia: str
    jenis_kelamin: str
    peran_komunikasi: Optional[str] = None
    gaya_bicara: Optional[str] = None
    literasi: Optional[str] = None
    kategori_khusus: list[str] = Field(default_factory=list)
    riwayat_alergi: str = "Tidak diketahui"
    obat_lain_suplemen: list[str] = Field(default_factory=list)
    kondisi_penyerta: str = "Tidak diketahui"


class SafeBriefSummary(BaseModel):
    status_resep: Optional[str] = None
    unit_layanan: Optional[str] = None
    obat: list[str] = Field(default_factory=list)
    signa: list[str] = Field(default_factory=list)
    jumlah: list[str] = Field(default_factory=list)


class KeyInfoTrigger(BaseModel):
    kode: str = ""
    hal: str = ""
    mode: str = "Bila Ditanya"  # "Langsung" | "Bila Ditanya"


class CueOrProbeTrigger(BaseModel):
    kode: str = ""
    jenis_atau_sifat: str = ""
    kapan: str = ""
    kalimat: str = ""


class GlossaryEntry(BaseModel):
    istilah: str
    padanan: str


class PatientPersonaContext(BaseModel):
    skenario_id: str
    kode_skenario: str
    versi: str
    jenis: JenisSkenario
    judul: str
    opening_line: str
    patient: SafePatientInfo
    brief_summary: SafeBriefSummary = Field(default_factory=SafeBriefSummary)
    patient_facts: dict[str, str] = Field(default_factory=dict)
    key_info_triggers: list[KeyInfoTrigger] = Field(default_factory=list)
    cue_triggers: list[CueOrProbeTrigger] = Field(default_factory=list)
    probe_triggers: list[CueOrProbeTrigger] = Field(default_factory=list)
    glossary: list[GlossaryEntry] = Field(default_factory=list)


class TurnHistoryItem(BaseModel):
    role: Literal["student", "patient"]
    text: str


class SimulationTurnRequest(BaseModel):
    session_id: str
    skenario_id: str
    mode: ModeSesi
    student_message: str = Field(min_length=1, max_length=2000)
    waktu_mulai_detik: int = Field(default=0, ge=0)
    status_asr_valid: bool = True
    history: list[TurnHistoryItem] = Field(default_factory=list)


class SimulationTurnResponse(BaseModel):
    session_id: str
    status_evaluasi: StatusEvaluasi
    student_turn_id: str
    student_kode_giliran: str
    turn_id: str
    patient_kode_giliran: str
    reply_text: str
    student_turn_count: int
    created_at: datetime


class FinishSimulationRequest(BaseModel):
    session_id: str
    skenario_id: str
    mode: ModeSesi
    reason: Literal["completed", "timeout", "aborted"] = "completed"


class FinishSimulationResponse(BaseModel):
    session_id: str
    status_evaluasi: StatusEvaluasi
    ended_at: datetime


class StartSimulationRequest(BaseModel):
    skenario_id: str
    mode: ModeSesi
    id_mahasiswa: str
    waktu_mulai_detik: int = Field(default=0, ge=0)


class ResumedTranscriptItem(BaseModel):
    id: Optional[str] = None
    urutan_global: Optional[int] = None
    kode_giliran: Optional[str] = None
    nomor_giliran_pembicara: Optional[int] = None
    pembicara: str
    waktu_mulai_detik: int = 0
    teks: str


class StartSimulationResponse(BaseModel):
    session_id: str
    skenario_id: str
    mode: ModeSesi
    status_evaluasi: StatusEvaluasi
    opening_turn_id: str
    opening_kode_giliran: str = "PSN-01"
    opening_text: str
    persona_context: PatientPersonaContext
    created_at: datetime
    is_resumed: bool = False
    durasi_aktif_detik: int = Field(default=0, ge=0)
    transcript: list[ResumedTranscriptItem] = Field(default_factory=list)


class FinishChecklistItem(BaseModel):
    key: str
    label: str
    satisfied: bool


class SimulationFinishRequest(BaseModel):
    session_id: str
    skenario_id: str
    durasi_detik: int = 0
    mode: str | None = None
    force_finish: bool = False
    discard_on_force_finish: bool = False


class SimulationFinishResponse(BaseModel):
    session_id: str
    skenario_id: str | None = None
    can_finish: bool
    status_evaluasi: str
    all_triggers_covered: bool
    follow_up_plan_delivered: bool
    missing_items: list[str] = Field(default_factory=list)
    checklist: list[FinishChecklistItem] = Field(default_factory=list)
    farewell_message: str | None = None
    finished_at: datetime | None = None
    discarded: bool = False


class SaveDocumentationRequest(BaseModel):
    nama_pasien: str = Field(default="")
    usia_pasien: str = Field(default="")
    jenis_kelamin: str = Field(default="")
    nama_dokter: str = Field(default="")
    keluhan_diagnosa: str = Field(default="")
    riwayat_alergi: str = Field(default="")
    obat_lain_penyerta: str = Field(default="")
    nama_obat_dosis: str = Field(default="")
    instruksi_khusus: str = Field(default="")
    edukasi_tindak_lanjut: str = Field(default="")
    durasi_pengisian_detik: int = Field(default=0, ge=0)
    waktu_habis: bool = Field(default=False)


class SaveDocumentationResponse(BaseModel):
    id: str
    session_id: str
    saved: bool = True