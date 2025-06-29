from typing import Dict, Any, Optional
import logging
from datetime import datetime
import uuid
from fastapi import HTTPException
import json

from app.utils.session import get_session, create_session, add_chat_message, add_quiz_response, update_progress
from app.services.google_sheets_service import GoogleSheetsService

logger = logging.getLogger(__name__)

class ChatService:
    """Service for handling chat interactions"""
    
    def __init__(self):
        self.sheets_service = GoogleSheetsService()
        self.engagement_service = None  # Initialize lazily to avoid circular imports
    
    async def process_message(
        self,
        query: str,
        session_id: str
    ) -> Dict[str, Any]:
        """Process a chat message and return the response"""
        try:
            # Import here to avoid circular imports
            from app.agents.crew import money_mentor_crew
            
            # Get or create session
            session = await get_session(session_id)
            if not session:
                try:
                    # Create new session if it doesn't exist
                    session = await create_session(session_id)
                    if not session:
                        raise HTTPException(status_code=500, detail="Failed to create session")
                    logger.info(f"Created new session: {session_id}")
                except Exception as e:
                    logger.error(f"Failed to create session: {e}")
                    raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
            
            # Add user message to chat history
            await add_chat_message(session_id, {
                "role": "user",
                "content": query,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Get chat history for context
            chat_history = session.get("chat_history", [])
            # print(f"Chat history: {json.dumps(chat_history, indent=2)}")
            if not isinstance(chat_history, list):
                chat_history = []
            
            # Process message with CrewAI
            try:
                response = await money_mentor_crew.process_message(
                    message=query,
                    chat_history=chat_history,
                    session_id=session_id
                )
                
                # Ensure response is a dictionary
                if response is None:
                    response = {"message": "I apologize, but I couldn't generate a response."}
                elif not isinstance(response, dict):
                    response = {"message": str(response)}
                
                # Ensure message field exists
                if "message" not in response:
                    response["message"] = "I apologize, but I couldn't generate a proper response."
                
            except Exception as crew_error:
                logger.error(f"Crew processing failed: {crew_error}")
                response = {
                    "message": "I apologize, but I encountered an error processing your message. Please try again.",
                    "error": str(crew_error)
                }
            
            # Add assistant response to chat history
            await add_chat_message(session_id, {
                "role": "assistant",
                "content": response["message"],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Update progress if available
            if response.get("progress"):
                await update_progress(session_id, response["progress"])
            
            # Handle quiz if generated
            if response.get("quiz"):
                quiz_id = str(uuid.uuid4())
                quiz_data = response["quiz"]
                if isinstance(quiz_data, dict) and "questions" in quiz_data:
                    await add_quiz_response(session_id, {
                        "quiz_id": quiz_id,
                        "questions": quiz_data["questions"]
                    })
                    response["quiz"]["id"] = quiz_id
            
            # Add session_id to response
            response["session_id"] = session_id
            
            # Log chat interaction to Google Sheets
            try:
                # Extract user_id from session or use session_id as fallback
                user_id = session.get("user_id", session_id)
                
                # Log the chat message
                chat_log_data = {
                    "user_id": user_id,
                    "session_id": session_id,
                    "message_type": "user",
                    "message": query,
                    "response": response["message"]
                }
                self.sheets_service.log_chat_message(chat_log_data)
                
            except Exception as e:
                logger.warning(f"Failed to log chat message to Google Sheets: {e}")
                # Don't fail the main request if logging fails
            
            # Track engagement metrics (non-blocking)
            try:
                # Lazy initialization to avoid circular imports
                if self.engagement_service is None:
                    from app.services.engagement_service import EngagementService
                    self.engagement_service = EngagementService()
                
                # Run engagement tracking in background without waiting
                import asyncio
                asyncio.create_task(self._track_engagement_async(user_id, session_id))
                
            except Exception as e:
                logger.warning(f"Failed to initialize engagement tracking: {e}")
                # Don't fail the main request if engagement tracking initialization fails
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to process message: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process message: {str(e)}"
            )
    
    async def _track_engagement_async(self, user_id: str, session_id: str):
        """Track engagement metrics asynchronously with timeout protection"""
        try:
            # Set a timeout for engagement tracking
            import asyncio
            await asyncio.wait_for(
                self.engagement_service.track_session_engagement(user_id, session_id),
                timeout=10.0  # 10 second timeout
            )
            logger.info(f"Engagement tracking completed for user {user_id}")
            
        except asyncio.TimeoutError:
            logger.warning(f"Engagement tracking timed out for user {user_id}")
        except Exception as e:
            logger.warning(f"Engagement tracking failed for user {user_id}: {e}")
            # Don't raise the exception - this is background processing 