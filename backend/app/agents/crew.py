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
            request_timeout=30,
            max_retries=2,
            streaming=False,
            provider="openai"
        )
        
        self.llm_gpt4_mini = ChatOpenAI(
            model_name=settings.OPENAI_MODEL_GPT4_MINI,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.3,
            request_timeout=30,
            max_retries=2,
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
                        {context if context else "No specific content found in knowledge base - use your general financial education knowledge"}
                        
                        User message: {message}
                        
                        Previous chat history:
                        {self._format_chat_history(chat_history)}
                        
                        IMPORTANT CALCULATION DETECTION:
                        If the user asks for financial calculations (like "how much", "how long", "payoff", "savings", "loan"), 
                        use the FinancialCalculatorTool to provide accurate, deterministic results. The tool supports:
                        1. Credit-card payoff timeline (calculation_type: "credit_card_payoff")
                        2. Savings goal projection (calculation_type: "savings_goal") 
                        3. Student-loan amortisation (calculation_type: "student_loan")
                        
                        When using the FinancialCalculatorTool:
                        - Extract the relevant parameters from the user's message
                        - Use EXACT parameter names:
                          * credit_card_payoff: {{"balance": amount, "apr": rate, "target_months": months}}
                          * savings_goal: {{"target_amount": amount, "interest_rate": rate, "target_months": months}}
                          * student_loan: {{"principal": amount, "interest_rate": rate, "monthly_payment": payment}}
                        - Call the tool with the appropriate calculation_type and params
                        
                        MANDATORY STEP 3 FORMAT - YOU MUST FOLLOW THIS EXACTLY:
                        After getting calculation results from FinancialCalculatorTool, your response MUST follow this format:
                        
                        1. START with: "Here is your calculation result:"
                        2. PASTE the complete JSON result in a code block like this:
                        ```json
                        [PASTE THE EXACT JSON FROM THE TOOL HERE]
                        ```
                        3. THEN explain the results, referencing specific JSON fields by name
                        4. END with exactly: "Estimates only. Verify with a certified financial professional."
                        
                        CRITICAL: You MUST include the raw tool output in your response so it can be properly formatted.
                        The tool output will look like: {{"success": True, "result": {{"monthly_payment": 561.57, ...}}, "_step3_marker": "CALCULATION_RESULT_READY_FOR_FORMATTING"}}
                        
                        EXAMPLE RESPONSE FORMAT:
                        Here is your calculation result:
                        ```json
                        {{
                          "monthly_payment": 561.57,
                          "months_to_payoff": 12,
                          "total_interest": 738.8,
                          "step_by_step_plan": [
                            "Starting balance: $6,000.00",
                            "APR: 22.0% (monthly rate: 1.83%)",
                            "Monthly payment: $561.57"
                          ]
                        }}
                        ```
                        
                        Based on the calculation results, your 'monthly_payment' would be $561.57. The 'months_to_payoff' shows it will take 12 months to clear the debt. The 'total_interest' you'll pay is $738.80. Following the 'step_by_step_plan' will help you stay on track.
                        
                        Estimates only. Verify with a certified financial professional.
                        
                        For general financial questions, use the ContentRetrievalTool with both query and limit parameters:
                        - query: the search term from the user's question
                        - limit: 5 (default number of results)
                        
                        If no specific content is found in the knowledge base, use your general financial education expertise to provide accurate, helpful information. Always aim to be educational and informative, even when specific content isn't available.
                        
                        Keep your responses natural and conversational while maintaining professionalism.
                        """,
                        agent=self.financial_tutor_agent,
                        expected_output="A friendly and helpful response that matches the tone of the user's message. If calculations are performed, you MUST include the structured JSON results in your explanation and provide a comprehensive step-by-step breakdown. Always end with the exact disclaimer: 'Estimates only. Verify with a certified financial professional.'"
                    )
                ],
                process=Process.sequential,
                verbose=False  # Reduced logging overhead for faster responses
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
                
                # Post-processing: Enforce Step 3 format if calculation was performed but format is missing
                def needs_step3_enforcement(msg):
                    # More specific detection based on client requirements
                    # Focus on numeric/"how much/how long" queries, not general financial terms
                    
                    # Check for calculation-specific patterns (more restrictive)
                    calculation_patterns = [
                        r'\$\d+',  # Dollar amounts
                        r'\d+\s*%',  # Percentage rates
                        r'\d+\s*(?:months?|years?)',  # Time periods
                        r'how\s+much',  # "how much" queries
                        r'how\s+long',  # "how long" queries
                        r'payoff',  # Payoff timeline
                        r'amortiz',  # Amortization
                        r'monthly\s+payment',  # Monthly payment
                        r'clear\s+(?:it|the\s+debt)',  # Clear debt
                        r'reach\s+(?:goal|target)',  # Reach goal
                        r'borrow\s+\$\d+',  # Borrow amounts
                        r'repay\s+with\s+\$\d+',  # Repay with amounts
                    ]
                    
                    # Check if message contains calculation patterns
                    import re
                    has_calculation_pattern = any(re.search(pattern, msg.lower()) for pattern in calculation_patterns)
                    
                    # Additional check for specific calculation keywords (more restrictive)
                    calculation_keywords = [
                        'payoff timeline',
                        'savings goal projection', 
                        'student-loan amortisation',
                        'monthly payment',
                        'months to payoff',
                        'total interest'
                    ]
                    
                    has_calculation_keyword = any(keyword in msg.lower() for keyword in calculation_keywords)
                    
                    # Exclude educational questions that start with "why", "what", "how" (without numbers)
                    educational_patterns = [
                        r'^why\s+',  # Questions starting with "why"
                        r'^what\s+is',  # Questions starting with "what is"
                        r'^explain\s+',  # Questions starting with "explain"
                        r'^describe\s+',  # Questions starting with "describe"
                        r'^tell\s+me\s+about',  # Questions starting with "tell me about"
                    ]
                    
                    is_educational_question = any(re.search(pattern, msg.lower()) for pattern in educational_patterns)
                    
                    # Only trigger if calculation patterns exist AND it's not an educational question AND no JSON block exists
                    return (
                        (has_calculation_pattern or has_calculation_keyword) and
                        not is_educational_question and
                        '```json' not in msg
                    )

                # Enhanced post-processing: Capture tool outputs from the crew execution
                calculation_result = None
                
                # Try to extract calculation result from the crew's execution logs
                if hasattr(chat_crew, 'tasks') and chat_crew.tasks:
                    for task in chat_crew.tasks:
                        if hasattr(task, 'output') and task.output:
                            # Look for tool output in task execution
                            task_str = str(task.output)
                            if 'Financial Calculator' in task_str:
                                import re
                                import json
                                import ast
                                
                                # Try to extract the tool output
                                tool_pattern = r"Tool Output:\s*({[\s\S]*?})\s*\n"
                                match = re.search(tool_pattern, task_str)
                                if match:
                                    try:
                                        # Try JSON first, then ast.literal_eval
                                        try:
                                            tool_dict = json.loads(match.group(1).replace("'", '"'))
                                        except Exception:
                                            tool_dict = ast.literal_eval(match.group(1))
                                        
                                        if 'result' in tool_dict:
                                            calculation_result = tool_dict['result']
                                            logger.info("Successfully extracted calculation result from task output")
                                    except Exception as e:
                                        logger.error(f"Failed to parse tool output from task: {e}")
                
                # Alternative: Look for the special marker in the result string itself
                if not calculation_result:
                    import re
                    import json
                    import ast
                    
                    # Look for the special marker pattern
                    marker_pattern = r"\{[^}]*\"_step3_marker\"[^}]*\"CALCULATION_RESULT_READY_FOR_FORMATTING\"[^}]*\}"
                    match = re.search(marker_pattern, str(result))
                    if match:
                        try:
                            # Try to parse the dict containing the marker
                            try:
                                tool_dict = json.loads(match.group(0).replace("'", '"'))
                            except Exception:
                                tool_dict = ast.literal_eval(match.group(0))
                            
                            if 'result' in tool_dict:
                                calculation_result = tool_dict['result']
                                logger.info("Successfully extracted calculation result using marker")
                            
                            # Check if there's a pre-formatted response
                            if '_formatted_response' in tool_dict:
                                result = tool_dict['_formatted_response']
                                logger.info("Applied pre-formatted response from tool")
                                calculation_result = None  # Skip further processing
                        except Exception as e:
                            logger.error(f"Failed to parse tool output with marker: {e}")
                
                # If we found a calculation result, enforce Step 3 format
                if calculation_result and needs_step3_enforcement(str(result)):
                    import json
                    formatted_response = f"""Here is your calculation result:
```json
{json.dumps(calculation_result, indent=2)}
```

Based on the calculation results, your 'monthly_payment' would be ${calculation_result.get('monthly_payment', 'N/A')}. The 'months_to_payoff' shows it will take {calculation_result.get('months_to_payoff', 'N/A')} months to clear the debt or reach your goal. The 'total_interest' you'll pay or earn is ${calculation_result.get('total_interest', 'N/A')}. Following the 'step_by_step_plan' will help you stay on track.

Estimates only. Verify with a certified financial professional."""
                    
                    result = formatted_response
                    logger.info("Applied Step 3 format enforcement with captured tool output")
                
                # Fallback: If no calculation result was captured but enforcement is needed
                elif needs_step3_enforcement(str(result)):
                    import re
                    import json
                    import ast
                    extracted = None
                    # Try to extract tool output from logs or agent output
                    tool_output_pattern = r"Tool Output:\s*({[\s\S]*?})\s*\n"
                    match = re.search(tool_output_pattern, str(result))
                    if match:
                        try:
                            # Try JSON first
                            try:
                                tool_dict = json.loads(match.group(1).replace("'", '"'))
                            except Exception:
                                tool_dict = ast.literal_eval(match.group(1))
                            if 'result' in tool_dict:
                                extracted = tool_dict['result']
                        except Exception as e:
                            logger.error(f"Failed to parse tool output: {e}")
                    # If not found, try to extract a JSON-like dict from the message (single or double quotes)
                    if not extracted:
                        json_like_pattern = r"\{[\s\S]*?monthly_payment[\s\S]*?\}"  # greedy match for any dict with monthly_payment
                        match2 = re.search(json_like_pattern, str(result))
                        if match2:
                            try:
                                try:
                                    extracted = json.loads(match2.group(0).replace("'", '"'))
                                except Exception:
                                    extracted = ast.literal_eval(match2.group(0))
                            except Exception as e:
                                logger.error(f"Failed to parse inline JSON: {e}")
                    # If still not found, fallback
                    if extracted:
                        formatted_response = f"""Here is your calculation result:\n```json\n{json.dumps(extracted, indent=2)}\n```\n\nBased on the calculation results, your 'monthly_payment' would be ${extracted.get('monthly_payment', 'N/A')}. The 'months_to_payoff' shows it will take {extracted.get('months_to_payoff', 'N/A')} months to clear the debt or reach your goal. The 'total_interest' you'll pay or earn is ${extracted.get('total_interest', 'N/A')}. Following the 'step_by_step_plan' will help you stay on track.\n\nEstimates only. Verify with a certified financial professional."""
                        result = formatted_response
                        logger.info("Applied robust post-processing to enforce Step 3 format")
                    else:
                        # Fallback message
                        result = ("[Formatting Error] The calculation was performed but the response did not follow the required format. "
                                  "Please try rephrasing your question or contact support if this persists.\n\nEstimates only. Verify with a certified financial professional.")
                        logger.warning("Step 3 enforcement failed: could not extract calculation result.")
                
                # Initialize response dictionary
                response = {
                    "message": result,
                    "session_id": session_id,
                    "quiz": None
                }
                
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
                 "making informed financial decisions. When users ask for financial calculations, "
                 "use the FinancialCalculatorTool to provide accurate, deterministic results.",
            backstory="You are an experienced financial educator with expertise in teaching "
                     "complex financial concepts in simple, understandable terms. You have "
                     "access to comprehensive course materials and can retrieve relevant "
                     "information to answer user questions accurately. You can also perform "
                     "precise financial calculations for debt payoff, savings goals, and loan "
                     "amortization using mathematical formulas.",
            tools=[ContentRetrievalTool(), FinancialCalculatorTool()],
            llm=self.llm_gpt4_mini,
            verbose=False,  # Reduced logging overhead for faster responses
            allow_delegation=False,  # Disable delegation to prevent unnecessary iterations
            max_iter=2,  # Reduced from 5 to speed up responses
            max_rpm=10,   # Increased RPM to reduce waiting time
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