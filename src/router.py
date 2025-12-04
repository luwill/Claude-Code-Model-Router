"""Request routing and forwarding logic."""

import json
import time
from typing import Any, AsyncIterator

import httpx

from .config import ConfigManager, get_config_manager
from .models import (
    MessagesRequest,
    MessagesResponse,
    ModelConfig,
    ErrorResponse,
    ErrorDetail,
)


class RouterError(Exception):
    """Router related errors."""

    def __init__(self, message: str, status_code: int = 500, error_type: str = "router_error"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_type = error_type

    def to_error_response(self) -> ErrorResponse:
        """Convert to an ErrorResponse model."""
        return ErrorResponse(
            error=ErrorDetail(type=self.error_type, message=self.message)
        )


class ModelRouter:
    """Routes requests to appropriate model backends."""

    def __init__(self, config_manager: ConfigManager | None = None):
        """Initialize the router.

        Args:
            config_manager: ConfigManager instance. If None, uses global instance.
        """
        self.config_manager = config_manager or get_config_manager()
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            timeout = self.config_manager.config.gateway.timeout
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(timeout, connect=30.0),
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def resolve_route(self, model_name: str) -> tuple[str, ModelConfig]:
        """Resolve model name to route configuration.

        Args:
            model_name: The model name from the request

        Returns:
            Tuple of (resolved_model_name, ModelConfig)

        Raises:
            RouterError: If model is not found
        """
        # Resolve alias if needed
        resolved_name = self.config_manager.resolve_model_name(model_name)
        model_config = self.config_manager.get_model(resolved_name)

        if not model_config:
            raise RouterError(
                f"Model '{model_name}' not found. Available models: "
                f"{', '.join(self.config_manager.config.models.keys())}",
                status_code=400,
                error_type="invalid_model",
            )

        return resolved_name, model_config

    def build_headers(
        self,
        model_config: ModelConfig,
        original_headers: dict[str, str],
    ) -> dict[str, str]:
        """Build headers for the upstream request.

        Args:
            model_config: The model configuration
            original_headers: Headers from the original request

        Returns:
            Headers dict for the upstream request

        Raises:
            RouterError: If API key is not available
        """
        # Get API key
        api_key = self.config_manager.get_api_key(
            self.config_manager.resolve_model_name(model_config.model_id)
        )

        # Try to find the key by iterating models
        if not api_key:
            for name, config in self.config_manager.config.models.items():
                if config.model_id == model_config.model_id or config == model_config:
                    api_key = self.config_manager.get_api_key(name)
                    if api_key:
                        break

        if not api_key:
            raise RouterError(
                f"API key not configured for model '{model_config.display_name}'. "
                f"Please set the {model_config.api_key_env} environment variable.",
                status_code=401,
                error_type="authentication_error",
            )

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            model_config.auth_header: api_key,
        }

        # Add Anthropic-specific headers for Anthropic provider
        if model_config.provider == "anthropic":
            headers["anthropic-version"] = model_config.api_version
            # Forward anthropic-beta header if present
            if "anthropic-beta" in original_headers:
                headers["anthropic-beta"] = original_headers["anthropic-beta"]

        # Add any extra headers from config
        headers.update(model_config.extra_headers)

        return headers

    def build_request_body(
        self,
        request: MessagesRequest,
        model_config: ModelConfig,
    ) -> dict[str, Any]:
        """Build the request body for the upstream API.

        Args:
            request: The original request
            model_config: The target model configuration

        Returns:
            Request body dict
        """
        # Start with the request data
        body = request.model_dump(exclude_none=True)

        # Replace model name with the actual model ID
        body["model"] = model_config.model_id

        # Ensure max_tokens doesn't exceed model limit
        if body.get("max_tokens", 0) > model_config.max_tokens:
            body["max_tokens"] = model_config.max_tokens

        return body

    def build_url(self, model_config: ModelConfig, endpoint: str = "/v1/messages") -> str:
        """Build the full URL for the upstream API.

        Args:
            model_config: The model configuration
            endpoint: The API endpoint path

        Returns:
            Full URL string
        """
        base_url = model_config.base_url.rstrip("/")

        # Handle different API structures
        # Anthropic: https://api.anthropic.com/v1/messages
        # Others might have different paths

        if model_config.provider == "anthropic":
            return f"{base_url}{endpoint}"

        # For other providers, the base_url usually includes the necessary path
        # e.g., https://api.deepseek.com/anthropic already points to the right place
        if endpoint == "/v1/messages":
            # Most Anthropic-compatible APIs use /v1/messages from their base
            if "/anthropic" in base_url or "/coding" in base_url or "/apps/anthropic" in base_url:
                return f"{base_url}/v1/messages"
            return f"{base_url}{endpoint}"

        return f"{base_url}{endpoint}"

    async def forward_request(
        self,
        request: MessagesRequest,
        original_headers: dict[str, str],
    ) -> MessagesResponse:
        """Forward a non-streaming request to the appropriate backend.

        Args:
            request: The messages request
            original_headers: Original request headers

        Returns:
            The response from the upstream API

        Raises:
            RouterError: On routing or API errors
        """
        resolved_name, model_config = self.resolve_route(request.model)
        headers = self.build_headers(model_config, original_headers)
        body = self.build_request_body(request, model_config)
        url = self.build_url(model_config)

        # Ensure stream is False for non-streaming
        body["stream"] = False

        client = await self._get_client()
        start_time = time.time()

        try:
            response = await client.post(url, json=body, headers=headers)
            latency_ms = (time.time() - start_time) * 1000

            if response.status_code != 200:
                error_body = response.text
                try:
                    error_json = response.json()
                    error_message = error_json.get("error", {}).get("message", error_body)
                except Exception:
                    error_message = error_body

                raise RouterError(
                    f"Upstream API error ({model_config.provider}): {error_message}",
                    status_code=response.status_code,
                    error_type="api_error",
                )

            response_data = response.json()

            # Log request info
            if self.config_manager.config.gateway.enable_logging:
                usage = response_data.get("usage", {})
                print(
                    f"[{resolved_name}] Request completed in {latency_ms:.0f}ms | "
                    f"Input: {usage.get('input_tokens', 'N/A')} | "
                    f"Output: {usage.get('output_tokens', 'N/A')}"
                )

            return MessagesResponse(**response_data)

        except httpx.TimeoutException:
            raise RouterError(
                f"Request to {model_config.provider} timed out after "
                f"{self.config_manager.config.gateway.timeout}s",
                status_code=504,
                error_type="timeout_error",
            )
        except httpx.RequestError as e:
            raise RouterError(
                f"Failed to connect to {model_config.provider}: {str(e)}",
                status_code=502,
                error_type="connection_error",
            )

    async def forward_stream(
        self,
        request: MessagesRequest,
        original_headers: dict[str, str],
    ) -> AsyncIterator[str]:
        """Forward a streaming request to the appropriate backend.

        Args:
            request: The messages request
            original_headers: Original request headers

        Yields:
            SSE formatted strings

        Raises:
            RouterError: On routing or API errors
        """
        resolved_name, model_config = self.resolve_route(request.model)
        headers = self.build_headers(model_config, original_headers)
        body = self.build_request_body(request, model_config)
        url = self.build_url(model_config)

        # Ensure stream is True
        body["stream"] = True

        # Update Accept header for SSE
        headers["Accept"] = "text/event-stream"

        client = await self._get_client()
        start_time = time.time()

        try:
            async with client.stream("POST", url, json=body, headers=headers) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    try:
                        error_json = json.loads(error_body)
                        error_message = error_json.get("error", {}).get("message", error_body.decode())
                    except Exception:
                        error_message = error_body.decode()

                    # Yield error as SSE event
                    error_event = {
                        "type": "error",
                        "error": {"type": "api_error", "message": error_message},
                    }
                    yield f"event: error\ndata: {json.dumps(error_event)}\n\n"
                    return

                # Stream the response
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk

                    # Process complete SSE events
                    while "\n\n" in buffer:
                        event_str, buffer = buffer.split("\n\n", 1)
                        if event_str.strip():
                            yield event_str + "\n\n"

                # Don't forget any remaining data
                if buffer.strip():
                    yield buffer + "\n\n"

                # Log completion
                if self.config_manager.config.gateway.enable_logging:
                    latency_ms = (time.time() - start_time) * 1000
                    print(f"[{resolved_name}] Stream completed in {latency_ms:.0f}ms")

        except httpx.TimeoutException:
            error_event = {
                "type": "error",
                "error": {
                    "type": "timeout_error",
                    "message": f"Request timed out after {self.config_manager.config.gateway.timeout}s",
                },
            }
            yield f"event: error\ndata: {json.dumps(error_event)}\n\n"

        except httpx.RequestError as e:
            error_event = {
                "type": "error",
                "error": {
                    "type": "connection_error",
                    "message": f"Connection error: {str(e)}",
                },
            }
            yield f"event: error\ndata: {json.dumps(error_event)}\n\n"


# Global router instance
_router: ModelRouter | None = None


def get_router() -> ModelRouter:
    """Get the global router instance."""
    global _router
    if _router is None:
        _router = ModelRouter()
    return _router


async def shutdown_router() -> None:
    """Shutdown the global router."""
    global _router
    if _router:
        await _router.close()
        _router = None
