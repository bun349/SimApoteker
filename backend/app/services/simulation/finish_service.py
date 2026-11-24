import re
from datetime import datetime, timezone
from typing import Any, Protocol

from fastapi import HTTPException, Request, status

from app.models.evaluation_schema import (
    PENANDA_PENILAIAN_TERLEWAT,
    PENANDA_SESI_PENDEK,
    TriggerTraceItem,
)
from app.models.schemas import (
    FinishChecklistItem,
    SimulationFinishRequest,
    SimulationFinishResponse,
)
from app.repositories.scenario_repo import SupabaseSimulationRepository
from app.services.simulation.evaluation_mapper import (
    build_initial_trigger_traces,
    update_trigger_traces_from_transcript,
)

class FinishSimulationRepository(Protocol):
    async def get_session_by_id(self, session_id: str) -> dict[str, Any] | None: ...

    async def get_scenario_finish_data(self, skenario_id: str) -> dict[str, Any] | None: ...

    async def get_session_transcript(self, session_id: str) -> list[dict[str, Any]]: ...

    async def mark_session_finished(
        self,
        *,
        session_id: str,
        durasi_detik: int,
        status_evaluasi: str,
        farewell_row: dict[str, Any] | None = None,
        extra_session_updates: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...

    async def discard_session_and_transcript(self, session_id: str) -> bool: ...


_FOLLOW_UP_PATTERNS = [
    r"\b(aturan pakai|dosis|minum obat|dikonsumsi|sesudah makan|sebelum makan|pagi|siang|malam|hari)\b",
    r"\b(jeda|jarak waktu|jangan diminum bersamaan|terpisah)\b",
    r"\b(rencana tindak lanjut|tindak lanjut|kontrol|periksa ke dokter|dokter|puskesmas|rumah sakit|rs)\b",
    r"\b(pantau|perhatikan|waspada|jika muncul|efek samping|tanda bahaya|memburuk|tidak membaik)\b",
]


def _tokenize_keywords(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9\u00C0-\u024F]{3,}", text.lower())
    stopwords = {
        "yang", "dan", "atau", "dengan", "untuk", "pada", "dari", "ke", "di", "ini", "itu",
        "saya", "anda", "pasien", "obat", "bila", "jika", "kalau", "saat", "ketika", "sudah",
        "belum", "tidak", "ada", "apa", "bagaimana", "berapa", "lama", "kapan", "dimana",
    }
    return {t for t in tokens if t not in stopwords}


def _extract_required_triggers(scenario: dict[str, Any]) -> list[dict[str, str]]:
    excluded_text = " ".join(
        str(x).lower() for x in (scenario.get("butir_tidak_berlaku") or []) if isinstance(x, str)
    )
    items: list[dict[str, str]] = []

    profil = scenario.get("profil_pasien") or {}
    if isinstance(profil, dict) and profil.get("kalimat_memuat_ik") is True:
        opening = str(scenario.get("kalimat_pembuka") or "").strip()
        if opening:
            items.append({
                "key": "ik_pembuka",
                "label": f"Informasi Kunci Pembuka: {opening[:60]}",
                "reference_text": opening,
            })

    pemicu = scenario.get("konfigurasi_pemicu") or {}
    if isinstance(pemicu, dict):
        raw_list = (
            pemicu.get("items")
            or pemicu.get("pemicu")
            or [
                *(pemicu.get("informasi_kunci") or []),
                *(pemicu.get("cue") or []),
                *(pemicu.get("probe") or []),
            ]
        )
        for idx, raw_entry in enumerate(raw_list):
            if not isinstance(raw_entry, dict):
                continue
            kode = str(raw_entry.get("kode") or raw_entry.get("id") or f"PMC-{idx + 1:02d}")
            jenis_pemicu = str(raw_entry.get("jenis") or raw_entry.get("tipe") or "Pemicu").upper()
            deskripsi = str(
                raw_entry.get("hal")
                or raw_entry.get("kalimat")
                or raw_entry.get("informasi_kunci")
                or raw_entry.get("probe")
                or raw_entry.get("cue")
                or raw_entry.get("deskripsi")
                or raw_entry.get("teks")
                or ""
            ).strip()
            if not deskripsi:
                continue
            if kode.lower() in excluded_text:
                continue
            items.append({
                "key": kode,
                "label": f"[{jenis_pemicu}] {deskripsi[:70]}",
                "reference_text": deskripsi,
            })

    return items


def _is_trigger_covered(trigger_text: str, conversation_text: str) -> bool:
    kw = _tokenize_keywords(trigger_text)
    if not kw:
        return True
    conv_tokens = _tokenize_keywords(conversation_text)
    overlap = len(kw & conv_tokens)
    needed = 1 if len(kw) <= 2 else max(1, (len(kw) + 1) // 2)
    return overlap >= needed


def _has_follow_up_plan(student_turns: list[str]) -> bool:
    if not student_turns:
        return False
    combined = "\n".join(student_turns).lower()
    matched_groups = sum(
        1 for pat in _FOLLOW_UP_PATTERNS if re.search(pat, combined, flags=re.IGNORECASE)
    )
    return matched_groups >= 2


class SimulationFinishService:
    def __init__(self, *, repo: FinishSimulationRepository) -> None:
        self.repo = repo

    async def finish_session(self, req: SimulationFinishRequest) -> SimulationFinishResponse:
        session = await self.repo.get_session_by_id(req.session_id)
        if not session:
            raise LookupError("Sesi simulasi tidak ditemukan.")

        scenario = await self.repo.get_scenario_finish_data(req.skenario_id)
        if not scenario:
            raise LookupError("Data skenario tidak ditemukan.")

        transcript = await self.repo.get_session_transcript(req.session_id)
        student_rows = [r for r in transcript if r.get("pembicara") == "mahasiswa"]
        student_turns = [
            str(r.get("teks") or "").strip()
            for r in student_rows
            if str(r.get("teks") or "").strip()
        ]
        valid_student_turns = [
            r for r in student_rows
            if r.get("status_asr_valid", True) is not False and str(r.get("teks") or "").strip()
        ]
        all_conversation_text = "\n".join(str(r.get("teks") or "") for r in transcript)

        initial_traces: list[TriggerTraceItem] = build_initial_trigger_traces(
            scenario.get("konfigurasi_pemicu")
        )
        traces: list[TriggerTraceItem] = update_trigger_traces_from_transcript(
            initial_traces, transcript
        )

        triggers = _extract_required_triggers(scenario)
        checklist: list[FinishChecklistItem] = []

        for trg in triggers:
            covered = _is_trigger_covered(trg["reference_text"], all_conversation_text)
            checklist.append(
                FinishChecklistItem(
                    key=trg["key"],
                    label=trg["label"],
                    satisfied=covered,
                )
            )

        all_triggers_covered = (
            all(item.satisfied for item in checklist) if checklist else len(student_turns) >= 1
        )
        follow_up_delivered = _has_follow_up_plan(student_turns)

        checklist.append(
            FinishChecklistItem(
                key="rencana_tindak_lanjut",
                label="Rencana Tindak Lanjut (aturan pakai, pemantauan/efek samping, atau rujukan/kontrol)",
                satisfied=follow_up_delivered,
            )
        )

        missing_items = [c.label for c in checklist if not c.satisfied]
        can_finish = all_triggers_covered and follow_up_delivered

        mode_str = str(getattr(req, "mode", None) or session.get("mode") or "mandiri").lower()

        if not can_finish and (mode_str == "praktikum" or not req.force_finish):
            return SimulationFinishResponse(
                session_id=req.session_id,
                can_finish=False,
                status_evaluasi=str(session.get("status_evaluasi") or "berjalan"),
                all_triggers_covered=all_triggers_covered,
                follow_up_plan_delivered=follow_up_delivered,
                missing_items=missing_items,
                checklist=checklist,
                farewell_message=None,
                finished_at=None,
            )
            
        MAX_SAVEABLE_TURNS = 4
        discard_on_force_finish = bool(getattr(req, "discard_on_force_finish", False))

        # 1. Jika mahasiswa mengonfirmasi Hapus & Akhiri Sesi pada ForceFinishModal
        if req.force_finish and discard_on_force_finish and mode_str != "praktikum":
            await self.repo.discard_session_and_transcript(req.session_id)
            return SimulationFinishResponse(
                session_id=req.session_id,
                skenario_id=req.skenario_id,
                can_finish=True,
                status_evaluasi="tidak_dapat_dinilai",
                all_triggers_covered=all_triggers_covered,
                follow_up_plan_delivered=follow_up_delivered,
                missing_items=missing_items,
                checklist=checklist,
                farewell_message=None,
                finished_at=datetime.now(timezone.utc),
                discarded=True,
            )

        # 2. Blok belum memenuhi syarat (di sinilah finished_at=None yang tadi memicu error)
        if not can_finish and (mode_str == "praktikum" or not req.force_finish):
            return SimulationFinishResponse(
                session_id=req.session_id,
                skenario_id=req.skenario_id,
                can_finish=False,
                status_evaluasi=str(session.get("status_evaluasi") or "berjalan"),
                all_triggers_covered=all_triggers_covered,
                follow_up_plan_delivered=follow_up_delivered,
                missing_items=missing_items,
                checklist=checklist,
                farewell_message=None,
                finished_at=None,
            )

        # 3. Batas maksimal 4 giliran mahasiswa agar sesi dapat disimpan
        if len(student_rows) > MAX_SAVEABLE_TURNS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sesi tidak dapat disimpan karena melebihi batas maksimal {MAX_SAVEABLE_TURNS} giliran (saat ini {len(student_rows)} giliran).",
            )

        profil = scenario.get("profil_pasien") or {}
        patient_name = str(profil.get("nama_pasien") or "Pasien").strip()
        farewell_message = (
            f"Baik, informasi dan rencana tindak lanjutnya sudah cukup jelas bagi saya. "
            f"Terima kasih banyak atas penjelasannya ya. Saya pamit dulu, {patient_name}."
        )

        last_urutan = max((int(r["urutan_global"]) for r in transcript), default=0)
        last_psn_num = max(
            (int(r["nomor_giliran_pembicara"]) for r in transcript if r.get("pembicara") == "pasien"),
            default=0,
        )
        next_psn_num = last_psn_num + 1

        farewell_row = {
            "id_sesi": req.session_id,
            "urutan_global": last_urutan + 1,
            "kode_giliran": f"PSN-{next_psn_num:02d}",
            "nomor_giliran_pembicara": next_psn_num,
            "pembicara": "pasien",
            "waktu_mulai_detik": req.durasi_detik,
            "teks": farewell_message,
            "pemicu_terkait": "PAMIT_SESI",
            "status_asr_valid": True,
        }

        now_iso = datetime.now(timezone.utc).isoformat()
        existing_penanda = list(session.get("penanda_khusus") or [])

        if len(valid_student_turns) == 0:
            status_akhir = "tidak_dapat_dinilai"
        elif len(valid_student_turns) < 5:
            status_akhir = "tidak_cukup_data"
            if PENANDA_SESI_PENDEK not in existing_penanda:
                existing_penanda.append(PENANDA_SESI_PENDEK)
        else:
            status_akhir = "selesai_otomatis"

        if mode_str == "mandiri" and not can_finish and PENANDA_PENILAIAN_TERLEWAT not in existing_penanda:
            existing_penanda.append(PENANDA_PENILAIAN_TERLEWAT)

        extra_updates: dict[str, Any] = {
            "waktu_selesai": now_iso,
            "jumlah_giliran_mahasiswa": len(student_rows),
            "jumlah_giliran_valid": len(valid_student_turns),
            "semua_pemicu_tergali": all_triggers_covered,
            "penanda_khusus": existing_penanda,
        }

        updated_session = await self.repo.mark_session_finished(
            session_id=req.session_id,
            durasi_detik=req.durasi_detik,
            status_evaluasi=status_akhir,
            farewell_row=farewell_row,
            extra_session_updates=extra_updates,
        )

        finished_at_raw = (
            updated_session.get("waktu_selesai")
            or updated_session.get("finished_at")
            or updated_session.get("updated_at")
        )
        finished_at = (
            datetime.fromisoformat(str(finished_at_raw).replace("Z", "+00:00"))
            if finished_at_raw
            else datetime.now(timezone.utc)
        )

        return SimulationFinishResponse(
            session_id=req.session_id,
            can_finish=True,
            status_evaluasi=status_akhir,
            all_triggers_covered=all_triggers_covered,
            follow_up_plan_delivered=follow_up_delivered,
            missing_items=missing_items,
            checklist=checklist,
            farewell_message=farewell_message,
            finished_at=finished_at,
        )
        
        


def get_finish_service(request: Request) -> SimulationFinishService:
    supabase_client = getattr(request.app.state, "supabase", None)
    if supabase_client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Koneksi database belum diinisialisasi.",
        )
    repo = SupabaseSimulationRepository(supabase_client)
    return SimulationFinishService(repo=repo)