from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.models.schemas import ProgressData
from app.agents.crew import money_mentor_crew
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/user/{user_id}", response_model=ProgressData)
async def get_user_progress(user_id: str):
    """Get comprehensive user progress analysis using CrewAI progress tracker"""
    try:
        # Create progress crew
        progress_crew = money_mentor_crew.create_progress_crew(user_id)
        
        # Execute the crew
        result = progress_crew.kickoff()
        
        # Parse result into ProgressData format
        return ProgressData(**result)
        
    except Exception as e:
        logger.error(f"Progress retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user progress")

@router.get("/analytics/{user_id}")
async def get_learning_analytics(user_id: str):
    """Get detailed learning analytics and insights"""
    try:
        supabase = get_supabase()
        
        # Get quiz performance data
        quiz_data = supabase.table('quiz_responses').select('*').eq('user_id', user_id).execute()
        
        # Get chat interaction data
        chat_data = supabase.table('chat_history').select('*').eq('user_id', user_id).execute()
        
        # Create progress crew for analysis
        progress_crew = money_mentor_crew.create_progress_crew(user_id)
        analysis = progress_crew.kickoff()
        
        return {
            "user_id": user_id,
            "quiz_performance": quiz_data.data,
            "chat_interactions": len(chat_data.data),
            "ai_analysis": analysis,
            "recommendations": "Generated by AI based on performance patterns"
        }
        
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get learning analytics")

@router.get("/leaderboard")
async def get_leaderboard():
    """Get anonymized leaderboard data"""
    try:
        supabase = get_supabase()
        
        # Get aggregated performance data
        # This would be a more complex query in production
        result = supabase.table('quiz_responses').select('user_id, correct').execute()
        
        # Process leaderboard data (anonymized)
        user_scores = {}
        for response in result.data:
            user_id = response['user_id']
            if user_id not in user_scores:
                user_scores[user_id] = {'correct': 0, 'total': 0}
            
            user_scores[user_id]['total'] += 1
            if response['correct']:
                user_scores[user_id]['correct'] += 1
        
        # Calculate accuracy and create leaderboard
        leaderboard = []
        for i, (user_id, scores) in enumerate(user_scores.items()):
            accuracy = (scores['correct'] / scores['total'] * 100) if scores['total'] > 0 else 0
            leaderboard.append({
                'rank': i + 1,
                'user_id': f"User_{hash(user_id) % 1000}",  # Anonymized
                'accuracy': round(accuracy, 1),
                'total_quizzes': scores['total']
            })
        
        # Sort by accuracy
        leaderboard.sort(key=lambda x: x['accuracy'], reverse=True)
        
        return {
            "leaderboard": leaderboard[:10],  # Top 10
            "total_users": len(user_scores)
        }
        
    except Exception as e:
        logger.error(f"Leaderboard retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get leaderboard")

@router.post("/export/{user_id}")
async def export_user_data(user_id: str):
    """Export user data for analysis (Google Sheets integration)"""
    try:
        # This would integrate with Google Sheets API
        # For now, return the data structure
        
        supabase = get_supabase()
        
        # Get all user data
        quiz_data = supabase.table('quiz_responses').select('*').eq('user_id', user_id).execute()
        chat_data = supabase.table('chat_history').select('*').eq('user_id', user_id).execute()
        
        export_data = {
            "user_id": user_id,
            "export_timestamp": "2024-01-01T00:00:00Z",
            "quiz_responses": quiz_data.data,
            "chat_history": chat_data.data,
            "summary": {
                "total_quizzes": len(quiz_data.data),
                "total_chats": len(chat_data.data),
                "accuracy": "Calculated based on responses"
            }
        }
        
        return {
            "success": True,
            "export_data": export_data,
            "message": "Data prepared for export to Google Sheets"
        }
        
    except Exception as e:
        logger.error(f"Data export failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to export user data") 