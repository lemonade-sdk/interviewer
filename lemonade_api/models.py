"""
Pydantic data models for the Lemonade API client.

All request and response models aligned with the official Lemonade Python SDK spec.
Docs: https://lemonade-sdk.github.io/lemonade/docs/server/python_sdk/
"""

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


# ============================================================
# Supporting Models
# ============================================================


class Message(BaseModel):
    """Chat message with role and content."""

    role: Literal["system", "user", "assistant"]
    content: str


class Usage(BaseModel):
    """Token usage statistics."""

    prompt_tokens: int = 0
    completion_tokens: Optional[int] = None
    total_tokens: int = 0


# ============================================================
# Request Models
# ============================================================


class ChatCompletionRequest(BaseModel):
    """Request body for POST /api/v1/chat/completions."""

    model: str
    messages: List[Message]
    stream: bool = False
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    top_k: Optional[int] = None
    max_tokens: Optional[int] = None
    max_completion_tokens: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None
    repeat_penalty: Optional[float] = Field(default=None, ge=1.0, le=2.0)
    tools: Optional[List[Dict[str, Any]]] = None
    logprobs: Optional[bool] = None


class CompletionRequest(BaseModel):
    """Request body for POST /api/v1/completions."""

    model: str
    prompt: str
    stream: bool = False
    echo: bool = False
    logprobs: Optional[int] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    repeat_penalty: Optional[float] = Field(default=None, ge=1.0, le=2.0)
    top_k: Optional[int] = None
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    max_tokens: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None


class ResponsesRequest(BaseModel):
    """Request body for POST /api/v1/responses."""

    input: Union[str, List[Dict[str, Any]]]
    model: str
    stream: bool = False
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    repeat_penalty: Optional[float] = None


class EmbeddingRequest(BaseModel):
    """Request body for POST /api/v1/embeddings."""

    model: str
    input: Union[str, List[str]]
    encoding_format: Optional[str] = "float"


class RerankingRequest(BaseModel):
    """Request body for POST /api/v1/reranking."""

    model: str
    query: str
    documents: List[str]


class AudioTranscriptionRequest(BaseModel):
    """Request body for POST /api/v1/audio/transcriptions."""

    model: str
    file: str  # Path to audio file
    language: Optional[str] = None
    response_format: Optional[str] = "json"


class AudioSpeechRequest(BaseModel):
    """Request body for POST /api/v1/audio/speech."""

    model: str
    input: str
    voice: Optional[str] = "shimmer"
    speed: Optional[float] = 1.0
    response_format: Optional[str] = "mp3"
    stream_format: Optional[str] = None


class ImageGenerationRequest(BaseModel):
    """Request body for POST /api/v1/images/generations."""

    model: str
    prompt: str
    size: Optional[str] = "512x512"
    n: Optional[int] = 1
    response_format: Optional[str] = "b64_json"
    steps: Optional[int] = None
    cfg_scale: Optional[float] = None
    seed: Optional[int] = None


class PullModelRequest(BaseModel):
    """Request body for POST /api/v1/pull."""

    model_name: str
    checkpoint: Optional[str] = None
    recipe: Optional[str] = None
    stream: bool = False
    reasoning: bool = False
    vision: bool = False
    embedding: bool = False
    reranking: bool = False
    mmproj: Optional[str] = None


class LoadModelRequest(BaseModel):
    """Request body for POST /api/v1/load."""

    model_name: str
    ctx_size: Optional[int] = None
    llamacpp_backend: Optional[str] = None
    llamacpp_args: Optional[str] = None
    whispercpp_backend: Optional[str] = None
    save_options: bool = False
    # Image generation settings
    steps: Optional[int] = None
    cfg_scale: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None


class UnloadModelRequest(BaseModel):
    """Request body for POST /api/v1/unload."""

    model_name: Optional[str] = None


class DeleteModelRequest(BaseModel):
    """Request body for POST /api/v1/delete."""

    model_name: str


# ============================================================
# Response Models
# ============================================================


class ChatCompletionMessage(BaseModel):
    """Message in a chat completion response."""

    role: str = "assistant"
    content: Optional[str] = None


