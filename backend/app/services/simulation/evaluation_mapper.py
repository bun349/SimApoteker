from typing import Any
from app.models.evaluation_schema import (
    ALASAN_AMBIGU_LEBIH_25_PERSEN,
    ALASAN_AUDIO_BUTIR_KRITIS,
    ALASAN_BUTIR_KRITIS_AMBIGU,
    ALASAN_KESALAHAN_KRITIS,
    ALASAN_KOREKSI_KESALAHAN_KRITIS,
    PENANDA_DATA_TERBATAS,
    PENANDA_MEMPENGARUHI_PENILAIAN,
    PENANDA_PENILAIAN_TERLEWAT,
    PENANDA_PERIKSA_AUDIO,
    PENANDA_SESI_PENDEK,
    SessionTriageResult,
    TriggerTraceItem,
)


def build_initial_trigger_traces(konfigurasi_pemicu: dict[str, Any] | None) -> list[TriggerTraceItem]:
    """Mengubah konfigurasi_pemicu dari skenario_praktikum menjadi daftar trace awal."""
    cfg = konfigurasi_pemicu or {}
    traces: list[TriggerTraceItem] = []

    for item in cfg.get("informasi_kunci") or []:
        kode = str(item.get("kode") or "").strip()
        if kode:
            traces.append(
                TriggerTraceItem(
                    kode=kode,
                    kategori="informasi_kunci",
                    mode=item.get("mode"),
                )
            )

    for item in cfg.get("cue") or []:
        kode = str(item.get("kode") or "").strip()
        if kode:
            traces.append(
                TriggerTraceItem(
                    kode=kode,
                    kategori="cue",
                    mode=item.get("jenis_atau_sifat"),
                )
            )

    for item in cfg.get("probe") or []:
        kode = str(item.get("kode") or "").strip()
        if kode:
            traces.append(
                TriggerTraceItem(
                    kode=kode,
                    kategori="probe",
                    mode=item.get("jenis_atau_sifat"),
                )
            )

    return traces


def update_trigger_traces_from_transcript(
    traces: list[TriggerTraceItem],
    transcript_rows: list[dict[str, Any]],
) -> list[TriggerTraceItem]:
    """
    Memetakan kemunculan pemicu dari transkrip_dialog dan menandai jendela respons
    mahasiswa (giliran langsung + 2 giliran mahasiswa sesudahnya sesuai rubrik).
    """
    student_turns = [
        r for r in transcript_rows if str(r.get("pembicara")).lower() == "mahasiswa"
    ]
    patient_turns = [
        r for r in transcript_rows if str(r.get("pembicara")).lower() == "pasien"
    ]

    trace_map = {t.kode: t.model_copy(deep=True) for t in traces}

    for p_row in patient_turns:
        pemicu_kode = (p_row.get("pemicu_terkait") or "").strip()
        if not pemicu_kode or pemicu_kode not in trace_map:
            continue

        tr = trace_map[pemicu_kode]
        p_urutan = int(p_row.get("urutan_global") or 0)

        tr.sudah_dimunculkan = True
        tr.giliran_pasien_muncul = p_urutan
        tr.kode_giliran_pasien = p_row.get("kode_giliran")
        tr.kutipan_pasien = p_row.get("teks")

        following_student = [
            s for s in student_turns if int(s.get("urutan_global") or 0) > p_urutan
        ][:3]

        if following_student:
            tr.sudah_direspons = True
            tr.giliran_mahasiswa_respons = [
                int(s.get("nomor_giliran_pembicara") or 0) for s in following_student
            ]
            tr.kode_giliran_mahasiswa = [
                str(s.get("kode_giliran") or "") for s in following_student if s.get("kode_giliran")
            ]
            tr.kutipan_mahasiswa = [
                str(s.get("teks") or "") for s in following_student if s.get("teks")
            ]
            tr.status_pemicu = "tergali_dan_direspons"
        else:
            tr.status_pemicu = "muncul_belum_direspons"

    return list(trace_map.values())


