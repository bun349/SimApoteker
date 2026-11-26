from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.models.schemas import EvaluationRequest
from app.repositories.evaluation_repo import SupabaseEvaluationRepository
from app.services.evaluation.konten_klinis import proses_evaluasi_konten
from app.services.evaluation.scoring_engine import (
    _has_meaningful_json,
    evaluate_session_comprehensive,
)

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


def get_evaluation_repo(request: Request) -> SupabaseEvaluationRepository:
    supabase_client = getattr(request.app.state, "supabase", None)
    if supabase_client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Koneksi database belum diinisialisasi.",
        )
    return SupabaseEvaluationRepository(supabase_client)


def _build_safe_scenario_summary(scenario: dict[str, Any] | None) -> dict[str, Any]:
    if not scenario:
        return {}
    profil = scenario.get("profil_pasien") or {}
    return {
        "id": scenario.get("id"),
        "kode_skenario": scenario.get("kode_skenario"),
        "versi": scenario.get("versi") or "0.1",
        "judul": scenario.get("judul"),
        "jenis": scenario.get("jenis"),
        "memuat_ddi": bool(scenario.get("memuat_ddi"))
        or _has_meaningful_json(scenario.get("interaksi_ditanam")),
        "bobot_komunikasi": scenario.get("bobot_komunikasi"),
        "bobot_konten": scenario.get("bobot_konten"),
        "nama_pasien": (
            (profil.get("nama_pasien") or profil.get("nama"))
            if isinstance(profil, dict)
            else None
        ),
    }


def _format_bundle_response(
    bundle: dict[str, Any],
    rapor: dict[str, Any],
) -> dict[str, Any]:
    return {
        "rapor": rapor,
        "session": bundle["session"],
        "scenario": _build_safe_scenario_summary(bundle.get("scenario")),
        "student": bundle.get("student"),
        "reviewer": bundle.get("reviewer"),
        "transcript": bundle.get("transcript") or [],
        "has_documentation": bundle.get("documentation") is not None,
        "documentation": bundle.get("documentation"),
    }


@router.post("/konten-klinis")
async def evaluate_konten_klinis_endpoint(request: EvaluationRequest):
    try:
        hasil = await proses_evaluasi_konten(request)
        return hasil
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}", status_code=status.HTTP_200_OK)
async def evaluate_session_endpoint(
    session_id: str,
    force: bool = Query(default=False),
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    try:
        bundle = await repo.get_session_bundle(session_id)
        if not bundle:
            raise LookupError("Sesi simulasi tidak ditemukan.")
        if not bundle.get("scenario"):
            raise LookupError("Data skenario untuk sesi ini tidak ditemukan.")

        existing_rapor = bundle.get("rapor")
        if existing_rapor and not force:
            return _format_bundle_response(bundle, existing_rapor)

        rapor_payload = await evaluate_session_comprehensive(
            session=bundle["session"],
            scenario=bundle["scenario"],
            transcript_rows=bundle.get("transcript") or [],
            existing_rapor=existing_rapor,
            kamus_umum=bundle.get("kamus_umum"),
        )
        saved_rapor = await repo.upsert_rapor(
            session_id=session_id,
            payload=rapor_payload,
            existing_rapor=existing_rapor,
        )
        return _format_bundle_response(bundle, saved_rapor)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengevaluasi sesi ({type(exc).__name__}): {exc}",
        ) from exc


@router.get("/rapor/{session_id}", status_code=status.HTTP_200_OK)
async def get_session_rapor_endpoint(
    session_id: str,
    auto_evaluate: bool = Query(default=True),
    force: bool = Query(default=False),
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    try:
        bundle = await repo.get_session_bundle(session_id)
        if not bundle:
            raise LookupError("Sesi simulasi tidak ditemukan.")
        if not bundle.get("scenario"):
            raise LookupError("Data skenario untuk sesi ini tidak ditemukan.")

        existing_rapor = bundle.get("rapor")
        if existing_rapor and not force:
            return _format_bundle_response(bundle, existing_rapor)

        if not auto_evaluate:
            raise LookupError("Rapor penilaian untuk sesi ini belum tersedia.")

        rapor_payload = await evaluate_session_comprehensive(
            session=bundle["session"],
            scenario=bundle["scenario"],
            transcript_rows=bundle.get("transcript") or [],
            existing_rapor=existing_rapor,
            kamus_umum=bundle.get("kamus_umum"),
        )
        saved_rapor = await repo.upsert_rapor(
            session_id=session_id,
            payload=rapor_payload,
            existing_rapor=existing_rapor,
        )
        return _format_bundle_response(bundle, saved_rapor)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat rapor penilaian ({type(exc).__name__}): {exc}",
        ) from exc


@router.get("/latest", status_code=status.HTTP_200_OK)
async def get_latest_rapor_endpoint(
    id_mahasiswa: str = Query(..., min_length=1),
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    try:
        latest_sid = await repo.get_latest_session_id_for_student(id_mahasiswa)
        if not latest_sid:
            raise LookupError("Belum ada sesi simulasi yang selesai untuk ditampilkan di rapor.")

        bundle = await repo.get_session_bundle(latest_sid)
        if not bundle or not bundle.get("scenario"):
            raise LookupError("Data sesi atau skenario terakhir tidak ditemukan.")

        existing_rapor = bundle.get("rapor")
        if existing_rapor:
            return _format_bundle_response(bundle, existing_rapor)

        rapor_payload = await evaluate_session_comprehensive(
            session=bundle["session"],
            scenario=bundle["scenario"],
            transcript_rows=bundle.get("transcript") or [],
            existing_rapor=None,
            kamus_umum=bundle.get("kamus_umum"),
        )
        saved_rapor = await repo.upsert_rapor(
            session_id=latest_sid,
            payload=rapor_payload,
            existing_rapor=None,
        )
        return _format_bundle_response(bundle, saved_rapor)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat rapor terakhir ({type(exc).__name__}): {exc}",
        ) from exc