class ChatCompletionChoice(BaseModel):
    """Single choice in a chat completion response."""

    index: int = 0
    message: Optional[ChatCompletionMessage] = None
    delta: Optional[ChatCompletionMessage] = None
    finish_reason: Optional[str] = None


class ChatCompletionResponse(BaseModel):
    """Response from POST /api/v1/chat/completions."""

    id: str = "0"
    object: str = "chat.completion"
    created: Optional[int] = None
    model: str = ""
    choices: List[ChatCompletionChoice] = []
    usage: Optional[Usage] = None


class CompletionChoice(BaseModel):
    """Single choice in a text completion response."""

    index: int = 0
    text: str = ""
    finish_reason: Optional[str] = None


class CompletionResponse(BaseModel):
    """Response from POST /api/v1/completions."""

    id: str = "0"
    object: str = "text_completion"
    created: Optional[int] = None
    model: str = ""
    choices: List[CompletionChoice] = []
    usage: Optional[Usage] = None


class EmbeddingData(BaseModel):
    """Single embedding vector."""

    object: str = "embedding"
    index: int = 0
    embedding: List[float] = []


class EmbeddingResponse(BaseModel):
    """Response from POST /api/v1/embeddings."""

    object: str = "list"
    data: List[EmbeddingData] = []
    model: str = ""
    usage: Optional[Usage] = None


class RerankingResult(BaseModel):
    """Reranking result with index and relevance score."""

    index: int = 0
    relevance_score: float = 0.0


class RerankingResponse(BaseModel):
    """Response from POST /api/v1/reranking."""

    model: str = ""
    object: str = "list"
    results: List[RerankingResult] = []
    usage: Optional[Usage] = None


class ModelInfo(BaseModel):
    """Model information from GET /api/v1/models."""

    id: str
    created: Optional[int] = None
    object: str = "model"
    owned_by: str = "lemonade"
    checkpoint: Optional[str] = None
    recipe: Optional[str] = None
    size: Optional[float] = None
    downloaded: bool = False
    suggested: bool = False
    labels: List[str] = []
    image_defaults: Optional[Dict[str, Any]] = None
    recipe_options: Optional[Dict[str, Any]] = None


class ModelListResponse(BaseModel):
    """Response from GET /api/v1/models."""

    object: str = "list"
    data: List[ModelInfo] = []


class HealthModelInfo(BaseModel):
    """Loaded model details in health response."""

    model_name: str
    checkpoint: Optional[str] = None
    last_use: Optional[float] = None
    type: Optional[str] = None  # "llm", "embedding", "reranking", "audio"
    device: Optional[str] = None
    recipe: Optional[str] = None
    recipe_options: Optional[Dict[str, Any]] = None
    backend_url: Optional[str] = None


class HealthResponse(BaseModel):
    """Response from GET /api/v1/health."""

    status: str = "ok"
    model_loaded: Optional[str] = None
    all_models_loaded: List[HealthModelInfo] = []
    max_models: Optional[Dict[str, int]] = None


class StatsResponse(BaseModel):
    """Response from GET /api/v1/stats."""

    time_to_first_token: Optional[float] = None
    tokens_per_second: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    decode_token_times: Optional[List[float]] = None
    prompt_tokens: Optional[int] = None


class DeviceInfo(BaseModel):
    """Hardware device information."""

    name: Optional[str] = None
    available: bool = False
    cores: Optional[int] = None
    threads: Optional[int] = None
    vram_gb: Optional[float] = None
    power_mode: Optional[str] = None


class SystemInfoResponse(BaseModel):
    """Response from GET /api/v1/system-info."""

    os_version: Optional[str] = Field(default=None, alias="OS Version")
    processor: Optional[str] = Field(default=None, alias="Processor")
    physical_memory: Optional[str] = Field(default=None, alias="Physical Memory")
    oem_system: Optional[str] = Field(default=None, alias="OEM System")
    bios_version: Optional[str] = Field(default=None, alias="BIOS Version")
    cpu_max_clock: Optional[str] = Field(default=None, alias="CPU Max Clock")
    windows_power_setting: Optional[str] = Field(default=None, alias="Windows Power Setting")
    devices: Optional[Dict[str, Any]] = None
    recipes: Optional[Dict[str, Any]] = None

    model_config = {"populate_by_name": True}
