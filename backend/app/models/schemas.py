from pydantic import BaseModel, Field, UUID4, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

class QuizType(str, Enum):
    DIAGNOSTIC = "diagnostic"
    MICRO = "micro"

class ChatMessage(BaseModel):
    message: str = Field(..., description="User message")
    user_id: str = Field(..., description="Unique user identifier")
    session_id: Optional[str] = Field(None, description="Session identifier")

class ChatResponse(BaseModel):
    response: str = Field(..., description="Bot response")
    session_id: str = Field(..., description="Session identifier")
    should_show_quiz: bool = Field(False, description="Whether to show a quiz")
    quiz_data: Optional[Dict[str, Any]] = Field(None, description="Quiz data if applicable")
    calculation_result: Optional[Dict[str, Any]] = Field(None, description="Calculation result if applicable")

class QuizQuestion(BaseModel):
    question: str = Field(..., description="Question text")
    choices: Dict[str, str] = Field(..., description="Multiple choice options with keys a, b, c, d")
    correct_answer: str = Field(..., description="Correct answer key (a, b, c, or d)")
    explanation: str = Field(..., description="Explanation for the correct answer")
    topic: Optional[str] = Field(None, description="Topic of the question")
    difficulty: Optional[str] = Field(None, description="Difficulty level of the question (easy, medium, hard)")

class QuizRequest(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    quiz_type: QuizType = Field(..., description="Type of quiz")
    topic: Optional[str] = Field(None, description="Topic of the quiz")
    difficulty: Optional[str] = Field("medium", description="Quiz difficulty level")

class QuizResponse(BaseModel):
    questions: List[QuizQuestion] = Field(..., description="List of quiz questions")
    quiz_id: str = Field(..., description="Unique quiz identifier")
    quiz_type: QuizType = Field(..., description="Type of quiz")
    topic: Optional[str] = Field(None, description="Topic of the quiz")
class QuizAttempt(BaseModel):
    user_id: str = Field(..., description="User identifier")
    quiz_id: str = Field(..., description="Quiz identifier")
    question_id: str = Field(..., description="Question identifier")
    selected_option: int = Field(..., description="Selected answer index")
    topic_tag: str = Field(..., description="Question topic")

class QuizAttemptResponse(BaseModel):
    correct: bool = Field(..., description="Whether answer was correct")
    explanation: str = Field(..., description="Explanation of the correct answer")
    correct_answer: int = Field(..., description="Index of correct answer")

class QuizSubmission(BaseModel):
    """Schema for quiz response submission"""
    user_id: str = Field(..., description="User identifier")
    quiz_id: str = Field(..., description="Quiz identifier")
    selected_option: str = Field(..., description="Selected answer (A, B, C, or D)", pattern="^[A-D]$")
    correct: bool = Field(..., description="Whether the answer was correct")
    topic: str = Field(..., description="Quiz topic")
    quiz_type: str = Field("micro", description="Type of quiz (micro, diagnostic, etc.)")
    
    @field_validator('selected_option')
    @classmethod
    def validate_selected_option(cls, v):
        if v not in ['A', 'B', 'C', 'D']:
            raise ValueError('selected_option must be A, B, C, or D')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "quiz_id": "quiz456",
                "selected_option": "B",
                "correct": True,
                "topic": "Investing",
                "quiz_type": "micro"
            }
        }

