from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

import httpx
from uppercut_grounded_answers import (
    ANSWER_JSON_SCHEMA,
    ChatCompletionsProvider,
    FailoverRouter,
    GeneratedAnswer,
    GroundingFailure,
    OllamaChatProvider,
    ProviderFailure,
    ProviderOutcome,
    decode_answer,
)

from .retrieval import Evidence


ProviderName = Literal["nvidia", "ollama"]
ProviderChoice = Literal["auto", "nvidia", "ollama"]

__all__ = [
    "ANSWER_JSON_SCHEMA",
    "GeneratedAnswer",
    "GenerationProvider",
    "GroundingFailure",
    "NvidiaProvider",
    "OllamaProvider",
    "ProviderChoice",
    "ProviderFailure",
    "ProviderName",
    "ProviderOutcome",
    "ProviderRouter",
    "ProviderScope",
]


@dataclass(frozen=True, slots=True)
class ProviderScope:
    sources: tuple[tuple[str, str], ...] = ()
    courses: tuple[tuple[str, str], ...] = ()
    select_all_that_apply: bool = False


def _prompt(
    question: str,
    evidence: tuple[Evidence, ...],
    scope: ProviderScope | None = None,
) -> list[dict[str, str]]:
    scope = scope or ProviderScope()
    source_scope = (
        "\n".join(f"- {source_id}: {label}" for source_id, label in scope.sources)
        or "- all configured sources"
    )
    course_scope = (
        "\n".join(f"- {course_id}: {label}" for course_id, label in scope.courses)
        or "- all configured courses"
    )
    excerpts = "\n\n".join(
        f"CHUNK_ID: {item.chunk_id}\nSOURCE: {item.source_title}\n"
        f"PDF_PAGE: {item.physical_page}\nBOOK_LABEL: {item.page_label}\nTEXT:\n{item.excerpt}"
        for item in evidence
    )
    mode = (
        " The user marked this as SELECT ALL THAT APPLY. Return every distinct correct option "
        "supported by the excerpts as a concise numbered or bulleted list; do not stop after "
        "the first valid option. Cite the supporting chunk IDs for each option."
        if scope.select_all_that_apply
        else " The user asked a standard question. Return one concise answer unless the excerpts clearly require a list."
    )
    system = (
        "You answer only from the supplied textbook excerpts. Keep the answer concise. "
        "Every factual claim must be supported by a cited CHUNK_ID. If the excerpts are not "
        "enough, abstain. Put CHUNK_ID values only in the citations array; the answer text must "
        "not contain chunk IDs, bracketed citation markers, or internal retrieval metadata. "
        "Never invent a title, page, quote, or citation. Return only JSON: "
        '{"status":"ok|insufficient_evidence","answer":"...","citations":["exact chunk id"]}. '
        + mode
    )
    return [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": (
                f"SELECTED SOURCE SCOPE:\n{source_scope}\n\n"
                f"SELECTED COURSE SCOPE:\n{course_scope}\n\n"
                f"QUESTION:\n{question}\n\nEXCERPTS:\n{excerpts}"
            ),
        },
    ]


class GenerationProvider(Protocol):
    name: ProviderName

    def generate(
        self,
        question: str,
        evidence: tuple[Evidence, ...],
        scope: ProviderScope | None = None,
    ) -> GeneratedAnswer: ...


def _decode_answer(provider: ProviderName, content: object, evidence: tuple[Evidence, ...]) -> GeneratedAnswer:
    return decode_answer(provider, content, {item.chunk_id for item in evidence})


class NvidiaProvider(ChatCompletionsProvider):
    def __init__(self, base_url: str, model: str, api_key: str | None, *, client: httpx.Client | None = None):
        super().__init__(
            "nvidia",
            base_url,
            model,
            api_key,
            _prompt,
            extra_body={
                "guided_json": ANSWER_JSON_SCHEMA,
                "chat_template_kwargs": {"enable_thinking": False},
            },
            missing_key_message="NVIDIA_API_KEY is not configured",
            client=client,
        )


class OllamaProvider(OllamaChatProvider):
    def __init__(self, base_url: str, model: str, *, client: httpx.Client | None = None):
        super().__init__("ollama", base_url, model, _prompt, client=client)


class ProviderRouter(FailoverRouter):
    def __init__(self, nvidia: GenerationProvider, ollama: GenerationProvider):
        super().__init__({"nvidia": nvidia, "ollama": ollama}, order=("nvidia", "ollama"))
