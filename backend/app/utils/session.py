from datetime import datetime, timedelta
import json
import uuid
from typing import Dict, Any, Optional
from app.core.database import get_supabase, supabase
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

async def create_session(session_id: str) -> Dict[str, Any]:
    """Create a new session"""
    try:
        # Convert session_id to string if it's a UUID
        session_id_str = str(session_id)
        
        session_data = {
            "id": session_id_str,
            "user_id": "default_user",  # Default user ID for development
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "chat_history": [],
            "quiz_history": [],
            "progress": {}
        }
        
        result = supabase.table("user_sessions").insert(session_data).execute()
        if not result.data:
            raise ValueError("Failed to create session")
            
        return session_data
        
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise

async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session by ID"""
    try:
        # Convert session_id to string if it's a UUID
        session_id_str = str(session_id)
        result = supabase.table("user_sessions").select("*").eq("id", session_id_str).single().execute()
        return result.data if result.data else None
        
    except Exception as e:
        logger.error(f"Failed to get session: {e}")
        return None

async def update_session(session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update session data"""
    try:
        data["updated_at"] = datetime.utcnow().isoformat()
        result = supabase.table("user_sessions").update(data).eq("id", session_id).execute()
        
        if not result.data:
            raise ValueError(f"Failed to update session {session_id}")
            
        return result.data[0]
        
    except Exception as e:
        logger.error(f"Failed to update session: {e}")
        raise

async def add_chat_message(session_id: str, message: Dict[str, Any]) -> None:
    """Add a message to chat history"""
    try:
        session = await get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
            
        chat_history = session.get("chat_history", [])
        chat_history.append(message)
        
        await update_session(session_id, {"chat_history": chat_history})
        
    except Exception as e:
        logger.error(f"Failed to add chat message: {e}")
        raise

async def add_quiz_response(session_id: str, quiz_data: Dict[str, Any]) -> None:
    """Add a quiz response to history"""
    try:
        session = await get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
            
        quiz_history = session.get("quiz_history", [])
        quiz_history.append(quiz_data)
        
        await update_session(session_id, {"quiz_history": quiz_history})
        
    except Exception as e:
        logger.error(f"Failed to add quiz response: {e}")
        raise

async def update_progress(session_id: str, progress_data: Dict[str, Any]) -> None:
    """Update session progress"""
    try:
        session = await get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
            
        current_progress = session.get("progress", {})
        current_progress.update(progress_data)
        
        await update_session(session_id, {"progress": current_progress})
        
    except Exception as e:
        logger.error(f"Failed to update progress: {e}")
        raise

async def delete_session(session_id: str) -> bool:
    """Delete session"""
    try:
        result = supabase.table("user_sessions").delete().eq("id", session_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Failed to delete session: {e}")
        raise 