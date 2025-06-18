from typing import Dict, Any, Optional
import logging
from datetime import datetime
import uuid
from fastapi import HTTPException
import json

from app.agents.crew import money_mentor_crew
from app.utils.session import get_session, create_session, add_chat_message, add_quiz_response, update_progress

logger = logging.getLogger(__name__)

class ChatService:
    """Service for handling chat interactions"""
    
    async def process_message(
        self,
        query: str,
        session_id: str
    ) -> Dict[str, Any]:
        """Process a chat message and return the response"""
        try:
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
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to process message: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process message: {str(e)}"
            ) 