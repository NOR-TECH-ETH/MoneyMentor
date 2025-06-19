import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
import json
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleSheetsService:
    """Service for interacting with Google Sheets for quiz response logging
    
    Client Requirements:
    - Sheet schema (QuizResponses tab): user_id | timestamp | quiz_id | topic | selected | correct
    - Access: Share-locked to client email; dev writes via Google Sheets API
    - Additional tabs (optional): ConfidencePolls, UsageLogs
    """
    
    def __init__(self):
        self.service = None
        self.drive_service = None
        self.spreadsheet_id = os.getenv('GOOGLE_SHEET_ID')
        self.client_email = os.getenv('GOOGLE_CLIENT_EMAIL')  # Client's email for access
        self._init_service()
    
    def _init_service(self):
        """Initialize Google Sheets and Drive services with service account credentials"""
        try:
            # Get the path to the service account JSON file
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if not credentials_path:
                logger.warning("GOOGLE_APPLICATION_CREDENTIALS not set")
                return
            
            # Resolve the path relative to the backend directory
            backend_dir = Path(__file__).resolve().parent.parent.parent
            credentials_file = backend_dir / credentials_path
            
            if not credentials_file.exists():
                logger.error(f"Service account credentials file not found: {credentials_file}")
                return
            
            # Load credentials from file
            with open(credentials_file, 'r') as f:
                credentials_dict = json.load(f)
            
            # Create credentials with required scopes
            credentials = Credentials.from_service_account_info(
                credentials_dict,
                scopes=[
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            )
            
            # Build services
            self.service = build('sheets', 'v4', credentials=credentials)
            self.drive_service = build('drive', 'v3', credentials=credentials)
            logger.info("Google Sheets and Drive services initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets service: {e}")
            self.service = None
            self.drive_service = None
    
    def setup_client_access(self) -> bool:
        """
        Set up client access to the Google Sheet
        
        This method:
        1. Creates the sheet if it doesn't exist
        2. Sets up the QuizResponses tab with proper headers
        3. Shares the sheet with the client's email (read-only)
        4. Creates optional tabs (ConfidencePolls, UsageLogs)
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.service or not self.drive_service:
                logger.error("Google services not initialized")
                return False
            
            if not self.spreadsheet_id:
                logger.error("Spreadsheet ID not configured")
                return False
            
            if not self.client_email:
                logger.error("Client email not configured")
                return False
            
            # 1. Check if sheet exists and create if needed
            try:
                sheet_info = self.service.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id
                ).execute()
                logger.info(f"Sheet exists: {sheet_info.get('properties', {}).get('title', 'Unknown')}")
            except HttpError as e:
                if e.resp.status == 404:
                    logger.error("Spreadsheet not found. Please create it and share with service account.")
                    return False
                else:
                    raise e
            
            # 2. Set up QuizResponses tab with headers
            headers = ['user_id', 'timestamp', 'quiz_id', 'topic', 'selected', 'correct']
            
            # Check if headers already exist
            try:
                existing_headers = self.service.spreadsheets().values().get(
                    spreadsheetId=self.spreadsheet_id,
                    range='QuizResponses!A1:F1'
                ).execute()
                
                if not existing_headers.get('values'):
                    # Set up headers
                    header_body = {
                        'values': [headers]
                    }
                    self.service.spreadsheets().values().update(
                        spreadsheetId=self.spreadsheet_id,
                        range='QuizResponses!A1:F1',
                        valueInputOption='RAW',
                        body=header_body
                    ).execute()
                    logger.info("QuizResponses headers set up successfully")
                else:
                    logger.info("QuizResponses headers already exist")
                    
            except HttpError as e:
                if e.resp.status == 400:
                    # Tab doesn't exist, create it
                    self._create_quiz_responses_tab(headers)
                else:
                    raise e
            
            # 3. Share with client email (read-only)
            self._share_with_client()
            
            # 4. Create optional tabs
            self._create_optional_tabs()
            
            logger.info("Client access setup completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup client access: {e}")
            return False
    
    def _create_quiz_responses_tab(self, headers: List[str]):
        """Create the QuizResponses tab with headers"""
        try:
            # Add new sheet
            add_sheet_request = {
                'addSheet': {
                    'properties': {
                        'title': 'QuizResponses',
                        'gridProperties': {
                            'rowCount': 1000,
                            'columnCount': 6
                        }
                    }
                }
            }
            
            body = {
                'requests': [add_sheet_request]
            }
            
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            # Add headers
            header_body = {
                'values': [headers]
            }
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range='QuizResponses!A1:F1',
                valueInputOption='RAW',
                body=header_body
            ).execute()
            
            logger.info("QuizResponses tab created with headers")
            
        except Exception as e:
            logger.error(f"Failed to create QuizResponses tab: {e}")
            raise e
    
    def _share_with_client(self):
        """Share the spreadsheet with the client email (read-only)"""
        try:
            # Check if already shared
            permissions = self.drive_service.permissions().list(
                fileId=self.spreadsheet_id
            ).execute()
            
            client_shared = any(
                perm.get('emailAddress') == self.client_email 
                for perm in permissions.get('permissions', [])
            )
            
            if not client_shared:
                # Share with client (read-only) with improved notification
                permission = {
                    'type': 'user',
                    'role': 'reader',
                    'emailAddress': self.client_email
                }
                
                # Create a professional email message to reduce spam filtering
                email_message = f"""
Hello,

You have been granted access to the AI Chatbot Logs spreadsheet for quiz response tracking.

Spreadsheet Details:
- Title: AI Chatbot Logs
- Purpose: Track quiz responses and user progress
- Access Level: Read-only
- Main Tab: QuizResponses (contains quiz data)

You can access the spreadsheet at:
https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}