def evaluate_session_triage(
    *,
    mode: str,
    jumlah_giliran_valid: int,
    persentase_aspek_dapat_dinilai: float,
    traces: list[TriggerTraceItem],
    ada_kesalahan_kritis: bool = False,
    ada_koreksi_kesalahan_kritis: bool = False,
    ada_butir_kritis_ambigu: bool = False,
    persentase_butir_ambigu: float = 0.0,
    ada_butir_kritis_terlewat_karena_audio: bool = False,
    ada_kegagalan_asr: bool = False,
    ada_perintah_sistem_di_transkrip: bool = False,
    ada_aspek_data_terbatas: bool = False,
    gagal_total_tanpa_data_layak: bool = False,
) -> SessionTriageResult:
    """
    Menentukan status_evaluasi, perlu_ditinjau_dosen, alasan_tinjau_dosen,
    dan penanda_khusus secara deterministik berdasarkan Pedoman Penilaian VIKIE.
    """
    penanda: list[str] = []
    alasan_tinjau: list[str] = []

    semua_tergali = (
        all(t.status_pemicu == "tergali_dan_direspons" for t in traces) if traces else True
    )

    if ada_kegagalan_asr:
        penanda.append(PENANDA_PERIKSA_AUDIO)
    if ada_perintah_sistem_di_transkrip:
        penanda.append(PENANDA_MEMPENGARUHI_PENILAIAN)
    if ada_aspek_data_terbatas:
        penanda.append(PENANDA_DATA_TERBATAS)

    # Seluruh sesi tidak dapat dinilai sama sekali (gagal total / tidak ada giliran valid)
    if gagal_total_tanpa_data_layak or (
        jumlah_giliran_valid <= 0 and persentase_aspek_dapat_dinilai <= 0.0
    ):
        return SessionTriageResult(
            status_evaluasi="tidak_dapat_dinilai",
            perlu_ditinjau_dosen=False,
            alasan_tinjau_dosen=[],
            penanda_khusus=penanda,
            semua_pemicu_tergali=semua_tergali,
        )

    # Data sesi ada tetapi belum mencukupi ambang kelayakan (< 5 giliran valid atau < 60% aspek)
    if jumlah_giliran_valid < 5 or persentase_aspek_dapat_dinilai < 60.0:
        if jumlah_giliran_valid < 5 and PENANDA_SESI_PENDEK not in penanda:
            penanda.append(PENANDA_SESI_PENDEK)
        return SessionTriageResult(
            status_evaluasi="tidak_cukup_data",
            perlu_ditinjau_dosen=False,
            alasan_tinjau_dosen=[],
            penanda_khusus=penanda,
            semua_pemicu_tergali=semua_tergali,
        )

    # Mode Latihan Mandiri: tidak masuk antrean tinjau dosen, cek kelengkapan penggalian
    if mode != "praktikum":
        if not semua_tergali and PENANDA_PENILAIAN_TERLEWAT not in penanda:
            penanda.append(PENANDA_PENILAIAN_TERLEWAT)
        return SessionTriageResult(
            status_evaluasi="selesai_otomatis",
            perlu_ditinjau_dosen=False,
            alasan_tinjau_dosen=[],
            penanda_khusus=penanda,
            semua_pemicu_tergali=semua_tergali,
        )

    # Mode Praktikum: evaluasi pemicu status "perlu_ditinjau_dosen"
    if ada_kesalahan_kritis:
        alasan_tinjau.append(ALASAN_KESALAHAN_KRITIS)
    if ada_koreksi_kesalahan_kritis:
        alasan_tinjau.append(ALASAN_KOREKSI_KESALAHAN_KRITIS)
    if ada_butir_kritis_ambigu:
        alasan_tinjau.append(ALASAN_BUTIR_KRITIS_AMBIGU)
    if persentase_butir_ambigu > 25.0:
        alasan_tinjau.append(ALASAN_AMBIGU_LEBIH_25_PERSEN)
    if ada_butir_kritis_terlewat_karena_audio:
        alasan_tinjau.append(ALASAN_AUDIO_BUTIR_KRITIS)

    perlu_tinjau = len(alasan_tinjau) > 0
    status_akhir = "perlu_ditinjau_dosen" if perlu_tinjau else "selesai_otomatis"

    return SessionTriageResult(
        status_evaluasi=status_akhir,
        perlu_ditinjau_dosen=perlu_tinjau,
        alasan_tinjau_dosen=alasan_tinjau,
        penanda_khusus=penanda,
        semua_pemicu_tergali=semua_tergali,
    )