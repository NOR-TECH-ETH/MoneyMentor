from typing import List, Dict, Any, Optional
import uuid
import json
import random
from datetime import datetime
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build

from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage

from app.core.config import settings
from app.models.schemas import QuizQuestion, QuizType
from app.services.content_service import ContentService
from app.core.database import get_supabase
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)

class QuizService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL_GPT4_MINI,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7
        )
        self.content_service = ContentService()
        self.supabase = get_supabase()
        self.sheets_service = self._init_google_sheets()
        self.webhook_service = WebhookService()
        self.quiz_frequency = settings.QUIZ_FREQUENCY
        
        # Predefined topics for diagnostic quiz
        self.diagnostic_topics = [
            "Basic Investing Concepts",
            "Risk and Return",
            "Diversification",
            "Compound Interest",
            "Asset Classes",
            "Market Volatility",
            "Dollar-Cost Averaging",
            "Emergency Funds",
            "Debt Management",
            "Retirement Planning"
        ]
    
    def _init_google_sheets(self):
        """Initialize Google Sheets API client"""
        try:
            credentials = service_account.Credentials.from_service_account_file(
                settings.GOOGLE_APPLICATION_CREDENTIALS,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            return build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets: {e}")
            return None

    async def should_trigger_diagnostic(self, user_id: str) -> bool:
        """Check if diagnostic pre-test should be triggered"""
        try:
            # Check if user has completed diagnostic
            result = self.supabase.table('quiz_attempts').select('*').eq('user_id', user_id).eq('quiz_type', 'diagnostic').execute()
            return len(result.data) == 0
        except Exception as e:
            logger.error(f"Failed to check diagnostic status: {e}")
            return True
    
    async def generate_diagnostic_quiz(self) -> List[Dict[str, Any]]:
        """Generate diagnostic pre-test questions using predefined general financial topics"""
        try:
            topics = self.diagnostic_topics
            prompt = (
                f"Generate 10 multiple-choice questions for a diagnostic quiz. "
                f"Each question should cover one of these topics: {', '.join(topics)}. "
                f"Return ONLY a valid JSON array of questions, no explanation, no markdown, no extra text. "
                f"Each question should have: "
                f"'question' (text), 'choices' (object with keys 'a', 'b', 'c', 'd' and string values), "
                f"'correct_answer' (one of 'a', 'b', 'c', 'd'), and 'explanation' (short explanation for the correct answer)."
            )
            response = self.llm.invoke([HumanMessage(content=prompt)])
            import json
            try:
                questions = json.loads(response.content)
                processed_questions = []
                for q in questions:
                    processed_questions.append({
                        'question': q.get('question', ''),
                        'choices': q.get('choices', {}),
                        'correct_answer': q.get('correct_answer', ''),
                        'explanation': q.get('explanation', '')
                    })
                return processed_questions
            except Exception as e:
                logger.error(f"Failed to parse diagnostic quiz JSON: {e}. Raw LLM output: {response.content}")
                return []
        except Exception as e:
            logger.error(f"Failed to generate diagnostic quiz: {e}")
            return []
    
    async def _generate_question(self, topic: str) -> Optional[Dict[str, Any]]:
        """Generate a single quiz question for a specific topic using LLM"""
        try:
            prompt = (
                f"Generate a multiple-choice question about {topic}. "
                f"Return a JSON object with: 'question' (text), 'choices' (object with keys 'a', 'b', 'c', 'd' and string values), "
                f"'correct_answer' (one of 'a', 'b', 'c', 'd'), and 'explanation' (short explanation for the correct answer). "
                f"Make the question educational and relevant to personal finance."
            )
            response = self.llm.invoke([HumanMessage(content=prompt)])
            import json
            try:
                question_data = json.loads(response.content)
                if 'question' in question_data and 'choices' in question_data and 'correct_answer' in question_data:
                    return {
                        'question': question_data['question'],
                        'choices': question_data['choices'],
                        'correct_answer': question_data['correct_answer'],
                        'explanation': question_data.get('explanation', '')
                    }
            except Exception as e:
                logger.error(f"Failed to parse question JSON for topic {topic}: {e}")
                return None
            return None
        except Exception as e:
            logger.error(f"Failed to generate question for topic {topic}: {e}")
            return None

    async def generate_micro_quiz(self, user_id: str, topic: str) -> Dict[str, Any]:
        """Generate a micro-quiz (3-5 questions) on a specific topic"""
        try:
            # Generate 3-5 questions on the topic
            questions = []
            num_questions = min(5, max(3, len(topic.split())))  # 3-5 questions based on topic complexity
            
            for _ in range(num_questions):
                question = await self._generate_question(topic)
                questions.append(question)
            
            quiz_id = str(uuid.uuid4())
            quiz_data = {
                "quiz_id": quiz_id,
                "user_id": user_id,
                "type": "micro",
                "topic": topic,
                "questions": questions,
                "created_at": datetime.utcnow().isoformat(),
                "status": "pending"
            }
            
            # Store quiz in Supabase
            result = self.supabase.table('quizzes').insert(quiz_data).execute()
            
            # Log to Google Sheets
            await self._log_quiz_to_sheets(quiz_data)
            
            return quiz_data
            
        except Exception as e:
            logger.error(f"Failed to generate micro quiz: {e}")
            raise

    async def log_quiz_response(self, quiz_id: str, responses: List[Dict[str, Any]]) -> bool:
        """Log quiz responses and update progress"""
        try:
            # Get quiz data
            quiz = self.supabase.table('quizzes').select('*').eq('quiz_id', quiz_id).execute()
            if not quiz.data:
                raise ValueError(f"Quiz {quiz_id} not found")
            
            quiz_data = quiz.data[0]
            
            # Calculate score and analyze responses
            score = self._calculate_score(quiz_data['questions'], responses)
            analysis = self._analyze_responses(quiz_data['questions'], responses)
            
            # Update quiz with responses
            update_data = {
                "responses": responses,
                "score": score,
                "analysis": analysis,
                "completed_at": datetime.utcnow().isoformat(),
                "status": "completed"
            }
            
            result = self.supabase.table('quizzes').update(update_data).eq('quiz_id', quiz_id).execute()
            
            # Log to Google Sheets
            await self._log_responses_to_sheets(quiz_data, responses, score, analysis)
            
            # Update user progress
            await self._update_user_progress(quiz_data['user_id'], quiz_data['type'], score, analysis)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to log quiz responses: {e}")
            return False

    async def _get_topics(self) -> List[str]:
        """Get comprehensive list of topics from content"""
        try:
            # Query Supabase for content topics
            result = self.supabase.table('content_topics').select('topic').execute()
            return [row['topic'] for row in result.data]
        except Exception as e:
            logger.error(f"Failed to get topics: {e}")
            return []

    async def log_quiz_attempt(
        self,
        user_id: str,
        quiz_id: str,
        selected_option: int,
        correct: bool,
        topic: str,
        quiz_type: str = "micro"
    ) -> bool:
        """Log a quiz attempt"""
        try:
            # Store in database
            attempt_data = {
                "user_id": user_id,
                "quiz_id": quiz_id,
                "selected_option": selected_option,
                "correct": correct,
                "topic": topic,
                "quiz_type": quiz_type,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            self.supabase.table('quiz_attempts').insert(attempt_data).execute()
            
            # Send to webhook
            await self.webhook_service.log_quiz_attempt(attempt_data)
            
            return True
        except Exception as e:
            logger.error(f"Failed to log quiz attempt: {e}")
            return False
    
    async def get_user_progress(self, user_id: str) -> Dict[str, Any]:
        """Get user's quiz progress"""
        try:
            # Get all quiz attempts
            result = self.supabase.table('quiz_attempts').select('*').eq('user_id', user_id).execute()
            
            # Calculate statistics
            total_attempts = len(result.data)
            correct_attempts = sum(1 for attempt in result.data if attempt['correct'])
            
            # Group by topic
            topic_stats = {}
            for attempt in result.data:
                topic = attempt['topic']
                if topic not in topic_stats:
                    topic_stats[topic] = {'total': 0, 'correct': 0}
                topic_stats[topic]['total'] += 1
                if attempt['correct']:
                    topic_stats[topic]['correct'] += 1
            
            return {
                'total_attempts': total_attempts,
                'correct_attempts': correct_attempts,
                'accuracy': correct_attempts / total_attempts if total_attempts > 0 else 0,
                'topic_stats': topic_stats
            }
        except Exception as e:
            logger.error(f"Failed to get user progress: {e}")
            return {}

    def _calculate_score(self, questions: List[Dict[str, Any]], responses: List[Dict[str, Any]]) -> float:
        """Calculate quiz score"""
        try:
            correct = 0
            for q, r in zip(questions, responses):
                if q['correct_answer'] == r['answer']:
                    correct += 1
            return (correct / len(questions)) * 100
        except Exception as e:
            logger.error(f"Failed to calculate score: {e}")
            return 0.0

    def _analyze_responses(self, questions: List[Dict[str, Any]], responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze quiz responses for insights"""
        try:
            analysis = {
                "strengths": [],
                "weaknesses": [],
                "recommendations": []
            }
            
            # Analyze each response
            for q, r in zip(questions, responses):
                if q['correct_answer'] == r['answer']:
                    analysis['strengths'].append(q['topic'])
                else:
                    analysis['weaknesses'].append(q['topic'])
            
            # Generate recommendations based on weaknesses
            for weakness in analysis['weaknesses']:
                analysis['recommendations'].append(f"Review {weakness} concepts")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze responses: {e}")
            return {"error": str(e)}

    async def _log_quiz_to_sheets(self, quiz_data: Dict[str, Any]) -> bool:
        """Log quiz data to Google Sheets"""
        try:
            if not self.sheets_service:
                return False
                
            values = [[
                quiz_data['quiz_id'],
                quiz_data['user_id'],
                quiz_data['type'],
                quiz_data['created_at'],
                quiz_data.get('topic', ''),
                len(quiz_data['questions'])
            ]]
            
            body = {
                'values': values
            }
            
            self.sheets_service.spreadsheets().values().append(
                spreadsheetId=settings.GOOGLE_SHEET_ID,
                range='Quizzes!A:F',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to log quiz to sheets: {e}")
            return False

    async def _log_responses_to_sheets(self, quiz_data: Dict[str, Any], responses: List[Dict[str, Any]], 
                                     score: float, analysis: Dict[str, Any]) -> bool:
        """Log quiz responses to Google Sheets"""
        try:
            if not self.sheets_service:
                return False
                
            values = [[
                quiz_data['quiz_id'],
                quiz_data['user_id'],
                quiz_data['type'],
                datetime.utcnow().isoformat(),
                score,
                str(analysis)
            ]]
            
            body = {
                'values': values
            }
            
            self.sheets_service.spreadsheets().values().append(
                spreadsheetId=settings.GOOGLE_SHEET_ID,
                range='QuizResponses!A:F',
                valueInputOption='RAW',
                body=body
            ).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to log responses to sheets: {e}")
            return False

    async def _update_user_progress(self, user_id: str, quiz_type: str, score: float, 
                                  analysis: Dict[str, Any]) -> bool:
        """Update user progress based on quiz results"""
        try:
            # Get current progress
            result = self.supabase.table('user_progress').select('*').eq('user_id', user_id).execute()
            current_progress = result.data[0] if result.data else {}
            
            # Update progress
            progress_data = {
                'user_id': user_id,
                'last_quiz_type': quiz_type,
                'last_quiz_score': score,
                'last_quiz_date': datetime.utcnow().isoformat(),
                'strengths': analysis.get('strengths', []),
                'weaknesses': analysis.get('weaknesses', []),
                'recommendations': analysis.get('recommendations', [])
            }
            
            # Store in Supabase
            self.supabase.table('user_progress').upsert(progress_data).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update user progress: {e}")
            return False
    
    def validate_answer(self, question_id: str, selected_option: int, correct_answer: int) -> Dict[str, Any]:
        """Validate a quiz answer and return result"""
        is_correct = selected_option == correct_answer
        
        return {
            "correct": is_correct,
            "selected_option": selected_option,
            "correct_answer": correct_answer
        }
    
    def get_quiz_explanation(self, question_data: Dict[str, Any], selected_option: int) -> str:
        """Get explanation for quiz answer"""
        explanation = question_data.get("explanation", "")
        
        if selected_option == question_data.get("correct_answer"):
            return f"✅ Correct! {explanation}"
        else:
            correct_option = question_data.get("options", [])[question_data.get("correct_answer", 0)]
            return f"❌ Incorrect. The correct answer is: {correct_option}. {explanation}"
    
    def should_trigger_quiz(self, user_id: str, chat_count: int) -> bool:
        """Determine if a micro-quiz should be triggered"""
        # Trigger quiz every N chat interactions
        return chat_count > 0 and chat_count % settings.QUIZ_TRIGGER_INTERVAL == 0
    
    def extract_topic_from_message(self, message: str) -> str:
        """Extract the main topic from a user message for micro-quiz generation"""
        try:
            prompt = PromptTemplate(
                input_variables=["message"],
                template="""
                Analyze this user message and identify the main financial topic being discussed:
                "{message}"
                
                Return only the topic name (e.g., "Investing", "Debt Management", "Savings", "Retirement Planning", etc.)
                If no clear financial topic is identified, return "General Finance".
                """
            )
            
            formatted_prompt = prompt.format(message=message)
            response = self.llm.invoke([HumanMessage(content=formatted_prompt)])
            
            topic = response.content.strip().replace('"', '')
            return topic if topic else "General Finance"
            
        except Exception as e:
            logger.error(f"Error extracting topic from message: {e}")
            return "General Finance"

    async def generate_quiz_from_history(self, session_id: str, quiz_type: str, difficulty: str, chat_history: list) -> list:
        """Generate a single micro-quiz question based on recent chat history, quiz_type, and difficulty."""
        try:
            # Use the last 4-5 messages for context
            recent_history = chat_history[-5:]
            chat_context = "\n".join([
                f"{msg['role']}: {msg['content']}" for msg in recent_history if 'role' in msg and 'content' in msg
            ])
            prompt = (
                f"Based on the following recent chat history, generate a single multiple-choice quiz question "
                f"that is relevant to the user's recent discussion. The difficulty should be {difficulty}. "
                f"Return a JSON object with: 'question', 'choices' (object with keys 'a', 'b', 'c', 'd'), "
                f"'correct_answer' (a/b/c/d), and 'explanation'.\n"
                f"Chat history:\n{chat_context}"
            )
            response = self.llm.invoke([HumanMessage(content=prompt)])
            import json
            try:
                question = json.loads(response.content)
                # Ensure the structure is correct
                if 'question' in question and 'choices' in question and 'correct_answer' in question:
                    return [{
                        'question': question.get('question', ''),
                        'choices': question.get('choices', {}),
                        'correct_answer': question.get('correct_answer', ''),
                        'explanation': question.get('explanation', '')
                    }]
            except Exception as e:
                logger.error(f"Failed to parse micro quiz JSON: {e}")
                return []
            return []
        except Exception as e:
            logger.error(f"Failed to generate quiz from history: {e}")
            raise 