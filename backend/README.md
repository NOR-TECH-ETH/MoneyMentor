# MoneyMentor Backend API

AI-powered financial education chatbot with quiz engine and calculation services. This is a pure backend API implementation using FastAPI with CrewAI agents for intelligent orchestration.

## Features

- **AI-Powered Chat**: Conversational financial education using GPT-4 models
- **Quiz Engine**: Diagnostic and micro-quizzes with intelligent triggering
- **Financial Calculations**: Debt payoff, savings goals, and loan amortization
- **Content Management**: PDF/document ingestion with vector search
- **Progress Tracking**: User learning analytics and progress monitoring
- **Session Management**: Stateful conversations with Redis caching

## Architecture

- **FastAPI**: Modern Python web framework for APIs
- **CrewAI**: Multi-agent orchestration for intelligent decision-making
- **LangChain**: LLM integration and document processing
- **Supabase**: Vector database for content storage and search
- **Redis**: Session management and caching
- **OpenAI**: GPT-4 and GPT-4-mini for AI responses

## Installation

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy environment variables:
   ```bash
   cp env.example .env
   ```
5. Configure your `.env` file with required API keys and settings

## Environment Variables

Required environment variables (see `env.example`):

- `OPENAI_API_KEY`: OpenAI API key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase anon key
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `GOOGLE_SHEETS_CREDENTIALS_FILE`: Path to Google Sheets credentials JSON
- `GOOGLE_SHEETS_SPREADSHEET_ID`: Google Sheets ID for progress tracking
- `SECRET_KEY`: JWT secret key
- `REDIS_URL`: Redis connection URL

## Running the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Chat API (`/api/chat`)

- `POST /api/chat/message` - Send a chat message
- `POST /api/chat/start-diagnostic` - Start diagnostic quiz
- `GET /api/chat/session/{user_id}` - Get session information
- `POST /api/chat/calculate` - Perform financial calculations

### Quiz API (`/api/quiz`)

- `POST /api/quiz/generate` - Generate a quiz
- `POST /api/quiz/submit` - Submit quiz answer
- `GET /api/quiz/history/{user_id}` - Get quiz history

### Calculation API (`/api/calculation`)

- `POST /api/calculation/debt-payoff` - Calculate debt payoff plan
- `POST /api/calculation/savings-goal` - Calculate savings goal plan
- `POST /api/calculation/loan-amortization` - Calculate loan amortization
- `POST /api/calculation/custom` - Custom financial calculations

### Progress API (`/api/progress`)

- `GET /api/progress/user/{user_id}` - Get user progress
- `GET /api/progress/analytics/{user_id}` - Get learning analytics
- `GET /api/progress/leaderboard` - Get leaderboard
- `POST /api/progress/export/{user_id}` - Export user data

## Usage Examples

### Send a Chat Message

```bash
curl -X POST "http://localhost:8000/api/chat/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I start investing?",
    "user_id": "user123"
  }'
```

### Generate a Quiz

```bash
curl -X POST "http://localhost:8000/api/quiz/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "quiz_type": "micro",
    "topic": "investing basics"
  }'
```

### Calculate Debt Payoff

```bash
curl -X POST "http://localhost:8000/api/calculation/debt-payoff" \
  -H "Content-Type: application/json" \
  -d '{
    "calculation_type": "payoff",
    "principal": 5000,
    "interest_rate": 18.5,
    "monthly_payment": 200
  }'
```

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black .
flake8 .
```

## Deployment

The API is designed to be deployed as a containerized service. Key considerations:

1. Set up environment variables in your deployment environment
2. Configure Redis and Supabase connections
3. Set up Google Sheets API credentials
4. Configure CORS origins for your frontend domains

## License

This project is proprietary software developed for MoneyMentor. 