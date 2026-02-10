"""
Unit tests for LemonadeClient
"""

import json

import pytest
from unittest.mock import Mock, patch, MagicMock

from lemonade_api.client import LemonadeClient
from lemonade_api.exceptions import LemonadeError, APIError, ConnectionError
from lemonade_api.models import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    CompletionRequest,
    LoadModelRequest,
    UnloadModelRequest,
    DeleteModelRequest,
    PullModelRequest,
    Message,
    ModelListResponse,
    HealthResponse,
    StatsResponse,
)


class TestLemonadeClient:
    """Test suite for LemonadeClient"""

    def test_client_initialization(self):
        """Test that client initializes with correct base URL"""
        client = LemonadeClient(base_url="http://localhost:8000")
        assert client.base_url == "http://localhost:8000"

    def test_client_initialization_default_url(self):
        """Test that client uses default URL when none provided"""
        client = LemonadeClient()
        assert client.base_url == "http://localhost:8000"

    def test_client_trailing_slash_stripped(self):
        """Test that trailing slash is stripped from base URL"""
        client = LemonadeClient(base_url="http://localhost:8000/")
        assert client.base_url == "http://localhost:8000"
        assert not client.base_url.endswith("/")

    def test_url_construction(self):
        """Test that internal URL builder constructs correct paths"""
        client = LemonadeClient(base_url="http://localhost:8000")
        assert client._url("models") == "http://localhost:8000/api/v1/models"
        assert client._url("/models") == "http://localhost:8000/api/v1/models"
        assert client._url("chat/completions") == "http://localhost:8000/api/v1/chat/completions"
        assert client._url("health") == "http://localhost:8000/api/v1/health"

    @pytest.mark.unit
    def test_client_has_required_methods(self):
        """Test that client has all required API methods per the official SDK"""
        client = LemonadeClient()
        required_methods = [
            # Chat & Completions
            "chat_completions",
            "completions",
            "responses",
            # Embeddings & Reranking
            "embeddings",
            "reranking",
            # Audio
            "audio_transcriptions",
            "audio_speech",
            # Images
            "generate_images",
            # Models
            "list_models",
            "get_model",
            # Model Management
            "pull_model",
            "load_model",
            "unload_model",
            "delete_model",
            # System
            "health",
            "stats",
            "system_info",
            "live",
        ]
        for method in required_methods:
            assert hasattr(client, method), f"Client missing method: {method}"

    @pytest.mark.unit
    @patch("httpx.Client.get")
    def test_list_models_success(self, mock_get):
        """Test successful model listing"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {
            "object": "list",
            "data": [
                {
                    "id": "Qwen3-0.6B-GGUF",
                    "object": "model",
                    "owned_by": "lemonade",
                    "downloaded": True,
                    "labels": ["reasoning"],
                },
                {
                    "id": "Gemma-3-4b-it-GGUF",
                    "object": "model",
                    "owned_by": "lemonade",
                    "downloaded": True,
                    "labels": ["hot", "vision"],
                },
            ],
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        client = LemonadeClient()
        result = client.list_models()

        assert isinstance(result, ModelListResponse)
        assert len(result.data) == 2
        assert result.data[0].id == "Qwen3-0.6B-GGUF"
        assert result.data[1].id == "Gemma-3-4b-it-GGUF"

    @pytest.mark.unit
    @patch("httpx.Client.post")
    def test_chat_completions_success(self, mock_post):
        """Test successful chat completion"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {
            "id": "0",
            "object": "chat.completion",
            "created": 1742927481,
            "model": "Qwen3-0.6B-GGUF",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Hello! How can I help you?",
                    },
                    "finish_reason": "stop",
                }
            ],
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        client = LemonadeClient()
        request = ChatCompletionRequest(
            model="Qwen3-0.6B-GGUF",
            messages=[Message(role="user", content="Hello")],
        )
        result = client.chat_completions(request)

        assert isinstance(result, ChatCompletionResponse)
        assert result.choices[0].message.content == "Hello! How can I help you?"
        assert result.model == "Qwen3-0.6B-GGUF"

    @pytest.mark.unit
    @patch("httpx.Client.get")
    def test_health_success(self, mock_get):
        """Test health endpoint"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {
            "status": "ok",
            "model_loaded": "Qwen3-0.6B-GGUF",
            "all_models_loaded": [
                {
                    "model_name": "Qwen3-0.6B-GGUF",
                    "type": "llm",
                    "device": "gpu",
                    "recipe": "llamacpp",
                }
            ],
            "max_models": {"llm": 1, "embedding": 1, "reranking": 1},
        }
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        client = LemonadeClient()
        result = client.health()

        assert isinstance(result, HealthResponse)
        assert result.status == "ok"
        assert result.model_loaded == "Qwen3-0.6B-GGUF"
        assert len(result.all_models_loaded) == 1

    @pytest.mark.unit
    @patch("httpx.Client.get")
    def test_live_success(self, mock_get):
        """Test live endpoint returns True when server is up"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        client = LemonadeClient()
        assert client.live() is True

    @pytest.mark.unit
    @patch("httpx.Client.get")
    def test_live_failure(self, mock_get):
        """Test live endpoint returns False when server is down"""
        import httpx
        mock_get.side_effect = httpx.ConnectError("Connection refused")

        client = LemonadeClient()
        assert client.live() is False

    @pytest.mark.unit
    def test_connection_error(self):
        """Test that ConnectionError is raised when server is unreachable"""
        client = LemonadeClient(base_url="http://invalid-url-that-does-not-exist:9999")
        with pytest.raises(ConnectionError):
            client.health()


@pytest.mark.slow
class TestLemonadeClientIntegration:
    """Integration tests requiring a running Lemonade Server"""

    @pytest.fixture
    def client(self):
        """Fixture providing a test client"""
        return LemonadeClient(base_url="http://localhost:8000")

    @pytest.mark.skip(reason="Requires running Lemonade Server")
    def test_real_server_health(self, client):
        """Test health check against real server"""
        result = client.health()
        assert result.status == "ok"

    @pytest.mark.skip(reason="Requires running Lemonade Server")
    def test_real_server_models(self, client):
        """Test listing models against real server"""
        result = client.list_models()
        assert isinstance(result, ModelListResponse)
        assert len(result.data) >= 0

    @pytest.mark.skip(reason="Requires running Lemonade Server")
    def test_real_server_live(self, client):
        """Test liveness check against real server"""
        assert client.live() is True

    @pytest.mark.skip(reason="Requires running Lemonade Server")
    def test_real_server_system_info(self, client):
        """Test system info against real server"""
        result = client.system_info()
        assert result.processor is not None or result.os_version is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
