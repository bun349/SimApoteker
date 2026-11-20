from typing import Any

from app.models.schemas import (
    CueOrProbeTrigger,
    GlossaryEntry,
    JenisSkenario,
    KeyInfoTrigger,
    PatientPersonaContext,
    SafeBriefSummary,
    SafePatientInfo,
)


def _as_dict(val: Any) -> dict[str, Any]:
    return val if isinstance(val, dict) else {}


def _as_list(val: Any) -> list[Any]:
    return val if isinstance(val, list) else []


def _clean_str(val: Any) -> str:
    return val.strip() if isinstance(val, str) else ""


def _clean_str_list(val: Any) -> list[str]:
    result: list[str] = []
    for item in _as_list(val):
        if isinstance(item, str):
            s = item.strip()
            if s:
                result.append(s)
        elif isinstance(item, dict):
            # Mendukung item obat terstruktur jika ada
            name = _clean_str(item.get("obat") or item.get("drug") or item.get("nama"))
            if name:
                result.append(name)
    return result


def _split_csv(val: Any) -> list[str]:
    raw = _clean_str(val)
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def _normalize_jenis(raw_jenis: Any) -> JenisSkenario:
    j = _clean_str(raw_jenis).lower()
    if j in ("resep_akut", "resep akut"):
        return "resep_akut"
    if j in ("resep_kronis", "resep kronis"):
        return "resep_kronis"
    return "swamedikasi"


def _build_patient_info(row: dict[str, Any], jenis: JenisSkenario) -> SafePatientInfo:
    profil = _as_dict(row.get("profil_pasien"))
    peran = _clean_str(profil.get("peran_komunikasi") or profil.get("peran"))
    default_name = "Pendamping Pasien" if "pendamping" in peran.lower() else "Pasien"
    nama = _clean_str(profil.get("nama_pasien")) or default_name

    kategori_khusus = [
        _clean_str(x) for x in _as_list(profil.get("kategori_khusus")) if _clean_str(x)
    ]
    if jenis == "resep_akut" and "pediatri" in kategori_khusus and not _clean_str(profil.get("nama_pasien")):
        nama = "Ibu Pasien Anak"

    riwayat_alergi = _clean_str(row.get("riwayat_alergi")) or "Tidak ada"
    kondisi_penyerta = _clean_str(row.get("kondisi_penyerta")) or "Tidak ada"
    obat_lain = _clean_str_list(row.get("obat_lain_suplemen"))

    return SafePatientInfo(
        nama=nama,
        kategori_usia=_clean_str(profil.get("kategori_usia")) or "Dewasa",
        jenis_kelamin=_clean_str(profil.get("jenis_kelamin")) or "Tidak disebutkan",
        peran_komunikasi=peran or "Pasien",
        gaya_bicara=_clean_str(profil.get("gaya_bicara")) or None,
        literasi=_clean_str(profil.get("literasi_kesehatan") or profil.get("literasi")) or None,
        kategori_khusus=kategori_khusus,
        riwayat_alergi=riwayat_alergi,
        obat_lain_suplemen=obat_lain,
        kondisi_penyerta=kondisi_penyerta,
    )


def _build_brief_summary(jenis: JenisSkenario, klinis_khusus: dict[str, Any]) -> SafeBriefSummary:
    if jenis == "resep_akut":
        akut = _as_dict(klinis_khusus.get("resep_akut"))
        obat = _clean_str_list(akut.get("items"))
        if not obat and _clean_str(akut.get("obat")):
            obat = [_clean_str(akut.get("obat"))]
        signa = [_clean_str(akut.get("signa"))] if _clean_str(akut.get("signa")) else []
        jumlah = [_clean_str(akut.get("jumlah"))] if _clean_str(akut.get("jumlah")) else []
        return SafeBriefSummary(
            status_resep="Resep Baru",
            unit_layanan=_clean_str(akut.get("poli")) or None,
            obat=obat,
            signa=signa,
            jumlah=jumlah,
        )

    if jenis == "resep_kronis":
        kronis = _as_dict(klinis_khusus.get("resep_kronis"))
        obat = _split_csv(kronis.get("obat_utama"))
        signa = (
            [s.strip() for s in _clean_str(kronis.get("aturan_pakai")).split(".") if s.strip()]
            if _clean_str(kronis.get("aturan_pakai"))
            else []
        )
        return SafeBriefSummary(
            status_resep=_clean_str(kronis.get("status_resep")) or "Rawat Jalan Rutin",
            unit_layanan=_clean_str(kronis.get("unit_layanan")) or None,
            obat=obat,
            signa=signa,
            jumlah=[],
        )

    return SafeBriefSummary()


