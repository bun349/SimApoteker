from fastapi import APIRouter, HTTPException
from app.models.schemas import EvaluationRequest
from app.services.evaluation.konten_klinis import proses_evaluasi_konten

router = APIRouter()

@router.post("/konten-klinis")
async def evaluate_konten_klinis_endpoint(request: EvaluationRequest):
    try:
        hasil = await proses_evaluasi_konten(request)
        return hasil
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))