"""LLM client: provider switch, sample gate, 429 retries. No live calls."""
import httpx
import openai
import pytest

import config
import llm


def _rate_limit_error():
    req = httpx.Request("POST", "https://example.test/v1/chat/completions")
    resp = httpx.Response(429, request=req, headers={"retry-after": "0"})
    return openai.RateLimitError("rate limited", response=resp, body=None)


class _FakeCompletions:
    def __init__(self, fail_times, content='{"ok": true}'):
        self.calls = 0
        self.fail_times = fail_times
        self.content = content

    def create(self, **_kw):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise _rate_limit_error()

        class _Msg:
            content = self.content

        class _Choice:
            message = _Msg()

        class _Resp:
            choices = [_Choice()]
            usage = None

        return _Resp()


def _fake_client(monkeypatch, completions):
    class _Chat:
        pass

    class _Client:
        def __init__(self, **_kw):
            self.chat = _Chat()
            self.chat.completions = completions

    monkeypatch.setattr(llm, "OpenAI", _Client)
    monkeypatch.setattr(llm.time, "sleep", lambda *_: None)
    monkeypatch.setitem(config.PROVIDERS, "groq", {"base_url": "x", "api_key": "k", "model": "m"})
    monkeypatch.setattr(config, "LLM_PROVIDER", "groq")


def test_sample_gate_refuses_non_sample(monkeypatch):
    monkeypatch.setattr(config, "SAMPLE_DATA_ONLY", True)
    with pytest.raises(llm.SampleDataViolation):
        llm.chat_json("s", "u", is_sample=False, task="t", use_cache=False)


def test_sample_gate_off_allows(monkeypatch):
    monkeypatch.setattr(config, "SAMPLE_DATA_ONLY", False)
    llm.assert_sample(False)  # no exception


def test_429_is_retried_then_succeeds(monkeypatch):
    comp = _FakeCompletions(fail_times=2)
    _fake_client(monkeypatch, comp)
    out = llm.chat_json("s", "u", is_sample=True, task="t", use_cache=False)
    assert out == {"ok": True}
    assert comp.calls == 3


def test_429_reported_clearly_after_retries(monkeypatch):
    comp = _FakeCompletions(fail_times=99)
    _fake_client(monkeypatch, comp)
    with pytest.raises(llm.LLMError, match="rate limiting"):
        llm.chat_json("s", "u", is_sample=True, task="t", use_cache=False, max_retries=2)
    assert comp.calls == 3


def test_provider_switch_by_env(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "ollama")
    assert llm.provider_info()["provider"] == "ollama"
    monkeypatch.setattr(config, "LLM_PROVIDER", "groq")
    monkeypatch.setitem(config.PROVIDERS, "groq", {"base_url": "x", "api_key": "k", "model": "m"})
    assert llm.provider_info()["provider"] == "groq"


def test_missing_key_is_clear(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "openrouter")
    monkeypatch.setitem(config.PROVIDERS, "openrouter", {"base_url": "x", "api_key": None, "model": "m"})
    with pytest.raises(llm.LLMError, match="No API key"):
        llm.provider_info()
