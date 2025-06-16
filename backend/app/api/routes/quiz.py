from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.models.schemas import QuizRequest, QuizResponse, QuizAttempt, QuizAttemptResponse
from app.agents.crew import money_mentor_crew
from app.services.quiz_service import QuizService
from app.core.database import get_supabase
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """Generate a quiz using CrewAI quiz master agent"""
    try:
        # Create quiz crew
        quiz_crew = money_mentor_crew.create_quiz_crew(
            topic=request.topic or "general",
            quiz_type=request.quiz_type.value,
            user_id=request.user_id
        )
        
        # Execute the crew
        result = quiz_crew.kickoff()
        
        # Parse result (in production, this would be properly structured)
        return QuizResponse(
            questions=result,  # This would be parsed from crew result
            quiz_id=f"quiz_{request.user_id}_{datetime.utcnow().timestamp()}",
            quiz_type=request.quiz_type
        )
        
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate quiz")

@router.post("/submit", response_model=QuizAttemptResponse)
async def submit_quiz_answer(attempt: QuizAttempt):
    """Submit and validate a quiz answer"""
    try:
        quiz_service = QuizService()
        
        # Get question data (in production, retrieve from database)
        # For now, we'll simulate validation
        is_correct = True  # This would be actual validation
        
        # Log the attempt using CrewAI tools
        supabase = get_supabase()
        supabase.table('quiz_responses').insert({
            'user_id': attempt.user_id,
            'quiz_id': attempt.quiz_id,
            'question_id': attempt.question_id,
            'selected_option': attempt.selected_option,
            'correct': is_correct,
            'topic_tag': attempt.topic_tag,
            'timestamp': datetime.utcnow().isoformat()
        }).execute()
        
        return QuizAttemptResponse(
            correct=is_correct,
            explanation="Great job! This demonstrates your understanding of the concept.",
            correct_answer=attempt.selected_option if is_correct else 0
        )
        
    except Exception as e:
        logger.error(f"Quiz submission failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit quiz answer")

@router.get("/history/{user_id}")
async def get_quiz_history(user_id: str):
    """Get user's quiz history and performance"""
    try:
        # Create progress crew to analyze user performance
        progress_crew = money_mentor_crew.create_progress_crew(user_id)
        result = progress_crew.kickoff()
        
        return {
            "user_id": user_id,
            "progress_analysis": result
        }
        
    except Exception as e:
        logger.error(f"Quiz history retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get quiz history") 