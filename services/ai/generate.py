"""Checklist (Prompt 3), plain-language explanation (Prompt 2), drafting check (Prompt 4), assistant."""
from __future__ import annotations

import json
import re

from pydantic import ValidationError

import llm
from rules import norm
from schemas import (
    AssistantAnswer, ChecklistItem, DraftCheckResponse, Explanation, MissingItem, UnclearItem,
)

GROUPS = ["Form", "Documents to certify", "Documents to attach", "Conditional", "Submission steps"]


def _fill(template: str, **values: str) -> str:
    for k, v in values.items():
        template = template.replace("{{" + k + "}}", v)
    return template


def _record_for_prompt(record: dict) -> str:
    keep = {k: v for k, v in record.items() if k not in ("evidence", "embedding", "source_text")}
    return json.dumps(keep, ensure_ascii=False, default=str)


# ───────────── Checklist ─────────────

def standard_items(record: dict) -> list[ChecklistItem]:
    """Standard rules added in code so they can never be missed."""
    ref = record.get("reference_number")
    form = record.get("form_required") or "Z83"
    items = [
        ChecklistItem(group="Form", item=f"Complete and sign the current {'Z83 (effective 1 January 2021)' if 'z83' in form.lower() else form} form", source="standard rule"),
        ChecklistItem(group="Documents to attach", item="Your CV", source="standard rule"),
        ChecklistItem(group="Documents to certify", item="Certified copy of your ID", source="standard rule"),
        ChecklistItem(
            group="Submission steps",
            item=f"Quote the reference number {ref} on your application" if ref else "Quote the post's reference number on your application (check the advert)",
            source="standard rule",
        ),
    ]
    return items


def saqa_timing(source_text: str) -> str | None:
    """When the advert wants a SAQA evaluation for foreign qualifications, from the advert's own sentences.

    Returns None when the advert has no foreign-qualification condition (a mention like
    "NQF level 4 as recognised by SAQA" is not a condition).
    """
    text = re.sub(r"\s+", " ", source_text)
    sentences = [x for x in re.split(r"(?<=[.;])\s+", text) if "saqa" in x.lower() and "foreign" in x.lower()]
    if not sentences:
        return None
    timings = set()
    for sent in sentences:
        low = sent.lower()
        if "shortlist" in low or "short-list" in low or "short list" in low:
            timings.add("only if you are shortlisted")
        elif re.search(r"attach|accompan|submit|include|must be|required to", low):
            timings.add("with your application")
        else:
            timings.add("check the advert")
    return timings.pop() if len(timings) == 1 else "check the advert"


def _saqa_item(record: dict, source_text: str | None) -> ChecklistItem | None:
    when = saqa_timing(source_text) if source_text else None
    if when is None:
        return None
    return ChecklistItem(
        group="Conditional",
        item=f"If you have a foreign qualification: SAQA evaluation report ({when})",
        source="from advert",
    )


def _same(a: str, b: str) -> bool:
    na, nb = norm(a), norm(b)
    return na == nb or (len(na) > 12 and (na in nb or nb in na))


def build_checklist(record: dict, answers: dict, *, is_sample: bool, source_text: str | None = None) -> list[ChecklistItem]:
    prompt = _fill(llm.load_prompt("checklist"), approved_record_json=_record_for_prompt(record),
                   answers_json=json.dumps(answers or {}, ensure_ascii=False))
    raw = llm.chat_json(prompt, "Build the checklist now.", is_sample=is_sample, task="checklist")
    items: list[ChecklistItem] = []
    for it in raw.get("items") or []:
        try:
            ci = ChecklistItem.model_validate(it)
        except ValidationError:
            continue
        ci.source = "standard rule" if "standard" in ci.source.lower() else "from advert"
        if ci.group not in GROUPS:
            ci.group = next((g for g in GROUPS if g.lower() in ci.group.lower()), "Documents to attach")
        items.append(ci)
    # Drop model items that repeat the standard ones, then add the standard ones (code-owned).
    std = standard_items(record)
    keywords = [("z83",), ("cv", "curriculum vitae"), ("id ", "identity"), ("reference number",)]
    def is_std(text: str) -> bool:
        t = " " + text.lower() + " "
        return any(any(k in t for k in ks) for ks in keywords) and not any(w in t for w in ("qualification", "licen", "saqa"))
    items = [i for i in items if not (i.source == "standard rule" or is_std(i.item))]
    # SAQA timing is decided by code from the advert's sentences, never by the model.
    items = [i for i in items if "saqa" not in i.item.lower()]
    saqa = _saqa_item(record, source_text)
    if saqa:
        items.append(saqa)
    merged = std + items
    out: list[ChecklistItem] = []
    for i in merged:
        if not any(_same(i.item, o.item) for o in out):
            out.append(i)
    out.sort(key=lambda i: GROUPS.index(i.group))
    return out


# ───────────── Plain-language explanation ─────────────

_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]


def _numbers(text: str) -> set[str]:
    t = text.replace(" ", " ")
    t = re.sub(r"(?<=\d)[ ,](?=\d{3}\b)", "", t)  # "R201 093" -> "R201093"
    return {n.lstrip("0") or "0" for n in re.findall(r"\d+(?:\.\d+)?", t)}


