from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging
import uuid

from app.models.schemas import QuizRequest, QuizResponse, QuizAttempt, QuizAttemptResponse, QuizSubmission, QuizSubmissionBatch, CourseRecommendation
from app.agents.crew import money_mentor_crew
from app.services.quiz_service import QuizService
from app.services.google_sheets_service import GoogleSheetsService
from app.services.content_service import ContentService
from app.core.database import get_supabase
from datetime import datetime
from app.utils.session import get_session, create_session
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
            "recommended_course": {
                "title": "Intermediate Risk Management",
                "module": "Investment Fundamentals",
                "track": "High School",
                "estimated_length": "2,000-2,500 words",
                "lesson_overview": "This lesson will help you master...",
                "learning_objectives": [...],
                "core_concepts": [...],
                "key_terms": [...],
                "real_life_scenarios": [...],
                "mistakes_to_avoid": [...],
                "action_steps": [...],
                "summary": "...",
                "reflection_prompt": "...",
                "sample_quiz": [...],
                "course_level": "intermediate",
                "why_recommended": "Based on your diagnostic results...",
                "has_quiz": true
            }
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
        
        # 6. Generate course recommendation for diagnostic quizzes only
        recommended_course = None
        if quiz_batch.quiz_type == "diagnostic":
            try:
                # Get weaknesses from topic stats for course generation
                weaknesses = []
                for topic, stats in topic_stats.items():
                    accuracy = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
                    if accuracy < 0.5:  # Below 50% accuracy
                        weaknesses.append(topic)
                
                # Generate single course recommendation
                recommended_course = await generate_single_course_recommendation(
                    user_id=quiz_batch.user_id,
                    overall_score=overall_score,
                    topic_stats=topic_stats,
                    weaknesses=weaknesses
                )
                logger.info(f"Course recommendation generated for user {quiz_batch.user_id}")
                
            except Exception as e:
                logger.error(f"Failed to generate course recommendation: {e}")
                # Don't fail the entire request if course generation fails
                recommended_course = None
        
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
            "google_sheets_url": google_sheets_url
        }
        
        # Add course recommendation for diagnostic quizzes
        if recommended_course:
            response_data["recommended_course"] = recommended_course
        
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

