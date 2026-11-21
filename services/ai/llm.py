"""One OpenAI-compatible client for Groq / OpenRouter / Ollama, chosen by LLM_PROVIDER.

- Refuses non-sample payloads while SAMPLE_DATA_ONLY is on (checked before anything leaves the server).
- Retries HTTP 429 / 5xx with backoff, then raises LLMError with a clear message.
- Caches responses on disk by (provider, model, messages) so the same input is never sent twice.
- Logs token usage.
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import time
from typing import Any

import openai
from openai import OpenAI

import config

log = logging.getLogger("igovpath.llm")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


class LLMError(RuntimeError):
    """Raised when the LLM can't produce an answer (rate limit after retries, bad config, refusal)."""


class SampleDataViolation(PermissionError):
    """Raised when non-sample data would be sent while SAMPLE_DATA_ONLY is on."""


def assert_sample(is_sample: bool, personal_consent: bool = False) -> None:
    """Non-sample data may only be sent when the person has agreed and personal details were removed in code (cv.py)."""
    if config.SAMPLE_DATA_ONLY and not is_sample and not personal_consent:
        raise SampleDataViolation(
            "Refused: SAMPLE_DATA_ONLY is on and this payload is not marked as sample data. "
            "Only public sample data may be sent to the AI model during the hackathon."
        )


def _provider(name: str | None = None) -> tuple[str, dict[str, Any]]:
    name = (name or config.LLM_PROVIDER).lower()
    p = config.PROVIDERS.get(name)
    if not p:
        raise LLMError(f"Unknown LLM_PROVIDER '{name}'. Use groq, openrouter or ollama.")
    if not p.get("api_key"):
        raise LLMError(f"No API key set for provider '{name}'. Check .env.")
    if not p.get("model"):
        raise LLMError(f"No model set for provider '{name}'. Check .env.")
    return name, p


def provider_info() -> dict[str, Any]:
    name, p = _provider()
    return {"provider": name, "model": p["model"]}


def _cache_path(key: str):
    config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return config.CACHE_DIR / f"{key}.json"


class Usage:
    total_prompt = 0
    total_completion = 0


def chat_json(
    system: str,
    user: str,
    *,
    is_sample: bool,
    task: str,
    personal_consent: bool = False,
    max_retries: int = 4,
    use_cache: bool = True,
    temperature: float = 0.0,
    max_tokens: int = 4096,
) -> dict[str, Any]:
    """Send one chat request that must return a JSON object. Returns the parsed object."""
    assert_sample(is_sample, personal_consent)
    name, p = _provider()
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    key = hashlib.sha256(json.dumps([name, p["model"], task, messages], ensure_ascii=False).encode()).hexdigest()
    path = _cache_path(key)
    if use_cache and path.exists():
        log.info("cache hit task=%s", task)
        return json.loads(path.read_text())

    client = OpenAI(base_url=p["base_url"], api_key=p["api_key"], timeout=120, max_retries=0)
    extra: dict[str, Any] = {}
    if name == "groq" and "gpt-oss" in str(p["model"]):
        extra = {"reasoning_effort": "low", "include_reasoning": False}

    delay = 4.0
    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            resp = client.chat.completions.create(
                model=p["model"],
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
                extra_body=extra or None,
            )
            content = resp.choices[0].message.content or ""
            if resp.usage:
                Usage.total_prompt += resp.usage.prompt_tokens
                Usage.total_completion += resp.usage.completion_tokens
                log.info(
                    "llm task=%s provider=%s model=%s prompt_tokens=%s completion_tokens=%s",
                    task, name, p["model"], resp.usage.prompt_tokens, resp.usage.completion_tokens,
                )
            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                raise LLMError(f"Model returned invalid JSON for task {task}: {e}") from e
            if not isinstance(data, dict):
                raise LLMError(f"Model returned JSON that is not an object for task {task}")
            if use_cache:
                path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
            return data
        except openai.RateLimitError as e:
            last_err = e
            retry_after = None
            try:
                retry_after = float(e.response.headers.get("retry-after", ""))
            except (ValueError, AttributeError):
                pass
            wait = retry_after if retry_after and retry_after < 120 else delay
            log.warning("rate limited (429) task=%s attempt=%s waiting %.1fs", task, attempt + 1, wait)
        except (openai.APIConnectionError, openai.InternalServerError, openai.APITimeoutError) as e:
            last_err = e
            wait = delay
            log.warning("provider error task=%s attempt=%s: %s; waiting %.1fs", task, attempt + 1, e, wait)
        except openai.BadRequestError as e:
            # e.g. json_validate_failed on Groq: retry once more like a transient error
            last_err = e
            wait = 1.0
            log.warning("bad request task=%s attempt=%s: %s", task, attempt + 1, str(e)[:300])
        except openai.AuthenticationError as e:
            raise LLMError(f"The {name} API key was rejected. Check .env.") from e
        if attempt < max_retries:
            time.sleep(wait + random.uniform(0, 1))
            delay = min(delay * 2, 60)
    if isinstance(last_err, openai.RateLimitError):
        raise LLMError(
            f"The AI provider ({name}) is rate limiting us (HTTP 429) after {max_retries + 1} attempts. "
            "Wait a minute and try again, or switch LLM_PROVIDER in .env."
        ) from last_err
    raise LLMError(f"The AI provider ({name}) failed after {max_retries + 1} attempts: {last_err}") from last_err


def load_prompt(name: str) -> str:
    return (config.PROMPTS_DIR / f"{name}.txt").read_text()
