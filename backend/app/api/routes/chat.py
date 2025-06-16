from fastapi import APIRouter, HTTPException, Depends, Request, Cookie
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import uuid

from app.agents.crew import money_mentor_crew
from app.core.config import settings
from app.utils.session import (
    create_session,
    get_session,
    add_chat_message,
    add_quiz_response,
    update_progress,
    update_session
)
from app.services.content_service import ContentService
from app.models.schemas import ChatMessageRequest
from app.services.chat_service import ChatService

router = APIRouter()
logger = logging.getLogger(__name__)
content_service = ContentService()

def get_chat_service() -> ChatService:
    """Get ChatService instance"""
    return ChatService()

@router.post("/message")
async def process_message(
    request: ChatMessageRequest,
    chat_service: ChatService = Depends(get_chat_service)
) -> Dict[str, Any]:
    """Process a chat message and return the response"""
    try:
        # Process message
        response = await chat_service.process_message(
            query=request.query,
            session_id=request.session_id
        )
        
        # Validate response
        if not isinstance(response, dict):
            raise HTTPException(status_code=500, detail="Invalid response format")
            
        # Ensure required fields
        if "message" not in response:
            raise HTTPException(status_code=500, detail="Missing message in response")
            
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    try:
        session = await get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        return {
            "chat_history": session.get("chat_history", []),
            "quiz_history": session.get("quiz_history", [])
        }
        
    except Exception as e:
        logger.error(f"Failed to get chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{session_id}")
async def clear_chat_history(session_id: str):
    """Clear chat history for a session"""
    try:
        session = await get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Update session with empty history
        await update_session(session_id, {
            "chat_history": [],
            "quiz_history": []
        })
        
        return {"status": "success", "message": "Chat history cleared"}
        
    except Exception as e:
        logger.error(f"Failed to clear chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 