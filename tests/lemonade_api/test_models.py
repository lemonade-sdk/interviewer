"""
Unit tests for Pydantic models
"""

import pytest
from lemonade_api.models import (
    Message,
    ChatCompletionRequest,
    CompletionRequest,
    EmbeddingRequest,
    RerankingRequest,
    PullModelRequest,
    LoadModelRequest,
    UnloadModelRequest,
    DeleteModelRequest,
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatCompletionMessage,
    ModelInfo,
    ModelListResponse,
    HealthResponse,
    HealthModelInfo,
    StatsResponse,
    ResponsesRequest,
)


class TestMessage:
    """Test suite for Message model"""

    def test_message_creation(self):
        """Test creating a valid message"""
        message = Message(role="user", content="Hello")
        assert message.role == "user"
        assert message.content == "Hello"

    def test_message_role_validation(self):
        """Test that valid roles work"""
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
        request = ChatCompletionRequest(model="test-model", messages=messages)
        assert request.model == "test-model"
        assert len(request.messages) == 1

    def test_chat_request_with_optional_params(self):
        """Test chat request with optional parameters"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="test-model",
            messages=messages,
            temperature=0.7,
            max_tokens=100,
            stream=True,
        )
        assert request.temperature == 0.7
        assert request.max_tokens == 100
        assert request.stream is True

    def test_chat_request_with_all_params(self):
        """Test chat request with all parameters per SDK spec"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="Qwen3-0.6B-GGUF",
            messages=messages,
            stream=False,
            temperature=0.7,
            top_p=0.9,
            top_k=50,
            max_tokens=100,
            max_completion_tokens=200,
            stop=["END"],
            repeat_penalty=1.1,
            tools=None,
            logprobs=False,
        )
        assert request.top_p == 0.9
        assert request.top_k == 50
        assert request.max_completion_tokens == 200
        assert request.stop == ["END"]
        assert request.repeat_penalty == 1.1

    @pytest.mark.parametrize("temperature", [0.0, 0.5, 1.0, 2.0])
    def test_temperature_range(self, temperature):
        """Test various temperature values"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(
            model="test-model", messages=messages, temperature=temperature
        )
        assert request.temperature == temperature

    def test_request_serialization(self):
        """Test serializing request to JSON"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(model="test-model", messages=messages)
        request_dict = request.model_dump()
        assert isinstance(request_dict, dict)
        assert "model" in request_dict
        assert "messages" in request_dict

    def test_request_serialization_excludes_none(self):
        """Test that None values are excluded from serialization"""
        messages = [Message(role="user", content="Hello")]
        request = ChatCompletionRequest(model="test-model", messages=messages)
        request_dict = request.model_dump(exclude_none=True)
        # Optional None fields should not appear
        assert "top_p" not in request_dict
        assert "top_k" not in request_dict
        assert "stop" not in request_dict


class TestCompletionRequest:
    """Test suite for CompletionRequest model"""

    def test_completion_request_creation(self):
        """Test creating a text completion request"""
        request = CompletionRequest(
            model="Qwen3-0.6B-GGUF",
            prompt="Once upon a time",
            max_tokens=50,
        )
        assert request.model == "Qwen3-0.6B-GGUF"
        assert request.prompt == "Once upon a time"
        assert request.max_tokens == 50
        assert request.stream is False


class TestModelManagementRequests:
    """Test suite for model management request models"""

    def test_pull_model_request(self):
        """Test PullModelRequest matches SDK spec"""
        request = PullModelRequest(model_name="Qwen3-0.6B-GGUF")
        assert request.model_name == "Qwen3-0.6B-GGUF"
        assert request.stream is False

    def test_pull_model_request_custom(self):
        """Test PullModelRequest for custom Hugging Face model"""
        request = PullModelRequest(
            model_name="user.Phi-4-Mini-GGUF",
            checkpoint="unsloth/Phi-4-mini-instruct-GGUF:Q4_K_M",
            recipe="llamacpp",
            reasoning=True,
        )
        assert request.model_name == "user.Phi-4-Mini-GGUF"
        assert request.checkpoint == "unsloth/Phi-4-mini-instruct-GGUF:Q4_K_M"
        assert request.recipe == "llamacpp"
        assert request.reasoning is True

    def test_load_model_request(self):
        """Test LoadModelRequest matches SDK spec"""
        request = LoadModelRequest(
            model_name="Qwen3-0.6B-GGUF",
            ctx_size=8192,
            llamacpp_backend="vulkan",
            save_options=True,
        )
        assert request.model_name == "Qwen3-0.6B-GGUF"
        assert request.ctx_size == 8192
        assert request.llamacpp_backend == "vulkan"
        assert request.save_options is True

    def test_unload_model_request(self):
        """Test UnloadModelRequest - model_name is optional (unload all)"""
        request = UnloadModelRequest()
        assert request.model_name is None

        request_specific = UnloadModelRequest(model_name="Qwen3-0.6B-GGUF")
        assert request_specific.model_name == "Qwen3-0.6B-GGUF"

    def test_delete_model_request(self):
        """Test DeleteModelRequest"""
        request = DeleteModelRequest(model_name="old-model")
        assert request.model_name == "old-model"


class TestResponseModels:
    """Test suite for response models"""

    def test_chat_completion_response(self):
        """Test parsing a chat completion response"""
        data = {
            "id": "0",
            "object": "chat.completion",
            "created": 1742927481,
            "model": "Qwen3-0.6B-GGUF",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "Hello!"},
                    "finish_reason": "stop",
                }
            ],
        }
        response = ChatCompletionResponse(**data)
        assert response.model == "Qwen3-0.6B-GGUF"
        assert response.choices[0].message.content == "Hello!"
        assert response.choices[0].finish_reason == "stop"

    def test_model_list_response(self):
        """Test parsing a model list response"""
        data = {
            "object": "list",
            "data": [
                {
                    "id": "Qwen3-0.6B-GGUF",
                    "object": "model",
                    "owned_by": "lemonade",
                    "downloaded": True,
                    "labels": ["reasoning"],
                    "size": 0.38,
                }
            ],
        }
        response = ModelListResponse(**data)
        assert len(response.data) == 1
        assert response.data[0].id == "Qwen3-0.6B-GGUF"
        assert response.data[0].downloaded is True
        assert response.data[0].size == 0.38
        assert "reasoning" in response.data[0].labels

    def test_health_response(self):
        """Test parsing a health response"""
        data = {
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
            "max_models": {"llm": 3, "embedding": 1, "reranking": 1},
        }
        response = HealthResponse(**data)
        assert response.status == "ok"
        assert len(response.all_models_loaded) == 1
        assert response.all_models_loaded[0].model_name == "Qwen3-0.6B-GGUF"

    def test_stats_response(self):
        """Test parsing a stats response"""
        data = {
            "time_to_first_token": 2.14,
            "tokens_per_second": 33.33,
            "input_tokens": 128,
            "output_tokens": 5,
        }
        response = StatsResponse(**data)
        assert response.tokens_per_second == 33.33
        assert response.time_to_first_token == 2.14


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
