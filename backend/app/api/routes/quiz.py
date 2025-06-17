from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.models.schemas import QuizRequest, QuizResponse, QuizAttempt, QuizAttemptResponse
from app.agents.crew import money_mentor_crew
from app.services.quiz_service import QuizService
from app.core.database import get_supabase
from datetime import datetime
from app.utils.session import get_session, create_session

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """Generate a quiz using CrewAI quiz master agent"""
    try:
        session = await get_session(request.session_id)
        if not session:
            # If session does not exist, create it (frontend always provides a valid session_id)
            session = await create_session(request.session_id)
        chat_history = session.get("chat_history", [])

        quiz_service = QuizService()
        quiz_id = f"quiz_{request.session_id}_{datetime.utcnow().timestamp()}"

        if not chat_history:
            # No chat history: generate diagnostic quiz (10 questions) from knowledge base
            diagnostic_questions = await quiz_service.generate_diagnostic_quiz()
            # Convert to required structure (choices, correct_answer as str, etc.)
            processed_questions = []
            for q in diagnostic_questions:
                processed_questions.append({
                    'question': q.get('question', ''),
                    'choices': q.get('choices', {}),
                    'correct_answer': q.get('correct_answer', ''),
                    'explanation': q.get('explanation', '')
                })
            return QuizResponse(
                questions=processed_questions,
                quiz_id=quiz_id,
                quiz_type=request.quiz_type
            )
        else:
            # Chat history exists: generate a single micro-quiz question about the most recent topic
            # user_messages = "\n".join([msg["content"] for msg in chat_history if msg.get("role") == "user"])
            questions = await quiz_service.generate_quiz_from_history(
                session_id=request.session_id,
                quiz_type=request.quiz_type.value,
                difficulty=request.difficulty or "medium",
                chat_history=chat_history
            )
            # Only return the first question for micro-quiz
            return QuizResponse(
                questions=questions[:1],
                quiz_id=quiz_id,
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