@router.get("/history", status_code=status.HTTP_200_OK)
async def get_student_history_endpoint(
    id_mahasiswa: str = Query(..., min_length=1),
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    try:
        items = await repo.get_student_history(id_mahasiswa)

        completed_items = [x for x in items if x.get("status_evaluasi") != "berjalan"]
        mandiri_count = sum(1 for x in completed_items if x.get("mode") == "mandiri")
        praktikum_count = sum(1 for x in completed_items if x.get("mode") == "praktikum")

        official_scores: list[float] = []
        ddi_scores: list[float] = []
        durations: list[int] = []

        for x in completed_items:
            dur = int(x.get("durasi_aktif_detik") or 0)
            if dur > 0:
                durations.append(dur)
            rapor = x.get("rapor")
            if isinstance(rapor, dict):
                score = rapor.get("nilai_resmi_akhir")
                if score is None:
                    score = rapor.get("nilai_gabungan_sistem_tampil")
                if isinstance(score, (int, float)):
                    official_scores.append(float(score))

                ddi = rapor.get("skor_penanganan_ddi")
                if isinstance(ddi, (int, float)):
                    ddi_scores.append(float(ddi))

        avg_official = (
            round(sum(official_scores) / len(official_scores), 1)
            if official_scores
            else None
        )
        if ddi_scores:
            avg_ddi = round(sum(ddi_scores) / len(ddi_scores), 1)
        elif completed_items:
            covered = sum(1 for x in completed_items if x.get("semua_pemicu_tergali"))
            avg_ddi = round((covered / len(completed_items)) * 100.0, 1)
        else:
            avg_ddi = None

        avg_duration_sec = int(round(sum(durations) / len(durations))) if durations else 0

        return {
            "summary": {
                "total_sessions": len(completed_items),
                "total_all": len(items),
                "mandiri_count": mandiri_count,
                "praktikum_count": praktikum_count,
                "avg_official_score": avg_official,
                "avg_ddi_detection": avg_ddi,
                "avg_duration_sec": avg_duration_sec,
            },
            "items": items,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat riwayat simulasi ({type(exc).__name__}): {exc}",
        ) from exc


@router.get("/dosen/rekap", status_code=status.HTTP_200_OK)
async def get_dosen_rekap_endpoint(
    id_dosen: str = Query(..., min_length=1),
    id_kelas: str | None = Query(default=None),
    id_tugas: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    try:
        return await repo.get_dosen_recap(
            id_dosen=id_dosen,
            id_kelas=id_kelas,
            id_tugas=id_tugas,
            status_filter=status_filter,
            search=search,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat rekap kelas dan analitik ({type(exc).__name__}): {exc}",
        ) from exc


@router.get("/dosen/antrean", status_code=status.HTTP_200_OK)
async def get_dosen_antrean_endpoint(
    id_dosen: str = Query(..., min_length=1),
    id_kelas: str | None = Query(default=None),
    id_tugas: str | None = Query(default=None),
    search: str | None = Query(default=None),
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    try:
        return await repo.get_dosen_review_queue(
            id_dosen=id_dosen,
            id_kelas=id_kelas,
            id_tugas=id_tugas,
            search=search,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memuat antrean tinjauan ({type(exc).__name__}): {exc}",
        ) from exc


class DosenReviewSubmitBody(BaseModel):
    id_dosen: str = Field(..., min_length=1)
    is_overridden: bool = True
    skor_komunikasi_dosen: float | None = Field(default=None, ge=0, le=100)
    skor_konten_dosen: float | None = Field(default=None, ge=0, le=100)
    nilai_resmi_akhir: int = Field(..., ge=0, le=100)
    catatan_override_butir: dict[str, Any] | None = None
    komentar_dosen_untuk_mahasiswa: str | None = None
    alasan_perubahan: str | None = None


async def _handle_dosen_review_save(
    session_id: str,
    body: DosenReviewSubmitBody,
    repo: SupabaseEvaluationRepository,
) -> dict[str, Any]:
    try:
        updated_rapor = await repo.submit_dosen_review(
            session_id=session_id,
            id_dosen=body.id_dosen,
            is_overridden=body.is_overridden,
            skor_komunikasi_dosen=body.skor_komunikasi_dosen,
            skor_konten_dosen=body.skor_konten_dosen,
            nilai_resmi_akhir=body.nilai_resmi_akhir,
            catatan_override_butir=body.catatan_override_butir,
            komentar_dosen_untuk_mahasiswa=body.komentar_dosen_untuk_mahasiswa,
            alasan_perubahan=body.alasan_perubahan,
        )
        bundle = await repo.get_session_bundle(session_id)
        if bundle:
            return _format_bundle_response(bundle, updated_rapor)
        return {"rapor": updated_rapor}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan tinjauan dosen ({type(exc).__name__}): {exc}",
        ) from exc


@router.post("/dosen/tinjau/{session_id}", status_code=status.HTTP_200_OK)
async def submit_dosen_review_endpoint(
    session_id: str,
    body: DosenReviewSubmitBody,
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    return await _handle_dosen_review_save(session_id, body, repo)


@router.put("/dosen/rapor/{session_id}/review", status_code=status.HTTP_200_OK)
async def put_dosen_rapor_review_endpoint(
    session_id: str,
    body: DosenReviewSubmitBody,
    repo: SupabaseEvaluationRepository = Depends(get_evaluation_repo),
) -> dict[str, Any]:
    return await _handle_dosen_review_save(session_id, body, repo)
