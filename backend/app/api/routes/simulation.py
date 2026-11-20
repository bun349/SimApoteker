from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.models.schemas import (
    SimulationTurnRequest,
    SimulationTurnResponse,
    StartSimulationRequest,
    StartSimulationResponse,
)
from app.repositories.scenario_repo import SupabaseSimulationRepository
from app.services.simulation.turn_service import SimulationTurnService

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
            detail="Terjadi kesalahan saat memulai sesi simulasi.",
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
            detail="Terjadi kesalahan saat memproses giliran simulasi.",
        ) from exc