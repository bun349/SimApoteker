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


MIN_VALID_STUDENT_TURNS = 5

_FOLLOW_UP_PATTERNS = [
    r"\b(aturan pakai|dosis|minum obat|dikonsumsi|sesudah makan|sebelum makan|pagi|siang|malam|hari)\b",
    r"\b(jeda|jarak waktu|jangan diminum bersamaan|terpisah)\b",
    r"\b(rencana tindak lanjut|tindak lanjut|kontrol|periksa ke dokter|dokter|puskesmas|rumah sakit|rs)\b",
    r"\b(pantau|perhatikan|waspada|jika muncul|efek samping|tanda bahaya|memburuk|tidak membaik)\b",
]


def _resolve_evaluation_status(valid_student_turn_count: int) -> str:
    if valid_student_turn_count == 0:
        return "tidak_dapat_dinilai"
    if valid_student_turn_count < MIN_VALID_STUDENT_TURNS:
        return "tidak_cukup_data"
    return "selesai_otomatis"


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
                *(pemicu.get("isyarat_emosi") or pemicu.get("cue") or []),
                *(pemicu.get("probe_bingung") or pemicu.get("probe") or []),
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


def _build_safe_checklist_and_missing(
    *,
    mode: str,
    full_checklist: list[FinishChecklistItem],
    full_missing_items: list[str],
    all_triggers_covered: bool,
    follow_up_delivered: bool,
) -> tuple[list[FinishChecklistItem], list[str]]:
    if mode != "praktikum":
        return full_checklist, full_missing_items

    safe_checklist = [
        FinishChecklistItem(
            key="pemicu_wajib",
            label="Seluruh informasi kunci dan pemicu skenario tergali",
            satisfied=all_triggers_covered,
        ),
        FinishChecklistItem(
            key="rencana_tindak_lanjut",
            label="Rencana tindak lanjut dan pemantauan tersampaikan",
            satisfied=follow_up_delivered,
        ),
    ]
    safe_missing = [item.label for item in safe_checklist if not item.satisfied]
    return safe_checklist, safe_missing


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
        full_checklist: list[FinishChecklistItem] = []

        for trg in triggers:
            covered = _is_trigger_covered(trg["reference_text"], all_conversation_text)
            full_checklist.append(
                FinishChecklistItem(
                    key=trg["key"],
                    label=trg["label"],
                    satisfied=covered,
                )
            )

        all_triggers_covered = (
            all(item.satisfied for item in full_checklist) if full_checklist else len(student_turns) >= 1
        )
        follow_up_delivered = _has_follow_up_plan(student_turns)

        full_checklist.append(
            FinishChecklistItem(
                key="rencana_tindak_lanjut",
                label="Rencana Tindak Lanjut (aturan pakai, pemantauan/efek samping, atau rujukan/kontrol)",
                satisfied=follow_up_delivered,
            )
        )

        full_missing_items = [c.label for c in full_checklist if not c.satisfied]
        is_complete = all_triggers_covered and follow_up_delivered
        mode_str = str(getattr(req, "mode", None) or session.get("mode") or "mandiri").lower()

        checklist_out, missing_out = _build_safe_checklist_and_missing(
            mode=mode_str,
            full_checklist=full_checklist,
            full_missing_items=full_missing_items,
            all_triggers_covered=all_triggers_covered,
            follow_up_delivered=follow_up_delivered,
        )

        # Idempoten: jika sesi sudah selesai sebelumnya, langsung kembalikan status tersimpan
        current_status = str(session.get("status_evaluasi") or "berjalan")
        if current_status != "berjalan":
            existing_finished_raw = session.get("waktu_selesai") or session.get("updated_at")
            existing_finished_at = (
                datetime.fromisoformat(str(existing_finished_raw).replace("Z", "+00:00"))
                if existing_finished_raw
                else datetime.now(timezone.utc)
            )
            return SimulationFinishResponse(
                session_id=req.session_id,
                skenario_id=req.skenario_id,
                can_finish=True,
                status_evaluasi=current_status,
                all_triggers_covered=all_triggers_covered,
                follow_up_plan_delivered=follow_up_delivered,
                missing_items=full_missing_items if mode_str != "praktikum" else missing_out,
                checklist=full_checklist if mode_str != "praktikum" else checklist_out,
                farewell_message=None,
                finished_at=existing_finished_at,
                discarded=False,
            )

        discard_on_force_finish = bool(getattr(req, "discard_on_force_finish", False))

        # 1. Khusus mode mandiri: jika belum lengkap dan belum force_finish, tampilkan konfirmasi dulu
        if mode_str == "mandiri" and not req.force_finish and not is_complete:
            return SimulationFinishResponse(
                session_id=req.session_id,
                skenario_id=req.skenario_id,
                can_finish=False,
                status_evaluasi=current_status,
                all_triggers_covered=all_triggers_covered,
                follow_up_plan_delivered=follow_up_delivered,
                missing_items=missing_out,
                checklist=checklist_out,
                farewell_message=None,
                finished_at=None,
                discarded=False,
            )

        # 2. Khusus mode mandiri dengan opsi buang sesi
        if mode_str == "mandiri" and req.force_finish and discard_on_force_finish:
            await self.repo.discard_session_and_transcript(req.session_id)
            return SimulationFinishResponse(
                session_id=req.session_id,
                skenario_id=req.skenario_id,
                can_finish=True,
                status_evaluasi="tidak_dapat_dinilai",
                all_triggers_covered=all_triggers_covered,
                follow_up_plan_delivered=follow_up_delivered,
                missing_items=missing_out,
                checklist=checklist_out,
                farewell_message=None,
                finished_at=datetime.now(timezone.utc),
                discarded=True,
            )

        # 3. Mode praktikum atau mode mandiri (lengkap / tetap selesaikan):
        #    selalu boleh diselesaikan meski ada pemicu/rencana tindak lanjut yang terlewat
        profil = scenario.get("profil_pasien") or {}
        patient_name = str(profil.get("nama_pasien") or "Pasien").strip()
        farewell_message: str | None = (
            f"Baik, terima kasih banyak atas penjelasannya ya. Saya pamit dulu, {patient_name}."
            if len(valid_student_turns) > 0
            else None
        )

        farewell_row: dict[str, Any] | None = None
        if farewell_message is not None:
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

        status_akhir = _resolve_evaluation_status(len(valid_student_turns))
        if (
            0 < len(valid_student_turns) < MIN_VALID_STUDENT_TURNS
            and PENANDA_SESI_PENDEK not in existing_penanda
        ):
            existing_penanda.append(PENANDA_SESI_PENDEK)

        if mode_str == "mandiri" and not is_complete and PENANDA_PENILAIAN_TERLEWAT not in existing_penanda:
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
            skenario_id=req.skenario_id,
            can_finish=True,
            status_evaluasi=status_akhir,
            all_triggers_covered=all_triggers_covered,
            follow_up_plan_delivered=follow_up_delivered,
            missing_items=full_missing_items if mode_str != "praktikum" else missing_out,
            checklist=full_checklist if mode_str != "praktikum" else checklist_out,
            farewell_message=farewell_message,
            finished_at=finished_at,
            discarded=False,
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