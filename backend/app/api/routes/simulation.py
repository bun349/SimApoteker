from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.models.schemas import (
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


def get_turn_service(request: Request) -> SimulationTurnService:
    supabase_client = getattr(request.app.state, "supabase", None)
    if supabase_client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Koneksi database belum diinisialisasi.",
        )
    repo = SupabaseSimulationRepository(supabase_client)
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