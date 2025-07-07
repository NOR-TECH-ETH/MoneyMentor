import asyncio
import logging
from typing import Optional
from datetime import datetime, timedelta
from app.services.google_sheets_service import GoogleSheetsService
from app.services.supabase_listener_service import supabase_listener_service

logger = logging.getLogger(__name__)

class BackgroundSyncService:
    """Service for automatically syncing user profiles to Google Sheets"""
    
    def __init__(self):
        self.sheets_service = GoogleSheetsService()
        self.sync_interval = 300  # 5 minutes
        self.last_sync_time: Optional[datetime] = None
        self.is_running = False
        self.sync_task: Optional[asyncio.Task] = None
        self.notification_sync_delay = 30  # 30 seconds delay after notification
    
    async def start_background_sync(self):
        """Start the background sync service"""
        if self.is_running:
            logger.warning("Background sync service is already running")
            return
        
        self.is_running = True
        logger.info("Starting background sync service for Google Sheets")
        
        # Start the background task
        self.sync_task = asyncio.create_task(self._sync_loop())
        
        logger.info("Background sync service started - will sync every 5 minutes")
    
    async def stop_background_sync(self):
        """Stop the background sync service"""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("Stopping background sync service")
        
        # No external listeners to stop
        pass
        
        if self.sync_task:
            self.sync_task.cancel()
            try:
                await self.sync_task
            except asyncio.CancelledError:
                pass
    
    async def _sync_loop(self):
        """Main sync loop that runs periodically"""
        while self.is_running:
            try:
                await self._perform_sync()
                
                # Wait for the next sync interval
                await asyncio.sleep(self.sync_interval)
                
            except asyncio.CancelledError:
                logger.info("Background sync service cancelled")
                break
            except Exception as e:
                logger.error(f"Error in background sync loop: {e}")
                # Wait a bit before retrying
                await asyncio.sleep(60)
    
    async def _perform_sync(self):
        """Perform the actual sync operation"""
        try:
            logger.debug("Starting background sync to Google Sheets")
            
            # Get all user profiles for export
            user_profiles = await self.sheets_service.get_all_user_profiles_for_export()
            
            if user_profiles:
                # Export to Google Sheets
                success = await self.sheets_service.export_user_profiles_to_sheet(user_profiles)
                
                if success:
                    self.last_sync_time = datetime.utcnow()
                    logger.info(f"Background sync successful: {len(user_profiles)} user profiles synced to Google Sheets")
                else:
                    logger.error("Background sync failed: Could not export to Google Sheets")
            else:
                logger.debug("No user profiles found for background sync")
                
        except Exception as e:
            logger.error(f"Error during background sync: {e}")
    
    # Removed complex notification callbacks - keeping it simple with just background polling
    
    async def force_sync_now(self):
        """Force an immediate sync (useful for testing or manual triggers)"""
        try:
            logger.info("Forcing immediate sync to Google Sheets")
            await self._perform_sync()
            return True
        except Exception as e:
            logger.error(f"Error during forced sync: {e}")
            return False
    
    def get_sync_status(self) -> dict:
        """Get the current sync service status"""
        return {
            "is_running": self.is_running,
            "last_sync_time": self.last_sync_time.isoformat() if self.last_sync_time else None,
            "sync_interval_seconds": self.sync_interval,
            "next_sync_in_seconds": self._get_next_sync_in_seconds(),
            "sync_method": "background_polling"
        }
    
    def _get_next_sync_in_seconds(self) -> Optional[int]:
        """Calculate seconds until next sync"""
        if not self.last_sync_time:
            return 0
        
        next_sync_time = self.last_sync_time + timedelta(seconds=self.sync_interval)
        now = datetime.utcnow()
        
        if next_sync_time > now:
            return int((next_sync_time - now).total_seconds())
        else:
            return 0

# Global instance
background_sync_service = BackgroundSyncService() 