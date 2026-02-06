from typing import Any, Optional

import httpx

from .exceptions import LemonadeAPIError
from .models import ChatCompletionRequest


class LemonadeClient:
    def __init__(self, base_url: str = "http://localhost:8000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._client = httpx.Client(base_url=self.base_url)
        if api_key:
            self._client.headers.update({"Authorization": f"Bearer {api_key}"})

    def list_models(self) -> list[dict[str, Any]]:
        try:
            response = self._client.get("/models")
            response.raise_for_status()
            return response.json().get("data", [])
        except httpx.HTTPError as e:
            raise LemonadeAPIError(f"Failed to list models: {e}") from e

    def chat_completions(self, request: ChatCompletionRequest) -> dict[str, Any]:
        try:
            response = self._client.post("/chat/completions", json=request.model_dump())
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise LemonadeAPIError(f"Failed to create chat completion: {e}") from e
