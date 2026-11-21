"""CV privacy: redaction, consent gate, no caching, no 'eligible' wording. No live calls."""
import cv
import llm

SAMPLE = """Thandeka Nomvula Dlamini
Curriculum Vitae
ID Number: 9203150123087
Date of Birth: 15/03/1992
Address: 12 Mandela Street, Polokwane, 0699
Cell: 072 555 1234
Email: thandeka.d@example.com
Education: National Senior Certificate (2010). Diploma in Office Administration, Capricorn TVET College (2013).
Experience: Administration clerk at a municipality, 3 years. Filing, data capturing, MS Word and Excel.
Driver's licence: Code 8.
"""


def test_redaction_removes_personal_details():
    clean, n = cv.redact(SAMPLE)
    for secret in ("Thandeka", "9203150123087", "15/03/1992", "Mandela Street", "072 555 1234", "thandeka.d@example.com"):
        assert secret not in clean, secret
    assert "Diploma in Office Administration" in clean
    assert "Administration clerk" in clean
    assert n >= 6


def test_consent_required(monkeypatch):
    monkeypatch.setattr(llm.config, "SAMPLE_DATA_ONLY", True)
    try:
        cv.profile_from_cv(SAMPLE.encode(), "cv.txt", consent=False)
        assert False, "should refuse"
    except llm.SampleDataViolation:
        pass


def test_profile_sent_redacted_and_uncached(monkeypatch):
    seen = {}

    def fake(system, user, **kw):
        seen.update(user=user, **kw)
        return {"qualification_level": "diploma", "highest_qualification": "Diploma in Office Administration", "skills": ["Excel"], "summary": "Admin clerk."}

    monkeypatch.setattr(cv.llm, "chat_json", fake)
    prof, removed = cv.profile_from_cv(SAMPLE.encode(), "cv.txt", consent=True)
    assert prof.qualification_level == "diploma"
    assert "9203150123087" not in seen["user"] and "Thandeka" not in seen["user"]
    assert seen["use_cache"] is False and seen["personal_consent"] is True


def test_match_filters_unknown_ids_and_eligibility_words(monkeypatch):
    monkeypatch.setattr(cv.llm, "chat_json", lambda *a, **k: {"matches": [
        {"id": "a", "fit": "strong", "reasons": ["You are eligible for this post", "You have a diploma"], "missing": []},
        {"id": "zzz", "fit": "strong", "reasons": ["x"], "missing": []},
    ]})
    out = cv.match_posts({"skills": []}, [{"id": "a"}, {"id": "b"}], consent=True)
    assert [m.id for m in out] == ["a"]
    assert out[0].reasons == ["You have a diploma"]
