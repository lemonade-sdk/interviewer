"""
Lemonade API — Python client for the Lemonade Server.

Usage:
    from lemonade_api import LemonadeClient, ChatCompletionRequest, Message

    client = LemonadeClient()
    request = ChatCompletionRequest(
        model="Qwen3-0.6B-GGUF",
        messages=[Message(role="user", content="Hello!")]
    )
    response = client.chat_completions(request)
    print(response.choices[0].message.content)
"""

from .client import LemonadeClient
from .exceptions import (
    APIError,
    ConnectionError,
    LemonadeAPIError,
    LemonadeError,
    ValidationError,
)
from .models import (
    AudioSpeechRequest,
    AudioTranscriptionRequest,
    ChatCompletionRequest,
    ChatCompletionResponse,
    CompletionRequest,
    CompletionResponse,
    DeleteModelRequest,
    EmbeddingData,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthModelInfo,
    HealthResponse,
    ImageGenerationRequest,
    LoadModelRequest,
    Message,
    ModelInfo,
    ModelListResponse,
    PullModelRequest,
    RerankingRequest,
    RerankingResponse,
    RerankingResult,
    ResponsesRequest,
    StatsResponse,
    SystemInfoResponse,
    UnloadModelRequest,
    Usage,
)

__all__ = [
    # Client
    "LemonadeClient",
    # Exceptions
    "LemonadeError",
    "LemonadeAPIError",
    "APIError",
    "ConnectionError",
    "ValidationError",
    # Request Models
    "ChatCompletionRequest",
    "CompletionRequest",
    "ResponsesRequest",
    "EmbeddingRequest",
    "RerankingRequest",
    "AudioTranscriptionRequest",
    "AudioSpeechRequest",
    "ImageGenerationRequest",
    "PullModelRequest",
    "LoadModelRequest",
    "UnloadModelRequest",
    "DeleteModelRequest",
    # Response Models
    "ChatCompletionResponse",
    "CompletionResponse",
    "EmbeddingResponse",
    "RerankingResponse",
    "ModelInfo",
    "ModelListResponse",
    "HealthResponse",
    "StatsResponse",
    "SystemInfoResponse",
    # Supporting Models
    "Message",
    "Usage",
    "EmbeddingData",
    "RerankingResult",
    "HealthModelInfo",
]
