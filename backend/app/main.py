import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import chat, quiz, calculation, progress, content, course, streaming_chat, user

port = int(os.environ.get("PORT", 8080))
# Log the allowed origins
print("✅ Allowed CORS origins:", settings.CORS_ORIGINS)
app = FastAPI(
    title="MoneyMentor API",
    description="AI-powered financial education chatbot with quiz engine and calculation services",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(calculation.router, prefix="/api/calculation", tags=["calculation"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(content.router, prefix="/api", tags=["Content Management"])
app.include_router(course.router, prefix="/api/course", tags=["course"])
app.include_router(streaming_chat.router, prefix="/api/streaming", tags=["streaming"])
app.include_router(user.router, prefix="/api/user", tags=["user"])

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "MoneyMentor API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "MoneyMentor API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.DEBUG,
        log_level="info"
    ) 
