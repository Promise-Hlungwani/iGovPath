"""Guardrails that run on every AI output before an officer sees it."""
from __future__ import annotations

import re
from datetime import date

from schemas import AdvertRecord, Flag

_MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], start=1)}
_MONTHS.update({k[:3]: v for k, v in list(_MONTHS.items())})


def norm(s: str) -> str:
    """Normalise for substring matching: case, quotes, dashes, hyphenated line breaks, whitespace."""
    s = s.lower()
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-").replace(" ", " ")
    s = re.sub(r"-\s*\n\s*", "-", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*([:;,.()/-])\s*", r"\1", s)
    return s.strip()


def quote_in_source(quote: str, source_norm: str) -> bool:
    q = norm(quote).strip(" .\"'")
    if not q:
        return False
    if q in source_norm:
        return True
    # Allow models that join two adjacent fragments with "..."
    parts = [p.strip(" .") for p in re.split(r"\.\.\.|…", q) if len(p.strip(" .")) >= 8]
    return len(parts) > 1 and all(p in source_norm for p in parts)


def _dates_in(text: str) -> set[str]:
    """ISO dates mentioned in free text like '04 December 2026' or '4 Dec 2026'."""
    out = set()
    for d, m, y in re.findall(r"(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})", text):
        mi = _MONTHS.get(m.lower())
        if mi:
            try:
                out.add(date(int(y), mi, int(d)).isoformat())
            except ValueError:
                pass
    for y, m, d in re.findall(r"(\d{4})[-/](\d{2})[-/](\d{2})", text):
        out.add(f"{y}-{m}-{d}")
    return out


SCALAR_FIELDS = ["department", "post_title", "reference_number", "closing_date", "salary", "location", "form_required"]
LIST_FIELDS = ["minimum_requirements", "documents_required", "conditional_items"]
NESTED = {"apply_route": ["email", "portal_url", "postal", "hand_delivery"], "contact": ["name", "phone"]}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)


def _evidence_for(rec: AdvertRecord, key: str) -> str | None:
    ev = rec.evidence
    for k in (key, key.replace(".", "_"), key.split(".")[-1], key.split(".")[0]):
        if ev.get(k):
            return ev[k]
    return None


def check_record(rec: AdvertRecord, source: str, document_date: str | None = None) -> tuple[AdvertRecord, list[Flag]]:
    """Evidence check + rule checks. Fields that fail the evidence check are blanked and flagged."""
    flags: list[Flag] = []
    src = norm(source)
    data = rec.model_dump()

    evidence = dict(rec.evidence)

    def supported(key: str, value: str) -> bool:
        ev = _evidence_for(rec, key)
        if ev and quote_in_source(ev, src):
            evidence.setdefault(key, ev)
            return True
        # The value itself appearing verbatim in the source is also acceptable support;
        # record it as the field's evidence quote so every field has one.
        if bool(value) and len(value) >= 3 and norm(value) in src:
            evidence[key] = value
            return True
        return False

    # Scalars
    for f in SCALAR_FIELDS:
        v = data.get(f)
        if v in (None, ""):
            data[f] = None
            continue
        if f == "closing_date":
            ev = _evidence_for(rec, f)
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(v)):
                flags.append(Flag(field=f, level="error", message=f"Closing date '{v}' is not a YYYY-MM-DD date; blanked."))
                data[f] = None
                continue
            if not ev or not quote_in_source(ev, src):
                flags.append(Flag(field=f, level="error", message="No exact quote from the advert supports the closing date; blanked."))
                data[f] = None
                continue
            if v not in _dates_in(ev):
                flags.append(Flag(field=f, level="error", message=f"The quoted text does not contain the date {v}; blanked."))
                data[f] = None
                continue
            if document_date and v < document_date:
                flags.append(Flag(field=f, level="error", message=f"Closing date {v} is before the circular date {document_date}. Check it."))
            continue
        if not supported(f, str(v)):
            level = "warning" if f in ("department", "post_title") else "error"
            msg = "Evidence quote not found in the advert"
            if level == "error":
                data[f] = None
                msg += "; blanked."
            else:
                msg += "; please check."
            flags.append(Flag(field=f, level=level, message=msg))

    # Nested objects
    for parent, keys in NESTED.items():
        obj = data.get(parent) or {}
        for k in keys:
            v = obj.get(k)
            if v in (None, ""):
                obj[k] = None
                continue
            if not supported(f"{parent}.{k}", str(v)):
                obj[k] = None
                flags.append(Flag(field=f"{parent}.{k}", level="error", message="Not found in the advert; blanked."))
        data[parent] = obj

    # Lists: the field needs an evidence quote; each item should share words with the source.
    for f in LIST_FIELDS:
        items = data.get(f) or []
        if not items:
            continue
        ev = _evidence_for(rec, f)
        if not ev or not quote_in_source(ev, src):
            flags.append(Flag(field=f, level="warning", message="No exact supporting quote; check each item against the advert."))
        kept = []
        for it in items:
            text = it if isinstance(it, str) else f"{it.get('item', '')} {it.get('when', '')}"
            words = [w for w in re.findall(r"[a-z]{4,}", norm(text))]
            hit = sum(1 for w in words if w in src)
            if words and hit / len(words) < 0.6:
                flags.append(Flag(field=f, level="error", message=f"Item not supported by the advert and removed: '{text[:80]}'"))
            else:
                kept.append(it)
        data[f] = kept

    # Format rules
    ref = data.get("reference_number")
    if ref:
        # "(X2 POSTS)" is a post count, not part of the reference number.
        ref = re.sub(r"\s*\(\s*x\s*\d+\s*posts?\s*\)\s*$", "", ref, flags=re.I).strip() or None
        data["reference_number"] = ref
    if ref and (len(ref) > 60 or not re.search(r"\d", ref)):
        flags.append(Flag(field="reference_number", level="warning", message=f"Unusual reference number format: '{ref}'."))
    if not ref:
        flags.append(Flag(field="reference_number", level="warning", message="No reference number found. Applicants must quote one; check the advert."))
    if not data.get("closing_date"):
        flags.append(Flag(field="closing_date", level="warning", message="No closing date found. Check the advert."))
    route = data.get("apply_route") or {}
    if route.get("email") and not EMAIL_RE.match(route["email"].strip()):
        flags.append(Flag(field="apply_route.email", level="warning", message=f"'{route['email']}' does not look like an email address."))
    url = route.get("portal_url")
    if url and not re.match(r"^(https?://|www\.)", url.strip(), re.I):
        flags.append(Flag(field="apply_route.portal_url", level="warning", message=f"'{url}' does not look like a web address."))
    if not any(route.get(k) for k in ("email", "portal_url", "postal", "hand_delivery")):
        flags.append(Flag(field="apply_route", level="warning", message="No application route found. Check the advert."))
    form = data.get("form_required")
    if form and "z83" in form.lower().replace(" ", ""):
        data["form_required"] = "Z83"

    data["evidence"] = evidence
    return AdvertRecord.model_validate(data), flags