def _record_numbers(record: dict) -> set[str]:
    blob = json.dumps(record, ensure_ascii=False, default=str)
    nums = _numbers(blob)
    # ISO dates also appear as "4 December 2026" in explanations.
    for y, m, d in re.findall(r"(\d{4})-(\d{2})-(\d{2})", blob):
        nums.update({y, m.lstrip("0"), d.lstrip("0")})
    return nums


def fact_check(expl: Explanation, record: dict, contact: str) -> list[str]:
    """Every number in the explanation must appear in the record (no invented dates, salaries, counts)."""
    text = " ".join(
        " ".join(v) if isinstance(v, list) else str(v) for v in expl.model_dump().values()
    )
    allowed = _record_numbers(record) | _numbers(contact) | {"1", "2", "3", "4", "5", "8"}  # list numbering, grade 8
    problems = [n for n in sorted(_numbers(text)) if n not in allowed]
    return [f"Number '{n}' is not in the approved record" for n in problems]


def explain(record: dict, *, language: str, contact: str, profile: str, is_sample: bool) -> tuple[Explanation, list[str]]:
    prompt = _fill(llm.load_prompt("explain"), language=language, department_contact=contact,
                   approved_record_json=_record_for_prompt(record), profile_summary=profile or "(none)")
    feedback = ""
    expl: Explanation | None = None
    problems: list[str] = []
    for _ in range(2):
        raw = llm.chat_json(prompt, "Write the explanation now." + feedback, is_sample=is_sample, task=f"explain:{language}")
        try:
            expl = Explanation.model_validate(raw)
        except ValidationError as e:
            problems = [f"Output did not match the format: {e.errors()[:2]}"]
            feedback = " Your last answer did not match the JSON format. Use exactly the keys requested."
            continue
        problems = fact_check(expl, record, contact)
        if not problems:
            break
        feedback = (" Your last answer contained numbers that are not in the record: "
                    + ", ".join(problems) + ". Only use numbers, dates and amounts exactly as in the record.")
    if expl is None:
        raise llm.LLMError("Could not produce an explanation in the expected format.")
    return expl, problems


# ───────────── Drafting check ─────────────

MANDATORY = {
    "reference number": r"ref(erence)?\s*(no|number)?\s*[:.]",
    "closing date": r"closing\s+date",
    "application route": r"(apply|applications?)\b.{0,80}(@|https?://|www\.|private bag|p\.?o\.? box|hand deliver|deliver)",
    "required documents": r"(certified|copies|cv|curriculum vitae|attach)",
    "contact": r"(enquiries|tel\s*(no)?|contact)",
    "current Z83 instruction": r"z\s*83",
}


def draft_check(text: str, *, is_sample: bool) -> DraftCheckResponse:
    prompt = _fill(llm.load_prompt("draft_check"), draft_text=text)
    raw = llm.chat_json(prompt, "Check the draft now.", is_sample=is_sample, task="draft_check")
    missing = []
    for m in raw.get("missing") or []:
        try:
            missing.append(MissingItem.model_validate(m))
        except ValidationError:
            pass
    unclear = []
    for u in raw.get("unclear") or []:
        try:
            ui = UnclearItem.model_validate(u)
        except ValidationError:
            continue
        if norm(ui.sentence) in norm(text):  # only sentences that really exist in the draft
            unclear.append(ui)
    # Deterministic backstop: never miss a mandatory item the rules can detect.
    low = text.lower()
    for item, pattern in MANDATORY.items():
        absent = not re.search(pattern, low, re.S)
        listed = any(item.split()[0] in m.item.lower() for m in missing)
        if absent and not listed:
            missing.append(MissingItem(item=item.capitalize(), question_for_officer=f"What is the {item} for this post?"))
    return DraftCheckResponse(missing=missing, unclear=unclear, model=llm.provider_info()["model"])


# ───────────── Assistant ─────────────

def answer_question(question: str, listings: list[dict], *, is_sample: bool) -> AssistantAnswer:
    prompt = _fill(llm.load_prompt("assistant"), listings_json=json.dumps(listings, ensure_ascii=False, default=str), question=question)
    raw = llm.chat_json(prompt, question, is_sample=is_sample, task="assistant")
    try:
        ans = AssistantAnswer.model_validate(raw)
    except ValidationError:
        return AssistantAnswer(known=False, answer="I don't know. Please contact the department listed on the advert.")
    valid_ids = {str(l.get("id")) for l in listings}
    ans.listing_ids = [i for i in ans.listing_ids if i in valid_ids]
    if ans.known and not ans.listing_ids:
        ans.known = False
    return ans


# ───────────── Form details ─────────────

def form_details(text: str, *, is_sample: bool) -> dict:
    from rules import _dates_in, quote_in_source
    raw = llm.chat_json(llm.load_prompt("form_details"), f"<form>{text[:8000]}</form>", is_sample=is_sample, task="form_details")
    src = norm(text)
    out: dict = {"flags": []}
    ev = raw.get("evidence") or {}
    for f in ("name", "code", "version", "effective_date"):
        v = raw.get(f)
        if not v:
            out[f] = None
            continue
        ok = (f == "effective_date" and v in _dates_in(text)) or (ev.get(f) and quote_in_source(str(ev[f]), src)) or norm(str(v)) in src
        out[f] = v if ok else None
        if not ok:
            out["flags"].append({"field": f, "level": "error", "message": "Not found in the form; blanked."})
    return out
