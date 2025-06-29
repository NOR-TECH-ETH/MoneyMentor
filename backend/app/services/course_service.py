from typing import List, Dict, Any, Optional
import uuid
import json
import logging
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.schema import HumanMessage

from app.core.config import settings
from app.core.database import get_supabase
from app.models.schemas import Course, CoursePage, CourseSession
from app.services.content_service import ContentService
from app.services.google_sheets_service import GoogleSheetsService

logger = logging.getLogger(__name__)

class CourseService:
    """Service for managing courses and course flow"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL_GPT4_MINI,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7
        )
        self.supabase = get_supabase()
        self.content_service = ContentService()
        self.sheets_service = GoogleSheetsService()
    
    async def register_course(self, course_data: Dict[str, Any]) -> str:
        """Register a new course in the database and save all pages"""
        try:
            # Generate a unique course ID
            course_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()

            # Prepare course record for DB (serialize JSONB fields)
            course_record = {
                'id': course_id,
                'title': course_data.get('title', 'Untitled Course'),
                'module': course_data.get('module', 'General'),
                'track': course_data.get('track', 'High School'),
                'estimated_length': course_data.get('estimated_length', '2,000-2,500 words'),
                'lesson_overview': course_data.get('lesson_overview', 'Course overview'),
                'learning_objectives': json.dumps(course_data.get('learning_objectives', [])),
                'core_concepts': json.dumps(course_data.get('core_concepts', [])),
                'key_terms': json.dumps(course_data.get('key_terms', [])),
                'real_life_scenarios': json.dumps(course_data.get('real_life_scenarios', [])),
                'mistakes_to_avoid': json.dumps(course_data.get('mistakes_to_avoid', [])),
                'action_steps': json.dumps(course_data.get('action_steps', [])),
                'summary': course_data.get('summary', 'Course summary'),
                'reflection_prompt': course_data.get('reflection_prompt', 'Reflection question'),
                'course_level': course_data.get('course_level', 'beginner'),
                'why_recommended': course_data.get('why_recommended', 'Recommended based on diagnostic results'),
                'has_quiz': course_data.get('has_quiz', True),
                'topic': course_data.get('topic', ''),
                'created_at': now,
                'updated_at': now
            }

            # Insert course into DB
            try:
                insert_result = self.supabase.table('courses').insert(course_record).execute()
                logger.info(f"Course inserted into database: {course_id}")
                logger.debug(f"Insert result: {insert_result}")
            except Exception as db_error:
                logger.error(f"Database insertion failed for course {course_id}: {db_error}")
                logger.error(f"Course record data: {course_record}")
                raise

            # Generate and insert course pages (including quiz pages)
            try:
                await self._generate_course_pages(course_id, course_data)
            except Exception as page_error:
                logger.error(f"Failed to generate course pages: {page_error}")
                # Continue - at least the course is registered

            logger.info(f"Course registered successfully: {course_id}")
            return course_id
        except Exception as e:
            logger.error(f"Failed to register course: {e}")
            raise
    
    async def _generate_course_pages(self, course_id: str, course_data: Dict[str, Any]):
        """Generate course pages from course data and save to DB (serialize quiz_data)"""
        try:
            pages = []
            page_index = 0
            now = datetime.utcnow().isoformat()
            
            # Page 1: Introduction and Overview
            pages.append({
                'id': str(uuid.uuid4()),
                'course_id': course_id,
                'page_index': page_index,
                'title': f"Introduction: {course_data['title']}",
                'content': f"# {course_data['title']}\n\n{course_data['lesson_overview']}\n\n## Learning Objectives\n" + 
                          "\n".join([f"- {obj}" for obj in course_data['learning_objectives']]),
                'page_type': 'content',
                'created_at': now,
                'updated_at': now
            })
            page_index += 1
            
            # Page 2: Core Concepts
            for i, concept in enumerate(course_data['core_concepts']):
                pages.append({
                    'id': str(uuid.uuid4()),
                    'course_id': course_id,
                    'page_index': page_index,
                    'title': f"Core Concept {i+1}: {concept['title']}",
                    'content': f"# {concept['title']}\n\n{concept['explanation']}\n\n" +
                              f"**Metaphor:** {concept['metaphor']}\n\n" +
                              f"**Quick Challenge:** {concept['quick_challenge']}",
                    'page_type': 'content',
                    'created_at': now,
                    'updated_at': now
                })
                page_index += 1
                
                # Add a quiz after each core concept
                quiz_question = await self._generate_quiz_question(course_data['topic'])
                if quiz_question:
                    pages.append({
                        'id': str(uuid.uuid4()),
                        'course_id': course_id,
                        'page_index': page_index,
                        'title': f"Quiz: {concept['title']}",
                        'content': f"# Quick Check\n\nTest your understanding of {concept['title']}",
                        'page_type': 'quiz',
                        'quiz_data': json.dumps(quiz_question),
                        'created_at': now,
                        'updated_at': now
                    })
                    page_index += 1
            
            # Page 3: Key Terms
            if course_data['key_terms']:
                key_terms_content = "# Key Terms\n\n"
                for term in course_data['key_terms']:
                    key_terms_content += f"## {term['term']}\n\n"
                    key_terms_content += f"**Definition:** {term['definition']}\n\n"
                    key_terms_content += f"**Example:** {term['example']}\n\n"
                
                pages.append({
                    'id': str(uuid.uuid4()),
                    'course_id': course_id,
                    'page_index': page_index,
                    'title': "Key Terms",
                    'content': key_terms_content,
                    'page_type': 'content',
                    'created_at': now,
                    'updated_at': now
                })
                page_index += 1
            
            # Page 4: Real Life Scenarios
            if course_data['real_life_scenarios']:
                scenarios_content = "# Real Life Scenarios\n\n"
                for scenario in course_data['real_life_scenarios']:
                    scenarios_content += f"## {scenario['title']}\n\n"
                    scenarios_content += f"{scenario['narrative']}\n\n"
                
                pages.append({
                    'id': str(uuid.uuid4()),
                    'course_id': course_id,
                    'page_index': page_index,
                    'title': "Real Life Scenarios",
                    'content': scenarios_content,
                    'page_type': 'content',
                    'created_at': now,
                    'updated_at': now
                })
                page_index += 1
            
            # Page 5: Mistakes to Avoid
            if course_data['mistakes_to_avoid']:
                mistakes_content = "# Common Mistakes to Avoid\n\n"
                for mistake in course_data['mistakes_to_avoid']:
                    mistakes_content += f"- {mistake}\n"
                
                pages.append({
                    'id': str(uuid.uuid4()),
                    'course_id': course_id,
                    'page_index': page_index,
                    'title': "Mistakes to Avoid",
                    'content': mistakes_content,
                    'page_type': 'content',
                    'created_at': now,
                    'updated_at': now
                })
                page_index += 1
            
            # Page 6: Action Steps
            if course_data['action_steps']:
                action_content = "# Action Steps\n\n"
                for i, step in enumerate(course_data['action_steps'], 1):
                    action_content += f"{i}. {step}\n"
                
                pages.append({
                    'id': str(uuid.uuid4()),
                    'course_id': course_id,
                    'page_index': page_index,
                    'title': "Action Steps",
                    'content': action_content,
                    'page_type': 'content',
                    'created_at': now,
                    'updated_at': now
                })
                page_index += 1
            
            # Final Page: Summary and Reflection
            pages.append({
                'id': str(uuid.uuid4()),
                'course_id': course_id,
                'page_index': page_index,
                'title': "Summary and Reflection",
                'content': f"# Course Summary\n\n{course_data['summary']}\n\n" +
                          f"## Reflection Question\n\n{course_data['reflection_prompt']}",
                'page_type': 'summary',
                'created_at': now,
                'updated_at': now
            })
            
            # Insert all pages
            if pages:
                # Serialize quiz_data for quiz pages
                for page in pages:
                    if page.get('page_type') == 'quiz' and 'quiz_data' in page:
                        if isinstance(page['quiz_data'], dict):
                            page['quiz_data'] = json.dumps(page['quiz_data'])
                
                pages_result = self.supabase.table('course_pages').insert(pages).execute()
                logger.info(f"Generated {len(pages)} pages for course {course_id}")
                logger.debug(f"Pages insert result: {pages_result}")
            else:
                logger.warning(f"No pages generated for course {course_id}")
            
        except Exception as e:
            logger.error(f"Failed to generate course pages: {e}")
            raise
    
    async def _generate_quiz_question(self, topic: str) -> Optional[Dict[str, Any]]:
        """Generate a single quiz question for a topic"""
        try:
            prompt = (
                f"Generate a multiple-choice question about {topic}. "
                f"Return a JSON object with: 'question' (text), 'choices' (object with keys 'a', 'b', 'c', 'd' and string values), "
                f"'correct_answer' (one of 'a', 'b', 'c', 'd'), and 'explanation' (short explanation for the correct answer). "
                f"Make the question educational and relevant to personal finance."
            )
            response = self.llm.invoke([HumanMessage(content=prompt)])
            
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
                logger.error(f"Failed to parse quiz question JSON: {e}")
                return None
            return None
        except Exception as e:
            logger.error(f"Failed to generate quiz question: {e}")
            return None
    
    async def start_course(self, user_id: str, course_id: str) -> Dict[str, Any]:
        """Start a course - only if it exists in database"""
        try:
            # First check if course exists in database
            course_result = self.supabase.table('courses').select('*').eq('id', course_id).execute()
            if not course_result.data:
                logger.error(f"Course not found in database: {course_id}")
                return {
                    "success": False,
                    "message": f"Course not found: {course_id}. Please ensure the course is properly registered."
                }
            
            # Get the first page from database (should exist after registration)
            first_page = await self._get_course_page_from_db(course_id, 0)
            if not first_page:
                logger.error(f"First page not found for course: {course_id}")
                return {
                    "success": False,
                    "message": f"Course pages not found. Please ensure the course is properly registered."
                }
            
            return {
                "success": True,
                "message": "Course started successfully",
                "data": {
                    "current_page": first_page,
                    "course_session": {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "course_id": course_id,
                        "current_page_index": 0,
                        "completed": False,
                        "started_at": datetime.utcnow().isoformat()
                    }
                }
            }
        except Exception as e:
            logger.error(f"Failed to start course: {e}")
            return {
                "success": False,
                "message": f"Failed to start course: {str(e)}"
            }
    
    async def navigate_course_page(self, user_id: str, course_id: str, page_index: int) -> Dict[str, Any]:
        """Navigate to a specific course page - only from database"""
        try:
            # First check if course exists in database
            course_result = self.supabase.table('courses').select('*').eq('id', course_id).execute()
            if not course_result.data:
                logger.error(f"Course not found in database: {course_id}")
                return {
                    "success": False,
                    "message": f"Course not found: {course_id}. Please ensure the course is properly registered."
                }
            
            # Get the page from database (no fallback)
            page = await self._get_course_page_from_db(course_id, page_index)
            if not page:
                logger.error(f"Page {page_index} not found for course: {course_id}")
                return {
                    "success": False,
                    "message": f"Page {page_index} not found. Please ensure the course is properly registered."
                }
            
            total_pages = await self._get_total_pages(course_id)
            is_last_page = page_index == (total_pages - 1)
            
            return {
                "success": True,
                "message": "Page loaded successfully",
                "data": {
                    "current_page": page
                },
                "total_pages": total_pages,
                "is_last_page": is_last_page
            }
        except Exception as e:
            logger.error(f"Failed to navigate course page: {e}")
            return {
                "success": False,
                "message": f"Failed to load page: {str(e)}"
            }
    
    async def _get_course_page_from_db(self, course_id: str, page_index: int) -> Optional[Dict[str, Any]]:
        """Get course page from database only - no fallback content"""
        try:
            page_result = self.supabase.table('course_pages').select('*').eq('course_id', course_id).eq('page_index', page_index).execute()
            if not page_result.data:
                return None
                
            page = page_result.data[0]
            
            # Parse quiz_data if present and is a string
            if page.get('page_type') == 'quiz' and page.get('quiz_data'):
                if isinstance(page['quiz_data'], str):
                    try:
                        page['quiz_data'] = json.loads(page['quiz_data'])
                    except Exception as parse_error:
                        logger.error(f"Failed to parse quiz_data for page {page_index}: {parse_error}")
                        pass
            
            # Add total_pages if not present
            if 'total_pages' not in page:
                total_pages = await self._get_total_pages(course_id)
                page['total_pages'] = total_pages
                
            return page
            
        except Exception as e:
            logger.error(f"Failed to get course page from DB: {e}")
            return None
    
    async def submit_course_quiz(self, user_id: str, course_id: str, page_index: int, selected_option: str, correct: bool) -> Dict[str, Any]:
        """Submit a quiz answer for a course page"""
        try:
            # Get current page
            page_result = self.supabase.table('course_pages').select('*').eq('course_id', course_id).eq('page_index', page_index).execute()
            if not page_result.data:
                raise ValueError(f"Page not found: {page_index}")
            
            current_page = page_result.data[0]
            if current_page['page_type'] != 'quiz':
                raise ValueError(f"Page {page_index} is not a quiz page")
            
            # Parse quiz_data if it's a string
            quiz_data = current_page.get('quiz_data', {})
            if isinstance(quiz_data, str):
                try:
                    quiz_data = json.loads(quiz_data)
                except Exception as parse_error:
                    logger.error(f"Failed to parse quiz_data for page {page_index}: {parse_error}")
                    quiz_data = {}
            
            explanation = quiz_data.get('explanation', 'Good job!') if isinstance(quiz_data, dict) else 'Good job!'
            
            # Update quiz answers in session (create session if it doesn't exist)
            session_result = self.supabase.table('user_course_sessions').select('quiz_answers').eq('user_id', user_id).eq('course_id', course_id).execute()
            if session_result.data:
                # Update existing session
                quiz_answers = session_result.data[0].get('quiz_answers', {})
                quiz_answers[str(page_index)] = {
                    'selected_option': selected_option,
                    'correct': correct,
                    'timestamp': datetime.utcnow().isoformat()
                }
                
                self.supabase.table('user_course_sessions').update({
                    'quiz_answers': quiz_answers,
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('user_id', user_id).eq('course_id', course_id).execute()
            else:
                # Create new session
                quiz_answers = {
                    str(page_index): {
                        'selected_option': selected_option,
                        'correct': correct,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                }
                
                self.supabase.table('user_course_sessions').insert({
                    'user_id': user_id,
                    'course_id': course_id,
                    'current_page_index': page_index,
                    'completed': False,
                    'quiz_answers': quiz_answers,
                    'started_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }).execute()
            
            # Get next page if available
            next_page = None
            total_pages = await self._get_total_pages(course_id)
            
            if page_index + 1 < total_pages:
                next_page_result = self.supabase.table('course_pages').select('*').eq('course_id', course_id).eq('page_index', page_index + 1).execute()
                if next_page_result.data:
                    next_page_data = next_page_result.data[0]
                    
                    # Parse quiz_data if present and is a string
                    quiz_data = next_page_data.get('quiz_data')
                    if quiz_data and isinstance(quiz_data, str):
                        try:
                            quiz_data = json.loads(quiz_data)
                        except Exception as parse_error:
                            logger.error(f"Failed to parse quiz_data for next page: {parse_error}")
                            quiz_data = None
                    
                    next_page = {
                        'id': next_page_data['id'],
                        'page_index': next_page_data['page_index'],
                        'title': next_page_data['title'],
                        'content': next_page_data['content'],
                        'page_type': next_page_data['page_type'],
                        'quiz_data': quiz_data,
                        'total_pages': total_pages  # Include total pages for proper numbering
                    }
                else:
                    logger.warning(f"No next page found at index {page_index + 1}")
            else:
                logger.info(f"No next page available - current page {page_index} is the last page (total: {total_pages})")
            
            # Log course progress to Google Sheets
            try:
                # Get course details for logging
                course_result = self.supabase.table('courses').select('title').eq('id', course_id).execute()
                course_name = course_result.data[0]['title'] if course_result.data else 'Unknown Course'
                
                # Get session_id from user_course_sessions or use a generated one
                session_result = self.supabase.table('user_course_sessions').select('id').eq('user_id', user_id).eq('course_id', course_id).execute()
                session_id = str(session_result.data[0]['id']) if session_result.data else f"{user_id}_{course_id}"
                
                progress_data = {
                    "user_id": user_id,
                    "session_id": session_id,
                    "course_id": course_id,
                    "course_name": course_name,
                    "page_number": page_index + 1,  # Convert to 1-based
                    "total_pages": total_pages,
                    "completed": False  # Quiz page completion, not full course
                }
                self.sheets_service.log_course_progress(progress_data)
                
            except Exception as e:
                logger.warning(f"Failed to log course progress to Google Sheets: {e}")
                # Don't fail the main request if logging fails
            
            return {
                'success': True,
                'message': f"Quiz answer submitted successfully",
                'data': {
                    'course_id': course_id,
                    'page_index': page_index
                },
                'correct': correct,
                'explanation': explanation,
                'next_page': next_page
            }
            
        except Exception as e:
            logger.error(f"Failed to submit course quiz: {e}")
            raise
    
    async def complete_course(self, user_id: str, course_id: str) -> Dict[str, Any]:
        """Complete a course for a user"""
        try:
            # Get course details
            course_result = self.supabase.table('courses').select('*').eq('id', course_id).execute()
            if not course_result.data:
                raise ValueError(f"Course not found: {course_id}")
            
            course = course_result.data[0]
            
            # Get session details
            session_result = self.supabase.table('user_course_sessions').select('*').eq('user_id', user_id).eq('course_id', course_id).execute()
            if not session_result.data:
                raise ValueError(f"Course session not found")
            
            session = session_result.data[0]
            quiz_answers = session.get('quiz_answers', {})
            
            # Calculate completion summary
            total_quizzes = len([p for p in quiz_answers.values() if p.get('correct') is not None])
            correct_answers = len([p for p in quiz_answers.values() if p.get('correct')])
            score = (correct_answers / total_quizzes * 100) if total_quizzes > 0 else 0
            
            # Update session as completed
            self.supabase.table('user_course_sessions').update({
                'completed': True,
                'completed_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }).eq('user_id', user_id).eq('course_id', course_id).execute()
            
            # Log course completion to Google Sheets
            try:
                total_pages = await self._get_total_pages(course_id)
                session_id = str(session.get('id', f"{user_id}_{course_id}"))
                
                progress_data = {
                    "user_id": user_id,
                    "session_id": session_id,
                    "course_id": course_id,
                    "course_name": course['title'],
                    "page_number": total_pages,  # Final page
                    "total_pages": total_pages,
                    "completed": True  # Full course completion
                }
                self.sheets_service.log_course_progress(progress_data)
                
            except Exception as e:
                logger.warning(f"Failed to log course completion to Google Sheets: {e}")
                # Don't fail the main request if logging fails
            
            completion_summary = {
                'course_title': course['title'],
                'total_quizzes': total_quizzes,
                'correct_answers': correct_answers,
                'score': score,
                'completed_at': datetime.utcnow().isoformat()
            }
            
            return {
                'success': True,
                'message': f"Course '{course['title']}' completed successfully!",
                'data': {
                    'course_id': course_id,
                    'completion_summary': completion_summary
                },
                'completion_summary': completion_summary
            }
            
        except Exception as e:
            logger.error(f"Failed to complete course: {e}")
            raise
    
    async def _get_total_pages(self, course_id: str) -> int:
        """Get total number of pages for a course"""
        try:
            result = self.supabase.table('course_pages').select('page_index').eq('course_id', course_id).execute()
            return len(result.data)
        except Exception as e:
            logger.error(f"Failed to get total pages: {e}")
            return 0 