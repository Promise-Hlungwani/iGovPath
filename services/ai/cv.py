"""CV reading for 'What can I apply for?'.

Privacy: the file is read in memory and never stored; personal details are removed
in code before any text is sent to the AI; responses are not cached.
"""
from __future__ import annotations

import io
import json
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

import llm

MAX_CHARS = 12000


class Experience(BaseModel):
    role: str
    years: float | None = None


class CvProfile(BaseModel):
    highest_qualification: str | None = None
    qualification_level: Literal["none", "grade10", "grade12", "certificate", "diploma", "degree", "postgraduate"] = "none"
    qualifications: list[str] = Field(default_factory=list)
    fields_of_study: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    total_years_experience: float | None = None
    licences: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    summary: str = ""

    @field_validator("qualifications", "fields_of_study", "skills", "licences", "languages", "experience", mode="before")
    @classmethod
    def _none_list(cls, v):
        return [] if v is None else v

    @field_validator("qualification_level", mode="before")
    @classmethod
    def _level(cls, v):
        v = (v or "none").lower().replace(" ", "")
        return v if v in ("none", "grade10", "grade12", "certificate", "diploma", "degree", "postgraduate") else "none"


class Match(BaseModel):
    id: str
    fit: Literal["strong", "possible"]
    reasons: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)


def extract_text(data: bytes, filename: str) -> str:
    name = filename.lower()
    if data[:4] == b"%PDF" or name.endswith(".pdf"):
        import fitz

        doc = fitz.open(stream=data, filetype="pdf")
        return "\n".join(p.get_text() for p in doc)
    if data[:2] == b"PK" or name.endswith(".docx"):
        import docx

        d = docx.Document(io.BytesIO(data))
        parts = [p.text for p in d.paragraphs]
        for t in d.tables:
            for row in t.rows:
                parts.append(" | ".join(c.text for c in row.cells))
        return "\n".join(parts)
    return data.decode("utf-8", errors="ignore")


_LABELS = re.compile(
    r"^\s*(full\s*names?|names?|surname|first\s*name|id\s*(no|number)?|identity\s*(no|number)?|passport|date\s*of\s*birth|d\.?o\.?b|"
    r"age|gender|sex|race|nationality|citizenship|marital\s*status|address|residential|postal|physical\s*address|home\s*address|"
    r"contact\s*(no|number|details)?|cell(phone)?|mobile|phone|tel(ephone)?|e-?mail|linkedin|dependants|religion|health|disability)\b.*$",
    re.I | re.M,
)
_ID = re.compile(r"\b\d{13}\b")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE = re.compile(r"(\+27|\b0)[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{4}\b")
_URL = re.compile(r"https?://\S+|www\.\S+")
_ADDRESS = re.compile(r"^.*\b(street|str\.|road|rd\.|avenue|ave\.|drive|crescent|lane|p\.?o\.?\s*box|private bag|suite|unit \d+|flat \d+)\b.*$", re.I | re.M)
_POSTCODE_LINE = re.compile(r"^.*,\s*\d{4}\s*$", re.M)
_DOB = re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-](19|20)\d{2}\b")


def redact(text: str) -> tuple[str, int]:
    """Remove personal details. Returns (clean text, number of removals)."""
    n = 0
    lines = [l for l in text.splitlines()]
    # The first short lines of a CV are usually the person's name; drop them if they look like a name.
    head_removed = 0
    while lines and head_removed < 3:
        first = lines[0].strip()
        if not first:
            lines.pop(0)
            continue
        if len(first.split()) <= 5 and not re.search(r"\d", first) and not re.search(r"curriculum|resume|cv\b|profile|summary", first, re.I):
            lines.pop(0)
            head_removed += 1
            n += 1
            continue
        break
    text = "\n".join(lines)
    for rx, repl in ((_LABELS, "[personal detail removed]"), (_ADDRESS, "[address removed]"), (_POSTCODE_LINE, "[address removed]"),
                     (_ID, "[ID removed]"), (_EMAIL, "[email removed]"), (_PHONE, "[phone removed]"), (_URL, "[link removed]"),
                     (_DOB, "[date removed]")):
        text, k = rx.subn(repl, text)
        n += k
    return text.strip(), n


def profile_from_cv(data: bytes, filename: str, *, consent: bool) -> tuple[CvProfile, int]:
    if not consent:
        raise llm.SampleDataViolation("The person has not agreed to their CV being read by AI.")
    raw = extract_text(data, filename)
    if len(raw.strip()) < 40:
        raise llm.LLMError("We couldn't read any text in that file. Try a PDF or Word file with selectable text.")
    clean, removed = redact(raw)
    out = llm.chat_json(llm.load_prompt("cv_profile"), f"<cv>{clean[:MAX_CHARS]}</cv>", is_sample=False,
                        personal_consent=True, task="cv_profile", use_cache=False)
    try:
        prof = CvProfile.model_validate(out)
    except ValidationError as e:
        raise llm.LLMError("The CV summary didn't come back in the expected format. Please try again.") from e
    return prof, removed


def match_posts(profile: dict, posts: list[dict], *, consent: bool) -> list[Match]:
    if not consent:
        raise llm.SampleDataViolation("The person has not agreed to their CV being used for matching.")
    prompt = llm.load_prompt("cv_match").replace("{{profile_json}}", json.dumps(profile, ensure_ascii=False)) \
        .replace("{{posts_json}}", json.dumps(posts, ensure_ascii=False, default=str))
    out = llm.chat_json(prompt, "Choose the posts now.", is_sample=False, personal_consent=True, task="cv_match", use_cache=False)
    ids = {str(p["id"]) for p in posts}
    matches: list[Match] = []
    for m in out.get("matches") or []:
        try:
            mm = Match.model_validate(m)
        except ValidationError:
            continue
        if mm.id in ids and not any(x.id == mm.id for x in matches):
            banned = re.compile(r"\b(eligible|qualif(y|ies|ied) for|will be shortlisted|guarantee)\b", re.I)
            mm.reasons = [r for r in mm.reasons if not banned.search(r)]
            matches.append(mm)
    return matches[:8]
