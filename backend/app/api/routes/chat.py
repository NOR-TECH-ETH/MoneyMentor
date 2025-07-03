from fastapi import APIRouter, HTTPException, Depends, Request, Cookie
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import uuid
import time
import json
from fastapi.responses import StreamingResponse
import asyncio


from app.core.config import settings
from app.core.auth import get_current_active_user
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
from app.agents.function import money_mentor_function

router = APIRouter()
logger = logging.getLogger(__name__)
content_service = ContentService()

def get_chat_service() -> ChatService:
    """Get ChatService instance"""
    return ChatService()

@router.post("/message")
async def process_message(
    request: ChatMessageRequest,
    current_user: dict = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service)
) -> Dict[str, Any]:
    """Process a chat message and return the response"""
    start_time = time.time()
    print(f"\n🚀 CHAT ENDPOINT STARTED: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
    
    try:
        # Step 1: ChatService instantiation timing
        step1_start = time.time()
        print(f"   📋 Step 1: ChatService instantiation...")
        
        # ChatService is already instantiated via dependency injection
        step1_time = time.time() - step1_start
        print(f"   ✅ Step 1 completed in {step1_time:.3f}s")
        
        # Step 2: Process message timing
        step2_start = time.time()
        print(f"   🤖 Step 2: Processing message with ChatService...")
        response = await chat_service.process_message(
            query=request.query,
            session_id=request.session_id,
            user_id=current_user["id"]
        )
        step2_time = time.time() - step2_start
        print(f"   ✅ Step 2 completed in {step2_time:.3f}s (ChatService processing)")
        
        # Step 3: Response validation timing
        step3_start = time.time()
        print(f"   🔍 Step 3: Validating response...")
        
        # Validate response
        if not isinstance(response, dict):
            raise HTTPException(status_code=500, detail="Invalid response format")
            
        # Ensure required fields
        if "message" not in response:
            raise HTTPException(status_code=500, detail="Missing message in response")
        
        step3_time = time.time() - step3_start
        print(f"   ✅ Step 3 completed in {step3_time:.3f}s (Response validation)")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        total_time = time.time() - start_time
        print(f"❌ CHAT ENDPOINT FAILED after {total_time:.3f}s: {e}")
        logger.error(f"Failed to process message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/message/stream")
async def process_message_streaming(
    request: ChatMessageRequest,
    current_user: dict = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Process a chat message with streaming response for better UX"""
    start_time = time.time()
    print(f"\n🚀 CHAT STREAMING ENDPOINT STARTED: {datetime.now().strftime('%H:%M:%S.%f')[:-3]}")
    
    try:
        # Step 1: Get session and chat history (single fetch)
        print(f"   📋 Step 1: Getting session and chat history...")
        session = await get_session(request.session_id)
        if not session:
            session = await create_session(request.session_id)
            if not session:
                raise HTTPException(status_code=500, detail="Failed to create session for streaming")
        
        chat_history = session.get("chat_history", [])
        
        # Step 2: Get streaming response from LLM (single LLM call)
        print(f"   🔄 Step 2: Getting streaming response from LLM...")
        streaming_response = await money_mentor_function.process_and_stream(
            query=request.query,
            session_id=request.session_id,
            user_id=current_user["id"],
            skip_background_tasks=True,  # Skip background tasks in MoneyMentorFunction
            pre_fetched_session=session,  # Pass pre-fetched session to avoid duplicate fetch
            pre_fetched_history=chat_history  # Pass pre-fetched history to avoid duplicate fetch
        )
        
        # Step 3: Create a wrapper that collects the full response for background tasks
        print(f"   🔧 Step 3: Creating response wrapper for background tasks...")
        
        async def wrapped_streaming_response():
            collected_response = []
            
            # Get the original generator from the streaming response
            original_generator = streaming_response.body_iterator
            
            # Collect and yield tokens
            async for token in original_generator:
                collected_response.append(token.decode('utf-8'))
                yield token
            
            # After streaming is complete, handle background tasks
            full_response = ''.join(collected_response)
            
            # Handle background tasks with the complete response
            asyncio.create_task(chat_service._handle_background_tasks_only(
                query=request.query,
                session_id=request.session_id,
                user_id=current_user["id"],
                response_message=full_response,
                session=session,
                chat_history=chat_history
            ))
        
        # Return the wrapped streaming response
        final_response = StreamingResponse(
            wrapped_streaming_response(),
            media_type="text/plain",
            headers=streaming_response.headers
        )
        
        total_time = time.time() - start_time
        print(f"🏁 CHAT STREAMING ENDPOINT COMPLETED in {total_time:.3f}s")
        print(f"   ✅ Single LLM call with true streaming")
        print(f"   ✅ Background tasks handled after streaming completes")
        print(f"   ✅ No duplicate operations or database conflicts")
        
        return final_response
        
    except Exception as e:
        total_time = time.time() - start_time
        print(f"❌ CHAT STREAMING ENDPOINT FAILED after {total_time:.3f}s: {e}")
        logger.error(f"Failed to process streaming message: {e}")
        
        error_response = {
            "type": "error",
            "message": "I apologize, but I encountered an error processing your request. Please try again.",
            "session_id": request.session_id,
            "error": str(e)
        }
        
        return StreamingResponse(
            iter([f"data: {json.dumps(error_response)}\n\ndata: {json.dumps({'type': 'stream_end'})}\n\n"]),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )

@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    chat_service: ChatService = Depends(get_chat_service)
) -> Dict[str, Any]:
    """Get chat history for a session"""
    try:
        session = await get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        chat_history = session.get("chat_history", [])
        
        return {
            "session_id": session_id,
            "chat_history": chat_history,
            "message_count": len(chat_history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{session_id}")
async def clear_chat_history(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
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

# Performance endpoint removed - performance_monitor module not available 