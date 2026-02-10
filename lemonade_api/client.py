"""
LemonadeClient — Python client for the Lemonade Server.

Aligned with the official Lemonade Python SDK specification.
Docs: https://lemonade-sdk.github.io/lemonade/docs/server/python_sdk/

Usage:
    from lemonade_api import LemonadeClient, ChatCompletionRequest, Message

    client = LemonadeClient(base_url="http://localhost:8000")
    request = ChatCompletionRequest(
        model="Qwen3-0.6B-GGUF",
        messages=[Message(role="user", content="Hello!")]
    )
    response = client.chat_completions(request)
    print(response.choices[0].message.content)
"""

from typing import Any, Dict, Generator, Optional, Union

import httpx

from .exceptions import APIError, ConnectionError, LemonadeError
from .models import (
    AudioSpeechRequest,
    AudioTranscriptionRequest,
    ChatCompletionRequest,
    ChatCompletionResponse,
    CompletionRequest,
    CompletionResponse,
    DeleteModelRequest,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthResponse,
    ImageGenerationRequest,
    LoadModelRequest,
    ModelInfo,
    ModelListResponse,
    PullModelRequest,
    RerankingRequest,
    RerankingResponse,
    ResponsesRequest,
    StatsResponse,
    SystemInfoResponse,
    UnloadModelRequest,
)


