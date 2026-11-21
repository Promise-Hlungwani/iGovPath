"""iGovPath AI service: document intake, extraction, checklists, explanations."""
from __future__ import annotations

from fastapi import FastAPI

import config

app = FastAPI(title="iGovPath AI service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    p = config.PROVIDERS.get(config.LLM_PROVIDER, {})
    return {
        "status": "ok",
        "sample_data_only": config.SAMPLE_DATA_ONLY,
        "llm_provider": config.LLM_PROVIDER,
        "llm_model": p.get("model"),
        "llm_key_set": bool(p.get("api_key")),
    }
