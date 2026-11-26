"""Modul Pengamatan Vokal (Observasional / Non-Penalti).

Memproses metrik prosodi dari giliran audio mahasiswa (WPM, rasio jeda VAD,
stabilitas volume RMS / intensitas dB, pitch Hz, dan validitas ASR).
Sifatnya murni formatif dan tidak memengaruhi nilai gabungan sistem.
"""

from __future__ import annotations

import math
from typing import Any

MIN_AUDIO_TURNS_FOR_VOCAL = 3


def _to_float(val: Any) -> float | None:
    if val is None or isinstance(val, bool):
        return None
    try:
        num = float(val)
        return num if math.isfinite(num) else None
    except (TypeError, ValueError):
        return None


def _is_audio_turn(row: dict[str, Any]) -> bool:
    """Deteksi apakah giliran mahasiswa berasal dari rekaman audio yang memiliki metrik vokal."""
    if not isinstance(row, dict):
        return False
    if row.get("status_asr_valid") is False:
        return False

    sumber = str(row.get("sumber_input") or row.get("input_mode") or "").lower()
    if sumber in ("audio", "voice", "suara"):
        return True

    audio_keys = (
        "audio_url",
        "audio_path",
        "durasi_audio_detik",
        "wpm",
        "tempo_wpm",
        "rasio_jeda_persen",
        "stabilitas_volume_rms",
        "volume_rms",
        "kekuatan_db",
        "pitch_hz",
        "fitur_vokal",
    )
    for key in audio_keys:
        val = row.get(key)
        if val is None:
            continue
        if isinstance(val, dict) and val:
            return True
        if isinstance(val, str) and val.strip():
            return True
        if isinstance(val, (int, float)) and val > 0:
            return True
    return False


def _extract_turn_vocal_metrics(row: dict[str, Any], index: int) -> dict[str, Any]:
    nested = row.get("fitur_vokal") if isinstance(row.get("fitur_vokal"), dict) else {}
    teks = str(row.get("teks") or "").strip()
    word_count = len(teks.split())

    durasi_audio = (
        _to_float(row.get("durasi_audio_detik"))
        or _to_float(nested.get("durasi_audio_detik"))
        or _to_float(nested.get("duration_sec"))
    )
    wpm = (
        _to_float(row.get("wpm"))
        or _to_float(row.get("tempo_wpm"))
        or _to_float(nested.get("wpm"))
    )
    if wpm is None and durasi_audio and durasi_audio > 0 and word_count > 0:
        wpm = round((word_count / durasi_audio) * 60.0, 1)

    rasio_jeda = (
        _to_float(row.get("rasio_jeda_persen"))
        or _to_float(nested.get("rasio_jeda_persen"))
        or _to_float(nested.get("silence_ratio_pct"))
    )
    rms = (
        _to_float(row.get("stabilitas_volume_rms"))
        or _to_float(row.get("volume_rms"))
        or _to_float(nested.get("stabilitas_volume_rms"))
        or _to_float(nested.get("rms_stability"))
    )
    pitch_hz = _to_float(row.get("pitch_hz")) or _to_float(nested.get("pitch_hz"))
    kekuatan_db = _to_float(row.get("kekuatan_db")) or _to_float(nested.get("kekuatan_db"))

    kode = str(row.get("kode_giliran") or f"MHS-{index:02d}")
    waktu = int(_to_float(row.get("waktu_mulai_detik")) or 0)
    asr_valid = row.get("status_asr_valid", True) is not False

    return {
        "kode_giliran": kode,
        "nomor_giliran": int(_to_float(row.get("nomor_giliran_pembicara")) or index),
        "waktu_mulai_detik": waktu,
        "jumlah_kata": word_count,
        "durasi_audio_detik": round(durasi_audio, 2) if durasi_audio is not None else None,
        "wpm": round(wpm, 1) if wpm is not None else None,
        "rasio_jeda_persen": round(rasio_jeda, 1) if rasio_jeda is not None else None,
        "stabilitas_volume_rms": round(rms, 3) if rms is not None else None,
        "pitch_hz": round(pitch_hz, 1) if pitch_hz is not None else None,
        "kekuatan_db": round(kekuatan_db, 1) if kekuatan_db is not None else None,
        "status_asr_valid": asr_valid,
    }


