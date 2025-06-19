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

class QuizRequest(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    quiz_type: QuizType = Field(..., description="Type of quiz")
    difficulty: Optional[str] = Field("medium", description="Quiz difficulty level")

class QuizResponse(BaseModel):
    questions: List[QuizQuestion] = Field(..., description="List of quiz questions")
    quiz_id: str = Field(..., description="Unique quiz identifier")
    quiz_type: QuizType = Field(..., description="Type of quiz")

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