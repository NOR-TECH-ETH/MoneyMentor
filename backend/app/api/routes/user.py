from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, Optional
import logging
from datetime import timedelta

from app.models.schemas import (
    UserCreate, UserLogin, UserUpdate, UserResponse, UserProfileResponse,
    AuthResponse, TokenRefresh, TokenRefreshResponse, LogoutRequest,
    PasswordChange, PasswordReset, PasswordResetConfirm
)
from app.core.auth import (
    authenticate_user, create_user, get_current_active_user, create_access_token,
    create_refresh_token, verify_refresh_token, revoke_refresh_token, revoke_all_user_tokens,
    update_user, change_user_password, get_user_by_email
)
from app.services.user_service import UserService

router = APIRouter()
logger = logging.getLogger(__name__)

def get_user_service() -> UserService:
    """Get UserService instance"""
    return UserService()

@router.post("/register", response_model=AuthResponse)
async def register_user(
    user_data: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    """Register a new user account"""
    try:
        # Check if user already exists
        existing_user = await get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user
        user = await create_user(
            email=user_data.email,
            password=user_data.password,
            first_name=user_data.first_name,
            last_name=user_data.last_name
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user account"
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user["id"]}, expires_delta=access_token_expires
        )
        
        # Create refresh token
        refresh_token = create_refresh_token(user["id"])
        
        # Get user profile
        profile = await user_service.get_user_profile(user["id"])
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse(**user),
            profile=profile
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=AuthResponse)
async def login_user(
    user_data: UserLogin,
    user_service: UserService = Depends(get_user_service)
):
    """Login user and return access token"""
    try:
        # Authenticate user
        user = await authenticate_user(user_data.email, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.get('is_active', True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user["id"]}, expires_delta=access_token_expires
        )
        
        # Create refresh token
        refresh_token = create_refresh_token(user["id"])
        
        # Get user profile
        profile = await user_service.get_user_profile(user["id"])
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse(**user),
            profile=profile
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token_endpoint(token_refresh: TokenRefresh):
    """Refresh access token using a valid refresh token"""
    verified = verify_refresh_token(token_refresh.refresh_token)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    user_id = verified["user_id"]
    user = verified["user"]
    # Issue new access token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    # Issue new refresh token (rotate)
    new_refresh_token = create_refresh_token(user_id)
    # Revoke the old refresh token
    revoke_refresh_token(token_refresh.refresh_token)
    return TokenRefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )

@router.get("/profile", response_model=Dict[str, Any])
async def get_profile(
    current_user: dict = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
):
    """Get current user's profile and statistics"""
    try:
        # Get user profile
        profile = await user_service.get_user_profile(current_user["id"])
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        # Get comprehensive statistics
        statistics = await user_service.get_user_statistics(current_user["id"])
        
        return {
            "user": UserResponse(**current_user),
            "profile": profile,
            "statistics": statistics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get profile"
        )

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update user profile information"""
    try:
        # Convert Pydantic model to dict, excluding None values
        update_data = {k: v for k, v in user_update.dict().items() if v is not None}
        
        if not update_data:
            return UserResponse(**current_user)
        
        # Update user
        updated_user = await update_user(current_user["id"], update_data)
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile"
            )
        
        return UserResponse(**updated_user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )

@router.put("/password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_active_user)
):
    """Change user password"""
    try:
        success = await change_user_password(
            current_user["id"],
            password_data.current_password,
            password_data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to change password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )

@router.post("/password/reset")
async def request_password_reset(password_reset: PasswordReset):
    """Request password reset (sends email)"""
    try:
        # Check if user exists
        user = await get_user_by_email(password_reset.email)
        if not user:
            # Don't reveal if email exists or not
            return {"message": "If the email exists, a reset link has been sent"}
        
        # TODO: Implement email sending with reset token
        # For now, just return success message
        logger.info(f"Password reset requested for {password_reset.email}")
        
        return {"message": "If the email exists, a reset link has been sent"}
        
    except Exception as e:
        logger.error(f"Failed to request password reset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request password reset"
        )

@router.post("/password/reset/confirm")
async def confirm_password_reset(password_reset: PasswordResetConfirm):
    """Confirm password reset with token"""
    try:
        # TODO: Implement token verification and password reset
        # For now, just return success message
        logger.info(f"Password reset confirmed with token: {password_reset.token[:10]}...")
        
        return {"message": "Password reset successfully"}
        
    except Exception as e:
        logger.error(f"Failed to confirm password reset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm password reset"
        )

@router.delete("/account")
async def delete_account(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
):
    """Delete user account and all associated data"""
    try:
        success = await user_service.delete_user_account(
            current_user["id"],
            password_data.current_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is incorrect"
            )
        
        return {"message": "Account deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete account: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )

@router.get("/activity")
async def get_activity_summary(
    days: int = 30,
    current_user: dict = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
):
    """Get user activity summary for the last N days"""
    try:
        if days < 1 or days > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Days must be between 1 and 365"
            )
        
        activity = await user_service.get_user_activity_summary(current_user["id"], days)
        
        return activity
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get activity summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get activity summary"
        )

@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 10,
    user_service: UserService = Depends(get_user_service)
):
    """Get leaderboard data for top users"""
    try:
        if limit < 1 or limit > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit must be between 1 and 100"
            )
        
        leaderboard = await user_service.get_leaderboard_data(limit)
        
        return {
            "leaderboard": leaderboard,
            "total_users": len(leaderboard)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get leaderboard: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get leaderboard"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current user information"""
    return UserResponse(**current_user) 

@router.post("/logout")
async def logout_user(logout_data: LogoutRequest):
    """Logout user by revoking refresh token"""
    try:
        # Verify the refresh token first to ensure it's valid
        verified = verify_refresh_token(logout_data.refresh_token)
        if not verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Revoke the refresh token
        success = revoke_refresh_token(logout_data.refresh_token)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to revoke token"
            )
        
        return {"message": "Successfully logged out"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

@router.post("/logout/all")
async def logout_all_sessions(
    current_user: dict = Depends(get_current_active_user)
):
    """Logout user from all sessions by revoking all refresh tokens"""
    try:
        # Revoke all refresh tokens for the user
        success = revoke_all_user_tokens(current_user["id"])
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to revoke all tokens"
            )
        
        return {"message": "Successfully logged out from all sessions"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Logout all sessions failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout all sessions failed"
        ) 