"""Guardrails: evidence check, null handling, date and route rules."""
from rules import check_record, quote_in_source, norm
from schemas import AdvertRecord

ADVERT = """DEPARTMENT OF WATER AND SANITATION
APPLICATIONS : All applications to be submitted online on the following link: https://erecruitment.dws.gov.za/
CLOSING DATE : 04 December 2026
POST 42/281 : FINANCE CLERK PRODUCTION REF NO: 041226/14 (X2 POSTS)
CENTRE : Midmar Dam
REQUIREMENTS : A Senior/Grade 12 certificate with Mathematics/Accounting. The disclosure of a valid unexpired driver's license.
ENQUIRIES : Ms N Dlamini Tel No: (033) 392 1300
"""


def base(**kw):
    d = dict(
        department="DEPARTMENT OF WATER AND SANITATION",
        post_title="FINANCE CLERK PRODUCTION",
        reference_number="041226/14 (X2 POSTS)",
        closing_date="2026-12-04",
        salary=None,
        location="Midmar Dam",
        minimum_requirements=["A Senior/Grade 12 certificate with Mathematics/Accounting."],
        apply_route={"portal_url": "https://erecruitment.dws.gov.za/"},
        contact={"name": "Ms N Dlamini", "phone": "(033) 392 1300"},
        evidence={
            "closing_date": "CLOSING DATE : 04 December 2026",
            "reference_number": "REF NO: 041226/14",
            "location": "CENTRE : Midmar Dam",
            "minimum_requirements": "A Senior/Grade 12 certificate with Mathematics/Accounting.",
            "apply_route.portal_url": "https://erecruitment.dws.gov.za/",
            "contact": "Ms N Dlamini Tel No: (033) 392 1300",
        },
    )
    d.update(kw)
    return AdvertRecord.model_validate(d)


def test_good_record_has_no_errors():
    rec, flags = check_record(base(), ADVERT, "2026-11-20")
    assert not [f for f in flags if f.level == "error"], flags
    assert rec.closing_date == "2026-12-04"
    assert rec.reference_number == "041226/14"  # post count stripped


def test_wrong_quote_is_caught_and_blanked():
    rec, flags = check_record(base(location="Pretoria", evidence={**base().evidence, "location": "CENTRE : Pretoria"}), ADVERT)
    assert rec.location is None
    assert any(f.field == "location" and f.level == "error" for f in flags)


def test_closing_date_must_match_its_quote():
    rec, flags = check_record(base(closing_date="2026-12-14"), ADVERT)
    assert rec.closing_date is None
    assert any(f.field == "closing_date" and f.level == "error" for f in flags)


def test_closing_date_before_circular_is_flagged():
    _, flags = check_record(base(), ADVERT, "2026-12-10")
    assert any(f.field == "closing_date" and "before the circular" in f.message for f in flags)


def test_missing_salary_stays_null():
    rec, flags = check_record(base(salary=None), ADVERT)
    assert rec.salary is None
    assert not any(f.field == "salary" for f in flags)


def test_invented_salary_is_blanked():
    rec, flags = check_record(base(salary="R300 000 per annum", evidence={**base().evidence, "salary": "R300 000 per annum"}), ADVERT)
    assert rec.salary is None
    assert any(f.field == "salary" for f in flags)


def test_unsupported_requirement_removed():
    rec, flags = check_record(base(minimum_requirements=["A Senior/Grade 12 certificate with Mathematics/Accounting.", "Ten years of nuclear physics research experience"]), ADVERT)
    assert len(rec.minimum_requirements) == 1


def test_quote_matching_tolerates_layout():
    src = norm("A Senior/Grade 12\ncertificate with  Mathematics/ Accounting.")
    assert quote_in_source("A Senior/Grade 12 certificate with Mathematics/Accounting", src)


def test_z83_normalised():
    rec, _ = check_record(base(form_required="new Z 83 form", evidence={**base().evidence}), ADVERT + "\nUse the new Z 83 form")
    assert rec.form_required == "Z83"
