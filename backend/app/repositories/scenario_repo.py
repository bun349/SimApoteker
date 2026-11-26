import asyncio
from datetime import datetime, timezone
import logging
from typing import Any
import uuid

logger = logging.getLogger(__name__)


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
            .select(
                "id, id_sesi, urutan_global, kode_giliran, nomor_giliran_pembicara, "
                "pembicara, waktu_mulai_detik, teks, pemicu_terkait, status_asr_valid, created_at"
            )
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

        # Sinkronkan jumlah giliran mahasiswa secara real-time di sesi_simulasi
        try:
            mhs_num = int(student_row.get("nomor_giliran_pembicara") or 0)
            if mhs_num > 0:
                valid_flag = student_row.get("status_asr_valid", True) is not False
                update_fields: dict[str, Any] = {"jumlah_giliran_mahasiswa": mhs_num}
                if valid_flag:
                    update_fields["jumlah_giliran_valid"] = mhs_num
                self.db.table("sesi_simulasi").update(update_fields).eq("id", session_id).execute()
        except Exception as exc:
            logger.debug("Sinkronisasi jumlah giliran pada sesi_simulasi dilewati: %s", exc)

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

    def _get_active_session_sync(
        self,
        *,
        id_mahasiswa: str,
        id_skenario: str,
        mode: str,
    ) -> dict[str, Any] | None:
        res = (
            self.db.table("sesi_simulasi")
            .select("*")
            .eq("id_mahasiswa", id_mahasiswa)
            .eq("id_skenario", id_skenario)
            .eq("mode", mode)
            .eq("status_evaluasi", "berjalan")
            .order("waktu_mulai", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    async def get_active_session(
        self,
        *,
        id_mahasiswa: str,
        id_skenario: str,
        mode: str,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._get_active_session_sync,
            id_mahasiswa=id_mahasiswa,
            id_skenario=id_skenario,
            mode=mode,
        )

    def _has_completed_practicum_attempt_sync(
        self,
        *,
        id_mahasiswa: str,
        id_skenario: str,
    ) -> bool:
        blocking_statuses = ["selesai_otomatis", "perlu_ditinjau_dosen", "selesai_ditinjau"]
        res = (
            self.db.table("sesi_simulasi")
            .select("id, status_evaluasi")
            .eq("id_mahasiswa", id_mahasiswa)
            .eq("id_skenario", id_skenario)
            .eq("mode", "praktikum")
            .in_("status_evaluasi", blocking_statuses)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def has_completed_practicum_attempt(
        self,
        *,
        id_mahasiswa: str,
        id_skenario: str,
    ) -> bool:
        return await asyncio.to_thread(
            self._has_completed_practicum_attempt_sync,
            id_mahasiswa=id_mahasiswa,
            id_skenario=id_skenario,
        )

    def _update_active_duration_sync(
        self,
        *,
        session_id: str,
        durasi_aktif_detik: int,
    ) -> None:
        safe_duration = max(0, int(durasi_aktif_detik))
        try:
            self.db.table("sesi_simulasi").update(
                {"durasi_aktif_detik": safe_duration}
            ).eq("id", session_id).eq("status_evaluasi", "berjalan").execute()
        except Exception as exc:
            logger.debug(
                "update_active_duration dilewati (cek kolom durasi_aktif_detik): %s",
                exc,
            )

    async def update_active_duration(
        self,
        *,
        session_id: str,
        durasi_aktif_detik: int,
    ) -> None:
        await asyncio.to_thread(
            self._update_active_duration_sync,
            session_id=session_id,
            durasi_aktif_detik=durasi_aktif_detik,
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
        now_utc = datetime.now(timezone.utc)
        kode_sesi = f"SES-{now_utc.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

        session_payload = {
            "kode_sesi": kode_sesi,
            "id_skenario": skenario_id,
            "id_mahasiswa": id_mahasiswa,
            "mode": mode,
            "status_evaluasi": "berjalan",
        }
        ses_res = self.db.table("sesi_simulasi").insert(session_payload).execute()
        ses_rows = ses_res.data or []
        if not ses_rows:
            fallback_ses = (
                self.db.table("sesi_simulasi")
                .select("*")
                .eq("kode_sesi", kode_sesi)
                .limit(1)
                .execute()
            )
            ses_rows = fallback_ses.data or []

        if not ses_rows:
            raise RuntimeError(
                f"Insert sesi_simulasi tidak mengembalikan baris (kode_sesi={kode_sesi})."
            )

        session_row = ses_rows[0]
        session_id = session_row.get("id")
        if not session_id:
            raise RuntimeError("Baris sesi_simulasi tidak memiliki kolom 'id'.")

        opening_payload = {
            "id_sesi": session_id,
            "urutan_global": 1,
            "kode_giliran": "PSN-01",
            "nomor_giliran_pembicara": 1,
            "pembicara": "pasien",
            "waktu_mulai_detik": int(waktu_mulai_detik),
            "teks": opening_text,
            "pemicu_terkait": None,
            "status_asr_valid": True,
        }
        tr_res = self.db.table("transkrip_dialog").insert(opening_payload).execute()
        tr_rows = tr_res.data or []
        if not tr_rows:
            fallback_tr = (
                self.db.table("transkrip_dialog")
                .select("*")
                .eq("id_sesi", session_id)
                .eq("kode_giliran", "PSN-01")
                .limit(1)
                .execute()
            )
            tr_rows = fallback_tr.data or []

        if not tr_rows:
            raise RuntimeError(
                f"Insert transkrip_dialog gagal mengembalikan baris untuk id_sesi={session_id}."
            )

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

    def _get_session_sync(self, session_id: str) -> dict[str, Any] | None:
        res = (
            self.db.table("sesi_simulasi")
            .select(
                "id, kode_sesi, id_skenario, id_mahasiswa, mode, "
                "jumlah_giliran_mahasiswa, jumlah_giliran_valid, "
                "persentase_audio_valid, jumlah_segmen_vokal_valid, "
                "semua_pemicu_tergali, status_evaluasi, perlu_ditinjau_dosen, "
                "alasan_tinjau_dosen, penanda_khusus, waktu_mulai, waktu_selesai, "
                "durasi_aktif_detik"
            )
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    async def get_session_by_id(self, session_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_session_sync, session_id)

    def _get_scenario_finish_sync(self, skenario_id: str) -> dict[str, Any] | None:
        res = (
            self.db.table("skenario_praktikum")
            .select(
                "id, profil_pasien, kalimat_pembuka, konfigurasi_pemicu, butir_tidak_berlaku"
            )
            .eq("id", skenario_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    async def get_scenario_finish_data(self, skenario_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_scenario_finish_sync, skenario_id)

    def _mark_session_finished_sync(
        self,
        *,
        session_id: str,
        durasi_detik: int,
        status_evaluasi: str,
        farewell_row: dict[str, Any] | None = None,
        extra_session_updates: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if farewell_row:
            self.db.table("transkrip_dialog").insert(farewell_row).execute()

        allowed_columns = {
            "status_evaluasi",
            "waktu_selesai",
            "durasi_aktif_detik",
            "jumlah_giliran_mahasiswa",
            "jumlah_giliran_valid",
            "semua_pemicu_tergali",
            "penanda_khusus",
            "perlu_ditinjau_dosen",
            "alasan_tinjau_dosen",
            "persentase_audio_valid",
            "jumlah_segmen_vokal_valid",
        }

        payload: dict[str, Any] = {
            "status_evaluasi": status_evaluasi,
            "waktu_selesai": datetime.now(timezone.utc).isoformat(),
            "durasi_aktif_detik": max(0, int(durasi_detik)),
        }
        if extra_session_updates:
            for key, val in extra_session_updates.items():
                if key in allowed_columns:
                    payload[key] = val

        res = (
            self.db.table("sesi_simulasi")
            .update(payload)
            .eq("id", session_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else {"id": session_id, **payload}

    async def mark_session_finished(
        self,
        *,
        session_id: str,
        durasi_detik: int,
        status_evaluasi: str,
        farewell_row: dict[str, Any] | None = None,
        extra_session_updates: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._mark_session_finished_sync,
            session_id=session_id,
            durasi_detik=durasi_detik,
            status_evaluasi=status_evaluasi,
            farewell_row=farewell_row,
            extra_session_updates=extra_session_updates,
        )

    def _discard_session_and_transcript_sync(self, session_id: str) -> bool:
        self.db.table("transkrip_dialog").delete().eq("id_sesi", session_id).execute()
        res = self.db.table("sesi_simulasi").delete().eq("id", session_id).execute()
        deleted = bool(res.data)
        if not deleted:
            logger.warning(
                "discard_session_and_transcript: tidak ada baris sesi terhapus untuk session_id=%s (cek RLS/service key atau id sesi)",
                session_id,
            )
        return deleted

    async def discard_session_and_transcript(self, session_id: str) -> bool:
        return await asyncio.to_thread(self._discard_session_and_transcript_sync, session_id)

    def _save_documentation_sync(
        self,
        *,
        session_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        record: dict[str, Any] = {
            "id_sesi": session_id,
            **payload,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        res = (
            self.db.table("dokumentasi_konseling")
            .upsert(record, on_conflict="id_sesi")
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else {}

    async def save_documentation(
        self,
        *,
        session_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._save_documentation_sync,
            session_id=session_id,
            payload=payload,
        )

    def _get_documentation_sync(self, session_id: str) -> dict[str, Any] | None:
        res = (
            self.db.table("dokumentasi_konseling")
            .select("*")
            .eq("id_sesi", session_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    async def get_documentation(self, session_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_documentation_sync, session_id)