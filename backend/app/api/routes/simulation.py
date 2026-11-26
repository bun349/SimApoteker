from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.models.schemas import (
    SaveDocumentationRequest,
    SaveDocumentationResponse,
    SimulationTurnRequest,
    SimulationTurnResponse,
    StartSimulationRequest,
    StartSimulationResponse,
    SimulationFinishRequest,
    SimulationFinishResponse,
)
from app.repositories.scenario_repo import SupabaseSimulationRepository
from app.services.simulation.turn_service import SimulationTurnService
from app.services.simulation.finish_service import SimulationFinishService, get_finish_service

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


class SyncDurationRequest(BaseModel):
    durasi_detik: int = Field(ge=0)


def get_simulation_repo(request: Request) -> SupabaseSimulationRepository:
    supabase_client = getattr(request.app.state, "supabase", None)
    if supabase_client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Koneksi database belum diinisialisasi.",
        )
    return SupabaseSimulationRepository(supabase_client)


def get_turn_service(request: Request) -> SimulationTurnService:
    repo = get_simulation_repo(request)
    return SimulationTurnService(repo=repo)


@router.post(
    "/start",
    response_model=StartSimulationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_simulation_start(
    payload: StartSimulationRequest,
    turn_service: SimulationTurnService = Depends(get_turn_service),
) -> StartSimulationResponse:
    try:
        return await turn_service.start_session(payload)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memulai sesi simulasi: {type(exc).__name__}: {exc}",
        ) from exc


@router.patch("/{session_id}/pause", status_code=status.HTTP_200_OK)
async def pause_session_duration(
    session_id: str,
    payload: SyncDurationRequest,
    turn_service: SimulationTurnService = Depends(get_turn_service),
) -> dict[str, object]:
    try:
        return await turn_service.sync_active_duration(
            session_id=session_id,
            durasi_detik=payload.durasi_detik,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan durasi sesi: {type(exc).__name__}: {exc}",
        ) from exc


@router.post(
    "/turn",
    response_model=SimulationTurnResponse,
    status_code=status.HTTP_200_OK,
)
async def post_simulation_turn(
    payload: SimulationTurnRequest,
    turn_service: SimulationTurnService = Depends(get_turn_service),
) -> SimulationTurnResponse:
    try:
        return await turn_service.process_turn(payload)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses giliran simulasi ({type(exc).__name__}): {exc}",
        ) from exc


@router.post(
    "/finish",
    response_model=SimulationFinishResponse,
    status_code=status.HTTP_200_OK,
)
async def post_simulation_finish(
    payload: SimulationFinishRequest,
    finish_service: SimulationFinishService = Depends(get_finish_service),
) -> SimulationFinishResponse:
    try:
        return await finish_service.finish_session(payload)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses giliran simulasi ({type(exc).__name__}): {exc}",
        ) from exc


@router.post(
    "/{session_id}/documentation",
    response_model=SaveDocumentationResponse,
    status_code=status.HTTP_200_OK,
)
async def save_simulation_documentation(
    session_id: str,
    body: SaveDocumentationRequest,
    repo: SupabaseSimulationRepository = Depends(get_simulation_repo),
) -> SaveDocumentationResponse:
    try:
        session = await repo.get_session_by_id(session_id)
        if not session:
            raise LookupError("Sesi simulasi tidak ditemukan.")

        saved_row = await repo.save_documentation(
            session_id=session_id,
            payload=body.model_dump(),
        )
        return SaveDocumentationResponse(
            id=str(saved_row.get("id", "")),
            session_id=session_id,
            saved=True,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan dokumentasi kefarmasian ({type(exc).__name__}): {exc}",
        ) from exc


@router.get(
    "/{session_id}/documentation",
    status_code=status.HTTP_200_OK,
)
async def get_simulation_documentation(
    session_id: str,
    repo: SupabaseSimulationRepository = Depends(get_simulation_repo),
) -> dict[str, object]:
    try:
        session = await repo.get_session_by_id(session_id)
        if not session:
            raise LookupError("Sesi simulasi tidak ditemukan.")

        doc = await repo.get_documentation(session_id)
        return {
            "session_id": session_id,
            "exists": doc is not None,
            "documentation": doc,
            "session": session,
        }
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat dokumentasi kefarmasian ({type(exc).__name__}): {exc}",
        ) from exc