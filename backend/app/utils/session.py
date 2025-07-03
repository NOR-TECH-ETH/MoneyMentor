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
        # Store in the correct format matching actual database schema
        db_session_data = {
            "user_id": user_id,
            "chat_history": [],
            "quiz_history": [],
            "progress": {},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into database and get the generated id
        result = supabase.table("user_sessions").insert(db_session_data).execute()
        
        if not result.data:
            raise Exception("Failed to create session in database")
        
        # Get the created session with generated id
        created_session = result.data[0]
        actual_session_id = str(created_session["id"])  # Use the database id as session_id
        
        # Create session data in expected format
        session_data = {
            "session_id": actual_session_id,  # Use database id as session_id
            "user_id": user_id,
            "chat_history": [],
            "quiz_history": [],
            "progress": {},
            "created_at": created_session["created_at"],
            "updated_at": created_session["updated_at"]
        }
        
        # Store in cache immediately
        async with _cache_lock:
            _session_cache[actual_session_id] = session_data
        
        logger.info(f"Session created and stored in database: {actual_session_id}")
        return session_data
        
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise

async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session by ID with caching"""
    try:
        session_id_str = str(session_id)
        
        # Check cache first
        async with _cache_lock:
            if session_id_str in _session_cache:
                return _session_cache[session_id_str]
        
        # If not in cache, get from database using id column
        result = supabase.table("user_sessions").select("*").eq("id", session_id_str).execute()
        
        if result.data and len(result.data) > 0:
            # Convert database format to expected session format
            db_data = result.data[0]
            session_data = {
                "session_id": str(db_data["id"]),  # Use database id as session_id
                "user_id": db_data.get("user_id"),
                "chat_history": db_data.get("chat_history", []),
                "quiz_history": db_data.get("quiz_history", []),
                "progress": db_data.get("progress", {}),
                "created_at": db_data.get("created_at"),
                "updated_at": db_data.get("updated_at")
            }
            
            # Store in cache
            async with _cache_lock:
                _session_cache[session_id_str] = session_data
            return session_data
        
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
                result = supabase.table("user_sessions").select("*").eq("id", session_id).execute()
                if result.data and len(result.data) > 0:
                    db_data = result.data[0]
                    # Convert database format to session format
                    session_data = {
                        "session_id": str(db_data["id"]),
                        "user_id": db_data.get("user_id"),
                        "chat_history": db_data.get("chat_history", []),
                        "quiz_history": db_data.get("quiz_history", []),
                        "progress": db_data.get("progress", {}),
                        "created_at": db_data.get("created_at"),
                        "updated_at": db_data.get("updated_at")
                    }
                    session_data.update(data)
                    _session_cache[session_id] = session_data
                    updated_session = session_data
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
        # Update the session using id column
        update_data = {
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Map the data to the correct database columns
        if "chat_history" in data:
            update_data["chat_history"] = data["chat_history"]
        if "quiz_history" in data:
            update_data["quiz_history"] = data["quiz_history"]
        if "progress" in data:
            update_data["progress"] = data["progress"]
        
        supabase.table("user_sessions").update(update_data).eq("id", session_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update session in database: {e}")

async def _store_session_async(session_data: Dict[str, Any]):
    """Store session in database asynchronously"""
    try:
        # Store in the correct format matching actual database schema
        db_session_data = {
            "user_id": session_data.get("user_id", "default_user"),
            "chat_history": session_data.get("chat_history", []),
            "quiz_history": session_data.get("quiz_history", []),
            "progress": session_data.get("progress", {}),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        supabase.table("user_sessions").insert(db_session_data).execute()
    except Exception as e:
        logger.warning(f"Failed to store session in database: {e}")

async def delete_session(session_id: str) -> bool:
    """Delete session with cache cleanup"""
    try:
        # Remove from cache
        async with _cache_lock:
            _session_cache.pop(session_id, None)
        
        # Delete from database using id column
        result = supabase.table("user_sessions").delete().eq("id", session_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Failed to delete session: {e}")
        raise

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