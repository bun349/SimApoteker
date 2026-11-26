from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

from app.api.routes.evaluation import router as evaluation_router
from app.api.routes.simulation import router as simulation_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    supabase_url = (
        getattr(settings, "supabase_url", None)
        or getattr(settings, "SUPABASE_URL", "")
    )
    supabase_key = (
        getattr(settings, "SUPABASE_SECRET_KEY", None)
        or getattr(settings, "supabase_secret_key", None)
        or getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
        or getattr(settings, "supabase_service_role_key", None)
        or getattr(settings, "SUPABASE_KEY", None)
        or getattr(settings, "supabase_key", "")

    )

    print("[STARTUP] supabase_url present:", bool(supabase_url), "| key present:", bool(supabase_key))

    if supabase_url and supabase_key:
        app.state.supabase = create_client(supabase_url, supabase_key)
    else:
        app.state.supabase = None

    yield
    app.state.supabase = None


app = FastAPI(title="VIKIE API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulation_router)
app.include_router(evaluation_router)