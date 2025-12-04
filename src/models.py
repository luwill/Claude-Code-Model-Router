"""Data models for the Model Router."""

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


# ============================================
# Configuration Models
# ============================================

class ModelConfig(BaseModel):
    """Configuration for a single model."""

    display_name: str
    provider: str
    model_id: str
    base_url: str
    api_key_env: str
    api_version: str = "2023-06-01"
    auth_header: str = "x-api-key"
    supports_streaming: bool = True
    supports_tools: bool = True
    max_tokens: int = 8192
    context_window: int = 128000
    extra_headers: dict[str, str] = Field(default_factory=dict)


class GatewayConfig(BaseModel):
    """Configuration for the gateway server."""

    host: str = "0.0.0.0"
    port: int = 8080
    timeout: int = 300
    enable_logging: bool = True
    log_level: str = "INFO"
    include_model_header: bool = True
    health_path: str = "/health"


class RouterConfig(BaseModel):
    """Root configuration model."""

    default_model: str = "sonnet"
    models: dict[str, ModelConfig]
    aliases: dict[str, str] = Field(default_factory=dict)
    gateway: GatewayConfig = Field(default_factory=GatewayConfig)


# ============================================
# Anthropic API Models
# ============================================

class ContentBlockText(BaseModel):
    """Text content block."""

    type: Literal["text"] = "text"
    text: str


class ContentBlockImage(BaseModel):
    """Image content block."""

    type: Literal["image"] = "image"
    source: dict[str, Any]


class ContentBlockToolUse(BaseModel):
    """Tool use content block."""

    type: Literal["tool_use"] = "tool_use"
    id: str
    name: str
    input: dict[str, Any]


class ContentBlockToolResult(BaseModel):
    """Tool result content block."""

    type: Literal["tool_result"] = "tool_result"
    tool_use_id: str
    content: str | list[dict[str, Any]]


ContentBlock = ContentBlockText | ContentBlockImage | ContentBlockToolUse | ContentBlockToolResult


class Message(BaseModel):
    """A message in the conversation."""

    role: Literal["user", "assistant"]
    content: str | list[dict[str, Any]]


class Tool(BaseModel):
    """Tool definition."""

    name: str
    description: str
    input_schema: dict[str, Any]


class MessagesRequest(BaseModel):
    """Request body for /v1/messages endpoint."""

    model_config = ConfigDict(extra="allow")  # Allow additional fields for forward compatibility

    model: str
    messages: list[Message]
    max_tokens: int = 4096
    system: str | list[dict[str, Any]] | None = None
    temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    stop_sequences: list[str] | None = None
    stream: bool = False
    tools: list[Tool] | None = None
    tool_choice: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class Usage(BaseModel):
    """Token usage information."""

    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int | None = None
    cache_read_input_tokens: int | None = None


class MessagesResponse(BaseModel):
    """Response body for /v1/messages endpoint."""

    model_config = ConfigDict(extra="allow")

    id: str
    type: Literal["message"] = "message"
    role: Literal["assistant"] = "assistant"
    content: list[dict[str, Any]]
    model: str
    stop_reason: str | None = None
    stop_sequence: str | None = None
    usage: Usage


# ============================================
# Streaming Event Models
# ============================================

class StreamEvent(BaseModel):
    """Base model for SSE events."""

    model_config = ConfigDict(extra="allow")

    type: str


class MessageStartEvent(StreamEvent):
    """Event sent at the start of a message."""

    type: Literal["message_start"] = "message_start"
    message: dict[str, Any]


class ContentBlockStartEvent(StreamEvent):
    """Event sent at the start of a content block."""

    type: Literal["content_block_start"] = "content_block_start"
    index: int
    content_block: dict[str, Any]


class ContentBlockDeltaEvent(StreamEvent):
    """Event sent for content block updates."""

    type: Literal["content_block_delta"] = "content_block_delta"
    index: int
    delta: dict[str, Any]


class ContentBlockStopEvent(StreamEvent):
    """Event sent at the end of a content block."""

    type: Literal["content_block_stop"] = "content_block_stop"
    index: int


class MessageDeltaEvent(StreamEvent):
    """Event sent for message updates."""

    type: Literal["message_delta"] = "message_delta"
    delta: dict[str, Any]
    usage: dict[str, Any] | None = None


class MessageStopEvent(StreamEvent):
    """Event sent at the end of a message."""

    type: Literal["message_stop"] = "message_stop"


class PingEvent(StreamEvent):
    """Ping event for keepalive."""

    type: Literal["ping"] = "ping"


class ErrorEvent(StreamEvent):
    """Error event."""

    type: Literal["error"] = "error"
    error: dict[str, Any]


# ============================================
# Error Models
# ============================================

class ErrorDetail(BaseModel):
    """Error detail information."""

    type: str
    message: str


class ErrorResponse(BaseModel):
    """Error response body."""

    type: Literal["error"] = "error"
    error: ErrorDetail