class QuizSubmissionBatch(BaseModel):
    """Schema for submitting multiple quiz responses at once"""
    user_id: str = Field(..., description="User identifier")
    quiz_type: str = Field("micro", description="Type of quiz (micro, diagnostic, etc.)")
    session_id: Optional[str] = Field(None, description="Session identifier for tracking")
    responses: List[Dict[str, Any]] = Field(..., description="List of quiz responses")
    
    @field_validator('responses')
    @classmethod
    def validate_responses(cls, v):
        if not v:
            raise ValueError('responses list cannot be empty')
        
        for i, response in enumerate(v):
            required_fields = ['quiz_id', 'selected_option', 'correct', 'topic']
            for field in required_fields:
                if field not in response:
                    raise ValueError(f'Response {i} missing required field: {field}')
            
            # Validate selected_option
            selected = response.get('selected_option')
            if selected not in ['A', 'B', 'C', 'D']:
                raise ValueError(f'Response {i} selected_option must be A, B, C, or D')
        
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "quiz_type": "diagnostic",
                "responses": [
                    {
                        "quiz_id": "quiz_1",
                        "selected_option": "B",
                        "correct": True,
                        "topic": "Investing"
                    },
                    {
                        "quiz_id": "quiz_2", 
                        "selected_option": "A",
                        "correct": False,
                        "topic": "Budgeting"
                    }
                ]
            }
        }

class CalculationRequest(BaseModel):
    calculation_type: str = Field(..., description="Type of calculation (payoff, savings, loan)")
    principal: float = Field(..., description="Principal amount")
    interest_rate: float = Field(..., description="Annual interest rate (as percentage)")
    target_months: Optional[int] = Field(None, description="Target months for payoff/savings")
    monthly_payment: Optional[float] = Field(None, description="Monthly payment amount")
    target_amount: Optional[float] = Field(None, description="Target savings amount")

class CalculationResult(BaseModel):
    monthly_payment: Optional[float] = Field(None, description="Required monthly payment")
    months_to_payoff: Optional[int] = Field(None, description="Months to complete payoff")
    total_interest: float = Field(..., description="Total interest paid")
    step_by_step_plan: List[str] = Field(..., description="Detailed plan steps")
    total_amount: float = Field(..., description="Total amount paid/saved")