def evaluate_vocal_observation(
    transcript_rows: list[dict[str, Any]],
    *,
    session: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Menghitung metrik pengamatan vokal dari baris transkrip mahasiswa & metadata sesi_simulasi.

    Mengembalikan dict dengan key siap simpan ke rapor_penilaian:
      - layak_tampil_vokal (bool)
      - data_pengamatan_vokal (list[dict])
      - narasi_pengamatan_vokal (str)
      - ringkasan_vokal (dict)
    """
    student_rows = [
        r for r in transcript_rows
        if str(r.get("pembicara") or "").lower() == "mahasiswa" and str(r.get("teks") or "").strip()
    ]
    total_student_turns = len(student_rows)
    valid_asr_turns = sum(1 for r in student_rows if r.get("status_asr_valid", True) is not False)

    session_asr_pct = _to_float((session or {}).get("persentase_audio_valid"))
    validitas_asr_persen = (
        round(session_asr_pct, 1)
        if session_asr_pct is not None and total_student_turns == 0
        else (
            round((valid_asr_turns / total_student_turns) * 100.0, 1)
            if total_student_turns > 0
            else 0.0
        )
    )

    audio_rows = [r for r in student_rows if _is_audio_turn(r)]
    session_vocal_segments = int(_to_float((session or {}).get("jumlah_segmen_vokal_valid")) or 0)
    audio_turn_count = max(len(audio_rows), session_vocal_segments)
    layak_tampil = audio_turn_count >= MIN_AUDIO_TURNS_FOR_VOCAL

    if not layak_tampil:
        alasan = (
            "Sesi dijalankan melalui input teks atau belum memiliki minimal 3 giliran audio yang valid "
            f"(terdeteksi {audio_turn_count} giliran audio dari {total_student_turns} giliran mahasiswa). "
            "Pengamatan vokal bersifat observasional (non-penalti) dan tidak memengaruhi skor akhir."
        )
        summary_entry = {
            "tipe": "ringkasan",
            "audio_turns": audio_turn_count,
            "total_student_turns": total_student_turns,
            "wpm_rata_rata": None,
            "rasio_jeda_persen": None,
            "stabilitas_volume_rms": None,
            "pitch_rata_rata_hz": None,
            "intensitas_rata_rata_db": None,
            "validitas_asr_persen": validitas_asr_persen,
        }
        return {
            "layak_tampil_vokal": False,
            "data_pengamatan_vokal": [summary_entry],
            "narasi_pengamatan_vokal": alasan,
            "ringkasan_vokal": summary_entry,
        }

    # Jika metrik per-baris tidak ada di transkrip_dialog tetapi sesi_simulasi.jumlah_segmen_vokal_valid >= 3,
    # gunakan baris giliran mahasiswa valid untuk menyusun titik pengamatan berbasis timestamp & jumlah kata.
    source_rows = audio_rows if audio_rows else [
        r for r in student_rows if r.get("status_asr_valid", True) is not False
    ]
    per_turn = [_extract_turn_vocal_metrics(r, idx) for idx, r in enumerate(source_rows, start=1)]

    # Estimasi WPM dari selisih waktu antar giliran bila wpm per giliran belum tersedia
    for idx, item in enumerate(per_turn):
        if item["wpm"] is None and item["jumlah_kata"] > 0:
            cur_t = item["waktu_mulai_detik"]
            next_t = per_turn[idx + 1]["waktu_mulai_detik"] if idx + 1 < len(per_turn) else cur_t + 12
            est_sec = max(4, min(45, next_t - cur_t)) if next_t > cur_t else max(4, round(item["jumlah_kata"] / 2.2))
            item["wpm"] = round(min(210.0, max(65.0, (item["jumlah_kata"] / est_sec) * 60.0)), 1)

    wpm_vals = [p["wpm"] for p in per_turn if p["wpm"] is not None]
    jeda_vals = [p["rasio_jeda_persen"] for p in per_turn if p["rasio_jeda_persen"] is not None]
    rms_vals = [p["stabilitas_volume_rms"] for p in per_turn if p["stabilitas_volume_rms"] is not None]
    pitch_vals = [p["pitch_hz"] for p in per_turn if p["pitch_hz"] is not None]
    db_vals = [p["kekuatan_db"] for p in per_turn if p["kekuatan_db"] is not None]

    avg_wpm = round(sum(wpm_vals) / len(wpm_vals), 1) if wpm_vals else None
    avg_jeda = round(sum(jeda_vals) / len(jeda_vals), 1) if jeda_vals else None
    avg_rms = round(sum(rms_vals) / len(rms_vals), 3) if rms_vals else None
    avg_pitch = round(sum(pitch_vals) / len(pitch_vals), 1) if pitch_vals else None
    avg_db = round(sum(db_vals) / len(db_vals), 1) if db_vals else None

    summary_entry = {
        "tipe": "ringkasan",
        "audio_turns": audio_turn_count,
        "total_student_turns": total_student_turns,
        "wpm_rata_rata": avg_wpm,
        "rasio_jeda_persen": avg_jeda,
        "stabilitas_volume_rms": avg_rms,
        "pitch_rata_rata_hz": avg_pitch,
        "intensitas_rata_rata_db": avg_db,
        "validitas_asr_persen": validitas_asr_persen,
    }

    # Susun narasi 2-3 kalimat yang mudah dibaca mahasiswa
    narasi_parts: list[str] = []
    if avg_wpm is not None:
        if 110 <= avg_wpm <= 150:
            narasi_parts.append(
                f"Tempo bicara rata-rata berada di {avg_wpm:.0f} kata/menit, termasuk dalam rentang ideal konseling (110–150 WPM)."
            )
        elif avg_wpm < 110:
            narasi_parts.append(
                f"Tempo bicara rata-rata {avg_wpm:.0f} kata/menit cenderung agak lambat dibanding rentang ideal (110–150 WPM)."
            )
        else:
            narasi_parts.append(
                f"Tempo bicara rata-rata {avg_wpm:.0f} kata/menit cenderung cepat (>150 WPM); coba perlambat saat menjelaskan dosis dan aturan pakai."
            )
    else:
        narasi_parts.append(
            f"Tercatat {audio_turn_count} giliran audio mahasiswa yang valid dengan tingkat validitas ASR {validitas_asr_persen:.1f}%."
        )

    if avg_jeda is not None:
        if avg_jeda < 20.0:
            narasi_parts.append(
                f"Rasio jeda hening terjaga baik di {avg_jeda:.1f}% (<20%), menandakan alur penyampaian yang cukup lancar."
            )
        else:
            narasi_parts.append(
                f"Rasio jeda hening mencapai {avg_jeda:.1f}% (di atas patokan ideal <20%), yang mengindikasikan beberapa jeda panjang saat menyusun penjelasan."
            )

    if avg_db is not None:
        narasi_parts.append(
            f"Intensitas suara rata-rata berada di {avg_db:.0f} dB dengan kualitas transkripsi ASR {validitas_asr_persen:.1f}%."
        )
    elif avg_rms is not None:
        narasi_parts.append(
            f"Stabilitas volume suara (RMS {avg_rms:.3f}) terpantau konsisten dengan validitas ASR {validitas_asr_persen:.1f}%."
        )

    data_pengamatan = [summary_entry, *[{"tipe": "giliran", **item} for item in per_turn]]
    return {
        "layak_tampil_vokal": True,
        "data_pengamatan_vokal": data_pengamatan,
        "narasi_pengamatan_vokal": " ".join(narasi_parts),
        "ringkasan_vokal": summary_entry,
    }
