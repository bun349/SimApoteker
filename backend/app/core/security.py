from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.database import supabase # Sesuaikan jalur import ini

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # 1. Minta Supabase memvalidasi token JWT-nya
        auth_response = supabase.auth.get_user(token)
        auth_user_id = auth_response.user.id
        
        # 2. Jangan percaya pada metadata token, tapi langsung tembak tabel database
        db_response = supabase.table("pengguna").select("peran").eq("auth_user_id", auth_user_id).single().execute()
        peran_asli = db_response.data["peran"]
        
        # 3. Kembalikan format yang diharapkan oleh endpoint /register kita sebelumnya
        return {
            "user_metadata": {
                "peran": peran_asli
            }
        }
    except Exception as e:
        # Tampilkan error aslinya agar kita tahu jika ada masalah lain
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token autentikasi tidak valid atau akses ditolak: {str(e)}"
        )