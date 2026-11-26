"""Cek daftar model Gemini yang tersedia dari API menggunakan GEMINI_API_KEY di backend/.env.

Cara menjalankan:
    python backend/cek_model_gemini.py
    python backend/cek_model_gemini.py --all        # tampilkan semua model (termasuk non-Gemini / embedding)
    python backend/cek_model_gemini.py --generate   # hanya model yang mendukung generateContent
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai


def load_api_key() -> str:
    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print(
            f"Error: GEMINI_API_KEY tidak ditemukan. Pastikan sudah diatur di {env_path}",
            file=sys.stderr,
        )
        sys.exit(1)
    return api_key


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cek daftar model Gemini yang tersedia dari Google GenAI API."
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Tampilkan semua model (termasuk non-Gemini seperti embedding/imagen).",
    )
    parser.add_argument(
        "--generate",
        action="store_true",
        help="Filter hanya model yang mendukung generateContent.",
    )
    args = parser.parse_args()

    api_key = load_api_key()
    client = genai.Client(api_key=api_key)

    models = list(client.models.list())
    filtered = []

    for model in models:
        name = getattr(model, "name", "") or ""
        short_name = name.removeprefix("models/")
        actions = list(getattr(model, "supported_actions", None) or [])

        if not args.all and "gemini" not in short_name.lower():
            continue
        if args.generate and "generateContent" not in actions:
            continue

        filtered.append((short_name, model, actions))

    filtered.sort(key=lambda item: item[0])

    print(f"Total model ditemukan: {len(filtered)}\n")
    print(f"{'MODEL ID':<38} | {'INPUT':>9} | {'OUTPUT':>8} | SUPPORTED ACTIONS")
    print("-" * 100)

    for short_name, model, actions in filtered:
        in_limit = getattr(model, "input_token_limit", None)
        out_limit = getattr(model, "output_token_limit", None)
        in_str = f"{in_limit:,}" if isinstance(in_limit, int) else "-"
        out_str = f"{out_limit:,}" if isinstance(out_limit, int) else "-"
        actions_str = ", ".join(actions) if actions else "-"
        print(f"{short_name:<38} | {in_str:>9} | {out_str:>8} | {actions_str}")


if __name__ == "__main__":
    main()
