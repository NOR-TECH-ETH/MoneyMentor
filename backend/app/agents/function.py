# message_api.py
import time
import json
import logging
import asyncio
import re
from typing import Dict, Any, List, AsyncIterable
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from app.core.config import settings
from app.services.calculation_service import CalculationService
from app.services.content_service import ContentService
from app.utils.session import get_session, create_session

# Initialize logging
logger = logging.getLogger(__name__)

# Configure OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Define calculator functions for OpenAI function-calling
calculator_functions = [
    {
        "type": "function",
        "function": {
            "name": "credit_card_payoff",
            "description": "Calculate credit card payoff timeline",
            "parameters": {
                "type": "object",
                "properties": {
                    "balance": {"type": "number"},
                    "apr": {"type": "number"},
                    "monthly_payment": {"type": ["number", "null"]},
                    "target_months": {"type": ["integer", "null"]}
                },
                "required": ["balance", "apr"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "savings_goal",
            "description": "Calculate monthly savings needed for a goal",
            "parameters": {
                "type": "object",
                "properties": {
                    "target_amount": {"type": "number"},
                    "target_months": {"type": "integer"},
                    "current_savings": {"type": "number"},
                    "interest_rate": {"type": "number"}
                },
                "required": ["target_amount", "target_months"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "student_loan_amortization",
            "description": "Calculate student loan amortization schedule",
            "parameters": {
                "type": "object",
                "properties": {
                    "principal": {"type": "number"},
                    "apr": {"type": "number"},
                    "target_months": {"type": "integer"},
                    "monthly_payment": {"type": ["number", "null"]}
                },
                "required": ["principal", "apr", "target_months"]
            }
        }
    }
]

class MoneyMentorFunction:
    """Service for handling chat interactions with direct OpenAI function-calling and streaming"""
    
    def __init__(self):
        self.system_prompt = """You are MoneyMentor, a friendly and knowledgeable financial education tutor. Your role is to:

1. Help users understand financial concepts in simple, clear terms
2. Provide educational content about personal finance, budgeting, investing, and debt management
3. Answer questions about financial terms and concepts
4. Guide users through financial calculations when they ask for them
5. Be encouraging and supportive while maintaining accuracy

Key guidelines:
- Always be educational and informative
- Use simple language to explain complex concepts
- Provide practical, actionable advice when appropriate
- Be encouraging and supportive
- If a user asks for a calculation, use the available functions to help them
- Always include a disclaimer that estimates are for educational purposes only

Remember: You're here to educate and empower users with financial knowledge."""
        self.calc_service = CalculationService()
        self.content_service = ContentService()

    async def _save_history(self, session_id: str, role: str, content: str) -> None:
        """Append a message to session chat history"""
        session = await get_session(session_id) or {}
        chat = session.get("chat_history", [])
        chat.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        session["chat_history"] = chat
        await create_session(session_id, session)

    def _format_chat_history(self, history: List[Dict[str, Any]]) -> str:
        return "\n".join(f"{m['role']}: {m['content']}" for m in history)

    async def process_message(
        self,
        message: str,
        chat_history: List[Dict[str, str]],
        session_id: str
    ) -> Dict[str, Any]:
        """Process a message and return a response - this is what chat_service.py expects"""
        try:
            # Get session and chat history
            session = await get_session(session_id) or await create_session(session_id)
            if not session:
                raise HTTPException(status_code=500, detail="Failed to create session")

            # Use provided chat_history or get from session
            if not chat_history:
                chat_history = session.get("chat_history", [])

            # Detect calculation intent
            calc_patterns = [r"\$\d+", r"\d+%", r"\d+ months? to pay"]
            is_calc = any(re.search(p, message.lower()) for p in calc_patterns)

            # Get relevant content context
            content_items = await self.content_service.search_content(message, limit=2, threshold=0.2)
            context_str = "\n".join(item.get('content','')[:200] for item in content_items or [])

            # Build messages for OpenAI
            messages = [
                {"role": "system", "content": self.system_prompt}
            ]
            if context_str:
                messages.append({"role": "system", "content": f"Relevant context: {context_str}"})
            messages.extend(chat_history)
            messages.append({"role": "user", "content": message})

            # Handle calculation requests
            if is_calc:
                return await self._handle_calculation_request(message, messages, session_id)
            else:
                return await self._handle_general_chat(message, messages, session_id)

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "message": "I apologize, but I encountered an error processing your message. Please try again.",
                "session_id": session_id,
                "error": str(e)
            }

    async def _handle_calculation_request(self, message: str, messages: List[Dict], session_id: str) -> Dict[str, Any]:
        """Handle calculation requests with function calling"""
        try:
            # Phase 1: Function calling
            response1 = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=calculator_functions,
                tool_choice="auto",
                temperature=0.0
            )

            # Check if function was called
            if response1.choices[0].finish_reason == "tool_calls":
                tool_call = response1.choices[0].message.tool_calls[0]
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                # Perform calculation
                calc_result = await self.calc_service.calculate(function_name, function_args)

                # Phase 2: Generate explanation with calculation result
                messages.append({
                    "role": "assistant", 
                    "content": None, 
                    "tool_calls": [{"id": "1", "type": "function", "function": {"name": function_name, "arguments": json.dumps(function_args)}}]
                })
                messages.append({
                    "role": "tool", 
                    "tool_call_id": "1",
                    "content": json.dumps(calc_result)
                })

                response2 = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.0
                )

                explanation = response2.choices[0].message.content

                # Save to history
                await self._save_history(session_id, "user", message)
                await self._save_history(session_id, "assistant", explanation)

                return {
                    "message": explanation,
                    "session_id": session_id,
                    "is_calculation": True,
                    "calculation_result": calc_result
                }
            else:
                # No function call - treat as general chat
                return await self._handle_general_chat(message, messages, session_id)

        except Exception as e:
            logger.error(f"Calculation handling failed: {e}")
            return {
                "message": "I apologize, but I encountered an error processing your calculation request. Please check your input and try again.",
                "session_id": session_id,
                "error": str(e)
            }

    async def _handle_general_chat(self, message: str, messages: List[Dict], session_id: str) -> Dict[str, Any]:
        """Handle general chat requests"""
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7
            )

            assistant_message = response.choices[0].message.content

            # Save to history
            await self._save_history(session_id, "user", message)
            await self._save_history(session_id, "assistant", assistant_message)

            return {
                "message": assistant_message,
                "session_id": session_id,
                "is_calculation": False
            }

        except Exception as e:
            logger.error(f"General chat handling failed: {e}")
            return {
                "message": "I apologize, but I encountered an error processing your message. Please try again.",
                "session_id": session_id,
                "error": str(e)
            }

    async def process_and_stream(
        self,
        query: str,
        session_id: str
    ) -> StreamingResponse:
        """Streaming version for real-time responses"""
        # Session management
        session = await get_session(session_id) or await create_session(session_id)
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create session")

        history = session.get("chat_history", [])

        # Detect calculation intent
        calc_patterns = [r"\$\d+", r"\d+%", r"\d+ months? to pay"]
        is_calc = any(re.search(p, query.lower()) for p in calc_patterns)

        # Optional content retrieval
        content_items = await self.content_service.search_content(query, limit=2, threshold=0.2)
        context_str = "\n".join(item.get('content','')[:200] for item in content_items or [])

        # Build base messages
        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        if context_str:
            messages.append({"role": "system", "content": context_str})
        messages.extend(history)
        messages.append({"role": "user", "content": query})

        # Generator for streaming tokens
        async def token_generator():
            # Phase 1: Function-calling for calculations
            if is_calc:
                try:
                    resp1 = await client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=messages,
                        tools=calculator_functions,
                        tool_choice="auto",
                        stream=True
                    )
                    
                    # Collect function call
                    fn_name = None
                    fn_args_str = ""
                    async for chunk in resp1:
                        if chunk.choices[0].delta.tool_calls:
                            tool_call = chunk.choices[0].delta.tool_calls[0]
                            if tool_call.function:
                                if tool_call.function.name:
                                    fn_name = tool_call.function.name
                                if tool_call.function.arguments:
                                    fn_args_str += tool_call.function.arguments
                    
                    # Parse function arguments after collecting complete JSON
                    fn_args = None
                    if fn_name and fn_args_str:
                        try:
                            fn_args = json.loads(fn_args_str)
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse function arguments: {fn_args_str}, error: {e}")
                            # Fall back to non-streaming approach for calculations
                            response = await self._handle_calculation_request(query, messages, session_id)
                            yield response.get("message", "Error processing calculation").encode("utf-8")
                            return
                    
                    if fn_name and fn_args is not None:
                        calc_result = await self.calc_service.calculate(fn_name, fn_args)
                        # Prepare Phase 2
                        messages.append({"role": "assistant", "content": None, "tool_calls": [{"id": "1", "type": "function", "function": {"name": fn_name, "arguments": json.dumps(fn_args)}}]})
                        messages.append({"role": "tool", "tool_call_id": "1", "content": json.dumps(calc_result)})
                        
                        # Phase 2: Explanation stream
                        resp2 = await client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=messages,
                            stream=True
                        )
                        async for chunk in resp2:
                            if chunk.choices[0].delta.content:
                                yield chunk.choices[0].delta.content.encode("utf-8")
                    else:
                        # No function call detected, fall back to general chat
                        response = await self._handle_general_chat(query, messages, session_id)
                        yield response.get("message", "Error processing request").encode("utf-8")
                        
                except Exception as e:
                    logger.error(f"Streaming calculation failed: {e}")
                    yield f"Error processing calculation: {str(e)}".encode("utf-8")
            else:
                # General chat streaming
                resp = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.7,
                    stream=True
                )
                async for chunk in resp:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content.encode("utf-8")

        # Fire-and-forget history saves
        asyncio.create_task(self._save_history(session_id, "user", query))
        # Use a dummy listener to save assistant tokens after streaming complete
        async def wrapped_generator():
            collected = []
            async for token in token_generator():
                collected.append(token.decode('utf-8'))
                yield token
            full_response = ''.join(collected)
            await self._save_history(session_id, "assistant", full_response)

        return StreamingResponse(wrapped_generator(), media_type="text/plain")

# Create a singleton instance
money_mentor_function = MoneyMentorFunction()

