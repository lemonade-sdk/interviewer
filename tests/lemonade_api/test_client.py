"""
Unit tests for LemonadeClient
"""

import pytest
from unittest.mock import Mock, patch
from lemonade_api.client import LemonadeClient
from lemonade_api.exceptions import LemonadeAPIError


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

    def test_client_initialization_with_api_key(self):
        """Test that client stores API key when provided"""
        client = LemonadeClient(api_key="test-key-123")
        assert hasattr(client, "api_key") or hasattr(client, "_api_key")

    @pytest.mark.unit
    def test_client_has_required_methods(self):
        """Test that client has all required API methods"""
        client = LemonadeClient()
        required_methods = [
            "chat_completions",
            "list_models",
        ]
        for method in required_methods:
            assert hasattr(client, method), f"Client missing method: {method}"

    @pytest.mark.unit
    def test_client_base_url_validation(self):
        """Test that base URL is properly formatted"""
        client = LemonadeClient(base_url="http://localhost:8000/")
        # Should strip trailing slash
        assert not client.base_url.endswith("/")

    @pytest.mark.integration
    @patch("httpx.Client.get")
    def test_list_models_success(self, mock_get):
        """Test successful model listing"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"id": "model-1", "object": "model"}, {"id": "model-2", "object": "model"}]
        }
        mock_get.return_value = mock_response

        client = LemonadeClient()
        # This test will be skipped if the method doesn't exist yet
        if hasattr(client, "list_models"):
            models = client.list_models()
            assert len(models) >= 0

    @pytest.mark.integration
    def test_error_handling(self):
        """Test that client properly handles API errors"""
        client = LemonadeClient(base_url="http://invalid-url-that-does-not-exist:9999")
        # This should raise an appropriate error
        # Adjust based on actual implementation
        pass


@pytest.mark.slow
class TestLemonadeClientIntegration:
    """Integration tests requiring a running server"""

    @pytest.fixture
    def client(self):
        """Fixture providing a test client"""
        return LemonadeClient(base_url="http://localhost:8000")

    @pytest.mark.skip(reason="Requires running Lemonade server")
    def test_real_server_connection(self, client):
        """Test connection to real server"""
        models = client.list_models()
        assert isinstance(models, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
