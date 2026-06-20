"""Base LLM provider protocol and data types."""

from dataclasses import dataclass, field
from typing import AsyncIterator, Protocol


@dataclass
class Message:
    """A chat message."""

    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMResponse:
    """Response from an LLM provider."""

    text: str
    model: str
    usage: dict = field(default_factory=dict)  # token usage, etc.


class LLMProvider(Protocol):
    """Protocol for LLM providers."""

    async def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a complete response."""
        ...

    async def stream(self, messages: list[Message], **kwargs) -> AsyncIterator[str]:
        """Stream a response token by token."""
        ...
        if False:  # pragma: no cover
            yield ""
