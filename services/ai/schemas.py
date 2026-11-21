"""Pydantic models for every LLM output and API payload."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ApplyRoute(BaseModel):
    email: str | None = None
    portal_url: str | None = None
    postal: str | None = None
    hand_delivery: str | None = None


class Contact(BaseModel):
    name: str | None = None
    phone: str | None = None


class ConditionalItem(BaseModel):
    item: str
    when: str


class AdvertRecord(BaseModel):
    """Prompt 1 output (proposal §5) plus province and opportunity_type."""

    department: str | None = None
    post_title: str | None = None
    reference_number: str | None = None
    closing_date: str | None = None
    salary: str | None = None
    location: str | None = None
    minimum_requirements: list[str] = Field(default_factory=list)
    documents_required: list[str] = Field(default_factory=list)
    form_required: str | None = None
    apply_route: ApplyRoute = Field(default_factory=ApplyRoute)
    contact: Contact = Field(default_factory=Contact)
    conditional_items: list[ConditionalItem] = Field(default_factory=list)
    province: str | None = None
    opportunity_type: Literal["post", "internship", "learnership"] = "post"
    evidence: dict[str, str] = Field(default_factory=dict)

    @field_validator("minimum_requirements", "documents_required", mode="before")
    @classmethod
    def _none_to_list(cls, v):
        return [] if v is None else v

    @field_validator("conditional_items", mode="before")
    @classmethod
    def _cond_none(cls, v):
        return [] if v is None else v

    @field_validator("apply_route", mode="before")
    @classmethod
    def _route_none(cls, v):
        return {} if v is None else v

    @field_validator("contact", mode="before")
    @classmethod
    def _contact_none(cls, v):
        return {} if v is None else v

    @field_validator("evidence", mode="before")
    @classmethod
    def _evidence(cls, v):
        if not isinstance(v, dict):
            return {}
        return {str(k): str(val) for k, val in v.items() if val}

    @field_validator("opportunity_type", mode="before")
    @classmethod
    def _otype(cls, v):
        v = (v or "post").lower()
        return v if v in ("post", "internship", "learnership") else "post"


class Flag(BaseModel):
    field: str
    level: Literal["error", "warning"]
    message: str


class ExtractRequest(BaseModel):
    text: str
    is_sample: bool
    document_date: str | None = None  # YYYY-MM-DD of the circular, for the closing-date rule


class ExtractResponse(BaseModel):
    record: AdvertRecord
    flags: list[Flag]
    status: Literal["draft", "needs_fix"]
    model: str
    attempts: int


class AmendmentChanges(BaseModel):
    closing_date: str | None = None
    minimum_requirements: list[str] | None = None
    apply_route: ApplyRoute | None = None
    location: str | None = None
    salary: str | None = None


class Amendment(BaseModel):
    department: str | None = None
    post_title: str | None = None
    reference_number: str | None = None
    original_circular: str | None = None
    status_change: Literal["amended", "extended", "withdrawn"] = "amended"
    changes: AmendmentChanges = Field(default_factory=AmendmentChanges)
    summary: str = ""
    evidence: dict[str, str] = Field(default_factory=dict)

    @field_validator("changes", mode="before")
    @classmethod
    def _ch(cls, v):
        return {} if v is None else v

    @field_validator("evidence", mode="before")
    @classmethod
    def _ev(cls, v):
        if not isinstance(v, dict):
            return {}
        return {str(k): str(val) for k, val in v.items() if val}


class AmendmentRequest(BaseModel):
    text: str
    is_sample: bool
    document_date: str | None = None


class AmendmentResult(BaseModel):
    amendment: Amendment
    flags: list[Flag]


class AmendmentResponse(BaseModel):
    amendments: list[AmendmentResult]
    model: str


class ChecklistItem(BaseModel):
    group: str
    item: str
    source: str


class ChecklistRequest(BaseModel):
    record: dict
    answers: dict = Field(default_factory=dict)
    source_text: str | None = None  # used only by the code-owned SAQA rule, never sent to the model
    is_sample: bool


class ChecklistResponse(BaseModel):
    items: list[ChecklistItem]
    model: str


class ExplainRequest(BaseModel):
    record: dict
    language: str = "English"
    department_contact: str = "the department"
    profile_summary: str = ""
    is_sample: bool


class Explanation(BaseModel):
    what_the_job_is: str | list[str]
    what_you_must_have: str | list[str]
    what_to_send: str | list[str]
    deadline_and_where: str | list[str]
    what_you_may_be_missing: str | list[str]
    closing_line: str


class ExplainResponse(BaseModel):
    explanation: Explanation
    language: str
    fact_check_passed: bool
    fact_problems: list[str]
    model: str


class DraftCheckRequest(BaseModel):
    text: str
    is_sample: bool


class MissingItem(BaseModel):
    item: str
    question_for_officer: str


class UnclearItem(BaseModel):
    sentence: str
    suggestion: str


class DraftCheckResponse(BaseModel):
    missing: list[MissingItem]
    unclear: list[UnclearItem]
    model: str


class AssistantRequest(BaseModel):
    question: str
    listings: list[dict]
    is_sample: bool


class AssistantAnswer(BaseModel):
    known: bool
    answer: str
    listing_ids: list[str] = Field(default_factory=list)


class AssistantResponse(AssistantAnswer):
    model: str
