import asyncio
from typing import Any


class SupabaseSimulationRepository:
    def __init__(self, supabase_client: Any) -> None:
        self.db = supabase_client

    def _fetch_scenario_sync(self, skenario_id: str, mode: str) -> dict[str, Any] | None:
        res = (
            self.db.table("skenario_praktikum")
            .select(
                "id, kode_skenario, versi, status_rilis, judul, jenis, "
                "profil_pasien, kalimat_pembuka, riwayat_alergi, "
                "obat_lain_suplemen, kondisi_penyerta, data_klinis_khusus, "
                "konfigurasi_pemicu, kamus_tambahan, mode_rilis"
            )
            .eq("id", skenario_id)
            .eq("status_rilis", "diterbitkan")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None

        row = rows[0]
        allowed_modes = row.get("mode_rilis") or []
        if isinstance(allowed_modes, list) and allowed_modes and mode not in allowed_modes:
            return None

        return row

    def _fetch_transcript_sync(self, session_id: str) -> list[dict[str, Any]]:
        res = (
            self.db.table("transkrip_dialog")
            .select("id, urutan_global, kode_giliran, nomor_giliran_pembicara, pembicara, teks")
            .eq("id_sesi", session_id)
            .order("urutan_global", desc=False)
            .execute()
        )
        return res.data or []

    def _insert_turn_pair_sync(
        self,
        *,
        session_id: str,
        student_row: dict[str, Any],
        patient_row: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        res = (
            self.db.table("transkrip_dialog")
            .insert([student_row, patient_row])
            .execute()
        )
        inserted = res.data or []
        if len(inserted) < 2:
            raise RuntimeError("Gagal menyimpan giliran percakapan ke transkrip_dialog.")
        return inserted[0], inserted[1]

    async def get_scenario_for_simulation(
        self,
        *,
        skenario_id: str,
        mode: str,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._fetch_scenario_sync, skenario_id, mode)

    async def get_session_transcript(self, session_id: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._fetch_transcript_sync, session_id)

    async def save_turn_pair(
        self,
        *,
        session_id: str,
        student_row: dict[str, Any],
        patient_row: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        return await asyncio.to_thread(
            self._insert_turn_pair_sync,
            session_id=session_id,
            student_row=student_row,
            patient_row=patient_row,
        )
        
    def _create_session_with_opening_sync(
        self,
        *,
        skenario_id: str,
        mode: str,
        id_mahasiswa: str,
        opening_text: str,
        waktu_mulai_detik: int,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        # 1. Buat record sesi simulasi (status awal berjalan)
        session_payload = {
            "id_skenario": skenario_id,
            "id_mahasiswa": id_mahasiswa,
            "mode": mode,
            "status_evaluasi": "berjalan",
        }
        ses_res = self.db.table("sesi_simulasi").insert(session_payload).execute()
        ses_rows = ses_res.data or []
        if not ses_rows:
            raise RuntimeError("Gagal membuat sesi simulasi baru.")
        session_row = ses_rows[0]
        session_id = session_row["id"]

        # 2. Catat kalimat pembuka pasien sebagai giliran pertama (urutan_global = 1, PSN-01)
        opening_payload = {
            "id_sesi": session_id,
            "urutan_global": 1,
            "kode_giliran": "PSN-01",
            "nomor_giliran_pembicara": 1,
            "pembicara": "pasien",
            "waktu_mulai_detik": waktu_mulai_detik,
            "teks": opening_text,
            "pemicu_terkait": None,
            "status_asr_valid": True,
        }
        tr_res = self.db.table("transkrip_dialog").insert(opening_payload).execute()
        tr_rows = tr_res.data or []
        if not tr_rows:
            raise RuntimeError("Gagal menyimpan kalimat pembuka ke transkrip_dialog.")

        return session_row, tr_rows[0]

    async def create_session_with_opening(
        self,
        *,
        skenario_id: str,
        mode: str,
        id_mahasiswa: str,
        opening_text: str,
        waktu_mulai_detik: int = 0,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        return await asyncio.to_thread(
            self._create_session_with_opening_sync,
            skenario_id=skenario_id,
            mode=mode,
            id_mahasiswa=id_mahasiswa,
            opening_text=opening_text,
            waktu_mulai_detik=waktu_mulai_detik,
        )