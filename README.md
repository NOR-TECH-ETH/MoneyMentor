# Quiz API Documentation

## Base URL
```
http://localhost:8000/api/quiz
```

## Endpoints

### 1. Generate Quiz
**POST** `/generate`

Generates quiz questions based on chat history or creates a diagnostic quiz.

#### Request Body
```json
{
  "session_id": "string",
  "quiz_type": "micro" | "diagnostic",
  "difficulty": "easy" | "medium" | "hard" (optional, default: "medium")
}
```

#### Response
```json
{
  "questions": [
    {
      "question": "What is compound interest?",
      "choices": {
        "a": "Interest earned only on the principal",
        "b": "Interest earned on principal and accumulated interest",
        "c": "A type of loan",
        "d": "A savings account feature"
      },
      "correct_answer": "b",
      "explanation": "Compound interest is interest earned on both the principal and any accumulated interest."
    }
  ],
  "quiz_id": "quiz_1234567890_1703123456.789",
  "quiz_type": "micro"
}
```

#### Notes
- **No chat history**: Returns 10 diagnostic questions from knowledge base
- **With chat history**: Returns 1 micro-quiz question about recent topics
- `quiz_id` is auto-generated and required for submission

---

### 2. Submit Quiz
**POST** `/submit`

Submits one or more quiz responses. Supports both single and batch submissions.

#### Request Body
```json
{
  "user_id": "string",
  "quiz_type": "micro" | "diagnostic",
  "responses": [
    {
      "quiz_id": "quiz_1234567890_1703123456.789",
      "selected_option": "B",
      "correct": true,
      "topic": "Investing"
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "message": "Quiz submission(s) successful: 7/10 correct",
  "data": {
    "user_id": "user123",
    "quiz_type": "diagnostic",
    "total_responses": 10,
    "correct_responses": 7,
    "overall_score": 70.0,
    "topic_breakdown": {
      "Investing": {
        "total": 3,
        "correct": 2
      },
      "Budgeting": {
        "total": 3,
        "correct": 2
      },
      "Saving": {
        "total": 2,
        "correct": 1
      },
      "Debt Management": {
        "total": 2,
        "correct": 2
      }
    },
    "google_sheets_logged": true,
    "google_sheets_url": "https://docs.google.com/spreadsheets/d/1dj0l7UBaG-OkQKtSfrlf_7uDdhJu7g65OapGeKgC6bs/edit?gid=1325423234#gid=1325423234"
  }
}
```

#### Notes
- **Single quiz**: Send 1 response in the array
- **Batch quiz**: Send multiple responses (e.g., diagnostic quiz with 10 questions)
- `selected_option` must be "A", "B", "C", or "D"
- `correct` should be `true`/`false` based on frontend validation
- Data is automatically saved to database and Google Sheets
- **Google Sheets access**: Users can view their quiz data using the provided `google_sheets_url`

---

## Data Types

### Quiz Types
- `"micro"`: Single question quiz (1 question)
- `"diagnostic"`: Comprehensive quiz (10 questions)

### Answer Options
- `"A"`, `"B"`, `"C"`, `"D"` (uppercase letters only)

### Topics
Common topics include:
- "Investing"
- "Budgeting" 
- "Saving"
- "Debt Management"
- "Emergency Fund"
- "Credit Cards"
- "Financial Goals"

---

## Integration Flow

### 1. Generate Quiz
```javascript
// Generate quiz
const response = await fetch('/api/quiz/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: "user_session_123",
    quiz_type: "micro",
    difficulty: "medium"
  })
});

const quizData = await response.json();
// Display quizData.questions to user
```

### 2. Submit Quiz
```javascript
// Submit quiz response
const submitResponse = await fetch('/api/quiz/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: "user123",
    quiz_type: "micro",
    responses: [
      {
        quiz_id: quizData.quiz_id,
        selected_option: "B",
        correct: true, // Frontend should validate this
        topic: "Investing"
      }
    ]
  })
});

const result = await submitResponse.json();
// Show result.data.overall_score and feedback
// Provide Google Sheets link: result.data.google_sheets_url
```

---

## Error Handling

### Common Error Responses
```json
{
  "detail": "Failed to generate quiz"
}
```
```json
{
  "detail": "Failed to submit quiz responses: [error details]"
}
```

### Validation Errors
- `selected_option` must be A, B, C, or D
- `responses` array cannot be empty
- All required fields must be present

---

## Testing

### Test Single Quiz
```bash
curl -X POST "http://localhost:8000/api/quiz/generate" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test123", "quiz_type": "micro"}'
```

### Test Quiz Submission
```bash
curl -X POST "http://localhost:8000/api/quiz/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "quiz_type": "micro",
    "responses": [{
      "quiz_id": "quiz_test_123",
      "selected_option": "B",
      "correct": true,
      "topic": "Investing"
    }]
  }'
```

---

## Notes for Frontend Developer

1. **Session Management**: Always provide a valid `session_id` for quiz generation
2. **Quiz ID**: Use the `quiz_id` from generate response in submit request
3. **Validation**: Frontend should validate answers before sending `correct` field
4. **Batch Support**: Use batch submission for diagnostic quizzes (10 questions)
5. **Real-time Updates**: Quiz data is automatically logged to Google Sheets
6. **Google Sheets Access**: Provide users with the `google_sheets_url` from the response
7. **Error Handling**: Implement proper error handling for network issues
8. **User Feedback**: Use `overall_score` and `topic_breakdown` for user feedback