async def generate_single_course_recommendation(user_id: str, overall_score: float, topic_stats: Dict[str, Dict[str, int]], weaknesses: List[str]) -> Dict[str, Any]:
    """
    Generate ONE focused course based on diagnostic results using knowledge base content
    """
    try:
        # Initialize content service for knowledge base access
        content_service = ContentService()
        
        # Determine course focus based on performance and weaknesses
        if overall_score >= 80:
            course_level = "Advanced"
        elif overall_score >= 60:
            course_level = "Intermediate"
        else:
            course_level = "Foundational"
        
        # Find the weakest topic to focus on
        focus_topic = weaknesses[0] if weaknesses else "Personal Finance"
        
        # Create course title
        course_title = f"{course_level} {focus_topic}"
        
        # Fetch relevant content from knowledge base based on diagnostic topics
        knowledge_base_content = ""
        try:
            # Search for content related to the focus topic
            search_results = await content_service.search_content(
                query=focus_topic,
                limit=5,
                threshold=0.7
            )
            
            # Also search for content related to other diagnostic topics for broader context
            all_topics = list(topic_stats.keys())
            additional_content = []
            
            for topic in all_topics[:3]:  # Limit to top 3 topics to avoid overwhelming
                if topic != focus_topic:
                    topic_results = await content_service.search_content(
                        query=topic,
                        limit=2,
                        threshold=0.6
                    )
                    additional_content.extend(topic_results.get('results', []))
            
            # Combine and format knowledge base content
            all_content = search_results.get('results', []) + additional_content
            
            if all_content:
                knowledge_base_content = "\n\n".join([
                    f"Content {i+1}: {item.get('content', '')}" 
                    for i, item in enumerate(all_content[:8])  # Limit to 8 pieces of content
                ])
                logger.info(f"Retrieved {len(all_content)} pieces of content from knowledge base for {focus_topic}")
            else:
                logger.warning(f"No relevant content found in knowledge base for {focus_topic}")
                
        except Exception as e:
            logger.error(f"Failed to fetch content from knowledge base: {e}")
            knowledge_base_content = ""
        
        # Generate course content with single LLM call following the student lesson template
        prompt = f"""
        Based on diagnostic results (score: {overall_score}%, weaknesses: {weaknesses}, topic breakdown: {topic_stats}),
        generate ONE focused course titled "{course_title}" following the student lesson template structure.
        
        Knowledge Base Content for {focus_topic}:
        {knowledge_base_content if knowledge_base_content else "No specific knowledge base content available - use general financial education best practices"}
        
        Return ONLY a valid JSON object with these exact fields following the student lesson template:
        {{
            "title": "Course title",
            "module": "Module name",
            "track": "High School",
            "estimated_length": "2,000-2,500 words",
            "lesson_overview": "1 short paragraph explaining why this lesson matters, what students will learn, and how it connects to real-life money situations",
            "learning_objectives": ["objective1", "objective2", "objective3"],
            "core_concepts": [
                {{
                    "title": "Concept Title",
                    "explanation": "3-5 sentence explanation",
                    "metaphor": "Optional metaphor/analogy",
                    "quick_challenge": "Optional reflection prompt"
                }}
            ],
            "key_terms": [
                {{
                    "term": "Term name",
                    "definition": "Student-friendly definition",
                    "example": "Simple example"
                }}
            ],
            "real_life_scenarios": [
                {{
                    "title": "Name + Quick Situation",
                    "narrative": "4-6 sentence story showing diverse students applying the lesson topic"
                }}
            ],
            "mistakes_to_avoid": [
                "Common misconception or financial mistake with brief context"
            ],
            "action_steps": [
                "Step-by-step mini checklist or small challenges students can try this week"
            ],
            "summary": "Wrap-up paragraph that reinforces the lesson takeaway in encouraging tone",
            "reflection_prompt": "Journal-style question for students to reflect on",
            "sample_quiz": [
                {{
                    "question": "Question text?",
                    "options": {{
                        "a": "Option A",
                        "b": "Option B", 
                        "c": "Option C",
                        "d": "Option D"
                    }},
                    "correct_answer": "a/b/c/d",
                    "explanation": "Brief reason why this is correct"
                }}
            ],
            "course_level": "beginner/intermediate/advanced",
            "why_recommended": "Brief explanation of why this course was recommended",
            "has_quiz": true
        }}
        
        Make the course practical and actionable for someone with {overall_score}% diagnostic score.
        Focus on {focus_topic} as the main topic.
        Ensure all content is student-friendly and engaging.
        Use the knowledge base content to inform the course structure and examples.
        """
        
        response = course_llm.invoke([HumanMessage(content=prompt)])
        
        try:
            course_data = json.loads(response.content)
            
            # Ensure all required fields are present
            required_fields = [
                "title", "module", "track", "estimated_length", "lesson_overview", 
                "learning_objectives", "core_concepts", "key_terms", "real_life_scenarios",
                "mistakes_to_avoid", "action_steps", "summary", "reflection_prompt",
                "sample_quiz", "course_level", "why_recommended", "has_quiz"
            ]
            
            for field in required_fields:
                if field not in course_data:
                    if field == "has_quiz":
                        course_data[field] = True
                    elif field == "track":
                        course_data[field] = "High School"
                    elif field == "estimated_length":
                        course_data[field] = "2,000-2,500 words"
                    else:
                        course_data[field] = "To be determined"
            
            return course_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse course JSON: {e}. Raw response: {response.content}")
            # Return fallback course data following template
            return {
                "title": course_title,
                "module": f"{focus_topic} Fundamentals",
                "track": "High School",
                "estimated_length": "2,000-2,500 words",
                "lesson_overview": f"This lesson will help you master {focus_topic} concepts that are essential for making smart financial decisions. You'll learn practical strategies that connect directly to real-life money situations you'll face.",
                "learning_objectives": [
                    f"Understand key {focus_topic} principles",
                    "Apply concepts to real financial decisions",
                    "Build confidence in financial planning"
                ],
                "core_concepts": [
                    {
                        "title": f"Understanding {focus_topic}",
                        "explanation": f"{focus_topic} is fundamental to building a strong financial foundation. It helps you make informed decisions and avoid common pitfalls.",
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
                        "title": "Alex's First Budget",
                        "narrative": "Alex, a high school student, decided to track their spending for a month. They discovered they were spending more on snacks than they realized and started bringing lunch from home to save money."
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
                "summary": f"You've taken an important step toward mastering {focus_topic}. Remember, financial literacy is a journey, and every small step counts toward your long-term success.",
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
                "why_recommended": f"Based on your {overall_score}% diagnostic score and identified areas for improvement in {focus_topic}.",
                "has_quiz": True
            }
            
    except Exception as e:
        logger.error(f"Failed to generate course recommendation: {e}")
        # Return basic fallback
        return {
            "title": "Personal Finance Fundamentals",
            "module": "Financial Basics",
            "track": "High School",
            "estimated_length": "2,000-2,500 words",
            "lesson_overview": "This lesson will help you build a strong foundation in personal finance. You'll learn practical strategies that connect directly to real-life money situations you'll face.",
            "learning_objectives": [
                "Understand basic financial concepts",
                "Learn practical money management",
                "Develop financial confidence"
            ],
            "core_concepts": [
                {
                    "title": "Understanding Personal Finance",
                    "explanation": "Personal finance is about managing your money wisely to achieve your goals. It's the foundation for all financial decisions you'll make.",
                    "metaphor": "Think of it like building a house - you need a solid foundation first!",
                    "quick_challenge": "What's one financial goal you have?"
                }
            ],
            "key_terms": [
                {
                    "term": "Personal Finance",
                    "definition": "The practice of managing your money effectively",
                    "example": "Creating a budget for your monthly expenses"
                }
            ],
            "real_life_scenarios": [
                {
                    "title": "Sarah's Savings Goal",
                    "narrative": "Sarah, a high school student, wanted to buy a new phone. She created a savings plan and tracked her spending to reach her goal in 3 months."
                }
            ],
            "mistakes_to_avoid": [
                "Spending without a plan",
                "Not saving for emergencies"
            ],
            "action_steps": [
                "Create a simple budget",
                "Start a savings account",
                "Track your spending for a week"
            ],
            "summary": "You've taken an important step toward financial literacy. Remember, every small step counts toward your long-term financial success.",
            "reflection_prompt": "What's one money habit you want to start after today?",
            "sample_quiz": [
                {
                    "question": "What is the first step in managing your money?",
                    "options": {
                        "a": "Spend everything you have",
                        "b": "Create a budget",
                        "c": "Ignore your finances",
                        "d": "Borrow money"
                    },
                    "correct_answer": "b",
                    "explanation": "Creating a budget helps you understand where your money goes and plan your spending."
                }
            ],
            "course_level": "beginner",
            "why_recommended": "Recommended based on your diagnostic results.",
            "has_quiz": True
        } 