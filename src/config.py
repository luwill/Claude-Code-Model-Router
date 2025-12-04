"""Configuration management for the Model Router."""

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

from .models import ModelConfig, RouterConfig, GatewayConfig


class ConfigError(Exception):
    """Configuration related errors."""

    pass


class ConfigManager:
    """Manages loading and accessing configuration."""

    def __init__(self, config_path: str | Path | None = None):
        """Initialize the configuration manager.

        Args:
            config_path: Path to the models.yaml config file.
                        If None, looks for config/models.yaml relative to project root.
        """
        # Load environment variables from .env file
        load_dotenv()

        self.config_path = self._resolve_config_path(config_path)
        self._config: RouterConfig | None = None
        self._api_keys: dict[str, str] = {}

    def _resolve_config_path(self, config_path: str | Path | None) -> Path:
        """Resolve the configuration file path."""
        if config_path:
            path = Path(config_path)
            if path.exists():
                return path
            raise ConfigError(f"Configuration file not found: {config_path}")

        # Try default locations
        default_locations = [
            Path("config/models.yaml"),
            Path("models.yaml"),
            Path(__file__).parent.parent / "config" / "models.yaml",
        ]

        for location in default_locations:
            if location.exists():
                return location

        raise ConfigError(
            f"Configuration file not found. Tried: {', '.join(str(p) for p in default_locations)}"
        )

    def load(self) -> RouterConfig:
        """Load configuration from YAML file."""
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                raw_config = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ConfigError(f"Failed to parse YAML config: {e}")
        except IOError as e:
            raise ConfigError(f"Failed to read config file: {e}")

        # Parse models
        models = {}
        for name, model_data in raw_config.get("models", {}).items():
            try:
                models[name] = ModelConfig(**model_data)
            except Exception as e:
                raise ConfigError(f"Invalid model configuration for '{name}': {e}")

        # Parse gateway config
        gateway_data = raw_config.get("gateway", {})
        gateway = GatewayConfig(**gateway_data)

        # Override with environment variables if present
        if env_port := os.getenv("GATEWAY_PORT"):
            gateway.port = int(env_port)
        if env_log_level := os.getenv("LOG_LEVEL"):
            gateway.log_level = env_log_level
        if env_timeout := os.getenv("REQUEST_TIMEOUT"):
            gateway.timeout = int(env_timeout)

        # Get default model
        default_model = os.getenv("DEFAULT_MODEL", raw_config.get("default_model", "sonnet"))

        # Parse aliases
        aliases = raw_config.get("aliases", {})

        self._config = RouterConfig(
            default_model=default_model,
            models=models,
            aliases=aliases,
            gateway=gateway,
        )

        # Pre-load API keys
        self._load_api_keys()

        return self._config

    def _load_api_keys(self) -> None:
        """Load API keys from environment variables."""
        if not self._config:
            return

        for name, model in self._config.models.items():
            key = os.getenv(model.api_key_env)
            if key:
                self._api_keys[name] = key
            else:
                # Log warning but don't fail - key might not be needed yet
                print(f"Warning: API key not found for model '{name}' (env: {model.api_key_env})")

    @property
    def config(self) -> RouterConfig:
        """Get the loaded configuration."""
        if not self._config:
            self.load()
        return self._config

    def get_model(self, name: str) -> ModelConfig | None:
        """Get model configuration by name or alias.

        Args:
            name: Model name or alias

        Returns:
            ModelConfig if found, None otherwise
        """
        config = self.config

        # Check direct model name
        if name in config.models:
            return config.models[name]

        # Check aliases
        if name in config.aliases:
            alias_target = config.aliases[name]
            return config.models.get(alias_target)

        return None

    def get_api_key(self, model_name: str) -> str | None:
        """Get the API key for a model.

        Args:
            model_name: The model name (resolved, not alias)

        Returns:
            API key string if found, None otherwise
        """
        # First check cached keys
        if model_name in self._api_keys:
            return self._api_keys[model_name]

        # Try to load from environment
        model = self.get_model(model_name)
        if model:
            key = os.getenv(model.api_key_env)
            if key:
                self._api_keys[model_name] = key
                return key

        return None

    def resolve_model_name(self, name: str) -> str:
        """Resolve an alias to the actual model name.

        Args:
            name: Model name or alias

        Returns:
            Resolved model name
        """
        config = self.config

        # If it's an alias, resolve it
        if name in config.aliases:
            return config.aliases[name]

        # If it's a direct model name, return as-is
        if name in config.models:
            return name

        # Unknown model, return as-is (will be handled by router)
        return name

    def list_models(self) -> dict[str, dict[str, Any]]:
        """List all available models with their info.

        Returns:
            Dictionary of model name -> model info
        """
        result = {}
        for name, model in self.config.models.items():
            has_key = self.get_api_key(name) is not None
            result[name] = {
                "display_name": model.display_name,
                "provider": model.provider,
                "model_id": model.model_id,
                "available": has_key,
                "supports_streaming": model.supports_streaming,
                "supports_tools": model.supports_tools,
            }
        return result


# Global configuration instance
_config_manager: ConfigManager | None = None


def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
        _config_manager.load()
    return _config_manager


def init_config(config_path: str | Path | None = None) -> ConfigManager:
    """Initialize the global configuration manager.

    Args:
        config_path: Optional path to configuration file

    Returns:
        The initialized ConfigManager instance
    """
    global _config_manager
    _config_manager = ConfigManager(config_path)
    _config_manager.load()
    return _config_manager