class UserSession(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    session_id: str = Field(..., description="Session identifier")
    chat_count: int = Field(0, description="Number of chat interactions")
    last_quiz_at: Optional[datetime] = Field(None, description="Last quiz timestamp")
    diagnostic_completed: bool = Field(False, description="Whether diagnostic quiz is completed")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProgressData(BaseModel):
    user_id: str = Field(..., description="User identifier")
    total_chats: int = Field(..., description="Total chat interactions")
    quizzes_taken: int = Field(..., description="Number of quizzes taken")
    correct_answers: int = Field(..., description="Number of correct answers")
    topics_covered: List[str] = Field(..., description="Topics discussed")
    last_activity: datetime = Field(..., description="Last activity timestamp")

class ContentDocument(BaseModel):
    """Schema for content document metadata"""
    file_id: str
    filename: str
    content_type: str
    uploaded_at: datetime
    status: str
    title: Optional[str] = None
    description: Optional[str] = None
    topic: Optional[str] = None

class SearchRequest(BaseModel):
    """Schema for content search requests"""
    query: str
    limit: Optional[int] = 5
    threshold: Optional[float] = 0.7
    filters: Optional[Dict[str, Any]] = None

class SearchResponse(BaseModel):
    """Schema for content search responses"""
    results: List[Dict[str, Any]]
    total: int
    query: str
    filters: Optional[Dict[str, Any]] = None

class TopicCreate(BaseModel):
    """Schema for creating a new topic"""
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None

class TopicResponse(BaseModel):
    """Schema for topic responses"""
    id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CourseRecommendation(BaseModel):
    """Schema for course recommendation based on diagnostic results following student lesson template"""
    title: str = Field(..., description="Course title")
    module: str = Field(..., description="Module name")
    track: str = Field(..., description="Track (e.g., 'High School')")
    estimated_length: str = Field(..., description="Estimated course length (e.g., '2,000-2,500 words')")
    lesson_overview: str = Field(..., description="Brief overview explaining why the lesson matters and what students will learn")
    learning_objectives: List[str] = Field(..., description="List of key learning objectives")
    core_concepts: List[Dict[str, str]] = Field(..., description="List of core concepts with title, explanation, metaphor, and quick_challenge")
    key_terms: List[Dict[str, str]] = Field(..., description="List of key terms with term, definition, and example")
    real_life_scenarios: List[Dict[str, str]] = Field(..., description="List of real-life scenarios with title and narrative")
    mistakes_to_avoid: List[str] = Field(..., description="List of common misconceptions or financial mistakes")
    action_steps: List[str] = Field(..., description="List of step-by-step actions students can try")
    summary: str = Field(..., description="Wrap-up paragraph reinforcing the lesson takeaway")
    reflection_prompt: str = Field(..., description="Journal-style question for student reflection")
    sample_quiz: List[Dict[str, Any]] = Field(..., description="List of sample quiz questions with options, correct answer, and explanation")
    course_level: str = Field(..., description="Course difficulty level (beginner/intermediate/advanced)")
    why_recommended: str = Field(..., description="Explanation of why this course was recommended")
    has_quiz: bool = Field(..., description="Whether the course includes a quiz section")
    
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Intermediate Risk Management",
                "module": "Investment Fundamentals",
                "track": "High School",
                "estimated_length": "2,000-2,500 words",
                "lesson_overview": "This lesson will help you master risk management concepts that are essential for making smart investment decisions. You'll learn practical strategies that connect directly to real-life money situations you'll face.",
                "learning_objectives": [
                    "Understand different types of investment risks",
                    "Learn risk mitigation strategies",
                    "Build a balanced portfolio"
                ],
                "core_concepts": [
                    {
                        "title": "Understanding Investment Risk",
                        "explanation": "Investment risk is the possibility of losing money on an investment. Different investments have different levels of risk.",
                        "metaphor": "Think of it like crossing a street - some crossings are safer than others!",
                        "quick_challenge": "What's one risky financial decision you've seen someone make?"
                    }
                ],
                "key_terms": [
                    {
                        "term": "Risk Management",
                        "definition": "The practice of identifying and minimizing potential losses",
                        "example": "Diversifying your investments across different types of assets"
                    }
                ],
                "real_life_scenarios": [
                    {
                        "title": "Maria's First Investment",
                        "narrative": "Maria, a high school student, wanted to invest her summer job savings. She researched different options and chose a mix of stocks and bonds to balance risk and potential returns."
                    }
                ],
                "mistakes_to_avoid": [
                    "Putting all your money in one investment",
                    "Ignoring the risk level of investments"
                ],
                "action_steps": [
                    "Research different investment types",
                    "Create a simple investment plan",
                    "Start with small amounts to learn"
                ],
                "summary": "You've taken an important step toward understanding risk management. Remember, every investment decision involves balancing risk and potential reward.",
                "reflection_prompt": "What's one investment risk you want to understand better?",
                "sample_quiz": [
                    {
                        "question": "What is the main benefit of diversifying your investments?",
                        "options": {
                            "a": "It guarantees higher returns",
                            "b": "It reduces overall risk",
                            "c": "It's required by law",
                            "d": "It doesn't matter"
                        },
                        "correct_answer": "b",
                        "explanation": "Diversification spreads risk across different investments, reducing the chance of losing everything."
                    }
                ],
                "course_level": "intermediate",
                "why_recommended": "Based on your 65% diagnostic score and identified weaknesses in risk management concepts.",
                "has_quiz": True
            }
        }

class ChatMessageRequest(BaseModel):
    """Schema for chat message request"""
    query: str = Field(..., description="The user's query")
    session_id: str = Field(..., description="Session identifier (any string, not restricted to UUID v4)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "What is compound interest?",
                "session_id": "123e4567-e89b-12d3-a456-426614174000"
            }
        }

# Course-related schemas
class CoursePage(BaseModel):
    """Schema for a single course page"""
    id: Optional[str] = Field(None, description="Page ID")
    page_index: int = Field(..., description="Page index (0-based)")
    title: str = Field(..., description="Page title")
    content: str = Field(..., description="Page content")
    page_type: str = Field("content", description="Page type: content, quiz, summary")
    quiz_data: Optional[Dict[str, Any]] = Field(None, description="Quiz data for quiz pages")

