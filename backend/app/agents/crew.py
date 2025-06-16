from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI
from typing import Dict, Any, List
import logging
from fastapi import HTTPException

from app.core.config import settings
from app.agents.tools import (
    QuizGeneratorTool,
    QuizLoggerTool,
    FinancialCalculatorTool,
    ContentRetrievalTool,
    SessionManagerTool,
    ProgressTrackerTool
)
from app.services.content_service import ContentService

logger = logging.getLogger(__name__)

class MoneyMentorCrew:
    def __init__(self):
        self.llm_gpt4 = ChatOpenAI(
            model_name=settings.OPENAI_MODEL_GPT4,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.1,
            request_timeout=120,
            max_retries=3,
            streaming=False,
            provider="openai"
        )
        
        self.llm_gpt4_mini = ChatOpenAI(
            model_name=settings.OPENAI_MODEL_GPT4_MINI,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.3,
            request_timeout=120,
            max_retries=3,
            streaming=False,
            provider="openai"
        )
        
        # Initialize tools
        self.tools = [
            QuizGeneratorTool(),
            QuizLoggerTool(),
            FinancialCalculatorTool(),
            ContentRetrievalTool(),
            SessionManagerTool(),
            ProgressTrackerTool()
        ]
        
        # Create agents
        self.financial_tutor_agent = self._create_financial_tutor_agent()
        self.quiz_master_agent = self._create_quiz_master_agent()
        self.calculation_agent = self._create_calculation_agent()
        self.progress_tracker_agent = self._create_progress_tracker_agent()
        
    def _format_chat_history(self, chat_history: List[Dict[str, str]]) -> str:
        """Format chat history into a readable string"""
        if not chat_history:
            return "No previous messages."
            
        formatted_history = []
        for msg in chat_history:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            timestamp = msg.get("timestamp", "")
            formatted_history.append(f"{role.upper()} ({timestamp}): {content}")
            
        return "\n".join(formatted_history)
        
    async def process_message(self, message: str, chat_history: List[Dict[str, str]], session_id: str, context: str = "") -> Dict[str, Any]:
        """Process a user message and generate a response"""
        try:
            # Initialize content service to get relevant context
            content_service = ContentService()
            
            # Get relevant context from knowledge base based on the message
            try:
                content_results = await content_service.search_content(message)
                if content_results and isinstance(content_results, list):
                    # Format the content results into a readable context
                    context = "\n".join([
                        f"- {item.get('title', 'Untitled')}: {item.get('content', '')}"
                        for item in content_results[:3]  # Limit to top 3 most relevant results
                    ])
                    logger.info(f"Retrieved context from knowledge base: {context[:100]}...")
                else:
                    logger.info("No relevant context found in knowledge base")
            except Exception as e:
                logger.error(f"Failed to retrieve context from knowledge base: {e}")
                context = ""  # Reset to empty if retrieval fails
            
            # Create a chat crew for this message
            chat_crew = Crew(
                agents=[self.financial_tutor_agent],
                tasks=[
                    Task(
                        description=f"""Process the user's message and provide a helpful response.
                        Use the following context from our knowledge base if relevant:
                        {context}
                        
                        User message: {message}
                        
                        Previous chat history:
                        {self._format_chat_history(chat_history)}
                        
                        If the message is a casual greeting (like 'hi', 'hello', 'hey'), respond with a friendly greeting.
                        For financial questions, use the ContentRetrievalTool with both query and limit parameters:
                        - query: the search term from the user's question
                        - limit: 5 (default number of results)
                        
                        If the context is relevant, incorporate it naturally into your response.
                        
                        Keep your responses natural and conversational while maintaining professionalism.
                        """,
                        agent=self.financial_tutor_agent,
                        expected_output="A friendly and helpful response that matches the tone of the user's message"
                    )
                ],
                process=Process.sequential,
                verbose=settings.DEBUG
            )
            
            try:
                # Process the message
                result = await chat_crew.kickoff_async()
                
                # Ensure result is a string
                if hasattr(result, 'raw_output'):
                    result = result.raw_output
                elif hasattr(result, 'output'):
                    result = result.output
                elif not isinstance(result, str):
                    result = str(result)
                
                # Initialize response dictionary
                response = {
                    "message": result,
                    "session_id": session_id,
                    "quiz": None
                }
                
                # Check if we should generate a quiz
                # should_quiz = len(chat_history) % settings.QUIZ_TRIGGER_INTERVAL == 0
                
                # if should_quiz:
                #     try:
                #         # Generate a quiz
                #         quiz_crew = self.create_quiz_crew(
                #             topic="General Finance",  # You might want to extract topic from chat history
                #             quiz_type="micro",
                #             user_id=session_id
                #         )
                        
                #         # Generate quiz
                #         quiz_result = await quiz_crew.kickoff_async()
                        
                #         # Ensure quiz result is a string
                #         if hasattr(quiz_result, 'raw_output'):
                #             quiz_result = quiz_result.raw_output
                #         elif hasattr(quiz_result, 'output'):
                #             quiz_result = quiz_result.output
                #         elif not isinstance(quiz_result, str):
                #             quiz_result = str(quiz_result)
                            
                #         response["quiz"] = quiz_result
                #     except Exception as quiz_error:
                #         logger.error(f"Quiz generation failed: {str(quiz_error)}")
                #         # Don't fail the whole request if quiz generation fails
                #         response["quiz"] = None
                
                return response
                
            except Exception as e:
                logger.error(f"Crew execution failed: {str(e)}")
                # Return a fallback response if crew fails
                return {
                    "message": "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
                    "session_id": session_id,
                    "quiz": None,
                    "error": str(e)
                }
            
        except Exception as e:
            logger.error(f"Message processing failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process message: {str(e)}"
            )

    def _create_financial_tutor_agent(self) -> Agent:
        """Create the main financial education tutor agent"""
        return Agent(
            role="Financial Education Tutor",
            goal="Provide comprehensive financial education through conversational teaching, "
                 "helping users understand investing basics, personal finance concepts, and "
                 "making informed financial decisions.",
            backstory="You are an experienced financial educator with expertise in teaching "
                     "complex financial concepts in simple, understandable terms. You have "
                     "access to comprehensive course materials and can retrieve relevant "
                     "information to answer user questions accurately.",
            tools=[ContentRetrievalTool(), SessionManagerTool()],
            llm=self.llm_gpt4_mini,
            verbose=True,
            allow_delegation=False,  # Disable delegation to prevent unnecessary iterations
            max_iter=1,  # Keep at 1 to prevent retries
            max_rpm=5,   # Increase RPM to reduce waiting time
            max_retry_limit=1  # Limit retries on failures
        )
    
    def _create_quiz_master_agent(self) -> Agent:
        """Create the quiz generation and management agent"""
        return Agent(
            role="Quiz Master",
            goal="Generate engaging quizzes to test user knowledge, manage quiz sessions, "
                 "and provide immediate feedback to reinforce learning.",
            backstory="You are a skilled assessment specialist who creates effective "
                     "multiple-choice questions that test understanding and promote "
                     "active learning. You track user progress and adapt quiz difficulty "
                     "based on performance.",
            tools=[QuizGeneratorTool(), QuizLoggerTool(), ProgressTrackerTool()],
            llm=self.llm_gpt4_mini,
            verbose=True,
            allow_delegation=False,
            max_iter=2
        )
    
    def _create_calculation_agent(self) -> Agent:
        """Create the financial calculation specialist agent"""
        return Agent(
            role="Financial Calculator Specialist",
            goal="Perform accurate financial calculations for debt payoff, savings goals, "
                 "and loan amortization, providing detailed step-by-step explanations.",
            backstory="You are a financial mathematics expert who specializes in personal "
                     "finance calculations. You provide precise calculations with clear "
                     "explanations and practical advice for financial planning.",
            tools=[FinancialCalculatorTool()],
            llm=self.llm_gpt4,  # Use GPT-4 for higher precision
            verbose=True,
            allow_delegation=False,
            max_iter=2
        )
    
    def _create_progress_tracker_agent(self) -> Agent:
        """Create the progress tracking and analytics agent"""
        return Agent(
            role="Learning Progress Analyst",
            goal="Track user learning progress, analyze performance patterns, and provide "
                 "insights to optimize the learning experience.",
            backstory="You are a learning analytics specialist who monitors user engagement, "
                     "quiz performance, and learning patterns to provide personalized "
                     "recommendations and track educational outcomes.",
            tools=[ProgressTrackerTool(), SessionManagerTool()],
            llm=self.llm_gpt4_mini,
            verbose=True,
            allow_delegation=False,
            max_iter=2
        )
    
    def create_chat_crew(self, user_message: str, user_id: str, session_id: str) -> Crew:
        """Create a crew for handling chat interactions"""
        
        # Task for the financial tutor
        tutor_task = Task(
            description=f"""
            Analyze the user message: "{user_message}"
            
            1. Retrieve relevant content from the knowledge base if needed
            2. Provide a comprehensive, educational response
            3. Determine if this is a good moment to trigger a micro-quiz
            4. Check if any financial calculations are needed
            5. Update session information
            
            User ID: {user_id}
            Session ID: {session_id}
            
            Provide a helpful, engaging response that teaches financial concepts.
            """,
            agent=self.financial_tutor_agent,
            expected_output="A comprehensive educational response with recommendations for next steps"
        )
        
        return Crew(
            agents=[self.financial_tutor_agent],
            tasks=[tutor_task],
            process=Process.sequential,
            verbose=True
        )
    
    def create_quiz_crew(self, topic: str, quiz_type: str, user_id: str) -> Crew:
        """Create a crew for quiz generation and management"""
        
        quiz_task = Task(
            description=f"""
            Generate a {quiz_type} quiz for the topic: "{topic}"
            
            1. Create appropriate questions based on the topic and user's level
            2. Ensure questions are engaging and educational
            3. Provide clear explanations for correct answers
            
            User ID: {user_id}
            Quiz Type: {quiz_type}
            Topic: {topic}
            """,
            agent=self.quiz_master_agent,
            expected_output="A well-structured quiz with questions, options, and explanations"
        )
        
        return Crew(
            agents=[self.quiz_master_agent],
            tasks=[quiz_task],
            process=Process.sequential,
            verbose=True
        )
    
    def create_calculation_crew(self, calculation_request: Dict[str, Any]) -> Crew:
        """Create a crew for financial calculations"""
        
        calc_task = Task(
            description=f"""
            Perform financial calculation with the following parameters:
            {calculation_request}
            
            1. Execute the appropriate calculation
            2. Provide step-by-step explanation
            3. Include practical advice and disclaimers
            4. Format results in an easy-to-understand manner
            """,
            agent=self.calculation_agent,
            expected_output="Detailed calculation results with explanations and practical advice"
        )
        
        return Crew(
            agents=[self.calculation_agent],
            tasks=[calc_task],
            process=Process.sequential,
            verbose=True
        )
    
    def create_progress_crew(self, user_id: str) -> Crew:
        """Create a crew for progress tracking and analysis"""
        
        progress_task = Task(
            description=f"""
            Analyze learning progress for user: {user_id}
            
            1. Gather all user activity data
            2. Calculate performance metrics
            3. Identify learning patterns and areas for improvement
            4. Provide personalized recommendations
            """,
            agent=self.progress_tracker_agent,
            expected_output="Comprehensive progress analysis with personalized recommendations"
        )
        
        return Crew(
            agents=[self.progress_tracker_agent],
            tasks=[progress_task],
            process=Process.sequential,
            verbose=True
        )

# Global crew instance
money_mentor_crew = MoneyMentorCrew() 