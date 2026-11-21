"""Checklist standard rules, SAQA timing, explanation fact check, draft-check backstop. No live calls."""
import generate
from schemas import Explanation

REC = {
    "post_title": "Admin Clerk",
    "reference_number": "LDARD 33/11/2026",
    "closing_date": "2026-12-04",
    "salary": "R228 321 per annum",
    "form_required": "Z83",
    "documents_required": ["certified copy of Senior Certificate"],
    "conditional_items": [{"item": "SAQA evaluation report for foreign qualifications", "when": "only shortlisted candidates"}],
}


def test_standard_items_always_present(monkeypatch):
    monkeypatch.setattr(generate.llm, "chat_json", lambda *a, **k: {"items": [{"group": "Documents to certify", "item": "Senior Certificate", "source": "from advert"}]})
    items = generate.build_checklist(REC, {}, is_sample=True)
    texts = " | ".join(i.item for i in items)
    assert "Z83" in texts and "CV" in texts and "ID" in texts and "LDARD 33/11/2026" in texts
    assert sum(1 for i in items if i.source == "standard rule") == 4


def test_saqa_timing_from_advert_sentences():
    assert generate.saqa_timing("Shortlisted candidates must submit SAQA evaluation reports for foreign qualifications.") == "only if you are shortlisted"
    assert generate.saqa_timing("Should you be in possession of foreign qualification/s, it must be accompanied by an evaluation certificate from SAQA.") == "with your application"
    assert generate.saqa_timing("Grade 12 (NQF level 4 as recognized by SAQA).") is None
    assert generate.saqa_timing("Foreign qualifications: SAQA.") == "check the advert"


def test_saqa_item_added_by_code(monkeypatch):
    monkeypatch.setattr(generate.llm, "chat_json", lambda *a, **k: {"items": [{"group": "Conditional", "item": "SAQA report", "source": "from advert"}]})
    items = generate.build_checklist(REC, {}, is_sample=True, source_text="Candidates with foreign qualifications are advised to attach SAQA accreditation.")
    saqa = [i for i in items if "SAQA" in i.item]
    assert len(saqa) == 1 and "with your application" in saqa[0].item


def test_fact_check_catches_invented_number():
    e = Explanation(what_the_job_is="Clerk", what_you_must_have="Grade 12", what_to_send="Z83",
                    deadline_and_where="Send by 9 January 2027", what_you_may_be_missing="", closing_line="Ask HR")
    problems = generate.fact_check(e, REC, "HR")
    assert any("2027" in p for p in problems)


def test_fact_check_accepts_record_dates():
    e = Explanation(what_the_job_is="Clerk", what_you_must_have="Grade 12", what_to_send="Z83",
                    deadline_and_where="Send by 4 December 2026. Pay is R228 321 per year.", what_you_may_be_missing="", closing_line="Ask HR")
    assert generate.fact_check(e, REC, "HR") == []


def test_draft_check_backstop(monkeypatch):
    monkeypatch.setattr(generate.llm, "chat_json", lambda *a, **k: {"missing": [], "unclear": []})
    r = generate.draft_check("We need a clerk. Applicants must have matric. Send your CV.", is_sample=True)
    names = " ".join(m.item.lower() for m in r.missing)
    assert "closing date" in names and "reference number" in names