class LemonadeClient:
    """
    Client for the Lemonade Server API.

    Args:
        base_url: Base URL of the Lemonade Server (default: http://localhost:8000).
                  Do NOT include /api/v1 — the client handles path prefixing internally.
    """

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")
        self._api_prefix = "/api/v1"
        self._client = httpx.Client(timeout=60.0)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _url(self, path: str) -> str:
        """Build a full URL for the given API path."""
        return f"{self.base_url}{self._api_prefix}/{path.lstrip('/')}"

    def _get(self, path: str, **kwargs: Any) -> httpx.Response:
        """Make a GET request and handle errors."""
        try:
            response = self._client.get(self._url(path), **kwargs)
            response.raise_for_status()
            return response
        except httpx.ConnectError as e:
            raise ConnectionError(
                f"Cannot connect to Lemonade Server at {self.base_url}. Is it running?"
            ) from e
        except httpx.HTTPStatusError as e:
            raise APIError(
                message=str(e),
                status_code=e.response.status_code,
                error_type=(
                    e.response.json().get("error", {}).get("type")
                    if e.response.headers.get("content-type", "").startswith("application/json")
                    else None
                ),
            ) from e
        except httpx.HTTPError as e:
            raise LemonadeError(f"HTTP error: {e}") from e

    def _post(self, path: str, json: Any = None, **kwargs: Any) -> httpx.Response:
        """Make a POST request and handle errors."""
        try:
            response = self._client.post(self._url(path), json=json, **kwargs)
            response.raise_for_status()
            return response
        except httpx.ConnectError as e:
            raise ConnectionError(
                f"Cannot connect to Lemonade Server at {self.base_url}. Is it running?"
            ) from e
        except httpx.HTTPStatusError as e:
            raise APIError(
                message=str(e),
                status_code=e.response.status_code,
                error_type=(
                    e.response.json().get("error", {}).get("type")
                    if e.response.headers.get("content-type", "").startswith("application/json")
                    else None
                ),
            ) from e
        except httpx.HTTPError as e:
            raise LemonadeError(f"HTTP error: {e}") from e

    def _post_multipart(self, path: str, data: Dict, files: Dict, **kwargs: Any) -> httpx.Response:
        """Make a multipart POST request and handle errors."""
        try:
            response = self._client.post(self._url(path), data=data, files=files, **kwargs)
            response.raise_for_status()
            return response
        except httpx.ConnectError as e:
            raise ConnectionError(
                f"Cannot connect to Lemonade Server at {self.base_url}. Is it running?"
            ) from e
        except httpx.HTTPStatusError as e:
            raise APIError(
                message=str(e),
                status_code=e.response.status_code,
            ) from e
        except httpx.HTTPError as e:
            raise LemonadeError(f"HTTP error: {e}") from e

    def _stream_post(self, path: str, json: Any = None) -> Generator[Dict[str, Any], None, None]:
        """Make a streaming POST request and yield parsed SSE events."""
        try:
            with self._client.stream("POST", self._url(path), json=json) as response:
                response.raise_for_status()
                buffer = ""
                for chunk in response.iter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                return
                            try:
                                import json as json_module

                                yield json_module.loads(data_str)
                            except Exception:
                                continue
        except httpx.ConnectError as e:
            raise ConnectionError(
                f"Cannot connect to Lemonade Server at {self.base_url}. Is it running?"
            ) from e
        except httpx.HTTPError as e:
            raise LemonadeError(f"Streaming error: {e}") from e

    # ------------------------------------------------------------------
    # Chat & Completions
    # ------------------------------------------------------------------

    def chat_completions(
        self, request: ChatCompletionRequest
    ) -> Union[ChatCompletionResponse, Generator[Dict[str, Any], None, None]]:
        """
        Generate a model response for a chat conversation.

        Endpoint: POST /api/v1/chat/completions

        If request.stream is True, returns a generator that yields parsed SSE chunks.
        Otherwise, returns a ChatCompletionResponse.
        """
        payload = request.model_dump(exclude_none=True)

        if request.stream:
            return self._stream_post("chat/completions", json=payload)

        response = self._post("chat/completions", json=payload)
        return ChatCompletionResponse(**response.json())

    def completions(
        self, request: CompletionRequest
    ) -> Union[CompletionResponse, Generator[Dict[str, Any], None, None]]:
        """
        Generate a completion for a text prompt.

        Endpoint: POST /api/v1/completions
        """
        payload = request.model_dump(exclude_none=True)

        if request.stream:
            return self._stream_post("completions", json=payload)

        response = self._post("completions", json=payload)
        return CompletionResponse(**response.json())

    def responses(
        self, request: ResponsesRequest
    ) -> Union[Dict[str, Any], Generator[Dict[str, Any], None, None]]:
        """
        Generate responses using the OpenAI Responses API format.

        Endpoint: POST /api/v1/responses
        """
        payload = request.model_dump(exclude_none=True)

        if request.stream:
            return self._stream_post("responses", json=payload)

        response = self._post("responses", json=payload)
        return response.json()

    # ------------------------------------------------------------------
    # Embeddings & Reranking
    # ------------------------------------------------------------------

    def embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Create embedding vectors for input text.

        Endpoint: POST /api/v1/embeddings
        """
        payload = request.model_dump(exclude_none=True)
        response = self._post("embeddings", json=payload)
        return EmbeddingResponse(**response.json())

    def reranking(self, request: RerankingRequest) -> RerankingResponse:
        """
        Rerank documents by relevance to a query.

        Endpoint: POST /api/v1/reranking
        """
        payload = request.model_dump(exclude_none=True)
        response = self._post("reranking", json=payload)
        return RerankingResponse(**response.json())

    # ------------------------------------------------------------------
    # Audio
    # ------------------------------------------------------------------

    def audio_transcriptions(self, request: AudioTranscriptionRequest) -> Dict[str, Any]:
        """
        Transcribe audio to text using Whisper models.

        Endpoint: POST /api/v1/audio/transcriptions
        """
        data: Dict[str, Any] = {"model": request.model}
        if request.language:
            data["language"] = request.language
        if request.response_format:
            data["response_format"] = request.response_format

        with open(request.file, "rb") as f:
            files = {"file": (request.file, f)}
            response = self._post_multipart("audio/transcriptions", data=data, files=files)

        return response.json()

    def audio_speech(self, request: AudioSpeechRequest) -> bytes:
        """
        Generate speech audio from text.

        Endpoint: POST /api/v1/audio/speech
        Returns raw audio bytes.
        """
        payload = request.model_dump(exclude_none=True)
        response = self._post("audio/speech", json=payload)
        return response.content

    # ------------------------------------------------------------------
    # Images
    # ------------------------------------------------------------------

    def generate_images(self, request: ImageGenerationRequest) -> Dict[str, Any]:
        """
        Generate images from text prompts.

        Endpoint: POST /api/v1/images/generations
        """
        payload = request.model_dump(exclude_none=True)
        response = self._post("images/generations", json=payload)
        return response.json()

    # ------------------------------------------------------------------
    # Models
    # ------------------------------------------------------------------

    def list_models(self, show_all: bool = False) -> ModelListResponse:
        """
        List available models.

        Endpoint: GET /api/v1/models

        Args:
            show_all: If True, returns all models including not-yet-downloaded ones.
        """
        params = {}
        if show_all:
            params["show_all"] = "true"

        response = self._get("models", params=params)
        return ModelListResponse(**response.json())

    def get_model(self, model_id: str) -> ModelInfo:
        """
        Get detailed information about a specific model.

        Endpoint: GET /api/v1/models/{model_id}
        """
        response = self._get(f"models/{model_id}")
        return ModelInfo(**response.json())

    # ------------------------------------------------------------------
    # Model Management
    # ------------------------------------------------------------------

    def pull_model(
        self, request: PullModelRequest
    ) -> Union[Dict[str, Any], Generator[Dict[str, Any], None, None]]:
        """
        Download and install a model.

        Endpoint: POST /api/v1/pull

        If request.stream is True, returns a generator yielding SSE progress events.
        """
        payload = request.model_dump(exclude_none=True)

        if request.stream:
            return self._stream_post("pull", json=payload)

        response = self._post("pull", json=payload)
        return response.json()

    def load_model(self, request: LoadModelRequest) -> Dict[str, Any]:
        """
        Load a model into memory.

        Endpoint: POST /api/v1/load
        """
        payload = request.model_dump(exclude_none=True)
        response = self._post("load", json=payload)
        return response.json()

    def unload_model(self, request: Optional[UnloadModelRequest] = None) -> Dict[str, Any]:
        """
        Unload a model from memory.

        Endpoint: POST /api/v1/unload

        If no request is provided, unloads all loaded models.
        """
        payload = request.model_dump(exclude_none=True) if request else {}
        response = self._post("unload", json=payload if payload else None)
        return response.json()

    def delete_model(self, request: DeleteModelRequest) -> Dict[str, Any]:
        """
        Delete a model from local storage.

        Endpoint: POST /api/v1/delete
        """
        payload = request.model_dump(exclude_none=True)
        response = self._post("delete", json=payload)
        return response.json()

    # ------------------------------------------------------------------
    # System
    # ------------------------------------------------------------------

    def health(self) -> HealthResponse:
        """
        Get server health status and loaded model information.

        Endpoint: GET /api/v1/health
        """
        response = self._get("health")
        return HealthResponse(**response.json())

    def stats(self) -> StatsResponse:
        """
        Get performance statistics from the last inference request.

        Endpoint: GET /api/v1/stats
        """
        response = self._get("stats")
        return StatsResponse(**response.json())

    def system_info(self) -> SystemInfoResponse:
        """
        Get detailed system hardware and software information.

        Endpoint: GET /api/v1/system-info
        """
        response = self._get("system-info")
        return SystemInfoResponse(**response.json())

    def live(self) -> bool:
        """
        Check if the server is reachable.

        Endpoint: GET /live  (root path, NOT under /api/v1/)
        """
        try:
            response = self._client.get(f"{self.base_url}/live", timeout=5.0)
            return response.status_code == 200
        except httpx.HTTPError:
            return False