The QuizResponses tab contains the following columns:
- user_id: Unique identifier for each user
- timestamp: When the quiz was taken
- quiz_id: Identifier for the specific quiz
- topic_tag: The topic being tested
- selected_option: User's answer (A, B, C, or D)
- correct: Whether the answer was correct (TRUE/FALSE)
- session_id: Session identifier (if applicable)

This is an automated notification from the MoneyMentor AI Chatbot system.

Best regards,
MoneyMentor Team
                """.strip()
                
                self.drive_service.permissions().create(
                    fileId=self.spreadsheet_id,
                    body=permission,
                    sendNotificationEmail=True,
                    emailMessage=email_message
                ).execute()
                
                logger.info(f"Shared spreadsheet with client: {self.client_email}")
            else:
                logger.info("Spreadsheet already shared with client")
                
        except Exception as e:
            logger.error(f"Failed to share with client: {e}")
            raise e
    
    def _create_optional_tabs(self):
        """Create optional tabs: ConfidencePolls, UsageLogs"""
        try:
            optional_tabs = ['ConfidencePolls', 'UsageLogs']
            
            for tab_name in optional_tabs:
                try:
                    # Check if tab exists
                    self.service.spreadsheets().values().get(
                        spreadsheetId=self.spreadsheet_id,
                        range=f'{tab_name}!A1:A1'
                    ).execute()
                    logger.info(f"Tab {tab_name} already exists")
                    
                except HttpError as e:
                    if e.resp.status == 400:
                        # Tab doesn't exist, create it
                        add_sheet_request = {
                            'addSheet': {
                                'properties': {
                                    'title': tab_name,
                                    'gridProperties': {
                                        'rowCount': 1000,
                                        'columnCount': 10
                                    }
                                }
                            }
                        }
                        
                        body = {
                            'requests': [add_sheet_request]
                        }
                        
                        self.service.spreadsheets().batchUpdate(
                            spreadsheetId=self.spreadsheet_id,
                            body=body
                        ).execute()
                        
                        logger.info(f"Optional tab {tab_name} created")
                    else:
                        raise e
                        
        except Exception as e:
            logger.error(f"Failed to create optional tabs: {e}")
            # Don't raise - optional tabs are not critical
    
    def log_quiz_response(self, quiz_data: Dict[str, Any]) -> bool:
        """
        Log a quiz response to Google Sheets QuizResponses tab
        
        Args:
            quiz_data: Dictionary containing:
                - user_id: str
                - quiz_id: str
                - topic: str
                - selected: str (A, B, C, or D)
                - correct: bool
                - quiz_type: str (optional)
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.service or not self.spreadsheet_id:
                logger.warning("Google Sheets service not available")
                return False
            
            # Prepare data row according to client schema
            # Schema: user_id | timestamp | quiz_id | topic | selected | correct
            row_data = [
                quiz_data.get('user_id', ''),
                datetime.utcnow().isoformat(),  # timestamp
                quiz_data.get('quiz_id', ''),
                quiz_data.get('topic', ''),
                quiz_data.get('selected', ''),  # A, B, C, or D
                'TRUE' if quiz_data.get('correct', False) else 'FALSE'
            ]
            
            # Append to QuizResponses tab
            body = {
                'values': [row_data]
            }
            
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range='QuizResponses!A:F',
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()
            
            logger.info(f"Quiz response logged to Google Sheets: {result.get('updates', {}).get('updatedRows', 0)} rows updated")
            return True
            
        except HttpError as e:
            logger.error(f"Google Sheets API error: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to log quiz response to Google Sheets: {e}")
            return False
    
    def log_multiple_responses(self, responses: List[Dict[str, Any]]) -> bool:
        """
        Log multiple quiz responses in a batch
        
        Args:
            responses: List of quiz response dictionaries
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.service or not self.spreadsheet_id:
                logger.warning("Google Sheets service not available")
                return False
            
            # Prepare batch data according to client schema
            rows_data = []
            for response in responses:
                row_data = [
                    response.get('user_id', ''),
                    datetime.utcnow().isoformat(),
                    response.get('quiz_id', ''),
                    response.get('topic', ''),
                    response.get('selected', ''),  # A, B, C, or D
                    'TRUE' if response.get('correct', False) else 'FALSE'
                ]
                rows_data.append(row_data)
            
            # Append batch to QuizResponses tab
            body = {
                'values': rows_data
            }
            
            result = self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range='QuizResponses!A:F',
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()
            
            logger.info(f"Batch quiz responses logged to Google Sheets: {result.get('updates', {}).get('updatedRows', 0)} rows updated")
            return True
            
        except HttpError as e:
            logger.error(f"Google Sheets API error: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to log batch quiz responses to Google Sheets: {e}")
            return False
    
    def test_connection(self) -> bool:
        """
        Test the Google Sheets connection and client access
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            if not self.service or not self.spreadsheet_id:
                return False
            
            # Try to read the first row of QuizResponses tab
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range='QuizResponses!A1:F1'
            ).execute()
            
            logger.info("Google Sheets connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"Google Sheets connection test failed: {e}")
            return False
    
    def get_sheet_info(self) -> Optional[Dict[str, Any]]:
        """
        Get information about the Google Sheet and access permissions
        
        Returns:
            Dict containing sheet information or None if failed
        """
        try:
            if not self.service or not self.spreadsheet_id:
                return None
            
            # Get sheet info
            result = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id
            ).execute()
            
            # Get permissions
            permissions_info = None
            if self.drive_service:
                try:
                    permissions = self.drive_service.permissions().list(
                        fileId=self.spreadsheet_id
                    ).execute()
                    permissions_info = [
                        {
                            'email': perm.get('emailAddress'),
                            'role': perm.get('role'),
                            'type': perm.get('type')
                        }
                        for perm in permissions.get('permissions', [])
                    ]
                except Exception as e:
                    logger.warning(f"Could not retrieve permissions: {e}")
            
            return {
                'title': result.get('properties', {}).get('title', ''),
                'sheets': [sheet.get('properties', {}).get('title', '') for sheet in result.get('sheets', [])],
                'spreadsheet_id': self.spreadsheet_id,
                'client_email': self.client_email,
                'permissions': permissions_info
            }
            
        except Exception as e:
            logger.error(f"Failed to get sheet info: {e}")
            return None 