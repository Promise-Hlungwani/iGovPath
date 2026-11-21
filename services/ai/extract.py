"""Prompt 1 extraction with schema validation, evidence check, rule checks and one retry."""
from __future__ import annotations

import json

from pydantic import ValidationError

import llm
import re

from rules import _dates_in, check_record, norm, quote_in_source
from schemas import (
    AdvertRecord, Amendment, AmendmentResponse, AmendmentResult, ExtractResponse, Flag,
)


def extract_advert(text: str, *, is_sample: bool, document_date: str | None = None) -> ExtractResponse:
    system = llm.load_prompt("extract")
    user = f"<advert>{text}</advert>"
    attempts = 0
    feedback = ""
    rec: AdvertRecord | None = None
    flags: list[Flag] = []
    for attempts in (1, 2):
        raw = llm.chat_json(system, user + feedback, is_sample=is_sample, task="extract")
        try:
            candidate = AdvertRecord.model_validate(raw)
        except ValidationError as e:
            flags = [Flag(field="schema", level="error", message=f"Output did not match the schema: {e.errors()[:3]}")]
            feedback = (
                "\n\nYour previous answer did not match the schema. Errors: "
                + json.dumps(e.errors()[:5], default=str)
                + ". Return valid JSON that matches the schema exactly."
            )
            continue
        rec, flags = check_record(candidate, text, document_date)
        errors = [f for f in flags if f.level == "error"]
        if not errors:
            break
        feedback = (
            "\n\nYour previous answer had problems. Fix them and answer again. Every evidence value must be "
            "copied exactly from the advert text. Problems: "
            + json.dumps([f.model_dump() for f in errors])
        )
    if rec is None:
        rec = AdvertRecord()
    status = "needs_fix" if any(f.level == "error" for f in flags) else "draft"
    return ExtractResponse(record=rec, flags=flags, status=status, model=llm.provider_info()["model"], attempts=attempts)


def extract_amendments(text: str, *, is_sample: bool) -> AmendmentResponse:
    raw = llm.chat_json(llm.load_prompt("amendment"), f"<notice>{text}</notice>", is_sample=is_sample, task="amendment")
    src = norm(text)
    source_dates = _dates_in(text)
    items: list = []
    for item in raw.get("amendments") or []:
        # Code fallback: split "REF A; REF B" into one amendment per reference number.
        refs = [r.strip() for r in re.split(r"[;,]| and ", str((item or {}).get("reference_number") or "")) if r.strip()]
        if len(refs) > 1:
            for r in refs:
                items.append({**item, "reference_number": r})
        else:
            items.append(item)
    results: list[AmendmentResult] = []
    for item in items:
        try:
            a = Amendment.model_validate(item)
        except ValidationError as e:
            results.append(AmendmentResult(amendment=Amendment(summary="(unreadable amendment)"),
                                           flags=[Flag(field="schema", level="error", message=str(e)[:200])]))
            continue
        flags: list[Flag] = []
        ch = a.changes.model_dump()
        for field, value in ch.items():
            if value in (None, [], {}):
                continue
            ev = a.evidence.get(field) or a.evidence.get(f"changes.{field}")
            if field == "closing_date" and value in source_dates:
                continue  # the exact date is written in the notice
            if not ev or not quote_in_source(ev, src):
                flags.append(Flag(field=field, level="error", message="No exact quote in the notice supports this change; removed."))
                setattr(a.changes, field, None)
        if a.reference_number and norm(a.reference_number).replace(" ", "") not in src.replace(" ", ""):
            flags.append(Flag(field="reference_number", level="warning", message="Reference number not found verbatim in the notice."))
        results.append(AmendmentResult(amendment=a, flags=flags))
    return AmendmentResponse(amendments=results, model=llm.provider_info()["model"])
