from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging
import uuid

from app.models.schemas import QuizRequest, QuizResponse, QuizAttempt, QuizAttemptResponse, QuizSubmission, QuizSubmissionBatch, CourseRecommendation
from app.agents.crew import money_mentor_crew
from app.services.quiz_service import QuizService
from app.services.google_sheets_service import GoogleSheetsService
from app.services.content_service import ContentService
from app.services.course_service import CourseService
from app.core.database import get_supabase
from app.core.auth import get_current_active_user
from datetime import datetime
from app.utils.session import get_session, create_session
from app.utils.user_validation import require_authenticated_user_id, sanitize_user_id_for_logging
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage
from app.core.config import settings
import json

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize Google Sheets service
google_sheets_service = GoogleSheetsService()

# Initialize LLM for course generation
course_llm = ChatOpenAI(
    model=settings.OPENAI_MODEL_GPT4_MINI,
    api_key=settings.OPENAI_API_KEY,
    temperature=0.7
)

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate a quiz using CrewAI quiz master agent"""
    try:
        session = await get_session(request.session_id)
        if not session:
            logger.debug("creating new session✅session✅session✅session✅session✅")
            logger.debug(f"Session ID from request: {request.session_id}")
            logger.debug(f"User ID from token: {current_user['id']}")
            # If session does not exist, create it with the actual user_id
            # Validate user_id is a real UUID from authentication
            validated_user_id = require_authenticated_user_id(current_user["id"], "quiz session creation")
            session = await create_session(request.session_id, validated_user_id)
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
async def submit_quiz(
    quiz_batch: QuizSubmissionBatch,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Submit one or more quiz responses at once (for both micro and diagnostic quizzes)
    
    For diagnostic quizzes, this endpoint will also generate a personalized course recommendation
    based on the user's performance and identified areas for improvement.
    
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
    
    Response for diagnostic quizzes includes:
    {
        "success": true,
        "data": {
            "user_id": "string",
            "quiz_type": "diagnostic",
            "overall_score": 65.0,
            "topic_breakdown": {...},
            "recommended_course_id": "course_id"
        }
    }
    """
    try:
        supabase = get_supabase()
        
        # 1. Prepare batch data for quiz_responses table
        quiz_responses_batch = []
        topic_stats = {}  # Track stats for user_progress update
        
        for response in quiz_batch.responses:
            quiz_response_data = {
                "user_id": current_user["id"],  # Use user_id from token
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
        await _update_user_progress_from_batch(current_user["id"], quiz_batch.quiz_type, topic_stats)
        
        # 4. Log to Google Sheets (for client access)
        if google_sheets_service.service:
            try:
                # Prepare data for Google Sheets (new schema)
                sheets_data = []
                for response in quiz_batch.responses:
                    sheets_data.append({
                        'user_id': current_user["id"],  # Use user_id from token
                        'quiz_id': response["quiz_id"],
                        'topic_tag': response["topic"],  # Updated to topic_tag
                        'selected_option': response["selected_option"],  # Updated to selected_option
                        'correct': response["correct"],
                        'session_id': quiz_batch.session_id or current_user["id"]  # Use session_id if provided
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
        
        logger.info(f"Quiz submission(s) successful for user {current_user['id']}: {correct_responses}/{total_responses} correct")
        
        # 6. Generate course recommendation for diagnostic quizzes only
        recommended_course_id = None
        if quiz_batch.quiz_type == "diagnostic":
            # Always create and register a proper course (no random UUID generation)
            try:
                logger.info("Creating course recommendation")
                
                # Determine course level based on score
                if overall_score >= 80:
                    course_level = "Advanced"
                    focus_topic = "Investment Strategies"
                elif overall_score >= 60:
                    course_level = "Intermediate"
                    focus_topic = "Budgeting and Saving"
                else:
                    course_level = "Beginner"
                    focus_topic = "Financial Basics"
                
                # Create course data
                course_data = {
                    "title": f"{course_level} {focus_topic}",
                    "module": f"{focus_topic} Fundamentals",
                    "track": "High School",
                    "estimated_length": "2,000-2,500 words",
                    "lesson_overview": f"This lesson will help you master {focus_topic} concepts that are essential for making smart financial decisions.",
                    "learning_objectives": [
                        f"Understand key {focus_topic} principles",
                        "Apply concepts to real financial decisions",
                        "Build confidence in financial planning"
                    ],
                    "core_concepts": [
                        {
                            "title": f"Understanding {focus_topic}",
                            "explanation": f"{focus_topic} is fundamental to building a strong financial foundation.",
                            "metaphor": "Think of it like learning to ride a bike - once you master the basics, you can go anywhere!",
                            "quick_challenge": "What's one financial decision you made this week?"
                        }
                    ],
                    "key_terms": [
                        {
                            "term": focus_topic,
                            "definition": f"The practice of managing {focus_topic.lower()} effectively",
                            "example": "Creating a budget for your monthly expenses"
                        }
                    ],
                    "real_life_scenarios": [
                        {
                            "title": "Alex's Financial Journey",
                            "narrative": "Alex, a high school student, decided to track their spending for a month. They discovered they were spending more than they realized and started making better financial decisions."
                        }
                    ],
                    "mistakes_to_avoid": [
                        "Not tracking your spending regularly",
                        "Ignoring small expenses that add up over time"
                    ],
                    "action_steps": [
                        f"Research {focus_topic} basics online",
                        "Track your spending for 3 days",
                        "Set one financial goal for this month"
                    ],
                    "summary": f"You've taken an important step toward mastering {focus_topic}. Remember, financial literacy is a journey, and every small step counts.",
                    "reflection_prompt": f"What's one {focus_topic.lower()} habit you want to start after today?",
                    "sample_quiz": [
                        {
                            "question": f"What is the main benefit of understanding {focus_topic}?",
                            "options": {
                                "a": "It's required for school",
                                "b": "It helps make better financial decisions",
                                "c": "It's only important for adults",
                                "d": "It doesn't matter much"
                            },
                            "correct_answer": "b",
                            "explanation": "Understanding financial concepts helps you make informed decisions about your money."
                        }
                    ],
                    "course_level": course_level.lower(),
                    "why_recommended": f"Based on your {overall_score}% diagnostic score and identified areas for improvement.",
                    "has_quiz": True,
                    "topic": focus_topic
                }
                
                # Register the course
                course_service = CourseService()
                recommended_course_id = await course_service.register_course(course_data)
                logger.info(f"Course registered successfully: {recommended_course_id}")
                
                # Verify the course was actually registered by checking database
                try:
                    verification_result = supabase.table('courses').select('id').eq('id', recommended_course_id).execute()
                    if verification_result.data:
                        logger.info(f"Course registration verified: {recommended_course_id}")
                    else:
                        logger.error(f"Course registration verification failed: {recommended_course_id}")
                except Exception as verify_error:
                    logger.error(f"Failed to verify course registration: {verify_error}")
                
            except Exception as course_error:
                logger.error(f"Failed to create course: {course_error}")
                
                # Try to create a minimal test course to see if database is working
                try:
                    logger.info("Attempting to create minimal test course")
                    course_service = CourseService()
                    
                    # Test basic database connection first
                    try:
                        test_result = supabase.table('courses').select('id').limit(1).execute()
                        logger.info("Database connection test successful")
                        db_available = True
                    except Exception as db_test_error:
                        if "does not exist" in str(db_test_error):
                            logger.warning("Courses table does not exist, using fallback mode")
                            db_available = False
                        else:
                            logger.error(f"Database connection test failed: {db_test_error}")
                            db_available = True  # Assume available for other errors
                    
                    if db_available:
                        # Try to insert a very basic course
                        basic_course_data = {
                            'id': str(uuid.uuid4()),
                            'title': 'Test Course',
                            'module': 'Test Module',
                            'track': 'High School',
                            'estimated_length': '2,000-2,500 words',
                            'lesson_overview': 'Test overview',
                            'learning_objectives': [],
                            'core_concepts': [],
                            'key_terms': [],
                            'real_life_scenarios': [],
                            'mistakes_to_avoid': [],
                            'action_steps': [],
                            'summary': 'Test summary',
                            'reflection_prompt': 'Test reflection',
                            'course_level': 'beginner',
                            'why_recommended': 'Test recommendation',
                            'has_quiz': True,
                            'topic': 'Test',
                            'created_at': datetime.utcnow().isoformat(),
                            'updated_at': datetime.utcnow().isoformat()
                        }
                        
                        # Try direct database insertion
                        try:
                            direct_result = supabase.table('courses').insert(basic_course_data).execute()
                            logger.info(f"Direct database insertion successful: {basic_course_data['id']}")
                            recommended_course_id = basic_course_data['id']
                        except Exception as direct_error:
                            logger.error(f"Direct database insertion failed: {direct_error}")
                            # Try with CourseService as last resort
                            test_course_data = {
                                "title": "Test Course",
                                "module": "Test Module",
                                "track": "High School",
                                "estimated_length": "2,000-2,500 words",
                                "lesson_overview": "Test overview",
                                "learning_objectives": [],
                                "core_concepts": [],
                                "key_terms": [],
                                "real_life_scenarios": [],
                                "mistakes_to_avoid": [],
                                "action_steps": [],
                                "summary": "Test summary",
                                "reflection_prompt": "Test reflection",
                                "course_level": "beginner",
                                "why_recommended": "Test recommendation",
                                "has_quiz": True,
                                "topic": "Test"
                            }
                            test_course_id = await course_service.register_course(test_course_data)
                            logger.info(f"Test course created successfully: {test_course_id}")
                            recommended_course_id = test_course_id
                    else:
                        # Database not available, create a fallback course ID
                        logger.warning("Database not available, creating fallback course ID")
                        recommended_course_id = str(uuid.uuid4())
                        
                except Exception as test_error:
                    logger.error(f"Test course creation also failed: {test_error}")
                    # Create a fallback course ID
                    recommended_course_id = str(uuid.uuid4())
        
        # 7. Prepare Google Sheets URL for user access
        google_sheets_url = "https://docs.google.com/spreadsheets/d/1dj0l7UBaG-OkQKtSfrlf_7uDdhJu7g65OapGeKgC6bs/edit?gid=1325423234#gid=1325423234"
        
        # 8. Prepare response data
        response_data = {
            "user_id": quiz_batch.user_id,
            "quiz_type": quiz_batch.quiz_type,
            "total_responses": total_responses,
            "correct_responses": correct_responses,
            "overall_score": overall_score,
            "topic_breakdown": topic_stats,
            "google_sheets_logged": google_sheets_service.service is not None,
            "google_sheets_url": google_sheets_url,
            "recommended_course_id": recommended_course_id
        }
        
        return {
            "success": True,
            "message": f"Quiz submission(s) successful: {correct_responses}/{total_responses} correct",
            "data": response_data
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

@router.get("/history")
async def get_quiz_history(current_user: dict = Depends(get_current_active_user)):
    """Get user's quiz history and performance"""
    try:
        supabase = get_supabase()
        
        # Get quiz history for the user
        result = supabase.table('quiz_responses').select('*').eq('user_id', current_user["id"]).order('created_at', desc=True).execute()
        
        return {
            "user_id": current_user["id"],
            "quiz_history": result.data,
            "total_quizzes": len(result.data) if result.data else 0
        }
        
    except Exception as e:
        logger.error(f"Quiz history retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get quiz history")

@router.post("/session/")
async def create_new_session(current_user: dict = Depends(get_current_active_user)):
    """Create a new user session and return session data"""
    session_id = str(uuid.uuid4())
    session = await create_session(session_id, current_user["id"])
    return session