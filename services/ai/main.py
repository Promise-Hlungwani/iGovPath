"""iGovPath AI service: document intake, extraction, checklists, explanations."""
from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import config
import generate
import llm
from extract import extract_advert, extract_amendments
from intake import IntakeResult, intake_pdf
from schemas import (
    AmendmentRequest, AmendmentResponse, AssistantRequest, AssistantResponse, ChecklistRequest,
    ChecklistResponse, DraftCheckRequest, DraftCheckResponse, ExplainRequest, ExplainResponse,
    ExtractRequest, ExtractResponse,
)
from split_psvc import split_circular

app = FastAPI(title="iGovPath AI service", version="0.2.0", docs_url=None if config.AI_SERVICE_KEY else "/docs", redoc_url=None)


@app.middleware("http")
async def require_key(request: Request, call_next):
    """Only the iGovPath website may use this service: it must send the shared key."""
    import hmac

    if config.AI_SERVICE_KEY and request.url.path != "/health":
        given = request.headers.get("x-igovpath-key", "")
        if not hmac.compare_digest(given, config.AI_SERVICE_KEY):
            return JSONResponse(status_code=401, content={"error": "Not allowed."})
    return await call_next(request)


@app.exception_handler(llm.SampleDataViolation)
async def _sample_violation(_: Request, exc: llm.SampleDataViolation):
    return JSONResponse(status_code=403, content={"error": str(exc)})


@app.exception_handler(llm.LLMError)
async def _llm_error(_: Request, exc: llm.LLMError):
    return JSONResponse(status_code=503, content={"error": str(exc)})


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


@app.post("/intake", response_model=IntakeResult)
async def intake(file: UploadFile = File(...), max_pages: int | None = Form(None)) -> IntakeResult:
    data = await file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF is larger than 25 MB.")
    return intake_pdf(data, max_pages=max_pages)


class SplitRequest(BaseModel):
    pages: list[str]


@app.post("/split")
def split(req: SplitRequest) -> dict:
    chunks = split_circular(req.pages)
    return {
        "chunks": [
            {"chunk_ref": c.chunk_ref, "annexure": c.annexure, "page": c.page, "title": c.title_line, "text": c.text}
            for c in chunks
        ]
    }


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    return extract_advert(req.text, is_sample=req.is_sample, document_date=req.document_date)


@app.post("/extract-amendments", response_model=AmendmentResponse)
def amendments(req: AmendmentRequest) -> AmendmentResponse:
    return extract_amendments(req.text, is_sample=req.is_sample)


@app.post("/checklist", response_model=ChecklistResponse)
def checklist(req: ChecklistRequest) -> ChecklistResponse:
    items = generate.build_checklist(req.record, req.answers, is_sample=req.is_sample, source_text=req.source_text)
    return ChecklistResponse(items=items, model=llm.provider_info()["model"])


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest) -> ExplainResponse:
    expl, problems = generate.explain(
        req.record, language=req.language, contact=req.department_contact, profile=req.profile_summary, is_sample=req.is_sample
    )
    return ExplainResponse(explanation=expl, language=req.language, fact_check_passed=not problems,
                           fact_problems=problems, model=llm.provider_info()["model"])


@app.post("/draft-check", response_model=DraftCheckResponse)
def draft_check(req: DraftCheckRequest) -> DraftCheckResponse:
    return generate.draft_check(req.text, is_sample=req.is_sample)


@app.post("/assistant", response_model=AssistantResponse)
def assistant(req: AssistantRequest) -> AssistantResponse:
    ans = generate.answer_question(req.question, req.listings, is_sample=req.is_sample)
    return AssistantResponse(**ans.model_dump(), model=llm.provider_info()["model"])


class FormDetailsRequest(BaseModel):
    text: str
    is_sample: bool


@app.post("/form-details")
def form_details(req: FormDetailsRequest) -> dict:
    return {**generate.form_details(req.text, is_sample=req.is_sample), "model": llm.provider_info()["model"]}


# ───────────── CV matching ─────────────
import cv as cv_mod  # noqa: E402


@app.post("/cv/profile")
async def cv_profile(file: UploadFile = File(...), consent: bool = Form(False)) -> dict:
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="The CV must be smaller than 5 MB.")
    prof, removed = cv_mod.profile_from_cv(data, file.filename or "cv", consent=consent)
    return {"profile": prof.model_dump(), "personal_details_removed": removed, "model": llm.provider_info()["model"]}


class MatchRequest(BaseModel):
    profile: dict
    posts: list[dict]
    consent: bool = False


@app.post("/cv/match")
def cv_match(req: MatchRequest) -> dict:
    return {"matches": [m.model_dump() for m in cv_mod.match_posts(req.profile, req.posts, consent=req.consent)],
            "model": llm.provider_info()["model"]}
