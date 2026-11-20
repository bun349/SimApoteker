from datetime import datetime, timezone
from typing import Any, Protocol

from app.models.schemas import (
    SimulationTurnRequest,
    SimulationTurnResponse,
    TurnHistoryItem,
    StartSimulationRequest,
    StartSimulationResponse,
)
from app.services.simulation.context_builder import build_patient_persona_context
from app.services.simulation.gemini_patient import GeminiPatientService


class SimulationRepository(Protocol):
    async def get_scenario_for_simulation(
        self,
        *,
        skenario_id: str,
        mode: str,
    ) -> dict[str, Any] | None: ...

    async def get_session_transcript(self, session_id: str) -> list[dict[str, Any]]: ...

    async def save_turn_pair(
        self,
        *,
        session_id: str,
        student_row: dict[str, Any],
        patient_row: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]: ...


def _fmt_kode(prefix: str, num: int) -> str:
    return f"{prefix}-{num:02d}"


class SimulationTurnService:
    def __init__(
        self,
        *,
        repo: SimulationRepository,
        patient_service: GeminiPatientService | None = None,
    ) -> None:
        self.repo = repo
        self.patient_service = patient_service or GeminiPatientService()
    
    async def start_session(self, req: StartSimulationRequest) -> StartSimulationResponse:
        scenario_row = await self.repo.get_scenario_for_simulation(
            skenario_id=req.skenario_id,
            mode=req.mode,
        )
        if not scenario_row:
            raise LookupError("Skenario tidak ditemukan atau tidak tersedia untuk mode simulasi ini.")

        persona_context = build_patient_persona_context(scenario_row)
        opening_text = persona_context.opening_line.strip()
        if not opening_text:
            raise ValueError("Kalimat pembuka skenario belum tersedia.")

        session_row, opening_row = await self.repo.create_session_with_opening(
            skenario_id=req.skenario_id,
            mode=req.mode,
            id_mahasiswa=req.id_mahasiswa,
            opening_text=opening_text,
            waktu_mulai_detik=req.waktu_mulai_detik,
        )

        created_at = session_row.get("created_at") or opening_row.get("created_at") or datetime.now(timezone.utc)

        return StartSimulationResponse(
            session_id=str(session_row["id"]),
            skenario_id=req.skenario_id,
            mode=req.mode,
            status_evaluasi="berjalan",
            opening_turn_id=str(opening_row["id"]),
            opening_kode_giliran="PSN-01",
            opening_text=opening_text,
            persona_context=persona_context,
            created_at=created_at,
        )

    async def process_turn(self, req: SimulationTurnRequest) -> SimulationTurnResponse:
        scenario_row = await self.repo.get_scenario_for_simulation(
            skenario_id=req.skenario_id,
            mode=req.mode,
        )
        if not scenario_row:
            raise LookupError("Skenario tidak ditemukan atau tidak tersedia untuk mode simulasi ini.")

        persona_context = build_patient_persona_context(scenario_row)

        # Ambil transkrip tersimpan di DB sebagai sumber kebenaran urutan giliran
        db_rows = await self.repo.get_session_transcript(req.session_id)

        if db_rows:
            history = [
                TurnHistoryItem(
                    role="student" if r["pembicara"] == "mahasiswa" else "patient",
                    text=r["teks"],
                )
                for r in db_rows
            ]
            last_urutan = max(int(r["urutan_global"]) for r in db_rows)
            last_mhs_num = max(
                (int(r["nomor_giliran_pembicara"]) for r in db_rows if r["pembicara"] == "mahasiswa"),
                default=0,
            )
            last_psn_num = max(
                (int(r["nomor_giliran_pembicara"]) for r in db_rows if r["pembicara"] == "pasien"),
                default=0,
            )
        else:
            # Fallback jika opening_line belum di-insert saat init sesi:
            # anggap kalimat_pembuka sebagai urutan 1 (PSN-01) bila ada di history frontend
            history = list(req.history)
            last_urutan = len(history)
            last_mhs_num = sum(1 for h in history if h.role == "student")
            last_psn_num = sum(1 for h in history if h.role == "patient")

        clean_student_text = req.student_message.strip()
        reply_text = await self.patient_service.generate_reply(
            persona_context=persona_context,
            history=history,
            student_message=clean_student_text,
        )

        next_mhs_num = last_mhs_num + 1
        next_psn_num = last_psn_num + 1
        student_kode = _fmt_kode("MHS", next_mhs_num)
        patient_kode = _fmt_kode("PSN", next_psn_num)

        student_payload = {
            "id_sesi": req.session_id,
            "urutan_global": last_urutan + 1,
            "kode_giliran": student_kode,
            "nomor_giliran_pembicara": next_mhs_num,
            "pembicara": "mahasiswa",
            "waktu_mulai_detik": req.waktu_mulai_detik,
            "teks": clean_student_text,
            "pemicu_terkait": None,
            "status_asr_valid": req.status_asr_valid,
        }
        patient_payload = {
            "id_sesi": req.session_id,
            "urutan_global": last_urutan + 2,
            "kode_giliran": patient_kode,
            "nomor_giliran_pembicara": next_psn_num,
            "pembicara": "pasien",
            "waktu_mulai_detik": req.waktu_mulai_detik,
            "teks": reply_text,
            "pemicu_terkait": None,
            "status_asr_valid": True,
        }

        saved_student, saved_patient = await self.repo.save_turn_pair(
            session_id=req.session_id,
            student_row=student_payload,
            patient_row=patient_payload,
        )

        created_at = saved_patient.get("created_at") or datetime.now(timezone.utc)

        return SimulationTurnResponse(
            session_id=req.session_id,
            status_evaluasi="berjalan",
            student_turn_id=str(saved_student["id"]),
            student_kode_giliran=student_kode,
            turn_id=str(saved_patient["id"]),
            patient_kode_giliran=patient_kode,
            reply_text=reply_text,
            student_turn_count=next_mhs_num,
            created_at=created_at,
        )
        
        