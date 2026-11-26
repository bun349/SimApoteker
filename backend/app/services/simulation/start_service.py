from typing import Any

from fastapi import HTTPException

from app.models.schemas import PatientPersonaContext
from app.repositories.scenario_repo import SupabaseSimulationRepository


def _sanitize_persona_for_mode(
    persona: PatientPersonaContext,
    mode: str,
) -> PatientPersonaContext:
    """Sembunyikan daftar pemicu mentah saat mode praktikum agar tidak bocor di payload."""
    if mode != "praktikum":
        return persona
    return persona.model_copy(
        update={
            "key_info_triggers": [],
            "cue_triggers": [],
            "probe_triggers": [],
        }
    )


class StartSimulationService:
    def __init__(self, repo: SupabaseSimulationRepository) -> None:
        self.repo = repo

    async def start_or_resume_session(
        self,
        *,
        skenario_id: str,
        mode: str,
        id_mahasiswa: str,
        persona_context: PatientPersonaContext,
        opening_text: str,
    ) -> dict[str, Any]:
        # 1. Cek sesi berjalan untuk auto-resume
        active_session = await self.repo.get_active_session(
            id_mahasiswa=id_mahasiswa,
            id_skenario=skenario_id,
            mode=mode,
        )
        if active_session:
            session_id = str(active_session["id"])
            transcript = await self.repo.get_session_transcript(session_id)
            safe_persona = _sanitize_persona_for_mode(persona_context, mode)
            return {
                "session_id": session_id,
                "skenario_id": skenario_id,
                "mode": mode,
                "status_evaluasi": active_session.get("status_evaluasi") or "berjalan",
                "is_resumed": True,
                "durasi_aktif_detik": int(active_session.get("durasi_aktif_detik") or 0),
                "transcript": transcript,
                "persona_context": safe_persona,
            }

        # 2. Jika mode praktikum, blokir bila sudah ada percobaan sah yang selesai/ditinjau
        if mode == "praktikum":
            already_completed = await self.repo.has_completed_practicum_attempt(
                id_mahasiswa=id_mahasiswa,
                id_skenario=skenario_id,
            )
            if already_completed:
                raise HTTPException(
                    status_code=409,
                    detail="Percobaan mode praktikum untuk skenario ini sudah selesai.",
                )

        # 3. Buat sesi baru + giliran pembuka PSN-01
        session_row, opening_row = await self.repo.create_session_with_opening(
            skenario_id=skenario_id,
            mode=mode,
            id_mahasiswa=id_mahasiswa,
            opening_text=opening_text,
            waktu_mulai_detik=0,
        )
        safe_persona = _sanitize_persona_for_mode(persona_context, mode)

        return {
            "session_id": str(session_row["id"]),
            "skenario_id": skenario_id,
            "mode": mode,
            "status_evaluasi": session_row.get("status_evaluasi") or "berjalan",
            "is_resumed": False,
            "durasi_aktif_detik": int(session_row.get("durasi_aktif_detik") or 0),
            "opening_turn_id": opening_row.get("id"),
            "opening_kode_giliran": opening_row.get("kode_giliran") or "PSN-01",
            "opening_text": opening_text,
            "persona_context": safe_persona,
            "created_at": session_row.get("waktu_mulai"),
        }