class Course(BaseModel):
    """Schema for a course"""
    id: Optional[str] = Field(None, description="Course ID")
    title: str = Field(..., description="Course title")
    module: str = Field(..., description="Module name")
    track: str = Field(..., description="Track (e.g., 'High School')")
    estimated_length: str = Field(..., description="Estimated course length")
    lesson_overview: str = Field(..., description="Brief overview")
    learning_objectives: List[str] = Field(..., description="List of learning objectives")
    core_concepts: List[Dict[str, str]] = Field(..., description="List of core concepts")
    key_terms: List[Dict[str, str]] = Field(..., description="List of key terms")
    real_life_scenarios: List[Dict[str, str]] = Field(..., description="List of real-life scenarios")
    mistakes_to_avoid: List[str] = Field(..., description="List of mistakes to avoid")
    action_steps: List[str] = Field(..., description="List of action steps")
    summary: str = Field(..., description="Course summary")
    reflection_prompt: str = Field(..., description="Reflection prompt")
    course_level: str = Field("beginner", description="Course difficulty level")
    why_recommended: str = Field(..., description="Why this course was recommended")
    has_quiz: bool = Field(True, description="Whether the course includes quizzes")
    topic: str = Field(..., description="Course topic")
    pages: Optional[List[CoursePage]] = Field(None, description="Course pages")

class CourseSession(BaseModel):
    """Schema for user course session"""
    id: Optional[str] = Field(None, description="Session ID")
    user_id: str = Field(..., description="User ID")
    course_id: str = Field(..., description="Course ID")
    current_page_index: int = Field(0, description="Current page index")
    completed: bool = Field(False, description="Whether course is completed")
    started_at: Optional[datetime] = Field(None, description="When course was started")
    completed_at: Optional[datetime] = Field(None, description="When course was completed")
    quiz_answers: Dict[str, Any] = Field(default_factory=dict, description="Quiz answers")

class CourseStartRequest(BaseModel):
    """Schema for starting a course"""
    user_id: str = Field(..., description="User ID")
    session_id: str = Field(..., description="Session ID")
    course_id: str = Field(..., description="Course ID")

class CourseStartResponse(BaseModel):
    """Schema for course start response"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    current_page: Optional[CoursePage] = Field(None, description="Current page")
    course_session: Optional[CourseSession] = Field(None, description="Course session")

class CourseNavigateRequest(BaseModel):
    """Schema for navigating course pages"""
    user_id: str = Field(..., description="User ID")
    session_id: str = Field(..., description="Session ID")
    course_id: str = Field(..., description="Course ID")
    page_index: int = Field(..., description="Target page index")

class CourseNavigateResponse(BaseModel):
    """Schema for course navigation response"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    current_page: Optional[CoursePage] = Field(None, description="Current page")
    total_pages: int = Field(..., description="Total number of pages")
    is_last_page: bool = Field(..., description="Whether this is the last page")

class CourseQuizSubmitRequest(BaseModel):
    """Schema for submitting course quiz answers"""
    user_id: str = Field(..., description="User ID")
    session_id: str = Field(..., description="Session ID")
    course_id: str = Field(..., description="Course ID")
    page_index: int = Field(..., description="Page index")
    selected_option: str = Field(..., description="Selected answer (A, B, C, or D)")
    correct: bool = Field(..., description="Whether the answer was correct")

class CourseQuizSubmitResponse(BaseModel):
    """Schema for course quiz submission response"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    correct: bool = Field(..., description="Whether the answer was correct")
    explanation: str = Field(..., description="Explanation for the answer")
    next_page: Optional[CoursePage] = Field(None, description="Next page if available")

class CourseCompleteRequest(BaseModel):
    """Schema for completing a course"""
    user_id: str = Field(..., description="User ID")
    session_id: str = Field(..., description="Session ID")
    course_id: str = Field(..., description="Course ID")

class CourseCompleteResponse(BaseModel):
    """Schema for course completion response"""
    success: bool = Field(..., description="Whether the operation was successful")
    message: str = Field(..., description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    completion_summary: Optional[Dict[str, Any]] = Field(None, description="Completion summary") 