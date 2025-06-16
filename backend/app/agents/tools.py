from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
import logging
from datetime import datetime
from supabase import Client

from app.services.quiz_service import QuizService
from app.services.calculation_service import CalculationService
from app.services.content_service import ContentService
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

# Define allowed session keys
ALLOWED_SESSION_KEYS = {
    "conversation_history",
    "quiz_context",
    "current_topic",
    "last_interaction",
    "user_preferences"
}

class QuizGeneratorTool(BaseTool):
    """Tool for generating educational quizzes based on context."""
    
    name: str = "Quiz Generator"
    description: str = "Generates educational quizzes based on the given context. Input: topic or concept to quiz about"
    
    class ArgsSchema(BaseModel):
        context: str = Field(..., description="Topic or concept to generate quiz about")
    
    quiz_service: QuizService = Field(default_factory=QuizService)
    
    async def _run(self, context: str) -> Dict[str, Any]:
        try:
            questions = await self.quiz_service.generate_quiz(context)
            return {
                "success": True,
                "questions": questions
            }
        except Exception as e:
            logger.error(f"Failed to generate quiz: {e}")
            return {
                "success": False,
                "error": str(e),
                "details": "Failed to generate quiz"
            }

class QuizLoggerTool(BaseTool):
    """Tool for logging quiz responses and updating user progress."""
    
    name: str = "Quiz Logger"
    description: str = "Logs quiz responses and updates user progress. Input: quiz_id and responses"
    
    class ArgsSchema(BaseModel):
        quiz_id: str = Field(..., description="ID of the quiz")
        responses: List[Dict[str, Any]] = Field(..., description="List of user responses")
    
    quiz_service: QuizService = Field(default_factory=QuizService)
    
    async def _run(self, quiz_id: str, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        try:
            success = await self.quiz_service.log_quiz_response(quiz_id, responses)
            return {
                "success": success,
                "quiz_id": quiz_id
            }
        except Exception as e:
            logger.error(f"Failed to log quiz responses: {e}")
            return {
                "success": False,
                "error": str(e),
                "details": "Failed to log quiz responses"
            }

class FinancialCalculatorTool(BaseTool):
    """Tool for calculating financial metrics."""
    
    name: str = "Financial Calculator"
    description: str = "Calculates financial metrics like ROI, NPV, or loan payments. Input: JSON with calculation_type and params"
    
    class ArgsSchema(BaseModel):
        calculation_type: str = Field(..., description="Type of calculation (roi, npv, pmt)")
        params: Dict[str, Any] = Field(..., description="Calculation parameters")
    
    calc_service: CalculationService = Field(default_factory=CalculationService)
    
    async def _run(self, calculation_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            result = await self.calc_service.calculate(calculation_type, params)
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            logger.error(f"Failed to perform calculation: {e}")
            return {
                "success": False,
                "error": str(e),
                "details": "Failed to perform calculation"
            }

class ContentRetrievalTool(BaseTool):
    """Tool for retrieving relevant educational content."""
    
    name: str = "Content Retriever"
    description: str = "Retrieves relevant educational content based on query. Input: search query and optional limit"
    
    class ArgsSchema(BaseModel):
        query: str = Field(
            ...,
            description="Search query",
            json_schema_extra={"example": "investment strategies"}
        )
        limit: int = Field(
            default=5,
            description="Maximum number of results to return",
            json_schema_extra={"minimum": 1, "maximum": 20}
        )
        
        model_config = {
            "extra": "allow",
            "validate_assignment": True
        }
    
    content_service: ContentService = Field(default_factory=ContentService)
    
    async def _run(self, query: str, limit: int = 5) -> Dict[str, Any]:
        """Run the content retrieval tool with robust error handling"""
        try:
            if not query or not isinstance(query, str):
                return {
                    "success": False,
                    "error": "Invalid query parameter",
                    "details": "Query must be a non-empty string"
                }
            
            # Ensure limit is a positive integer
            try:
                limit = int(limit)
                if limit < 1:
                    limit = 5
            except (ValueError, TypeError):
                limit = 5
            
            # Attempt to retrieve content
            content = await self.content_service.search_content(query)
            
            # Limit results if needed
            if limit and isinstance(content, list):
                content = content[:limit]
            
            return {
                "success": True,
                "content": content,
                "query_info": {
                    "query": query,
                    "limit": limit,
                    "result_count": len(content) if isinstance(content, list) else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Content retrieval failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "Failed to retrieve content",
                "query_info": {
                    "query": query,
                    "limit": limit,
                    "error_type": type(e).__name__
                }
            }

class SessionManagerTool(BaseTool):
    """Tool for managing user session data."""
    
    name: str = "Session Manager"
    description: str = "Manages user session data including conversation history and preferences"
    
    class ArgsSchema(BaseModel):
        user_id: str = Field(..., description="User ID")
        action: str = Field(..., description="Action to perform (get/update)")
        data: Optional[Dict[str, Any]] = Field(None, description="Data to update")
    
    supabase: Client = Field(default_factory=get_supabase)
    
    async def _run(self, user_id: str, action: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            if action == "get":
                result = self.supabase.table('sessions').select('*').eq('user_id', user_id).execute()
                if not result.data:
                    return {
                        "success": True,
                        "data": {}
                    }
                return {
                    "success": True,
                    "data": result.data[0]['data'] if result.data else {}
                }
            elif action == "update" and data:
                # Filter allowed keys
                filtered_data = {k: v for k, v in data.items() if k in ALLOWED_SESSION_KEYS}
                current_data = await self._get_session(user_id)
                current_data.update(filtered_data)
                
                # Convert any UUID objects to strings in the data
                serialized_data = self._serialize_data(current_data)
                
                # Update in database
                self.supabase.table('sessions').upsert({
                    'user_id': user_id,
                    'data': serialized_data,
                    'updated_at': datetime.utcnow().isoformat()
                }).execute()
                
                return {
                    "success": True,
                    "data": serialized_data
                }
            else:
                return {
                    "success": False,
                    "error": "Invalid action or missing data",
                    "details": "Action must be 'get' or 'update' with data"
                }
        except Exception as e:
            logger.error(f"Failed to manage session: {e}")
            return {
                "success": False,
                "error": str(e),
                "details": "Failed to manage session"
            }
    
    async def _get_session(self, user_id: str) -> Dict[str, Any]:
        result = self.supabase.table('sessions').select('*').eq('user_id', user_id).execute()
        if not result.data:
            return {}
        return result.data[0]['data'] if result.data else {}
    
    def _serialize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert UUID objects to strings in the data dictionary"""
        serialized = {}
        for key, value in data.items():
            if isinstance(value, dict):
                serialized[key] = self._serialize_data(value)
            elif hasattr(value, 'hex'):  # Check if it's a UUID
                serialized[key] = str(value)
            else:
                serialized[key] = value
        return serialized

class ProgressTrackerTool(BaseTool):
    """Tool for tracking and analyzing user learning progress."""
    
    name: str = "Progress Tracker"
    description: str = "Tracks and analyzes user learning progress"
    
    class ArgsSchema(BaseModel):
        user_id: str = Field(..., description="User ID")
        action: str = Field(..., description="Action to perform (get/update)")
        data: Optional[Dict[str, Any]] = Field(None, description="Progress data to update")
    
    supabase: Client = Field(default_factory=get_supabase)
    
    async def _run(self, user_id: str, action: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            if action == "get":
                result = self.supabase.table('user_progress').select('*').eq('user_id', user_id).execute()
                return {
                    "success": True,
                    "data": result.data[0] if result.data else {}
                }
            elif action == "update" and data:
                # Update in database
                self.supabase.table('user_progress').upsert({
                    'user_id': user_id,
                    **data,
                    'updated_at': datetime.utcnow().isoformat()
                }).execute()
                
                return {
                    "success": True,
                    "data": data
                }
            else:
                return {
                    "success": False,
                    "error": "Invalid action or missing data",
                    "details": "Action must be 'get' or 'update' with data"
                }
        except Exception as e:
            logger.error(f"Failed to track progress: {e}")
            return {
                "success": False,
                "error": str(e),
                "details": "Failed to track progress"
            } 