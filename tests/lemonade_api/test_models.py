"""
Unit tests for Pydantic models
"""
import pytest
from lemonade_api.models import Message, ChatCompletionRequest


class TestMessage:
    """Test suite for Message model"""

    def test_message_creation(self):
        """Test creating a valid message"""
        message = Message(role="user", content="Hello")
        assert message.role == "user"
        assert message.content == "Hello"

    def test_message_role_validation(self):
        """Test that invalid roles are rejected"""
        # Valid roles should work
        valid_roles = ["system", "user", "assistant"]
        for role in valid_roles:
            message = Message(role=role, content="test")
            assert message.role == role

    def test_message_dict_conversion(self):
        """Test converting message to dict"""
        message = Message(role="user", content="Hello")
        message_dict = message.model_dump()
        assert isinstance(message_dict, dict)
        assert message_dict["role"] == "user"
        assert message_dict["content"] == "Hello"


class TestChatCompletionRequest:
    """Test suite for ChatCompletionRequest model"""

    def test_chat_request_creation(self):
        """Test creating a valid chat completion request"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="test-model",
            messages=messages
        )
        assert request.model == "test-model"
        assert len(request.messages) == 1

    def test_chat_request_with_optional_params(self):
        """Test chat request with optional parameters"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="test-model",
            messages=messages,
            temperature=0.7,
            max_tokens=100
        )
        assert request.temperature == 0.7
        assert request.max_tokens == 100

    @pytest.mark.parametrize("temperature", [0.0, 0.5, 1.0, 2.0])
    def test_temperature_range(self, temperature):
        """Test various temperature values"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="test-model",
            messages=messages,
            temperature=temperature
        )
        assert request.temperature == temperature

    def test_request_serialization(self):
        """Test serializing request to JSON"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="test-model",
            messages=messages
        )
        request_dict = request.model_dump()
        assert isinstance(request_dict, dict)
        assert "model" in request_dict
        assert "messages" in request_dict


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
