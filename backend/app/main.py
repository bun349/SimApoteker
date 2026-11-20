from dotenv import load_dotenv
from app.api import auth
load_dotenv() # HARUS dieksekusi sebelum import file-file di bawahnya

from fastapi import FastAPI
from app.api.routes import evaluation

app = FastAPI(title="Backend VIKIE API")

# Mendaftarkan router dengan prefix
app.include_router(evaluation.router, prefix="/evaluate", tags=["Evaluation"])
app.include_router(auth.router)