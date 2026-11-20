from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.database import supabase 
from app.core.security import get_current_user # Pastikan Anda sudah membuat file security.py

router = APIRouter(prefix="/auth", tags=["Authentication"])

# --- SKEMA REQUEST ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    nama_lengkap: str
    peran: str = "mahasiswa" 
    nomor_induk: str 
    id_kelas: Optional[str] = None

# --- ENDPOINT LOGIN (Terbuka untuk Umum) ---
@router.post("/login")
async def login(request: LoginRequest):
    try:
        # 1. Login ke Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        auth_user_id = auth_response.user.id
        
        # 2. Ambil data dengan mengekstrak data dari list, jangan pakai .single() 
        # karena .single() akan melempar error keras jika RLS Python client belum sinkron
        db_response = supabase.table("pengguna").select("*").eq("auth_user_id", auth_user_id).execute()
        
        # Cek apakah data ditemukan
        if not db_response.data or len(db_response.data) == 0:
             raise Exception("Data pengguna tidak ditemukan di tabel public.pengguna. Pastikan auth_user_id cocok.")
             
        pengguna_data = db_response.data[0] # Ambil baris pertama

        return {
            "status": "success",
            "message": "Login berhasil",
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "user": {
                "auth_user_id": pengguna_data["auth_user_id"],
                "email": pengguna_data["email"],
                "nama_lengkap": pengguna_data["nama_lengkap"],
                "nomor_induk": pengguna_data["nomor_induk"],
                "peran": pengguna_data["peran"], 
                "id_kelas": pengguna_data.get("id_kelas")
            }
        }
    except Exception as e:
        # Menampilkan error aslinya ke Swagger UI
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal login: {str(e)}"
        )
        
# --- ENDPOINT REGISTER (Terbatas hanya untuk Admin) ---
@router.post("/register")
async def register(
    request: RegisterRequest, 
    user_data: dict = Depends(get_current_user)
):
    role_pengakses = user_data.get("user_metadata", {}).get("peran")
    
    if role_pengakses != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Hanya Admin yang dapat mendaftarkan pengguna baru."
        )

    if request.peran == "admin":
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak dapat membuat akun admin melalui endpoint ini."
        )

    try:
        res = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "nama_lengkap": request.nama_lengkap,
                    "peran": request.peran,
                    "nomor_induk": request.nomor_induk,
                    "id_kelas": request.id_kelas # <-- Lempar ID kelas ke metadata Supabase
                }
            }
        })
        
        return {
            "status": "success",
            "message": f"Akun {request.peran} berhasil dibuat oleh Admin",
            "auth_user_id": res.user.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membuat akun: {str(e)}"
        )