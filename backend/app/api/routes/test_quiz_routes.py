import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, status, HTTPException, Depends
from unittest.mock import AsyncMock, patch, MagicMock
from app.api.routes import quiz

app = FastAPI()
app.include_router(quiz.router)

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

mock_user = {"id": "user123"}
def override_get_current_active_user():
    return mock_user

app.dependency_overrides[quiz.get_current_active_user] = override_get_current_active_user

# --- /generate ---
def test_generate_quiz_diagnostic_success(client):
    req = {"session_id": "sess1", "quiz_type": "diagnostic", "topic": "Investing", "difficulty": "easy"}
    with patch("app.api.routes.quiz.get_session", new=AsyncMock(return_value={"session_id": "sess1", "chat_history": []})), \
         patch("app.api.routes.quiz.QuizService") as MockService:
        instance = MockService.return_value
        instance.generate_diagnostic_quiz = AsyncMock(return_value=[{"question": "Q?", "choices": {"a": "A"}, "correct_answer": "a", "explanation": "E", "topic": "Investing", "difficulty": "easy"}])
        resp = client.post("/generate", json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data["quiz_type"] == "diagnostic"
        assert data["questions"][0]["question"] == "Q?"

def test_generate_quiz_micro_success(client):
    req = {"session_id": "sess1", "quiz_type": "micro", "difficulty": "medium"}
    with patch("app.api.routes.quiz.get_session", new=AsyncMock(return_value={"session_id": "sess1", "chat_history": [{"role": "user", "content": "topic"}]})), \
         patch("app.api.routes.quiz.QuizService") as MockService:
        instance = MockService.return_value
        instance.extract_topic_from_message = MagicMock(return_value="topic")
        instance.generate_quiz_from_history = AsyncMock(return_value=[{"question": "Q?", "choices": {"a": "A"}, "correct_answer": "a", "explanation": "E"}])
        resp = client.post("/generate", json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data["quiz_type"] == "micro"
        assert data["questions"][0]["question"] == "Q?"

def test_generate_quiz_error(client):
    req = {"session_id": "sess1", "quiz_type": "diagnostic", "topic": "Investing"}
    with patch("app.api.routes.quiz.get_session", new=AsyncMock(side_effect=Exception("fail"))):
        resp = client.post("/generate", json=req)
        assert resp.status_code == 500
        assert "Failed to generate quiz" in resp.json()["detail"]

# --- /submit ---
def test_submit_quiz_success(client):
    req = {"user_id": "user123", "quiz_type": "micro", "responses": [{"quiz_id": "q1", "selected_option": "A", "correct": True, "topic": "Investing"}]}
    with patch("app.api.routes.quiz.get_supabase") as mock_supabase, \
         patch("app.api.routes.quiz._update_user_progress_from_batch", new=AsyncMock(return_value=True)), \
         patch.object(quiz, "google_sheets_service", MagicMock(service=True)):
        mock_supabase.return_value.table.return_value.insert.return_value.execute.return_value = MagicMock()
        resp = client.post("/submit", json=req)
        assert resp.status_code == 200
        assert resp.json()["success"] is True

def test_submit_quiz_error(client):
    req = {"user_id": "user123", "quiz_type": "micro", "responses": [{"quiz_id": "q1", "selected_option": "A", "correct": True, "topic": "Investing"}]}
    with patch("app.api.routes.quiz.get_supabase", side_effect=Exception("fail")):
        resp = client.post("/submit", json=req)
        assert resp.status_code == 500
        assert "Failed to submit quiz responses" in resp.json()["detail"]

# --- /history ---
def test_get_quiz_history_success(client):
    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [{"quiz_type": "micro"}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
    with patch("app.api.routes.quiz.get_supabase", return_value=mock_supabase):
        resp = client.get("/history")
        assert resp.status_code == 200
        assert resp.json()["user_id"] == "user123"

def test_get_quiz_history_error(client):
    with patch("app.api.routes.quiz.get_supabase", side_effect=Exception("fail")):
        resp = client.get("/history")
        assert resp.status_code == 500
        assert "Failed to get quiz history" in resp.json()["detail"]

# --- /history/session/{session_id} ---
def test_get_session_quiz_history_success(client):
    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [{"quiz_type": "micro"}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
    with patch("app.api.routes.quiz.get_supabase", return_value=mock_supabase):
        resp = client.get("/history/session/sess1")
        assert resp.status_code == 200
        assert resp.json()["session_id"] == "sess1"

def test_get_session_quiz_history_error(client):
    with patch("app.api.routes.quiz.get_supabase", side_effect=Exception("fail")):
        resp = client.get("/history/session/sess1")
        assert resp.status_code == 500
        assert "Failed to get session micro quiz history" in resp.json()["detail"]

# --- /history/course/{course_id} ---
def test_get_course_quiz_history_success(client):
    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [{"correct": True}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
    with patch("app.api.routes.quiz.get_supabase", return_value=mock_supabase):
        resp = client.get("/history/course/c1")
        assert resp.status_code == 200
        assert resp.json()["course_id"] == "c1"

def test_get_course_quiz_history_error(client):
    with patch("app.api.routes.quiz.get_supabase", side_effect=Exception("fail")):
        resp = client.get("/history/course/c1")
        assert resp.status_code == 500
        assert "Failed to get course quiz history" in resp.json()["detail"]

# --- /session/ ---
def test_create_new_session_success(client):
    with patch("app.api.routes.quiz.create_session", new=AsyncMock(return_value={"session_id": "sess1", "user_id": "user123"})):
        resp = client.post("/session/")
        assert resp.status_code == 200
        assert resp.json()["session_id"] == "sess1" 