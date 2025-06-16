from fastapi import APIRouter, HTTPException, Depends, Security
from typing import Dict, Any
from app.services.content_service import ContentService
from app.core.dependencies import get_content_service
from app.core.auth import get_current_admin_user

router = APIRouter(
    tags=["Content Management"],
    responses={404: {"description": "Not found"}},
)

# Existing endpoints
@router.post("/search")
async def search_content(query: str):
    """Search content endpoint"""
    pass

@router.get("/search")
async def get_search_results():
    """Get search results endpoint"""
    pass

@router.get("/performance")
async def get_search_performance():
    """Get search performance endpoint"""
    pass

@router.post("/ingest")
async def ingest_document():
    """Ingest document endpoint"""
    pass

@router.post("/upload")
async def upload_content():
    """Upload content endpoint"""
    pass

@router.post("/upload/batch")
async def upload_batch():
    """Upload batch endpoint"""
    pass

# New content management endpoints
@router.delete("/chunks/{file_id}", 
    summary="Delete specific content",
    description="Delete all chunks associated with a specific file ID"
)
async def delete_content(
    file_id: str,
    content_service: ContentService = Depends(get_content_service)
) -> Dict[str, Any]:
    """Delete content chunks for a specific file"""
    success = await content_service.delete_content_chunks(file_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete content")
    return {"status": "success", "message": f"Content for file {file_id} deleted successfully"}

@router.get("/chunks/storage",
    summary="Get storage usage",
    description="Get statistics about content storage usage including total chunks and size"
)
async def get_storage_usage(
    content_service: ContentService = Depends(get_content_service)
) -> Dict[str, Any]:
    """Get storage usage statistics"""
    return await content_service.get_storage_usage()

@router.post("/chunks/cleanup",
    summary="Clean up old content",
    description="Delete content chunks older than specified number of days"
)
async def cleanup_content(
    days: int = 7,
    content_service: ContentService = Depends(get_content_service)
) -> Dict[str, Any]:
    """Clean up content older than specified days"""
    return await content_service.cleanup_old_content(days)

@router.post("/chunks/optimize",
    summary="Optimize storage",
    description="Remove duplicate chunks and optimize storage usage"
)
async def optimize_storage(
    content_service: ContentService = Depends(get_content_service)
) -> Dict[str, Any]:
    """Optimize storage by removing duplicates"""
    return await content_service.optimize_storage()

@router.delete("/chunks/clear-all",
    summary="Clear all content",
    description="Delete all content chunks and reset file statuses. Requires admin authentication.",
    dependencies=[Security(get_current_admin_user)]
)
async def clear_all_content(
    content_service: ContentService = Depends(get_content_service)
) -> Dict[str, Any]:
    """Clear all content chunks and reset file statuses"""
    result = await content_service.clear_all_content()
    if result['status'] == 'error':
        raise HTTPException(status_code=500, detail=result['message'])
    return result 