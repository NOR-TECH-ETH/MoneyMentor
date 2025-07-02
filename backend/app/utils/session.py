from datetime import datetime, timedelta
import json
import uuid
from typing import Dict, Any, Optional
from app.core.database import get_supabase, supabase
import logging
import asyncio
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory session cache for faster access
_session_cache = {}
_cache_lock = asyncio.Lock()

async def create_session(session_id: str = None, user_id: str = "default_user") -> Dict[str, Any]:
    """Create a new session with caching"""
    try:
        session_data = {
            "user_id": user_id,
            "chat_history": [],
            "quiz_history": [],
            "progress": {},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # If session_id is provided and looks like a UUID, use it
        if session_id and len(session_id) == 36 and '-' in session_id:
            session_data["session_id"] = session_id
        else:
            session_data["session_id"] = str(uuid.uuid4())
        
        # Store in cache immediately
        async with _cache_lock:
            _session_cache[session_data["session_id"]] = session_data
        
        # OPTIMIZATION: Store in database synchronously for immediate availability
        try:
            supabase.table("user_sessions").insert(session_data).execute()
            logger.info(f"Session created and stored in database: {session_data['session_id']}")
        except Exception as db_error:
            logger.warning(f"Failed to store session in database: {db_error}")
            # Continue anyway since it's in cache
            
        return session_data
        
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise

async def _store_session_async(session_data: Dict[str, Any]):
    """Store session in database asynchronously"""
    try:
        supabase.table("user_sessions").insert(session_data).execute()
    except Exception as e:
        logger.warning(f"Failed to store session in database: {e}")

async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session by ID with caching"""
    try:
        session_id_str = str(session_id)
        
        # Check cache first
        async with _cache_lock:
            if session_id_str in _session_cache:
                return _session_cache[session_id_str]
        
        # If not in cache, get from database
        result = supabase.table("user_sessions").select("*").eq("session_id", session_id_str).single().execute()
        
        if result.data:
            # Store in cache
            async with _cache_lock:
                _session_cache[session_id_str] = result.data
            return result.data
        
        return None
        
    except Exception as e:
        logger.error(f"Failed to get session: {e}")
        return None

async def update_session(session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update session data with caching"""
    try:
        data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update cache immediately
        async with _cache_lock:
            if session_id in _session_cache:
                _session_cache[session_id].update(data)
                updated_session = _session_cache[session_id]
            else:
                # If not in cache, get from database first
                result = supabase.table("user_sessions").select("*").eq("session_id", session_id).single().execute()
                if result.data:
                    updated_session = result.data
                    updated_session.update(data)
                    _session_cache[session_id] = updated_session
                else:
                    raise ValueError(f"Session {session_id} not found")
        
        # Async database update (fire-and-forget)
        asyncio.create_task(_update_session_async(session_id, data))
        
        return updated_session
        
    except Exception as e:
        logger.error(f"Failed to update session: {e}")
        raise

async def _update_session_async(session_id: str, data: Dict[str, Any]):
    """Update session in database asynchronously"""
    try:
        supabase.table("user_sessions").update(data).eq("session_id", session_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update session in database: {e}")

async def add_chat_message(session_id: str, message: Dict[str, Any]) -> None:
    """Add a message to chat history with optimized caching"""
    try:
        # Update cache directly if available
        async with _cache_lock:
            if session_id in _session_cache:
                chat_history = _session_cache[session_id].get("chat_history", [])
                chat_history.append(message)
                _session_cache[session_id]["chat_history"] = chat_history
                _session_cache[session_id]["updated_at"] = datetime.utcnow().isoformat()
                
                # Async database update
                asyncio.create_task(_update_session_async(session_id, {
                    "chat_history": chat_history,
                    "updated_at": _session_cache[session_id]["updated_at"]
                }))
                return
        
        # Fallback to database if not in cache
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
    """Add a quiz response to history with optimized caching"""
    try:
        # Update cache directly if available
        async with _cache_lock:
            if session_id in _session_cache:
                quiz_history = _session_cache[session_id].get("quiz_history", [])
                quiz_history.append(quiz_data)
                _session_cache[session_id]["quiz_history"] = quiz_history
                _session_cache[session_id]["updated_at"] = datetime.utcnow().isoformat()
                
                # Async database update
                asyncio.create_task(_update_session_async(session_id, {
                    "quiz_history": quiz_history,
                    "updated_at": _session_cache[session_id]["updated_at"]
                }))
                return
        
        # Fallback to database if not in cache
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
    """Update session progress with optimized caching"""
    try:
        # Update cache directly if available
        async with _cache_lock:
            if session_id in _session_cache:
                current_progress = _session_cache[session_id].get("progress", {})
                current_progress.update(progress_data)
                _session_cache[session_id]["progress"] = current_progress
                _session_cache[session_id]["updated_at"] = datetime.utcnow().isoformat()
                
                # Async database update
                asyncio.create_task(_update_session_async(session_id, {
                    "progress": current_progress,
                    "updated_at": _session_cache[session_id]["updated_at"]
                }))
                return
        
        # Fallback to database if not in cache
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
    """Delete session with cache cleanup"""
    try:
        # Remove from cache
        async with _cache_lock:
            _session_cache.pop(session_id, None)
        
        # Delete from database
        result = supabase.table("user_sessions").delete().eq("session_id", session_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Failed to delete session: {e}")
        raise

async def clear_session_cache():
    """Clear the session cache (useful for testing or memory management)"""
    async with _cache_lock:
        _session_cache.clear()

def get_cache_stats():
    """Get cache statistics for monitoring"""
    return {
        "cache_size": len(_session_cache),
        "cached_sessions": list(_session_cache.keys())
    } 