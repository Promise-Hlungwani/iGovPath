"""Settings for the AI service, read from the shared .env at the repo root."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() != "false"


SAMPLE_DATA_ONLY: bool = _bool("SAMPLE_DATA_ONLY", True)
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq").strip().lower()

PROVIDERS: dict[str, dict[str, str | None]] = {
    "groq": {
        "base_url": os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        "api_key": os.getenv("GROQ_API_KEY"),
        "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
    },
    "openrouter": {
        "base_url": os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        "api_key": os.getenv("OPENROUTER_API_KEY"),
        "model": os.getenv("OPENROUTER_MODEL"),
    },
    "ollama": {
        "base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        "api_key": "ollama",
        "model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct"),
    },
}

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
CACHE_DIR = ROOT / "data" / "cache"
