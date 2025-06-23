from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging
import uuid

from app.models.schemas import QuizRequest, QuizResponse, QuizAttempt, QuizAttemptResponse, QuizSubmission, QuizSubmissionBatch
from app.agents.crew import money_mentor_crew
from app.services.quiz_service import QuizService
from app.services.google_sheets_service import GoogleSheetsService
from app.core.database import get_supabase
from datetime import datetime
from app.utils.session import get_session, create_session

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize Google Sheets service
google_sheets_service = GoogleSheetsService()

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """Generate a quiz using CrewAI quiz master agent"""
    try:
        session = await get_session(request.session_id)
        if not session:
            logger.debug("creating new session✅session✅session✅session✅session✅")
            # If session does not exist, create it (frontend always provides a valid session_id)
            session = await create_session(request.session_id)
        chat_history = session.get("chat_history", [])

        quiz_service = QuizService()
        quiz_id = f"quiz_{request.session_id}_{datetime.utcnow().timestamp()}"
        print(f"{chat_history} ✅session✅session✅session✅session✅")
        
        # Check if topic is provided in request to determine quiz type
        if request.topic:
            # Topic provided: generate diagnostic quiz (10 questions) focused on the specific topic
            difficulty = request.difficulty if request.difficulty else "mixed"
            diagnostic_questions = await quiz_service.generate_diagnostic_quiz(topic=request.topic, difficulty=difficulty)
            # Convert to required structure (choices, correct_answer as str, etc.)
            processed_questions = []
            for q in diagnostic_questions:
                processed_questions.append({
                    'question': q.get('question', ''),
                    'choices': q.get('choices', {}),
                    'correct_answer': q.get('correct_answer', ''),
                    'explanation': q.get('explanation', ''),
                    'topic': q.get('topic', ''),  # Include topic for diagnostic quiz
                    'difficulty': q.get('difficulty', difficulty)  # Include difficulty
                })
            return QuizResponse(
                questions=processed_questions,
                quiz_id=quiz_id,
                quiz_type=request.quiz_type,
                topic=request.topic  # Include topic for diagnostic quiz
            )
        else:
            # No topic provided: generate micro-quiz question about the most recent topic from chat history
            # Extract topic from chat history for micro quiz
            recent_messages = [msg for msg in chat_history if msg.get("role") == "user"]
            if recent_messages:
                topic = quiz_service.extract_topic_from_message(recent_messages[-1].get("content", ""))
            else:
                topic = "General Finance"
            
            questions = await quiz_service.generate_quiz_from_history(
                session_id=request.session_id,
                topic=topic,
                quiz_type=request.quiz_type.value,
                difficulty=request.difficulty or "medium",
                chat_history=chat_history
            )
            # Only return the first question for micro-quiz
            return QuizResponse(
                questions=questions[:1],
                quiz_id=quiz_id,
                quiz_type=request.quiz_type
                # Don't include topic for micro quiz response
            )
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate quiz")

