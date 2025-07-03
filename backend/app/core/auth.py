from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
from app.core.config import settings
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token configuration
SECRET_KEY = getattr(settings, 'SECRET_KEY', 'your-secret-key-here-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = getattr(settings, 'ACCESS_TOKEN_EXPIRE_MINUTES', 60 * 24 * 30)  # 30 days default

# Security scheme
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return payload
    except JWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    supabase = get_supabase()
    try:
        result = supabase.table('users').select('*').eq('id', user_id).single().execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = result.data
        if not user.get('is_active', True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user
        
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_active_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Get current active user"""
    if not current_user.get('is_active', True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

async def authenticate_user(email: str, password: str) -> Optional[dict]:
    """Authenticate a user with email and password"""
    supabase = get_supabase()
    try:
        result = supabase.table('users').select('*').eq('email', email).single().execute()
        if not result.data:
            return None
        
        user = result.data
        if not verify_password(password, user['password_hash']):
            return None
        
        return user
        
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        return None

async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email"""
    supabase = get_supabase()
    try:
        result = supabase.table('users').select('*').eq('email', email).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error fetching user by email: {e}")
        return None

async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get user by ID"""
    supabase = get_supabase()
    try:
        result = supabase.table('users').select('*').eq('id', user_id).single().execute()
        return result.data if result.data else None
    except Exception as e:
        logger.error(f"Error fetching user by ID: {e}")
        return None

async def create_user(email: str, password: str, first_name: str, last_name: str) -> Optional[dict]:
    """Create a new user"""
    supabase = get_supabase()
    try:
        # Check if user already exists
        existing_user = await get_user_by_email(email)
        if existing_user:
            return None
        
        # Hash password
        hashed_password = get_password_hash(password)
        
        # Create user
        user_data = {
            'email': email,
            'password_hash': hashed_password,
            'first_name': first_name,
            'last_name': last_name,
            'is_active': True,
            'is_verified': False
        }
        
        result = supabase.table('users').insert(user_data).execute()
        if result.data:
            return result.data[0]
        
        return None
        
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return None

async def update_user(user_id: str, update_data: dict) -> Optional[dict]:
    """Update user information"""
    supabase = get_supabase()
    try:
        # Remove sensitive fields that shouldn't be updated directly
        update_data.pop('password_hash', None)
        update_data.pop('id', None)
        update_data.pop('created_at', None)
        
        # Add updated_at timestamp
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        result = supabase.table('users').update(update_data).eq('id', user_id).execute()
        if result.data:
            return result.data[0]
        
        return None
        
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        return None

async def delete_user(user_id: str) -> bool:
    """Delete a user account"""
    supabase = get_supabase()
    try:
        result = supabase.table('users').delete().eq('id', user_id).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        return False

async def change_user_password(user_id: str, current_password: str, new_password: str) -> bool:
    """Change user password"""
    try:
        # Get current user
        user = await get_user_by_id(user_id)
        if not user:
            return False
        
        # Verify current password
        if not verify_password(current_password, user['password_hash']):
            return False
        
        # Hash new password
        new_password_hash = get_password_hash(new_password)
        
        # Update password
        supabase = get_supabase()
        result = supabase.table('users').update({
            'password_hash': new_password_hash,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', user_id).execute()
        
        return bool(result.data)
        
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        return False 