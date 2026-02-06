from typing import Optional, List, Dict, Any
import httpx
from .models import ChatCompletionRequest
from .exceptions import LemonadeAPIError

class LemonadeClient:
    def __init__(self, base_url: str = "http://localhost:8000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self._client = httpx.Client(base_url=self.base_url)
        if api_key:
            self._client.headers.update({"Authorization": f"Bearer {api_key}"})

    def list_models(self) -> List[Dict[str, Any]]:
        try:
            response = self._client.get("/models")
            response.raise_for_status()
            return response.json().get("data", [])
        except httpx.HTTPError as e:
            raise LemonadeAPIError(f"Failed to list models: {e}")

    def chat_completions(self, request: ChatCompletionRequest) -> Dict[str, Any]:
        try:
            response = self._client.post("/chat/completions", json=request.model_dump())
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise LemonadeAPIError(f"Failed to create chat completion: {e}")
