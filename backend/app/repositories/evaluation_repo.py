"""Repository Supabase untuk evaluasi dan tabel rapor_penilaian."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any

logger = logging.getLogger(__name__)

_RAPOR_TO_SESSION_STATUS: dict[str, str] = {
    "otomatis": "selesai_otomatis",
    "perlu_ditinjau_dosen": "perlu_ditinjau_dosen",
    "selesai_ditinjau": "selesai_ditinjau",
    "tidak_cukup_data": "tidak_cukup_data",
    "tidak_dapat_dinilai": "tidak_dapat_dinilai",
}


class SupabaseEvaluationRepository:
    def __init__(self, supabase_client: Any) -> None:
        self.db = supabase_client

    def _get_session_bundle_sync(self, session_id: str) -> dict[str, Any] | None:
        sess_res = (
            self.db.table("sesi_simulasi")
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        sess_rows = sess_res.data or []
        if not sess_rows:
            return None
        session = sess_rows[0]

        skenario_id = session.get("id_skenario")
        scenario: dict[str, Any] | None = None
        if skenario_id:
            scen_res = (
                self.db.table("skenario_praktikum")
                .select("*")
                .eq("id", skenario_id)
                .limit(1)
                .execute()
            )
            scen_rows = scen_res.data or []
            if scen_rows:
                scenario = scen_rows[0]

        trans_res = (
            self.db.table("transkrip_dialog")
            .select("*")
            .eq("id_sesi", session_id)
            .order("urutan_global", desc=False)
            .execute()
        )
        transcript = trans_res.data or []

        rapor_res = (
            self.db.table("rapor_penilaian")
            .select("*")
            .eq("id_sesi", session_id)
            .limit(1)
            .execute()
        )
        rapor_rows = rapor_res.data or []
        rapor = rapor_rows[0] if rapor_rows else None

        documentation: dict[str, Any] | None = None
        try:
            doc_res = (
                self.db.table("dokumentasi_konseling")
                .select("*")
                .eq("id_sesi", session_id)
                .limit(1)
                .execute()
            )
            doc_rows = doc_res.data or []
            documentation = doc_rows[0] if doc_rows else None
        except Exception as exc:
            logger.debug("Gagal membaca dokumentasi_konseling untuk sesi %s: %s", session_id, exc)

        kamus_umum: list[dict[str, Any]] = []
        try:
            kamus_res = (
                self.db.table("kamus_istilah_umum")
                .select("id, kelompok, istilah, variasi_ejaan, padanan_awam, aktif")
                .eq("aktif", True)
                .execute()
            )
            kamus_umum = kamus_res.data or []
        except Exception as exc:
            logger.debug("Gagal membaca kamus_istilah_umum: %s", exc)

        # Identitas mahasiswa & kelas untuk header tinjauan dosen
        student: dict[str, Any] | None = None
        student_id = session.get("id_mahasiswa")
        if student_id:
            try:
                m_res = (
                    self.db.table("pengguna")
                    .select("id, nama_lengkap, nomor_induk, email, id_kelas")
                    .eq("id", student_id)
                    .limit(1)
                    .execute()
                )
                m_row = (m_res.data or [None])[0]
                if m_row:
                    nama_kelas: str | None = None
                    kode_kelas: str | None = None
                    kls_id = m_row.get("id_kelas")
                    if kls_id:
                        k_res = (
                            self.db.table("kelas")
                            .select("id, nama_kelas, kode_kelas")
                            .eq("id", kls_id)
                            .limit(1)
                            .execute()
                        )
                        k_row = (k_res.data or [None])[0]
                        if k_row:
                            nama_kelas = k_row.get("nama_kelas")
                            kode_kelas = k_row.get("kode_kelas")
                    student = {
                        "id": str(m_row["id"]),
                        "nama_lengkap": m_row.get("nama_lengkap") or "Mahasiswa",
                        "nomor_induk": m_row.get("nomor_induk") or "-",
                        "email": m_row.get("email") or "",
                        "id_kelas": str(kls_id) if kls_id else None,
                        "nama_kelas": nama_kelas,
                        "kode_kelas": kode_kelas,
                    }
            except Exception as exc:
                logger.debug("Gagal membaca identitas mahasiswa sesi %s: %s", session_id, exc)

        # Identitas dosen peninjau terakhir (jika sudah pernah ditinjau)
        reviewer: dict[str, Any] | None = None
        reviewer_id = (rapor or {}).get("id_dosen_peninjau")
        if reviewer_id:
            try:
                r_res = (
                    self.db.table("pengguna")
                    .select("id, nama_lengkap, nomor_induk, email")
                    .eq("id", reviewer_id)
                    .limit(1)
                    .execute()
                )
                r_row = (r_res.data or [None])[0]
                if r_row:
                    reviewer = {
                        "id": str(r_row["id"]),
                        "nama_lengkap": r_row.get("nama_lengkap") or "Dosen Penguji",
                        "nomor_induk": r_row.get("nomor_induk") or "",
                        "email": r_row.get("email") or "",
                    }
            except Exception as exc:
                logger.debug("Gagal membaca identitas dosen peninjau %s: %s", reviewer_id, exc)

        return {
            "session": session,
            "scenario": scenario,
            "transcript": transcript,
            "rapor": rapor,
            "documentation": documentation,
            "kamus_umum": kamus_umum,
            "student": student,
            "reviewer": reviewer,
        }

    async def get_session_bundle(self, session_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_session_bundle_sync, session_id)

    def _upsert_rapor_sync(
        self,
        *,
        session_id: str,
        payload: dict[str, Any],
        existing_rapor: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        record = dict(payload)
        record["id_sesi"] = session_id
        record["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Pertahankan override dosen jika rapor sebelumnya sudah ditinjau dosen
        if existing_rapor and existing_rapor.get("is_overridden"):
            record["status_rapor"] = "selesai_ditinjau"
            if existing_rapor.get("nilai_resmi_akhir") is not None:
                record["nilai_resmi_akhir"] = existing_rapor["nilai_resmi_akhir"]

        res = (
            self.db.table("rapor_penilaian")
            .upsert(record, on_conflict="id_sesi")
            .execute()
        )
        rows = res.data or []
        saved_rapor = rows[0] if rows else record

        # Sinkronkan status evaluasi pada tabel sesi_simulasi
        status_rapor = str(saved_rapor.get("status_rapor") or "otomatis")
        status_sesi = _RAPOR_TO_SESSION_STATUS.get(status_rapor, "selesai_otomatis")
        meta = saved_rapor.get("metadata_evaluasi") if isinstance(saved_rapor.get("metadata_evaluasi"), dict) else {}
        alasan_tinjau = list(meta.get("alasan_tinjau_dosen") or [])
        perlu_tinjau = status_rapor == "perlu_ditinjau_dosen"

        try:
            self.db.table("sesi_simulasi").update(
                {
                    "status_evaluasi": status_sesi,
                    "perlu_ditinjau_dosen": perlu_tinjau,
                    "alasan_tinjau_dosen": alasan_tinjau,
                }
            ).eq("id", session_id).execute()
        except Exception as exc:
            logger.warning("Sinkronisasi sesi_simulasi untuk %s dilewati: %s", session_id, exc)

        return saved_rapor

    async def upsert_rapor(
        self,
        *,
        session_id: str,
        payload: dict[str, Any],
        existing_rapor: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._upsert_rapor_sync,
            session_id=session_id,
            payload=payload,
            existing_rapor=existing_rapor,
        )

    def _get_latest_session_id_sync(self, id_mahasiswa: str) -> str | None:
        res = (
            self.db.table("sesi_simulasi")
            .select("id, status_evaluasi, waktu_selesai, waktu_mulai")
            .eq("id_mahasiswa", id_mahasiswa)
            .neq("status_evaluasi", "berjalan")
            .order("waktu_selesai", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows:
            return str(rows[0]["id"])

        fallback = (
            self.db.table("sesi_simulasi")
            .select("id")
            .eq("id_mahasiswa", id_mahasiswa)
            .order("waktu_mulai", desc=True)
            .limit(1)
            .execute()
        )
        fb_rows = fallback.data or []
        return str(fb_rows[0]["id"]) if fb_rows else None

    async def get_latest_session_id_for_student(self, id_mahasiswa: str) -> str | None:
        return await asyncio.to_thread(self._get_latest_session_id_sync, id_mahasiswa)

    def _get_student_history_sync(self, id_mahasiswa: str) -> list[dict[str, Any]]:
        sess_res = (
            self.db.table("sesi_simulasi")
            .select(
                "id, kode_sesi, id_mahasiswa, id_skenario, mode, "
                "jumlah_giliran_mahasiswa, jumlah_giliran_valid, "
                "persentase_audio_valid, jumlah_segmen_vokal_valid, "
                "semua_pemicu_tergali, status_evaluasi, perlu_ditinjau_dosen, "
                "alasan_tinjau_dosen, penanda_khusus, waktu_mulai, waktu_selesai, "
                "durasi_aktif_detik"
            )
            .eq("id_mahasiswa", id_mahasiswa)
            .order("waktu_mulai", desc=True)
            .execute()
        )
        sessions = sess_res.data or []
        if not sessions:
            return []

        scenario_ids = list({str(s["id_skenario"]) for s in sessions if s.get("id_skenario")})
        session_ids = [str(s["id"]) for s in sessions if s.get("id")]

        scenario_map: dict[str, dict[str, Any]] = {}
        if scenario_ids:
            scen_res = (
                self.db.table("skenario_praktikum")
                .select("id, kode_skenario, versi, judul, jenis, profil_pasien, memuat_ddi")
                .in_("id", scenario_ids)
                .execute()
            )
            for row in scen_res.data or []:
                scenario_map[str(row["id"])] = row

        rapor_map: dict[str, dict[str, Any]] = {}
        if session_ids:
            rapor_res = (
                self.db.table("rapor_penilaian")
                .select(
                    "id_sesi, skor_komunikasi_tampil, skor_konten_tampil, "
                    "skor_penanganan_ddi, nilai_gabungan_sistem_tampil, "
                    "nilai_resmi_akhir, is_overridden, status_rapor"
                )
                .in_("id_sesi", session_ids)
                .execute()
            )
            for row in rapor_res.data or []:
                rapor_map[str(row["id_sesi"])] = row

        # Hitung giliran mahasiswa dari transkrip_dialog untuk sesi yang counter-nya masih 0
        zero_turn_sids = [
            str(s["id"])
            for s in sessions
            if s.get("id") and int(s.get("jumlah_giliran_mahasiswa") or 0) == 0
        ]
        transcript_turn_counts: dict[str, int] = {}
        if zero_turn_sids:
            try:
                t_res = (
                    self.db.table("transkrip_dialog")
                    .select("id_sesi, pembicara")
                    .in_("id_sesi", zero_turn_sids)
                    .eq("pembicara", "mahasiswa")
                    .execute()
                )
                for tr in t_res.data or []:
                    tsid = str(tr.get("id_sesi") or "")
                    if tsid:
                        transcript_turn_counts[tsid] = transcript_turn_counts.get(tsid, 0) + 1
            except Exception as exc:
                logger.debug("Gagal menghitung fallback jumlah giliran dari transkrip: %s", exc)

        items: list[dict[str, Any]] = []
        for s in sessions:
            sid = str(s["id"])
            scen = scenario_map.get(str(s.get("id_skenario") or ""), {})
            rapor = rapor_map.get(sid)
            profil = scen.get("profil_pasien") if isinstance(scen.get("profil_pasien"), dict) else {}
            nama_pasien = (
                str(profil.get("nama_pasien") or profil.get("nama") or "Pasien").strip()
            )
            peran_kom = str(profil.get("peran_komunikasi") or profil.get("peran") or "").strip()
            usia = str(profil.get("kategori_usia") or "").strip()
            jk = str(profil.get("jenis_kelamin") or "").strip()
            patient_meta = " · ".join(p for p in (peran_kom, usia, jk) if p)

            stored_turns = int(s.get("jumlah_giliran_mahasiswa") or 0)
            resolved_turns = stored_turns if stored_turns > 0 else transcript_turn_counts.get(sid, 0)
            stored_valid = int(s.get("jumlah_giliran_valid") or 0)
            resolved_valid = stored_valid if stored_valid > 0 else resolved_turns

            items.append({
                "id": sid,
                "kode_sesi": s.get("kode_sesi"),
                "id_skenario": s.get("id_skenario"),
                "mode": s.get("mode") or "mandiri",
                "status_evaluasi": s.get("status_evaluasi") or "berjalan",
                "perlu_ditinjau_dosen": bool(s.get("perlu_ditinjau_dosen", False)),
                "alasan_tinjau_dosen": list(s.get("alasan_tinjau_dosen") or []),
                "penanda_khusus": list(s.get("penanda_khusus") or []),
                "semua_pemicu_tergali": bool(s.get("semua_pemicu_tergali", False)),
                "jumlah_giliran_mahasiswa": resolved_turns,
                "jumlah_giliran_valid": resolved_valid,
                "durasi_aktif_detik": int(s.get("durasi_aktif_detik") or 0),
                "waktu_mulai": s.get("waktu_mulai"),
                "waktu_selesai": s.get("waktu_selesai"),
                "scenario": {
                    "id": scen.get("id") or s.get("id_skenario"),
                    "kode_skenario": scen.get("kode_skenario") or "",
                    "versi": scen.get("versi") or "0.1",
                    "judul": scen.get("judul") or "Skenario Simulasi KIE",
                    "jenis": scen.get("jenis") or "swamedikasi",
                    "nama_pasien": nama_pasien,
                    "patient_meta": patient_meta,
                    "memuat_ddi": bool(scen.get("memuat_ddi", False)),
                },
                "rapor": rapor,
            })

        return items

    async def get_student_history(self, id_mahasiswa: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_student_history_sync, id_mahasiswa)

    def _get_dosen_recap_sync(
        self,
        *,
        id_dosen: str,
        id_kelas: str | None = None,
        id_tugas: str | None = None,
        status_filter: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        def _to_float(val: Any) -> float | None:
            if val is None or isinstance(val, bool):
                return None
            try:
                return float(val)
            except (TypeError, ValueError):
                return None

        def _to_int(val: Any) -> int | None:
            f = _to_float(val)
            return int(round(f)) if f is not None else None

        # 0. Resolusi pengguna dosen (bisa berupa pengguna.id atau auth_user_id)
        dosen_pengguna_id = id_dosen
        dosen_auth_id: str | None = None
        try:
            u_res = (
                self.db.table("pengguna")
                .select("id, auth_user_id")
                .eq("id", id_dosen)
                .limit(1)
                .execute()
            )
            u_row = (u_res.data or [None])[0]
            if not u_row:
                u_res2 = (
                    self.db.table("pengguna")
                    .select("id, auth_user_id")
                    .eq("auth_user_id", id_dosen)
                    .limit(1)
                    .execute()
                )
                u_row = (u_res2.data or [None])[0]
            if u_row:
                dosen_pengguna_id = str(u_row["id"])
                dosen_auth_id = str(u_row["auth_user_id"]) if u_row.get("auth_user_id") else None
        except Exception as exc:
            logger.debug("Gagal resolusi pengguna dosen %s: %s", id_dosen, exc)

        dosen_id_candidates = [x for x in dict.fromkeys([dosen_pengguna_id, dosen_auth_id, id_dosen]) if x]

        # 1. Ambil seluruh kelas milik dosen ini (kelas.id_dosen -> pengguna.id)
        kelas_res = (
            self.db.table("kelas")
            .select("id, nama_kelas, kode_kelas, id_dosen")
            .in_("id_dosen", dosen_id_candidates)
            .order("nama_kelas", desc=False)
            .execute()
        )
        kelas_rows = list(kelas_res.data or [])
        kelas_map: dict[str, dict[str, Any]] = {str(k["id"]): k for k in kelas_rows if k.get("id")}
        all_kelas_ids = list(kelas_map.keys())

        # 2. Ambil seluruh tugas praktikum untuk kelas milik dosen INI + tugas yang dibuat dosen ini
        #    (tugas_praktikum.id_dosen_penugasan ber-default auth.uid(), sedangkan kelas.id_dosen = pengguna.id)
        tugas_by_id: dict[str, dict[str, Any]] = {}
        if all_kelas_ids:
            t_res_kelas = (
                self.db.table("tugas_praktikum")
                .select("id, id_skenario, id_kelas, deadline, status, id_dosen_penugasan, created_at, updated_at")
                .in_("id_kelas", all_kelas_ids)
                .neq("status", "Diarsipkan")
                .order("created_at", desc=False)
                .execute()
            )
            for t in t_res_kelas.data or []:
                if t.get("id"):
                    tugas_by_id[str(t["id"])] = t

        if dosen_id_candidates:
            t_res_owner = (
                self.db.table("tugas_praktikum")
                .select("id, id_skenario, id_kelas, deadline, status, id_dosen_penugasan, created_at, updated_at")
                .in_("id_dosen_penugasan", dosen_id_candidates)
                .neq("status", "Diarsipkan")
                .order("created_at", desc=False)
                .execute()
            )
            for t in t_res_owner.data or []:
                if t.get("id"):
                    tugas_by_id.setdefault(str(t["id"]), t)

        tugas_rows_raw = sorted(
            tugas_by_id.values(),
            key=lambda x: str(x.get("created_at") or ""),
        )

        # Pastikan semua kelas yang direferensikan tugas_praktikum ada di kelas_map
        missing_kelas_ids = [
            str(t["id_kelas"])
            for t in tugas_rows_raw
            if t.get("id_kelas") and str(t["id_kelas"]) not in kelas_map
        ]
        if missing_kelas_ids:
            mk_res = (
                self.db.table("kelas")
                .select("id, nama_kelas, kode_kelas, id_dosen")
                .in_("id", list(dict.fromkeys(missing_kelas_ids)))
                .execute()
            )
            for k in mk_res.data or []:
                if k.get("id"):
                    kelas_map[str(k["id"])] = k
                    kelas_rows.append(k)
            kelas_rows.sort(key=lambda x: str(x.get("nama_kelas") or ""))
            all_kelas_ids = list(kelas_map.keys())

        # Ambil metadata skenario secara terpisah (hindari kegagalan PostgREST nested embed)
        sken_ids_from_tugas = list(
            dict.fromkeys(str(t["id_skenario"]) for t in tugas_rows_raw if t.get("id_skenario"))
        )
        skenario_map: dict[str, dict[str, Any]] = {}
        if sken_ids_from_tugas:
            sk_res = (
                self.db.table("skenario_praktikum")
                .select("id, kode_skenario, versi, judul, jenis")
                .in_("id", sken_ids_from_tugas)
                .execute()
            )
            for sc in sk_res.data or []:
                if sc.get("id"):
                    skenario_map[str(sc["id"])] = sc

        all_tugas: list[dict[str, Any]] = []
        for t in tugas_rows_raw:
            sk_id = str(t.get("id_skenario") or "")
            sken = skenario_map.get(sk_id, {})
            kls_id = str(t.get("id_kelas") or "")
            kls_info = kelas_map.get(kls_id, {})
            all_tugas.append({
                "id_tugas": str(t["id"]),
                "id_skenario": sk_id,
                "id_kelas": kls_id,
                "nama_kelas": str(kls_info.get("nama_kelas") or "Kelas"),
                "kode_skenario": str(sken.get("kode_skenario") or "-"),
                "versi": str(sken.get("versi") or "0.1"),
                "judul": str(sken.get("judul") or "Skenario Praktikum"),
                "jenis": str(sken.get("jenis") or "swamedikasi"),
                "deadline": t.get("deadline"),
                "status": str(t.get("status") or "Aktif"),
            })

        # Tentukan cakupan kelas & tugas aktif sesuai filter
        selected_tugas_obj = (
            next((t for t in all_tugas if t["id_tugas"] == id_tugas), None)
            if id_tugas and id_tugas != "semua"
            else None
        )

        active_kelas_ids = (
            [id_kelas]
            if id_kelas and id_kelas != "semua" and id_kelas in kelas_map
            else ([selected_tugas_obj["id_kelas"]] if selected_tugas_obj and selected_tugas_obj["id_kelas"] in kelas_map else all_kelas_ids)
        )

        if selected_tugas_obj:
            active_tugas = [selected_tugas_obj]
        else:
            active_tugas = [t for t in all_tugas if t["id_kelas"] in active_kelas_ids]

        # Kolom tugas unik berdasarkan id_skenario untuk tampilan tabel "Semua Tugas"
        task_columns: list[dict[str, Any]] = []
        seen_sken: set[str] = set()
        for t in active_tugas:
            sk_id = t["id_skenario"]
            if sk_id and sk_id not in seen_sken:
                seen_sken.add(sk_id)
                task_columns.append({
                    "id_tugas": t["id_tugas"],
                    "id_skenario": sk_id,
                    "kode_skenario": t["kode_skenario"],
                    "versi": t["versi"],
                    "judul": t["judul"],
                    "jenis": t["jenis"],
                    "deadline": t["deadline"],
                    "status": t["status"],
                })

        # 3. Ambil seluruh mahasiswa pada cakupan kelas aktif
        student_rows: list[dict[str, Any]] = []
        if active_kelas_ids:
            mhs_res = (
                self.db.table("pengguna")
                .select("id, nama_lengkap, nomor_induk, email, id_kelas")
                .eq("peran", "mahasiswa")
                .in_("id_kelas", active_kelas_ids)
                .order("nama_lengkap", desc=False)
                .execute()
            )
            student_rows = list(mhs_res.data or [])

        student_ids = [str(m["id"]) for m in student_rows if m.get("id")]
        active_skenario_ids = [c["id_skenario"] for c in task_columns if c.get("id_skenario")]

        # 4. Ambil sesi praktikum mahasiswa pada cakupan aktif
        sessions_raw: list[dict[str, Any]] = []
        if student_ids:
            sess_q = (
                self.db.table("sesi_simulasi")
                .select(
                    "id, kode_sesi, id_mahasiswa, id_skenario, mode, "
                    "jumlah_giliran_mahasiswa, jumlah_giliran_valid, "
                    "status_evaluasi, perlu_ditinjau_dosen, penanda_khusus, "
                    "waktu_mulai, waktu_selesai, durasi_aktif_detik"
                )
                .eq("mode", "praktikum")
                .in_("id_mahasiswa", student_ids)
                .order("waktu_mulai", desc=True)
            )
            if active_skenario_ids:
                sess_q = sess_q.in_("id_skenario", active_skenario_ids)
            sessions_raw = list(sess_q.execute().data or [])

        # Jika belum ada tugas_praktikum tetapi mahasiswa sudah punya sesi praktikum, turunkan kolom dari sesi
        if not task_columns and sessions_raw:
            extra_sken_ids = list(
                dict.fromkeys(str(s["id_skenario"]) for s in sessions_raw if s.get("id_skenario"))
            )
            if extra_sken_ids:
                ex_res = (
                    self.db.table("skenario_praktikum")
                    .select("id, kode_skenario, versi, judul, jenis")
                    .in_("id", extra_sken_ids)
                    .execute()
                )
                for sc in ex_res.data or []:
                    if sc.get("id"):
                        skenario_map[str(sc["id"])] = sc
                for sk_id in extra_sken_ids:
                    sc = skenario_map.get(sk_id, {})
                    task_columns.append({
                        "id_tugas": sk_id,
                        "id_skenario": sk_id,
                        "kode_skenario": str(sc.get("kode_skenario") or "-"),
                        "versi": str(sc.get("versi") or "0.1"),
                        "judul": str(sc.get("judul") or "Skenario Praktikum"),
                        "jenis": str(sc.get("jenis") or "swamedikasi"),
                        "deadline": None,
                        "status": "Aktif",
                    })

        # Pilih 1 sesi paling representatif per pasangan (id_mahasiswa, id_skenario)
        status_priority = {
            "selesai_ditinjau": 6,
            "perlu_ditinjau_dosen": 5,
            "selesai_otomatis": 4,
            "tidak_cukup_data": 3,
            "tidak_dapat_dinilai": 2,
            "berjalan": 1,
        }
        best_session_by_pair: dict[tuple[str, str], dict[str, Any]] = {}
        for s in sessions_raw:
            pair = (str(s.get("id_mahasiswa") or ""), str(s.get("id_skenario") or ""))
            cur = best_session_by_pair.get(pair)
            if cur is None:
                best_session_by_pair[pair] = s
            else:
                p_new = status_priority.get(str(s.get("status_evaluasi") or ""), 0)
                p_cur = status_priority.get(str(cur.get("status_evaluasi") or ""), 0)
                if p_new > p_cur:
                    best_session_by_pair[pair] = s

        chosen_session_ids = [str(s["id"]) for s in best_session_by_pair.values() if s.get("id")]

        # 5. Ambil rapor_penilaian untuk seluruh sesi terpilih (sesuai DDL rapor_penilaian)
        rapor_map: dict[str, dict[str, Any]] = {}
        if chosen_session_ids:
            rapor_res = (
                self.db.table("rapor_penilaian")
                .select(
                    "id_sesi, skor_tool_a, skor_tool_b, skor_tool_c, skor_tool_d, skor_tool_e, "
                    "skor_komunikasi_mentah, skor_komunikasi_tampil, detail_pact, "
                    "skor_prosedur, skor_penanganan_ddi, skor_kelengkapan, "
                    "skor_konten_mentah, skor_konten_tampil, detail_butir_konten, "
                    "detail_kesalahan_kritis, "
                    "nilai_gabungan_sistem_mentah, nilai_gabungan_sistem_tampil, "
                    "is_overridden, skor_komunikasi_dosen, skor_konten_dosen, "
                    "nilai_resmi_akhir, status_rapor"
                )
                .in_("id_sesi", chosen_session_ids)
                .execute()
            )
            for rp in rapor_res.data or []:
                if rp.get("id_sesi"):
                    rapor_map[str(rp["id_sesi"])] = rp

        def _classify_session_status(sess: dict[str, Any] | None, rapor: dict[str, Any] | None) -> str:
            if not sess:
                return "belum_mengerjakan"
            st = str(sess.get("status_evaluasi") or "berjalan")
            rp_st = str((rapor or {}).get("status_rapor") or "")

            # Selesai ditinjau selalu menang (meski flag perlu_ditinjau_dosen lama belum di-reset)
            if st == "selesai_ditinjau" or rp_st == "selesai_ditinjau":
                return "selesai"
            if st == "perlu_ditinjau_dosen" or rp_st == "perlu_ditinjau_dosen":
                return "perlu_ditinjau"
            if st in ("tidak_cukup_data", "tidak_dapat_dinilai") or rp_st in ("tidak_cukup_data", "tidak_dapat_dinilai"):
                return "tidak_cukup_data"
            if st == "selesai_otomatis" or rp_st == "otomatis":
                return "perlu_ditinjau" if sess.get("perlu_ditinjau_dosen") and rp_st != "otomatis" else "selesai"
            if st == "berjalan":
                if rapor and (
                    _to_float(rapor.get("nilai_resmi_akhir")) is not None
                    or _to_float(rapor.get("nilai_gabungan_sistem_tampil")) is not None
                    or _to_float(rapor.get("nilai_gabungan_sistem_mentah")) is not None
                ):
                    return "selesai"
                return "belum_mengerjakan"
            if sess.get("perlu_ditinjau_dosen"):
                return "perlu_ditinjau"
            return "selesai"

        # 6. Susun baris per mahasiswa lalu terapkan filter status & pencarian
        search_q = (search or "").strip().lower()
        norm_status_filter = (status_filter or "semua").strip().lower()

        filtered_students_out: list[dict[str, Any]] = []
        scoped_sessions_for_analytics: list[tuple[str, dict[str, Any], dict[str, Any] | None]] = []

        # Peta tugas yang ditugaskan per kelas (jika tidak ada tugas_praktikum, semua kolom berlaku)
        assigned_sken_by_class: dict[str, set[str]] = {}
        active_only_sken_by_class: dict[str, set[str]] = {}
        for t in active_tugas:
            assigned_sken_by_class.setdefault(t["id_kelas"], set()).add(t["id_skenario"])
            if t["status"] == "Aktif":
                active_only_sken_by_class.setdefault(t["id_kelas"], set()).add(t["id_skenario"])
        has_explicit_tugas = len(active_tugas) > 0

        for m in student_rows:
            mid = str(m["id"])
            nama = str(m.get("nama_lengkap") or "Mahasiswa")
            npm = str(m.get("nomor_induk") or "-")
            kls_id = str(m.get("id_kelas") or "")
            kls_name = str(kelas_map.get(kls_id, {}).get("nama_kelas") or "-")

            if search_q and search_q not in nama.lower() and search_q not in npm.lower():
                continue

            class_sken_set = (
                assigned_sken_by_class.get(kls_id, set())
                if has_explicit_tugas
                else {c["id_skenario"] for c in task_columns}
            )
            class_active_sken_set = active_only_sken_by_class.get(kls_id, set())

            task_cells: dict[str, dict[str, Any]] = {}
            student_scores: list[float] = []
            cell_statuses: list[str] = []
            active_cell_statuses: list[str] = []
            latest_session_id: str | None = None
            latest_ts = ""

            for col in task_columns:
                sk_id = col["id_skenario"]
                is_assigned = sk_id in class_sken_set
                if not is_assigned:
                    task_cells[sk_id] = {
                        "assigned": False,
                        "id_sesi": None,
                        "status_ui": "tidak_ditugaskan",
                        "status_evaluasi": None,
                        "nilai_sistem": None,
                        "nilai_resmi": None,
                        "is_overridden": False,
                        "skor_komunikasi": None,
                        "skor_konten": None,
                        "jumlah_giliran": 0,
                    }
                    continue

                sess = best_session_by_pair.get((mid, sk_id))
                rp = rapor_map.get(str(sess["id"])) if sess else None
                st_ui = _classify_session_status(sess, rp)
                cell_statuses.append(st_ui)
                if sk_id in class_active_sken_set:
                    active_cell_statuses.append(st_ui)

                nilai_sistem_num = (
                    _to_int(rp.get("nilai_gabungan_sistem_tampil"))
                    if rp
                    else None
                )
                if nilai_sistem_num is None and rp:
                    nilai_sistem_num = _to_int(rp.get("nilai_gabungan_sistem_mentah"))

                nilai_resmi_num = _to_int(rp.get("nilai_resmi_akhir")) if rp else None
                if nilai_resmi_num is None:
                    nilai_resmi_num = nilai_sistem_num

                is_overridden = bool(rp.get("is_overridden")) if rp else False
                skor_kom = (
                    _to_int(rp.get("skor_komunikasi_dosen"))
                    if rp and is_overridden and rp.get("skor_komunikasi_dosen") is not None
                    else (_to_int(rp.get("skor_komunikasi_tampil")) if rp else None)
                )
                if skor_kom is None and rp:
                    skor_kom = _to_int(rp.get("skor_komunikasi_mentah"))

                skor_kon = (
                    _to_int(rp.get("skor_konten_dosen"))
                    if rp and is_overridden and rp.get("skor_konten_dosen") is not None
                    else (_to_int(rp.get("skor_konten_tampil")) if rp else None)
                )
                if skor_kon is None and rp:
                    skor_kon = _to_int(rp.get("skor_konten_mentah"))

                if nilai_resmi_num is not None:
                    student_scores.append(float(nilai_resmi_num))

                if sess:
                    ts = str(sess.get("waktu_selesai") or sess.get("waktu_mulai") or "")
                    if not latest_session_id or ts >= latest_ts:
                        latest_session_id = str(sess["id"])
                        latest_ts = ts

                task_cells[sk_id] = {
                    "assigned": True,
                    "id_sesi": str(sess["id"]) if sess else None,
                    "status_ui": st_ui,
                    "status_evaluasi": sess.get("status_evaluasi") if sess else None,
                    "nilai_sistem": nilai_sistem_num,
                    "nilai_resmi": nilai_resmi_num,
                    "is_overridden": is_overridden,
                    "skor_komunikasi": skor_kom,
                    "skor_konten": skor_kon,
                    "jumlah_giliran": int(sess.get("jumlah_giliran_mahasiswa") or 0) if sess else 0,
                }

            # Status ringkas mahasiswa pada cakupan filter aktif
            eval_statuses = active_cell_statuses if (not selected_tugas_obj and active_cell_statuses) else cell_statuses
            if not eval_statuses:
                status_ringkas = "belum_mengerjakan"
            elif "perlu_ditinjau" in cell_statuses:
                status_ringkas = "perlu_ditinjau"
            elif all(st == "selesai" for st in eval_statuses):
                status_ringkas = "selesai"
            elif "tidak_cukup_data" in eval_statuses:
                status_ringkas = "tidak_cukup_data"
            else:
                status_ringkas = "belum_mengerjakan"

            if norm_status_filter != "semua" and status_ringkas != norm_status_filter:
                continue

            avg_student = (
                round(sum(student_scores) / len(student_scores), 1)
                if student_scores
                else None
            )

            # Kumpulkan sesi milik mahasiswa terfilter untuk agregasi analitik kelas
            for col in task_columns:
                sk_id = col["id_skenario"]
                if sk_id in class_sken_set:
                    sess = best_session_by_pair.get((mid, sk_id))
                    if sess:
                        scoped_sessions_for_analytics.append(
                            (mid, sess, rapor_map.get(str(sess["id"])))
                        )

            filtered_students_out.append({
                "id_mahasiswa": mid,
                "nama_lengkap": nama,
                "nomor_induk": npm,
                "id_kelas": kls_id,
                "nama_kelas": kls_name,
                "task_scores": task_cells,
                "rata_rata": avg_student,
                "status_ringkas": status_ringkas,
                "latest_session_id": latest_session_id,
            })

        # 7. Hitung Summary, Agregat 5 Pilar PaCT, dan Radar Kesalahan Klinis dari cakupan terfilter
        total_mhs = len(filtered_students_out)
        tuntas_mhs = sum(
            1 for st in filtered_students_out if st["status_ringkas"] in ("selesai", "perlu_ditinjau")
        )
        perlu_ditinjau_mhs = sum(
            1 for st in filtered_students_out if st["status_ringkas"] == "perlu_ditinjau"
        )
        belum_mhs = sum(
            1 for st in filtered_students_out if st["status_ringkas"] == "belum_mengerjakan"
        )
        tidak_cukup_mhs = sum(
            1 for st in filtered_students_out if st["status_ringkas"] == "tidak_cukup_data"
        )

        all_scoped_scores: list[float] = []
        pact_buckets: dict[str, list[float]] = {"A": [], "B": [], "C": [], "D": [], "E": []}
        error_students_map: dict[str, dict[str, Any]] = {}
        evaluated_student_ids: set[str] = set()

        for mid, sess, rp in scoped_sessions_for_analytics:
            if not rp:
                continue
            score = _to_float(rp.get("nilai_resmi_akhir"))
            if score is None:
                score = _to_float(rp.get("nilai_gabungan_sistem_tampil"))
            if score is None:
                score = _to_float(rp.get("nilai_gabungan_sistem_mentah"))
            if score is not None:
                all_scoped_scores.append(score)
                evaluated_student_ids.add(mid)

            detail_pact_obj = rp.get("detail_pact") if isinstance(rp.get("detail_pact"), dict) else {}
            pact_tools_obj = detail_pact_obj.get("tools") if isinstance(detail_pact_obj.get("tools"), dict) else {}

            for key, col_name in (
                ("A", "skor_tool_a"),
                ("B", "skor_tool_b"),
                ("C", "skor_tool_c"),
                ("D", "skor_tool_d"),
                ("E", "skor_tool_e"),
            ):
                val = _to_float(rp.get(col_name))
                if val is None:
                    tool_entry = pact_tools_obj.get(key)
                    if isinstance(tool_entry, dict):
                        val = _to_float(tool_entry.get("skor"))
                if val is not None:
                    pact_buckets[key].append(val)

            # Radar 1: Kesalahan Kritis
            kk_obj = rp.get("detail_kesalahan_kritis")
            if isinstance(kk_obj, dict):
                kk_items = kk_obj.get("items") or []
            elif isinstance(kk_obj, list):
                kk_items = kk_obj
            else:
                kk_items = []
            for kk in kk_items:
                if not isinstance(kk, dict):
                    continue
                code = str(kk.get("id") or kk.get("kode") or "KK")
                title = str(kk.get("judul") or kk.get("deskripsi") or code)
                ekey = f"KK::{code}::{title}"
                entry = error_students_map.setdefault(
                    ekey,
                    {
                        "kode": code,
                        "judul": title,
                        "kategori": str(kk.get("kategori") or "Kesalahan Kritis"),
                        "tipe": "kesalahan_kritis",
                        "students": set(),
                    },
                )
                entry["students"].add(mid)

            # Radar 2: Butir Klinis Terlewat / Ditolak / Parsial
            butir_obj = rp.get("detail_butir_konten")
            if isinstance(butir_obj, dict):
                butir_items = butir_obj.get("items") or []
            elif isinstance(butir_obj, list):
                butir_items = butir_obj
            else:
                butir_items = []
            for b in butir_items:
                if not isinstance(b, dict):
                    continue
                if b.get("berlaku") is False:
                    continue
                if str(b.get("status") or "").lower() in ("terlewat", "tidak_terpenuhi", "ditolak", "parsial"):
                    code = str(b.get("kode") or "K")
                    param = str(b.get("parameter") or code)
                    ekey = f"BUTIR::{code}::{param}"
                    entry = error_students_map.setdefault(
                        ekey,
                        {
                            "kode": code,
                            "judul": param,
                            "kategori": str(b.get("kategori") or "Konten Klinis"),
                            "tipe": "butir_terlewat",
                            "students": set(),
                        },
                    )
                    entry["students"].add(mid)

        pact_meta = {
            "A": "Membangun Koneksi",
            "B": "Perspektif Pasien",
            "C": "Respons Empatik",
            "D": "Edukasi Kolaboratif",
            "E": "Komunikasi Efektif",
        }
        pact_aggregate = []
        for key in ("A", "B", "C", "D", "E"):
            vals = pact_buckets[key]
            avg_val = round(sum(vals) / len(vals), 1) if vals else None
            pact_aggregate.append({
                "kode": key,
                "label": pact_meta[key],
                "rata_rata": avg_val,
                "jumlah_sampel": len(vals),
            })

        scored_pillars = [p for p in pact_aggregate if p["rata_rata"] is not None]
        weakest_pillar = (
            min(scored_pillars, key=lambda x: x["rata_rata"])["kode"]
            if scored_pillars
            else None
        )

        denom_eval = max(len(evaluated_student_ids), 1)
        radar_list = sorted(
            (
                {
                    "kode": item["kode"],
                    "judul": item["judul"],
                    "kategori": item["kategori"],
                    "tipe": item["tipe"],
                    "jumlah_praktikan": len(item["students"]),
                    "persentase": round((len(item["students"]) / denom_eval) * 100.0, 1),
                }
                for item in error_students_map.values()
            ),
            key=lambda x: (x["tipe"] != "kesalahan_kritis", -x["jumlah_praktikan"], x["kode"]),
        )[:6]

        summary = {
            "total_mahasiswa": total_mhs,
            "total_tuntas": tuntas_mhs,
            "tingkat_penyelesaian_persen": round((tuntas_mhs / total_mhs) * 100.0, 1)
            if total_mhs > 0
            else 0.0,
            "rata_rata_nilai": round(sum(all_scoped_scores) / len(all_scoped_scores), 1)
            if all_scoped_scores
            else None,
            "nilai_tertinggi": int(round(max(all_scoped_scores))) if all_scoped_scores else None,
            "nilai_terendah": int(round(min(all_scoped_scores))) if all_scoped_scores else None,
            "perlu_ditinjau_count": perlu_ditinjau_mhs,
            "belum_mengerjakan_count": belum_mhs,
            "tidak_cukup_data_count": tidak_cukup_mhs,
            "total_sesi_dinilai": len(all_scoped_scores),
        }

        return {
            "filters": {
                "kelas_list": [
                    {
                        "id": str(k["id"]),
                        "nama_kelas": str(k.get("nama_kelas") or "Kelas"),
                        "kode_kelas": k.get("kode_kelas"),
                    }
                    for k in kelas_rows
                ],
                "tugas_list": all_tugas,
            },
            "selected_tugas": selected_tugas_obj,
            "summary": summary,
            "pact_aggregate": pact_aggregate,
            "weakest_pillar": weakest_pillar,
            "clinical_error_radar": radar_list,
            "task_columns": task_columns,
            "students": filtered_students_out,
        }

    async def get_dosen_recap(
        self,
        *,
        id_dosen: str,
        id_kelas: str | None = None,
        id_tugas: str | None = None,
        status_filter: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._get_dosen_recap_sync,
            id_dosen=id_dosen,
            id_kelas=id_kelas,
            id_tugas=id_tugas,
            status_filter=status_filter,
            search=search,
        )

    def _get_dosen_review_queue_sync(
        self,
        *,
        id_dosen: str,
        id_kelas: str | None = None,
        id_tugas: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        def _to_float(val: Any) -> float | None:
            if val is None or isinstance(val, bool):
                return None
            try:
                return float(val)
            except (TypeError, ValueError):
                return None

        def _to_int(val: Any) -> int | None:
            f = _to_float(val)
            return int(round(f)) if f is not None else None

        # 0. Resolusi pengguna dosen (pengguna.id & auth_user_id)
        dosen_pengguna_id = id_dosen
        dosen_auth_id: str | None = None
        try:
            u_res = (
                self.db.table("pengguna")
                .select("id, auth_user_id")
                .eq("id", id_dosen)
                .limit(1)
                .execute()
            )
            u_row = (u_res.data or [None])[0]
            if not u_row:
                u_res2 = (
                    self.db.table("pengguna")
                    .select("id, auth_user_id")
                    .eq("auth_user_id", id_dosen)
                    .limit(1)
                    .execute()
                )
                u_row = (u_res2.data or [None])[0]
            if u_row:
                dosen_pengguna_id = str(u_row["id"])
                dosen_auth_id = str(u_row["auth_user_id"]) if u_row.get("auth_user_id") else None
        except Exception as exc:
            logger.debug("Gagal resolusi pengguna dosen %s: %s", id_dosen, exc)

        dosen_id_candidates = [x for x in dict.fromkeys([dosen_pengguna_id, dosen_auth_id, id_dosen]) if x]

        # 1. Kelas milik dosen
        kelas_res = (
            self.db.table("kelas")
            .select("id, nama_kelas, kode_kelas, id_dosen")
            .in_("id_dosen", dosen_id_candidates)
            .order("nama_kelas", desc=False)
            .execute()
        )
        kelas_rows = list(kelas_res.data or [])
        kelas_map: dict[str, dict[str, Any]] = {str(k["id"]): k for k in kelas_rows if k.get("id")}
        all_kelas_ids = list(kelas_map.keys())

        # 2. Tugas praktikum untuk kelas milik dosen + dibuat dosen ini
        tugas_by_id: dict[str, dict[str, Any]] = {}
        if all_kelas_ids:
            t_res_k = (
                self.db.table("tugas_praktikum")
                .select("id, id_skenario, id_kelas, deadline, status, id_dosen_penugasan, created_at")
                .in_("id_kelas", all_kelas_ids)
                .neq("status", "Diarsipkan")
                .order("created_at", desc=False)
                .execute()
            )
            for t in t_res_k.data or []:
                if t.get("id"):
                    tugas_by_id[str(t["id"])] = t

        if dosen_id_candidates:
            t_res_o = (
                self.db.table("tugas_praktikum")
                .select("id, id_skenario, id_kelas, deadline, status, id_dosen_penugasan, created_at")
                .in_("id_dosen_penugasan", dosen_id_candidates)
                .neq("status", "Diarsipkan")
                .order("created_at", desc=False)
                .execute()
            )
            for t in t_res_o.data or []:
                if t.get("id"):
                    tugas_by_id.setdefault(str(t["id"]), t)

        tugas_rows_raw = sorted(
            tugas_by_id.values(),
            key=lambda x: str(x.get("created_at") or ""),
        )

        # Pastikan semua kelas dari tugas ada di kelas_map
        missing_kelas_ids = [
            str(t["id_kelas"])
            for t in tugas_rows_raw
            if t.get("id_kelas") and str(t["id_kelas"]) not in kelas_map
        ]
        if missing_kelas_ids:
            mk_res = (
                self.db.table("kelas")
                .select("id, nama_kelas, kode_kelas, id_dosen")
                .in_("id", list(dict.fromkeys(missing_kelas_ids)))
                .execute()
            )
            for k in mk_res.data or []:
                if k.get("id"):
                    kelas_map[str(k["id"])] = k
                    kelas_rows.append(k)
            kelas_rows.sort(key=lambda x: str(x.get("nama_kelas") or ""))
            all_kelas_ids = list(kelas_map.keys())

        # Metadata skenario
        sken_ids = list(
            dict.fromkeys(str(t["id_skenario"]) for t in tugas_rows_raw if t.get("id_skenario"))
        )
        skenario_map: dict[str, dict[str, Any]] = {}
        if sken_ids:
            sk_res = (
                self.db.table("skenario_praktikum")
                .select("id, kode_skenario, versi, judul, jenis")
                .in_("id", sken_ids)
                .execute()
            )
            for sc in sk_res.data or []:
                if sc.get("id"):
                    skenario_map[str(sc["id"])] = sc

        all_tugas: list[dict[str, Any]] = []
        tugas_by_kelas_sken: dict[tuple[str, str], dict[str, Any]] = {}
        for t in tugas_rows_raw:
            sk_id = str(t.get("id_skenario") or "")
            kls_id = str(t.get("id_kelas") or "")
            sken = skenario_map.get(sk_id, {})
            kls = kelas_map.get(kls_id, {})
            item = {
                "id_tugas": str(t["id"]),
                "id_skenario": sk_id,
                "id_kelas": kls_id,
                "nama_kelas": str(kls.get("nama_kelas") or "Kelas"),
                "kode_skenario": str(sken.get("kode_skenario") or "-"),
                "versi": str(sken.get("versi") or "0.1"),
                "judul": str(sken.get("judul") or "Skenario Praktikum"),
                "jenis": str(sken.get("jenis") or "swamedikasi"),
                "deadline": t.get("deadline"),
                "status": str(t.get("status") or "Aktif"),
            }
            all_tugas.append(item)
            tugas_by_kelas_sken[(kls_id, sk_id)] = item

        selected_tugas_obj = (
            next((t for t in all_tugas if t["id_tugas"] == id_tugas), None)
            if id_tugas and id_tugas != "semua"
            else None
        )

        active_kelas_ids = (
            [id_kelas]
            if id_kelas and id_kelas != "semua" and id_kelas in kelas_map
            else ([selected_tugas_obj["id_kelas"]] if selected_tugas_obj and selected_tugas_obj["id_kelas"] in kelas_map else all_kelas_ids)
        )

        # 3. Mahasiswa pada kelas aktif
        student_rows: list[dict[str, Any]] = []
        if active_kelas_ids:
            mhs_res = (
                self.db.table("pengguna")
                .select("id, nama_lengkap, nomor_induk, email, id_kelas")
                .eq("peran", "mahasiswa")
                .in_("id_kelas", active_kelas_ids)
                .execute()
            )
            student_rows = list(mhs_res.data or [])

        student_map = {str(m["id"]): m for m in student_rows if m.get("id")}
        student_ids = list(student_map.keys())

        # 4. Ambil seluruh sesi praktikum mahasiswa yang belum selesai_ditinjau & masih perlu tinjauan
        sessions_raw: list[dict[str, Any]] = []
        if student_ids:
            sess_q = (
                self.db.table("sesi_simulasi")
                .select(
                    "id, kode_sesi, id_mahasiswa, id_skenario, mode, "
                    "jumlah_giliran_mahasiswa, jumlah_giliran_valid, "
                    "status_evaluasi, perlu_ditinjau_dosen, alasan_tinjau_dosen, penanda_khusus, "
                    "waktu_mulai, waktu_selesai, durasi_aktif_detik"
                )
                .eq("mode", "praktikum")
                .in_("id_mahasiswa", student_ids)
                .order("waktu_selesai", desc=True)
            )
            if selected_tugas_obj:
                sess_q = sess_q.eq("id_skenario", selected_tugas_obj["id_skenario"])
            sessions_raw = list(sess_q.execute().data or [])

        # Lengkapi skenario yang mungkin tidak ada di tugas_praktikum
        extra_sken_ids = [
            str(s["id_skenario"])
            for s in sessions_raw
            if s.get("id_skenario") and str(s["id_skenario"]) not in skenario_map
        ]
        if extra_sken_ids:
            ex_res = (
                self.db.table("skenario_praktikum")
                .select("id, kode_skenario, versi, judul, jenis")
                .in_("id", list(dict.fromkeys(extra_sken_ids)))
                .execute()
            )
            for sc in ex_res.data or []:
                if sc.get("id"):
                    skenario_map[str(sc["id"])] = sc

        # 5. Ambil rapor_penilaian untuk seluruh sesi praktikum tersebut
        sess_ids = [str(s["id"]) for s in sessions_raw if s.get("id")]
        rapor_map: dict[str, dict[str, Any]] = {}
        if sess_ids:
            rp_res = (
                self.db.table("rapor_penilaian")
                .select(
                    "id_sesi, skor_komunikasi_tampil, skor_komunikasi_mentah, "
                    "skor_konten_tampil, skor_konten_mentah, "
                    "nilai_gabungan_sistem_tampil, nilai_gabungan_sistem_mentah, "
                    "nilai_resmi_akhir, detail_kesalahan_kritis, detail_butir_konten, "
                    "status_rapor, metadata_evaluasi"
                )
                .in_("id_sesi", sess_ids)
                .execute()
            )
            for rp in rp_res.data or []:
                if rp.get("id_sesi"):
                    rapor_map[str(rp["id_sesi"])] = rp

        # 6. Filter hanya sesi yang perlu ditinjau dosen (Inbox Zero)
        search_q = (search or "").strip().lower()
        queue_items: list[dict[str, Any]] = []

        for s in sessions_raw:
            sid = str(s["id"])
            st_eval = str(s.get("status_evaluasi") or "berjalan")
            rp = rapor_map.get(sid)
            rp_st = str((rp or {}).get("status_rapor") or "")

            if st_eval == "selesai_ditinjau" or rp_st == "selesai_ditinjau":
                continue
            if st_eval == "berjalan":
                continue

            needs_review = (
                st_eval == "perlu_ditinjau_dosen"
                or rp_st == "perlu_ditinjau_dosen"
                or (bool(s.get("perlu_ditinjau_dosen")) and rp_st != "otomatis")
            )
            if not needs_review:
                continue

            mid = str(s.get("id_mahasiswa") or "")
            mhs = student_map.get(mid, {})
            nama_mhs = str(mhs.get("nama_lengkap") or "Mahasiswa")
            npm = str(mhs.get("nomor_induk") or "-")
            kls_id = str(mhs.get("id_kelas") or "")
            nama_kelas = str(kelas_map.get(kls_id, {}).get("nama_kelas") or "-")

            if search_q and search_q not in nama_mhs.lower() and search_q not in npm.lower():
                continue

            sk_id = str(s.get("id_skenario") or "")
            sc = skenario_map.get(sk_id, {})
            matched_tugas = tugas_by_kelas_sken.get((kls_id, sk_id))

            # Tentukan pemicu tinjauan dan prioritas (1: kritis, 2: koreksi terlambat/penanda, 3: butir ambigu/lainnya)
            kk_obj = (rp or {}).get("detail_kesalahan_kritis")
            kk_items = (
                kk_obj.get("items") or []
                if isinstance(kk_obj, dict)
                else (kk_obj if isinstance(kk_obj, list) else [])
            )
            active_kk = [
                kk for kk in kk_items
                if isinstance(kk, dict) and not bool(kk.get("dikoreksi"))
            ]
            late_kk = [
                kk for kk in active_kk
                if "terlambat" in str(kk.get("status_koreksi") or "").lower()
            ]

            butir_obj = (rp or {}).get("detail_butir_konten")
            butir_items = (
                butir_obj.get("items") or []
                if isinstance(butir_obj, dict)
                else (butir_obj if isinstance(butir_obj, list) else [])
            )
            ambig_items = [
                b for b in butir_items
                if isinstance(b, dict) and bool(b.get("ambigu"))
            ]

            alasan_list: list[str] = list(s.get("alasan_tinjau_dosen") or [])
            meta_eval = (rp or {}).get("metadata_evaluasi")
            if isinstance(meta_eval, dict) and isinstance(meta_eval.get("alasan_tinjau_dosen"), list):
                for a in meta_eval["alasan_tinjau_dosen"]:
                    if str(a) not in alasan_list:
                        alasan_list.append(str(a))

            if late_kk:
                first = late_kk[0]
                priority_rank = 2
                prioritas = "sedang"
                pemicu_judul = "Koreksi mandiri terlambat"
                pemicu_deskripsi = str(
                    first.get("status_koreksi")
                    or first.get("deskripsi")
                    or first.get("judul")
                    or "Koreksi dilakukan melewati batas toleransi giliran."
                )
            elif active_kk:
                first = active_kk[0]
                priority_rank = 1
                prioritas = "tinggi"
                kk_code = str(first.get("id") or first.get("kode") or "KK")
                pemicu_judul = f"Kesalahan kritis {kk_code}"
                pemicu_deskripsi = str(
                    first.get("deskripsi")
                    or first.get("judul")
                    or "Terdeteksi kesalahan klinis kritis yang memerlukan verifikasi dosen."
                )
            elif ambig_items:
                first = ambig_items[0]
                priority_rank = 3
                prioritas = "rendah"
                b_code = str(first.get("kode") or "K")
                b_param = str(first.get("parameter") or "butir klinis")
                pemicu_judul = "Butir kritis ambigu"
                pemicu_deskripsi = f"Butir {b_code} ({b_param}) perlu verifikasi dosen."
            elif alasan_list:
                priority_rank = 2 if any("kritis" in a.lower() for a in alasan_list) else 3
                prioritas = "sedang" if priority_rank == 2 else "rendah"
                pemicu_judul = "Perlu verifikasi dosen"
                pemicu_deskripsi = alasan_list[0]
            else:
                priority_rank = 3
                prioritas = "rendah"
                pemicu_judul = "Verifikasi manual diperlukan"
                pemicu_deskripsi = "Sesi ditandai perlu ditinjau sebelum nilai resmi diterbitkan."

            nilai_sistem = (
                _to_int((rp or {}).get("nilai_gabungan_sistem_tampil"))
                or _to_int((rp or {}).get("nilai_gabungan_sistem_mentah"))
            )
            skor_kom = (
                _to_int((rp or {}).get("skor_komunikasi_tampil"))
                or _to_int((rp or {}).get("skor_komunikasi_mentah"))
            )
            skor_kon = (
                _to_int((rp or {}).get("skor_konten_tampil"))
                or _to_int((rp or {}).get("skor_konten_mentah"))
            )

            queue_items.append({
                "id_sesi": sid,
                "kode_sesi": str(s.get("kode_sesi") or ""),
                "id_mahasiswa": mid,
                "nama_mahasiswa": nama_mhs,
                "nomor_induk": npm,
                "id_kelas": kls_id,
                "nama_kelas": nama_kelas,
                "id_tugas": matched_tugas["id_tugas"] if matched_tugas else None,
                "id_skenario": sk_id,
                "kode_skenario": str(sc.get("kode_skenario") or "-"),
                "versi_skenario": str(sc.get("versi") or "0.1"),
                "judul_skenario": str(sc.get("judul") or "Skenario Praktikum"),
                "jenis_skenario": str(sc.get("jenis") or "swamedikasi"),
                "waktu_selesai": s.get("waktu_selesai") or s.get("waktu_mulai"),
                "nilai_sistem": nilai_sistem,
                "skor_komunikasi": skor_kom,
                "skor_konten": skor_kon,
                "prioritas": prioritas,
                "priority_rank": priority_rank,
                "pemicu_judul": pemicu_judul,
                "pemicu_deskripsi": pemicu_deskripsi,
                "alasan_tinjau_dosen": alasan_list,
                "jumlah_kesalahan_kritis": len(active_kk),
            })

        queue_items.sort(
            key=lambda x: (
                x["priority_rank"],
                -(x["jumlah_kesalahan_kritis"]),
                str(x.get("waktu_selesai") or ""),
            )
        )

        return {
            "filters": {
                "kelas_list": [
                    {
                        "id": str(k["id"]),
                        "nama_kelas": str(k.get("nama_kelas") or "Kelas"),
                        "kode_kelas": k.get("kode_kelas"),
                    }
                    for k in kelas_rows
                ],
                "tugas_list": all_tugas,
            },
            "total_antrean": len(queue_items),
            "items": queue_items,
        }

    async def get_dosen_review_queue(
        self,
        *,
        id_dosen: str,
        id_kelas: str | None = None,
        id_tugas: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._get_dosen_review_queue_sync,
            id_dosen=id_dosen,
            id_kelas=id_kelas,
            id_tugas=id_tugas,
            search=search,
        )

    def _submit_dosen_review_sync(
        self,
        *,
        session_id: str,
        id_dosen: str,
        is_overridden: bool,
        skor_komunikasi_dosen: float | None,
        skor_konten_dosen: float | None,
        nilai_resmi_akhir: int,
        catatan_override_butir: dict[str, Any] | None = None,
        komentar_dosen_untuk_mahasiswa: str | None = None,
        alasan_perubahan: str | None = None,
    ) -> dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        wib_dt = now_utc.astimezone(timezone(timedelta(hours=7)))
        waktu_wib_str = wib_dt.strftime("%d %b %Y %H:%M WIB")

        # 1. Baca rapor & sesi yang ada (izinkan semua status kecuali tidak_dapat_dinilai tanpa giliran)
        existing_rp_res = (
            self.db.table("rapor_penilaian")
            .select("*")
            .eq("id_sesi", session_id)
            .limit(1)
            .execute()
        )
        existing_rp = (existing_rp_res.data or [None])[0]
        if not existing_rp:
            raise LookupError("Rapor untuk sesi ini belum tersedia untuk ditinjau.")

        sess_res = (
            self.db.table("sesi_simulasi")
            .select("id, jumlah_giliran_valid, status_evaluasi")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        sess_row = (sess_res.data or [None])[0] or {}
        if (
            str(existing_rp.get("status_rapor") or "") == "tidak_dapat_dinilai"
            and int(sess_row.get("jumlah_giliran_valid") or 0) == 0
        ):
            raise ValueError(
                "Sesi berstatus tidak_dapat_dinilai tanpa percakapan valid tidak dapat diberi nilai resmi."
            )

        # 2. Resolusi id_dosen_peninjau ke pengguna.id & ambil nama dosen untuk log audit
        dosen_pengguna_id = id_dosen
        dosen_nama = "Dosen Penguji"
        try:
            u_res = (
                self.db.table("pengguna")
                .select("id, nama_lengkap")
                .eq("id", id_dosen)
                .limit(1)
                .execute()
            )
            u_row = (u_res.data or [None])[0]
            if not u_row:
                u_res2 = (
                    self.db.table("pengguna")
                    .select("id, nama_lengkap")
                    .eq("auth_user_id", id_dosen)
                    .limit(1)
                    .execute()
                )
                u_row = (u_res2.data or [None])[0]
            if u_row:
                dosen_pengguna_id = str(u_row["id"])
                dosen_nama = str(u_row.get("nama_lengkap") or "Dosen Penguji")
        except Exception:
            pass

        # 3. Susun jejak perubahan pada log_audit_sistem (tanpa menimpa skor sistem AI)
        prev_official = existing_rp.get("nilai_resmi_akhir")
        if prev_official is None:
            prev_official = existing_rp.get("nilai_gabungan_sistem_tampil")
        prev_status = str(existing_rp.get("status_rapor") or "otomatis")

        clean_komentar = (komentar_dosen_untuk_mahasiswa or "").strip() or None
        clean_alasan = (alasan_perubahan or "").strip()
        clean_override_butir = (
            catatan_override_butir
            if isinstance(catatan_override_butir, dict)
            else (existing_rp.get("catatan_override_butir") or {})
        )

        if not clean_alasan and isinstance(clean_override_butir, dict):
            butir_notes = [
                f"{k}: {v}"
                for k, v in clean_override_butir.items()
                if isinstance(v, str) and v.strip()
            ]
            if butir_notes:
                clean_alasan = "; ".join(butir_notes[:2])
        if not clean_alasan and clean_komentar:
            clean_alasan = clean_komentar

        prev_label = str(prev_official) if prev_official is not None else "—"
        audit_entry = (
            f"[TINJAUAN DOSEN] Nilai resmi diperbarui dari {prev_label} menjadi {int(nilai_resmi_akhir)} "
            f"(status sebelumnya: {prev_status}) oleh {dosen_nama} pada {waktu_wib_str}"
        )
        if clean_alasan:
            audit_entry += f" — catatan: {clean_alasan[:220]}"

        existing_logs = list(existing_rp.get("log_audit_sistem") or [])
        existing_logs.append(audit_entry)

        # Pastikan kolom nilai sistem (nilai_gabungan_sistem_*, skor_komunikasi_tampil, skor_konten_tampil) TIDAK disentuh
        update_rapor: dict[str, Any] = {
            "is_overridden": True,
            "id_dosen_peninjau": dosen_pengguna_id,
            "skor_komunikasi_dosen": skor_komunikasi_dosen,
            "skor_konten_dosen": skor_konten_dosen,
            "nilai_resmi_akhir": int(nilai_resmi_akhir),
            "catatan_override_butir": clean_override_butir,
            "komentar_dosen_untuk_mahasiswa": clean_komentar,
            "waktu_ditinjau": now_iso,
            "status_rapor": "selesai_ditinjau",
            "log_audit_sistem": existing_logs,
            "updated_at": now_iso,
        }

        rp_res = (
            self.db.table("rapor_penilaian")
            .update(update_rapor)
            .eq("id_sesi", session_id)
            .execute()
        )
        if not (rp_res.data or []):
            raise LookupError("Gagal memperbarui rapor penilaian.")

        self.db.table("sesi_simulasi").update({
            "status_evaluasi": "selesai_ditinjau",
            "perlu_ditinjau_dosen": False,
        }).eq("id", session_id).execute()

        return rp_res.data[0]

    async def submit_dosen_review(
        self,
        *,
        session_id: str,
        id_dosen: str,
        is_overridden: bool,
        skor_komunikasi_dosen: float | None,
        skor_konten_dosen: float | None,
        nilai_resmi_akhir: int,
        catatan_override_butir: dict[str, Any] | None = None,
        komentar_dosen_untuk_mahasiswa: str | None = None,
        alasan_perubahan: str | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._submit_dosen_review_sync,
            session_id=session_id,
            id_dosen=id_dosen,
            is_overridden=is_overridden,
            skor_komunikasi_dosen=skor_komunikasi_dosen,
            skor_konten_dosen=skor_konten_dosen,
            nilai_resmi_akhir=nilai_resmi_akhir,
            catatan_override_butir=catatan_override_butir,
            komentar_dosen_untuk_mahasiswa=komentar_dosen_untuk_mahasiswa,
            alasan_perubahan=alasan_perubahan,
        )