def _build_patient_facts(jenis: JenisSkenario, klinis_khusus: dict[str, Any]) -> dict[str, str]:
    facts: dict[str, str] = {}

    if jenis == "swamedikasi":
        swa = _as_dict(klinis_khusus.get("swamedikasi"))
        allowed_keys = {
            "u_durasi": "Durasi & frekuensi keluhan menurut pasien",
            "u_pemicu": "Pemicu keluhan menurut pasien",
            "u_keparahan": "Keparahan & gangguan aktivitas menurut pasien",
            "u_riwayat": "Riwayat alergi/obat menurut pasien",
            "pengobatan_mandiri": "Upaya atau obat yang sudah dicoba sendiri di rumah",
            "obat_diminta": "Obat yang diminta atau diinginkan pasien",
        }
        for key, label in allowed_keys.items():
            val = _clean_str(swa.get(key))
            if val:
                facts[label] = val

    elif jenis == "resep_akut":
        akut = _as_dict(klinis_khusus.get("resep_akut"))
        allowed_keys = {
            "q_kegunaan": "Pemahaman awal tentang kegunaan obat dari dokter",
            "q_cara": "Pemahaman awal atau kebingungan tentang cara pakai",
            "q_harapan": "Harapan setelah pengobatan menurut pasien/pendamping",
        }
        for key, label in allowed_keys.items():
            val = _clean_str(akut.get(key))
            if val:
                facts[label] = val

    elif jenis == "resep_kronis":
        kronis = _as_dict(klinis_khusus.get("resep_kronis"))
        allowed_keys = {
            "q_kegunaan": "Pemahaman awal tentang kegunaan obat dari dokter",
            "q_cara": "Pemahaman awal atau kebingungan tentang cara pakai",
            "q_harapan": "Harapan setelah pengobatan menurut pasien",
            "adherence": "Kebiasaan kepatuhan minum obat sehari-hari",
            "diet": "Pola makan sehari-hari",
            "aktivitas": "Aktivitas fisik sehari-hari",
            "kebiasaan": "Kebiasaan gaya hidup sehari-hari",
            "mandiri": "Pemantauan kondisi secara mandiri di rumah",
            "lama_sakit": "Lama sakit yang dirasakan/diketahui pasien",
            "lama_terapi": "Lama menjalani terapi rutin",
        }
        for key, label in allowed_keys.items():
            val = _clean_str(kronis.get(key))
            if val:
                facts[label] = val

    return facts


def _build_triggers(row: dict[str, Any]) -> tuple[
    list[KeyInfoTrigger],
    list[CueOrProbeTrigger],
    list[CueOrProbeTrigger],
]:
    pemicu = _as_dict(row.get("konfigurasi_pemicu"))

    key_info: list[KeyInfoTrigger] = []
    for item in _as_list(pemicu.get("informasi_kunci")):
        d = _as_dict(item)
        hal = _clean_str(d.get("hal"))
        if hal:
            key_info.append(
                KeyInfoTrigger(
                    kode=_clean_str(d.get("kode")),
                    hal=hal,
                    mode=_clean_str(d.get("mode")) or "Bila Ditanya",
                )
            )

    cues: list[CueOrProbeTrigger] = []
    for item in _as_list(pemicu.get("isyarat_emosi")):
        d = _as_dict(item)
        kalimat = _clean_str(d.get("kalimat"))
        if kalimat:
            cues.append(
                CueOrProbeTrigger(
                    kode=_clean_str(d.get("kode")),
                    jenis_atau_sifat=_clean_str(d.get("jenis")),
                    kapan=_clean_str(d.get("kapan")),
                    kalimat=kalimat,
                )
            )

    probes: list[CueOrProbeTrigger] = []
    for item in _as_list(pemicu.get("probe_bingung")):
        d = _as_dict(item)
        kalimat = _clean_str(d.get("kalimat"))
        if kalimat:
            probes.append(
                CueOrProbeTrigger(
                    kode=_clean_str(d.get("kode")),
                    jenis_atau_sifat=_clean_str(d.get("sifat")),
                    kapan=_clean_str(d.get("kapan")),
                    kalimat=kalimat,
                )
            )

    return key_info, cues, probes


def _build_glossary(row: dict[str, Any]) -> list[GlossaryEntry]:
    entries: list[GlossaryEntry] = []
    for item in _as_list(row.get("kamus_tambahan")):
        d = _as_dict(item)
        istilah = _clean_str(d.get("istilah"))
        padanan = _clean_str(d.get("padanan"))
        if istilah and padanan:
            entries.append(GlossaryEntry(istilah=istilah, padanan=padanan))
    return entries


def build_patient_persona_context(row: dict[str, Any]) -> PatientPersonaContext:
    jenis = _normalize_jenis(row.get("jenis"))
    klinis_khusus = _as_dict(row.get("data_klinis_khusus"))
    key_info, cues, probes = _build_triggers(row)

    return PatientPersonaContext(
        skenario_id=_clean_str(row.get("id")),
        kode_skenario=_clean_str(row.get("kode_skenario")),
        versi=_clean_str(row.get("versi")) or "1.0",
        jenis=jenis,
        judul=_clean_str(row.get("judul")),
        opening_line=_clean_str(row.get("kalimat_pembuka")),
        patient=_build_patient_info(row, jenis),
        brief_summary=_build_brief_summary(jenis, klinis_khusus),
        patient_facts=_build_patient_facts(jenis, klinis_khusus),
        key_info_triggers=key_info,
        cue_triggers=cues,
        probe_triggers=probes,
        glossary=_build_glossary(row),
    )