@router.post("/submit", response_model=Dict[str, Any])
async def submit_quiz(quiz_batch: QuizSubmissionBatch):
    """
    Submit one or more quiz responses at once (for both micro and diagnostic quizzes)
    
    Expected payload:
    {
        "user_id": "string",
        "quiz_type": "micro" or "diagnostic",
        "responses": [
            {
                "quiz_id": "quiz_1",
                "selected_option": "B",
                "correct": true,
                "topic": "Investing"
            },
            ...
        ]
    }
    """
    try:
        supabase = get_supabase()
        
        # 1. Prepare batch data for quiz_responses table
        quiz_responses_batch = []
        topic_stats = {}  # Track stats for user_progress update
        
        for response in quiz_batch.responses:
            quiz_response_data = {
                "user_id": quiz_batch.user_id,
                "quiz_id": response["quiz_id"],
                "topic": response["topic"],
                "selected": response["selected_option"],
                "correct": response["correct"],
                "quiz_type": quiz_batch.quiz_type,
                "score": 100.0 if response["correct"] else 0.0
            }
            quiz_responses_batch.append(quiz_response_data)
            
            # Track topic statistics
            topic = response["topic"]
            if topic not in topic_stats:
                topic_stats[topic] = {"total": 0, "correct": 0}
            topic_stats[topic]["total"] += 1
            if response["correct"]:
                topic_stats[topic]["correct"] += 1
        
        # 2. Insert all quiz responses in batch
        if quiz_responses_batch:
            supabase.table('quiz_responses').insert(quiz_responses_batch).execute()
        
        # 3. Update user_progress table with aggregated stats
        await _update_user_progress_from_batch(quiz_batch.user_id, quiz_batch.quiz_type, topic_stats)
        
        # 4. Log to Google Sheets (for client access)
        if google_sheets_service.service:
            try:
                # Prepare data for Google Sheets (client schema)
                sheets_data = []
                for response in quiz_batch.responses:
                    sheets_data.append({
                        'user_id': quiz_batch.user_id,
                        'quiz_id': response["quiz_id"],
                        'topic': response["topic"],
                        'selected': response["selected_option"],
                        'correct': response["correct"]
                    })
                
                # Log to Google Sheets
                if len(sheets_data) == 1:
                    google_sheets_service.log_quiz_response(sheets_data[0])
                else:
                    google_sheets_service.log_multiple_responses(sheets_data)
                
                logger.info(f"Quiz responses logged to Google Sheets for user {quiz_batch.user_id}")
                
            except Exception as e:
                logger.error(f"Failed to log to Google Sheets: {e}")
                # Don't fail the entire request if Google Sheets fails
        else:
            logger.warning("Google Sheets service not available - quiz responses not logged to client sheet")
        
        # 5. Calculate overall results
        total_responses = len(quiz_batch.responses)
        correct_responses = sum(1 for r in quiz_batch.responses if r["correct"])
        overall_score = (correct_responses / total_responses * 100) if total_responses > 0 else 0
        
        logger.info(f"Quiz submission(s) successful for user {quiz_batch.user_id}: {correct_responses}/{total_responses} correct")
        
        # 6. Prepare Google Sheets URL for user access
        google_sheets_url = "https://docs.google.com/spreadsheets/d/1dj0l7UBaG-OkQKtSfrlf_7uDdhJu7g65OapGeKgC6bs/edit?gid=1325423234#gid=1325423234"
        
        return {
            "success": True,
            "message": f"Quiz submission(s) successful: {correct_responses}/{total_responses} correct",
            "data": {
                "user_id": quiz_batch.user_id,
                "quiz_type": quiz_batch.quiz_type,
                "total_responses": total_responses,
                "correct_responses": correct_responses,
                "overall_score": overall_score,
                "topic_breakdown": topic_stats,
                "google_sheets_logged": google_sheets_service.service is not None,
                "google_sheets_url": google_sheets_url
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to submit quiz responses: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit quiz responses: {str(e)}")

async def _update_user_progress_from_batch(user_id: str, quiz_type: str, topic_stats: Dict[str, Dict[str, int]]) -> bool:
    """
    Update user_progress table based on batch quiz results
    
    Args:
        user_id: User identifier
        quiz_type: Type of quiz
        topic_stats: Dictionary with topic statistics {"topic": {"total": X, "correct": Y}}
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        supabase = get_supabase()
        
        # Get current progress
        result = supabase.table('user_progress').select('*').eq('user_id', user_id).execute()
        current_progress = result.data[0] if result.data else {}
        
        # Update quiz scores
        quiz_scores = current_progress.get('quiz_scores', {})
        if quiz_type not in quiz_scores:
            quiz_scores[quiz_type] = {'total': 0, 'correct': 0, 'topics': {}}
        
        # Update topics covered
        topics_covered = current_progress.get('topics_covered', {})
        
        # Process each topic from the batch
        for topic, stats in topic_stats.items():
            total = stats["total"]
            correct = stats["correct"]
            
            # Update quiz scores for this quiz type
            quiz_scores[quiz_type]['total'] += total
            quiz_scores[quiz_type]['correct'] += correct
            
            # Update topic-specific scores
            if topic not in quiz_scores[quiz_type]['topics']:
                quiz_scores[quiz_type]['topics'][topic] = {'total': 0, 'correct': 0}
            
            quiz_scores[quiz_type]['topics'][topic]['total'] += total
            quiz_scores[quiz_type]['topics'][topic]['correct'] += correct
            
            # Update topics covered
            if topic not in topics_covered:
                topics_covered[topic] = {
                    'first_seen': datetime.utcnow().isoformat(),
                    'total_attempts': 0,
                    'correct_attempts': 0
                }
            
            topics_covered[topic]['total_attempts'] += total
            topics_covered[topic]['correct_attempts'] += correct
        
        # Calculate overall score for this quiz type
        total_attempts = quiz_scores[quiz_type]['total']
        correct_attempts = quiz_scores[quiz_type]['correct']
        overall_score = (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0
        
        # Update strengths and weaknesses based on performance
        strengths = []
        weaknesses = []
        recommendations = []
        
        for topic_name, topic_data in topics_covered.items():
            topic_accuracy = topic_data['correct_attempts'] / topic_data['total_attempts'] if topic_data['total_attempts'] > 0 else 0
            if topic_accuracy >= 0.7:  # 70% or higher
                strengths.append(topic_name)
            elif topic_accuracy < 0.5:  # Below 50%
                weaknesses.append(topic_name)
                recommendations.append(f"Review {topic_name} concepts")
        
        # Prepare progress data
        progress_data = {
            'user_id': user_id,
            'quiz_scores': quiz_scores,
            'topics_covered': topics_covered,
            'last_activity': datetime.utcnow().isoformat(),
            'last_quiz_type': quiz_type,
            'last_quiz_score': overall_score,
            'last_quiz_date': datetime.utcnow().isoformat(),
            'strengths': strengths,
            'weaknesses': weaknesses,
            'recommendations': recommendations,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Upsert to database
        supabase.table('user_progress').upsert(progress_data).execute()
        
        logger.info(f"User progress updated for user {user_id} from batch submission")
        return True
        
    except Exception as e:
        logger.error(f"Failed to update user progress from batch: {e}")
        return False

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

@router.post("/session/")
async def create_new_session():
    """Create a new user session and return session data"""
    session_id = str(uuid.uuid4())
    session = await create_session(session_id)
    return session 