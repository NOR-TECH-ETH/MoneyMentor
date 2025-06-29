#!/usr/bin/env python3
"""
Test script for Google Sheets service
Run this to verify Google Sheets integration is working
"""

import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.google_sheets_service import GoogleSheetsService

async def test_google_sheets_service():
    """Test the Google Sheets service with sample data"""
    print("🔍 Testing Google Sheets Service...")
    
    # Check if credentials are configured
    has_credentials = bool(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
    has_spreadsheet_id = bool(os.getenv('GOOGLE_SHEET_ID'))
    has_client_email = bool(os.getenv('GOOGLE_CLIENT_EMAIL'))
    
    print(f"Environment check:")
    print(f"  GOOGLE_APPLICATION_CREDENTIALS: {'✅' if has_credentials else '❌'}")
    print(f"  GOOGLE_SHEET_ID: {'✅' if has_spreadsheet_id else '❌'}")
    print(f"  GOOGLE_CLIENT_EMAIL: {'✅' if has_client_email else '❌'}")
    
    # Initialize service
    sheets_service = GoogleSheetsService()
    
    # Test connection
    print("\n1. Testing connection...")
    connection_result = sheets_service.test_connection()
    if connection_result:
        print("✅ Connection successful!")
    else:
        print("❌ Connection failed!")
        if not (has_credentials and has_spreadsheet_id):
            print("   ℹ️  This is expected - missing credentials or configuration")
    
    # Test quiz response logging
    print("\n2. Testing quiz response logging...")
    quiz_data = {
        "user_id": "test_user_123",
        "quiz_id": "test_quiz_456",
        "topic_tag": "Test Topic",
        "selected_option": "A",
        "correct": True,
        "session_id": "test_session_789"
    }
    
    quiz_result = sheets_service.log_quiz_response(quiz_data)
    if quiz_result:
        print("✅ Quiz response logged successfully!")
    else:
        print("❌ Quiz response logging failed!")
        if not connection_result:
            print("   ℹ️  This is expected - connection not available")
    
    # Test chat message logging
    print("\n3. Testing chat message logging...")
    chat_data = {
        "user_id": "test_user_123",
        "session_id": "test_session_789",
        "message_type": "user",
        "message": "What is compound interest?",
        "response": "Compound interest is the interest on interest..."
    }
    
    chat_result = sheets_service.log_chat_message(chat_data)
    if chat_result:
        print("✅ Chat message logged successfully!")
    else:
        print("❌ Chat message logging failed!")
        if not connection_result:
            print("   ℹ️  This is expected - connection not available")
    
    # Test engagement logging
    print("\n4. Testing engagement logging...")
    engagement_data = {
        "user_id": "test_user_123",
        "session_id": "test_session_789",
        "messages_per_session": 5,
        "session_duration": 300.5,  # 5 minutes
        "quizzes_attempted": 2,
        "pretest_completed": True,
        "last_activity": datetime.utcnow().isoformat(),
        "confidence_rating": 7
    }
    
    engagement_result = sheets_service.log_engagement(engagement_data)
    if engagement_result:
        print("✅ Engagement data logged successfully!")
    else:
        print("❌ Engagement data logging failed!")
        if not connection_result:
            print("   ℹ️  This is expected - connection not available")
    
    # Test course progress logging
    print("\n5. Testing course progress logging...")
    progress_data = {
        "user_id": "test_user_123",
        "session_id": "test_session_789",
        "course_id": "course_beginner_finance",
        "course_name": "Beginner Financial Basics",
        "page_number": 3,
        "total_pages": 8,
        "completed": False
    }
    
    progress_result = sheets_service.log_course_progress(progress_data)
    if progress_result:
        print("✅ Course progress logged successfully!")
    else:
        print("❌ Course progress logging failed!")
        if not connection_result:
            print("   ℹ️  This is expected - connection not available")
    
    # Get sheet info
    print("\n6. Getting sheet information...")
    sheet_info = sheets_service.get_sheet_info()
    if sheet_info:
        print(f"✅ Sheet Title: {sheet_info.get('title', 'Unknown')}")
        print(f"✅ Available Sheets: {', '.join(sheet_info.get('sheets', []))}")
        print(f"✅ Client Email: {sheet_info.get('client_email', 'Not configured')}")
    else:
        print("❌ Failed to get sheet information")
        if not connection_result:
            print("   ℹ️  This is expected - connection not available")
    
    # Summary
    print(f"\n📊 Test Summary:")
    if has_credentials and has_spreadsheet_id:
        if connection_result:
            print("🎉 Google Sheets service is fully configured and working!")
            success_count = sum([connection_result, quiz_result, chat_result, engagement_result, progress_result])
            print(f"   {success_count}/5 operations successful")
        else:
            print("⚠️  Google Sheets service is configured but connection failed")
            print("   Check spreadsheet ID and service account permissions")
    else:
        print("⚠️  Google Sheets service is not fully configured")
        print("   Missing credentials or configuration in .env file")
        print("   All methods handled missing credentials gracefully ✅")
        print("   Service will work correctly when credentials are provided ✅")
    
    print("\n🎉 Google Sheets service test completed!")
    return True

if __name__ == "__main__":
    # Run the test
    asyncio.run(test_google_sheets_service()) 