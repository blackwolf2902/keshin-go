"""Python AI service configuration loaded from keshin.toml."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Settings for the AI service, loaded from environment / keshin.toml."""

    # LLM configuration
    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    llm_max_tokens: int = 512
    llm_temperature: float = 0.7

    # Provider API keys
    groq_api_key: str = ""
    gemini_api_key: str = ""

    # Provider base URLs
    groq_base_url: str = "https://api.groq.com/openai/v1"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    ollama_base_url: str = "http://localhost:11434"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Ollama model
    ollama_model: str = "llama3.2:3b"
    openrouter_model: str = "meta-llama/llama-3.2-3b-instruct:free"

    # TTS configuration
    tts_provider: str = "edge-tts"
    edge_tts_voice: str = "ja-JP-NanamiNeural"
    edge_tts_rate: str = "+0%"
    edge_tts_pitch: str = "+0Hz"

    # Server
    host: str = "0.0.0.0"
    port: int = 9090

    model_config = {"env_prefix": "keshin_", "env_file": ".env", "extra": "ignore"}
