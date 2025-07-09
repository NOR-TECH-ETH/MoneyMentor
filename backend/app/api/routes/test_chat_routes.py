import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, status, HTTPException, Depends
from unittest.mock import AsyncMock, patch, MagicMock
from app.api.routes import chat
from app.models.schemas import ChatMessageRequest
import types

app = FastAPI()
app.include_router(chat.router)

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

# Helper: default user and request
mock_user = {"id": "user123"}
def override_get_current_active_user():
    return mock_user

app.dependency_overrides[chat.get_current_active_user] = override_get_current_active_user

valid_chat_request = {"query": "Hello!", "session_id": "sess1"}

# --- /message ---
def test_process_message_success(client):
    with patch("app.api.routes.chat.ChatService") as MockService:
        instance = MockService.return_value
        instance.process_message = AsyncMock(return_value={"message": "Hi!"})
        resp = client.post("/message", json=valid_chat_request)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Hi!"

def test_process_message_invalid_response(client):
    with patch("app.api.routes.chat.ChatService") as MockService:
        instance = MockService.return_value
        instance.process_message = AsyncMock(return_value="not a dict")
        resp = client.post("/message", json=valid_chat_request)
        assert resp.status_code == 500
        assert resp.json()["detail"] == "Invalid response format"

def test_process_message_missing_message(client):
    with patch("app.api.routes.chat.ChatService") as MockService:
        instance = MockService.return_value
        instance.process_message = AsyncMock(return_value={})
        resp = client.post("/message", json=valid_chat_request)
        assert resp.status_code == 500
        assert resp.json()["detail"] == "Missing message in response"

def test_process_message_exception(client):
    with patch("app.api.routes.chat.ChatService") as MockService:
        instance = MockService.return_value
        instance.process_message = AsyncMock(side_effect=Exception("fail"))
        resp = client.post("/message", json=valid_chat_request)
        assert resp.status_code == 500
        assert resp.json()["detail"] == "fail"

async def async_gen_tokens(tokens):
    for t in tokens:
        yield t

# --- /message/stream ---
def test_process_message_streaming_success(client):
    # Patch all async dependencies and streaming response
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value={"session_id": "sess1", "chat_history": []})), \
         patch("app.api.routes.chat.money_mentor_function.process_and_stream", new=AsyncMock(return_value=MagicMock(body_iterator=async_gen_tokens([b"token1", b"token2"]), headers={}))), \
         patch("app.api.routes.chat.ChatService") as MockService:
        instance = MockService.return_value
        instance._handle_background_tasks_only = AsyncMock()
        resp = client.post("/message/stream", json=valid_chat_request)
        assert resp.status_code == 200
        assert b"token1" in resp.content or b"token2" in resp.content

def test_process_message_streaming_session_creation(client):
    # Simulate no session found, so create_session is called
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value=None)), \
         patch("app.api.routes.chat.create_session", new=AsyncMock(return_value={"session_id": "sess1", "chat_history": []})), \
         patch("app.api.routes.chat.money_mentor_function.process_and_stream", new=AsyncMock(return_value=MagicMock(body_iterator=async_gen_tokens([b"token1"]), headers={}))), \
         patch("app.api.routes.chat.ChatService") as MockService:
        instance = MockService.return_value
        instance._handle_background_tasks_only = AsyncMock()
        resp = client.post("/message/stream", json=valid_chat_request)
        assert resp.status_code == 200
        assert b"token1" in resp.content

def test_process_message_streaming_error(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(side_effect=Exception("fail"))):
        resp = client.post("/message/stream", json=valid_chat_request)
        assert resp.status_code == 200
        assert b"error" in resp.content

# --- /history/{session_id} ---
def test_get_chat_history_success(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value={"session_id": "sess1", "chat_history": [
        {"role": "user", "content": "Hi", "timestamp": "2024-01-01T00:00:00"}
    ]})):
        resp = client.get("/history/sess1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "sess1"
        assert data["message_count"] == 1

def test_get_chat_history_not_found(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value=None)):
        resp = client.get("/history/sess1")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Session not found"

def test_get_chat_history_exception(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(side_effect=Exception("fail"))):
        resp = client.get("/history/sess1")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "fail"

# --- /history/{session_id} DELETE ---
def test_clear_chat_history_success(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value={"session_id": "sess1"})), \
         patch("app.api.routes.chat.update_session", new=AsyncMock(return_value=None)):
        resp = client.delete("/history/sess1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

def test_clear_chat_history_not_found(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value=None)):
        resp = client.delete("/history/sess1")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Session not found"

def test_clear_chat_history_exception(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(side_effect=Exception("fail"))):
        resp = client.delete("/history/sess1")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "fail"

# --- /session/{session_id} DELETE ---
def test_delete_chat_session_success(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value={"session_id": "sess1", "user_id": "user123"})), \
         patch("app.api.routes.chat.delete_session", new=AsyncMock(return_value=True)):
        resp = client.delete("/session/sess1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

def test_delete_chat_session_not_found(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value=None)):
        resp = client.delete("/session/sess1")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Session not found"

def test_delete_chat_session_forbidden(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(return_value={"session_id": "sess1", "user_id": "otheruser"})):
        resp = client.delete("/session/sess1")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Access denied - session does not belong to current user"

def test_delete_chat_session_exception(client):
    with patch("app.api.routes.chat.get_session", new=AsyncMock(side_effect=Exception("fail"))):
        resp = client.delete("/session/sess1")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "fail"

# --- /history/ (all user sessions) ---
def test_get_all_user_sessions_success(client):
    with patch("app.api.routes.chat.get_all_user_sessions", new=AsyncMock(return_value=[
        {"session_id": "sess1", "chat_history": [{"role": "user", "content": "Hi", "timestamp": "2024-01-01T00:00:00"}]},
        {"session_id": "sess2", "chat_history": [{"role": "assistant", "content": "Hello", "timestamp": "2024-01-01T00:00:01"}]}
    ])):
        resp = client.get("/history/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["total_sessions"] == 2
        assert data["total_messages"] == 2
        assert data["user_id"] == "user123"

def test_get_all_user_sessions_empty(client):
    with patch("app.api.routes.chat.get_all_user_sessions", new=AsyncMock(return_value=[])):
        resp = client.get("/history/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["total_sessions"] == 0
        assert data["total_messages"] == 0

def test_get_all_user_sessions_exception(client):
    with patch("app.api.routes.chat.get_all_user_sessions", new=AsyncMock(side_effect=Exception("fail"))):
        resp = client.get("/history/")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "fail" 