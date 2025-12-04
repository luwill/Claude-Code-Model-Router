"""FastAPI application entry point."""

import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import init_config, get_config_manager, ConfigError
from .router import get_router, shutdown_router, RouterError
from .models import MessagesRequest, ErrorResponse, ErrorDetail


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("=" * 60)
    print("Claude Code Model Router - Starting up...")
    print("=" * 60)

    try:
        config_manager = init_config()
        config = config_manager.config

        print(f"\nLoaded {len(config.models)} models:")
        for name, model in config.models.items():
            has_key = config_manager.get_api_key(name) is not None
            status = "Ready" if has_key else "No API Key"
            print(f"  - {name}: {model.display_name} [{status}]")

        print(f"\nGateway running at: http://{config.gateway.host}:{config.gateway.port}")
        print(f"Default model: {config.default_model}")
        print("=" * 60 + "\n")

    except ConfigError as e:
        print(f"Configuration Error: {e}")
        raise

    yield

    # Shutdown
    print("\nShutting down...")
    await shutdown_router()


app = FastAPI(
    title="Claude Code Model Router",
    description="A lightweight API gateway for routing Claude Code requests to multiple AI models",
    version="0.1.0",
    lifespan=lifespan,
)


# Error handlers
@app.exception_handler(RouterError)
async def router_error_handler(request: Request, exc: RouterError):
    """Handle router errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_error_response().model_dump(),
    )


@app.exception_handler(Exception)
async def general_error_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    error_response = ErrorResponse(
        error=ErrorDetail(
            type="internal_error",
            message=f"Internal server error: {str(exc)}",
        )
    )
    return JSONResponse(
        status_code=500,
        content=error_response.model_dump(),
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    config_manager = get_config_manager()
    models_status = {}

    for name in config_manager.config.models:
        has_key = config_manager.get_api_key(name) is not None
        models_status[name] = "available" if has_key else "no_api_key"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "default_model": config_manager.config.default_model,
        "models": models_status,
    }


# List models endpoint
@app.get("/v1/models")
async def list_models():
    """List available models."""
    config_manager = get_config_manager()
    return {
        "object": "list",
        "data": [
            {
                "id": name,
                "object": "model",
                "display_name": model.display_name,
                "provider": model.provider,
                "model_id": model.model_id,
                "available": config_manager.get_api_key(name) is not None,
            }
            for name, model in config_manager.config.models.items()
        ],
    }


# Main messages endpoint
@app.post("/v1/messages")
async def messages(request: Request):
    """Handle messages requests - the main Anthropic API endpoint."""
    router = get_router()

    # Parse request body
    try:
        body = await request.json()
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    # Get original headers (for forwarding anthropic-beta, etc.)
    original_headers = dict(request.headers)

    # Parse into our model
    try:
        messages_request = MessagesRequest(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {e}")

    # Handle default model
    if not messages_request.model:
        messages_request.model = get_config_manager().config.default_model

    # Check if streaming
    if messages_request.stream:
        return StreamingResponse(
            router.forward_stream(messages_request, original_headers),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Model-Router": messages_request.model,
            },
        )
    else:
        response = await router.forward_request(messages_request, original_headers)

        # Add model header if configured
        headers = {}
        if get_config_manager().config.gateway.include_model_header:
            headers["X-Model-Router"] = messages_request.model

        return JSONResponse(
            content=response.model_dump(),
            headers=headers,
        )


# Token counting endpoint (if supported)
@app.post("/v1/messages/count_tokens")
async def count_tokens(request: Request):
    """Count tokens for a request (forwards to upstream if supported)."""
    # For now, return a simple error - can be implemented later
    return JSONResponse(
        status_code=501,
        content={
            "type": "error",
            "error": {
                "type": "not_implemented",
                "message": "Token counting is not yet implemented in the model router",
            },
        },
    )


def create_app(config_path: str | None = None) -> FastAPI:
    """Create the FastAPI application with optional config path.

    Args:
        config_path: Optional path to configuration file

    Returns:
        Configured FastAPI application
    """
    if config_path:
        init_config(config_path)
    return app


# For running with uvicorn directly
if __name__ == "__main__":
    import uvicorn

    config_manager = get_config_manager()
    gateway_config = config_manager.config.gateway

    uvicorn.run(
        "src.main:app",
        host=gateway_config.host,
        port=gateway_config.port,
        reload=True,
        log_level=gateway_config.log_level.lower(),
    )
