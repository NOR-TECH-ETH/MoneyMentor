import { ChatResponse, DiagnosticTest, QuizSession, QuizQuestion } from '../../types';

export interface ApiConfig {
  apiUrl: string;
  userId: string;
  sessionId: string;
}

// Get environment variables
const BACKEND_URL = 'https://backend-647308514289.us-central1.run.app';
const BACKEND_TWO_URL = 'https://backend-2-647308514289.us-central1.run.app';

// Chat API calls - Using port 8000
export const sendChatMessage = async (
  config: ApiConfig,
  message: string
): Promise<ChatResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: message,
      session_id: config.sessionId
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
};

// Quiz API calls - Using port 3000
export const initializeQuizSession = async (
  config: ApiConfig
): Promise<QuizSession> => {
  const response = await fetch(`${BACKEND_TWO_URL}/api/quiz/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: config.userId, 
      sessionId: config.sessionId 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to initialize quiz session');
  }

  const data = await response.json();
  return data.data;
};

export const loadDiagnosticTest = async (
  apiUrl: string
): Promise<DiagnosticTest> => {
  const response = await fetch(`${BACKEND_TWO_URL}/api/quiz/diagnostic`);
  
  if (!response.ok) {
    throw new Error('Failed to load diagnostic test');
  }

  const data = await response.json();
  return data.data;
};

export const completeDiagnosticTest = async (
  config: ApiConfig,
  score: number
): Promise<any> => {
  const response = await fetch(`${BACKEND_TWO_URL}/api/quiz/complete-diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: config.userId, 
      sessionId: config.sessionId, 
      score 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to complete diagnostic test');
  }

  const data = await response.json();
  return data.data;
};

export const logQuizAnswer = async (
  config: ApiConfig,
  quizId: string,
  selectedOption: number,
  correct: boolean,
  topicTag: string
): Promise<void> => {
  // Convert selectedOption number to letter (0->A, 1->B, 2->C, 3->D)
  const optionLetters = ['A', 'B', 'C', 'D'];
  const selectedLetter = optionLetters[selectedOption] || 'A';
  
  // Use Python backend for Google Sheets logging
  const response = await fetch(`${BACKEND_URL}/api/quiz/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: config.userId,
      quiz_type: "micro",
      session_id: config.sessionId,
      responses: [
        {
          quiz_id: quizId,
          selected_option: selectedLetter,
          correct: correct,
          topic: topicTag
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error('Failed to log quiz answer');
  }
};

// Course API calls - Using new course service endpoints
export const getAvailableCourses = async (
  config: ApiConfig
): Promise<any> => {
  const response = await fetch(`${BACKEND_URL}/api/course/user/${config.userId}/sessions`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch courses');
  }

  const data = await response.json();
  return data.data;
};

export const startCourse = async (
  config: ApiConfig,
  courseId: string
): Promise<any> => {
  const response = await fetch(`${BACKEND_URL}/api/course/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: config.userId, 
      session_id: config.sessionId, 
      course_id: courseId 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to start course');
  }

  return response.json();
};

export const navigateCoursePage = async (
  config: ApiConfig,
  courseId: string,
  pageIndex: number
): Promise<any> => {
  const response = await fetch(`${BACKEND_URL}/api/course/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: config.userId,
      session_id: config.sessionId,
      course_id: courseId,
      page_index: pageIndex 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to navigate course page');
  }

  return response.json();
};

export const submitCourseQuiz = async (
  config: ApiConfig,
  courseId: string,
  pageIndex: number,
  selectedOption: string,
  correct: boolean
): Promise<any> => {
  const response = await fetch(`${BACKEND_URL}/api/course/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: config.userId,
      session_id: config.sessionId,
      course_id: courseId,
      page_index: pageIndex,
      selected_option: selectedOption,
      correct
    })
  });

  if (!response.ok) {
    throw new Error('Failed to submit course quiz');
  }

  return response.json();
};

export const completeCourse = async (
  config: ApiConfig,
  courseId: string
): Promise<any> => {
  const response = await fetch(`${BACKEND_URL}/api/course/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      user_id: config.userId,
      session_id: config.sessionId,
      course_id: courseId
    })
  });

  if (!response.ok) {
    throw new Error('Failed to complete course');
  }

  return response.json();
};

export const getCourseDetails = async (
  config: ApiConfig,
  courseId: string
): Promise<any> => {
  const response = await fetch(`${BACKEND_URL}/api/course/${courseId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to get course details');
  }

  return response.json();
};

// Content upload API calls - Using port 3000
export const uploadFile = async (
  config: ApiConfig,
  file: File
): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', config.userId);
  formData.append('sessionId', config.sessionId);

  const response = await fetch(`${BACKEND_TWO_URL}/api/content/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Upload failed');
  }

  return response.json();
};

export const removeFile = async (
  config: ApiConfig,
  fileName: string
): Promise<void> => {
  const response = await fetch(`${BACKEND_TWO_URL}/api/content/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: config.userId, 
      sessionId: config.sessionId, 
      fileName 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to remove file');
  }
};

// Diagnostic API functions - Using port 3000
export const startDiagnosticTest = async (
  config: ApiConfig
): Promise<any> => {
  const response = await fetch(`${BACKEND_TWO_URL}/api/quiz/start-diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: config.userId, 
      sessionId: config.sessionId 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to start diagnostic test');
  }

  const data = await response.json();
  return data.data;
};

export const getDiagnosticQuestion = async (
  apiUrl: string,
  questionIndex: number
): Promise<any> => {
  const response = await fetch(`${BACKEND_TWO_URL}/api/quiz/diagnostic/question/${questionIndex}`);
  
  if (!response.ok) {
    throw new Error('Failed to get diagnostic question');
  }

  const data = await response.json();
  return data.data;
};

// New: Generate Diagnostic Quiz (POST /api/quiz/generate)
export const generateDiagnosticQuiz = async (
  config: ApiConfig,
  topic?: string
): Promise<{ questions: QuizQuestion[]; quizId: string }> => {
  const requestBody: any = {
    session_id: config.sessionId,
    quiz_type: 'diagnostic'
  };
  
  // Add topic if provided
  if (topic) {
    requestBody.topic = topic;
  }

  const response = await fetch(`${BACKEND_URL}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error('Failed to generate diagnostic quiz');
  }

  const data = await response.json();
  // Map backend format to local QuizQuestion[]
  const questions = data.questions.map((q: any) => ({
    id: '', // Backend does not provide id, can generate if needed
    question: q.question,
    options: Object.values(q.choices),
    correctAnswer: ['a', 'b', 'c', 'd'].indexOf(q.correct_answer.toLowerCase()),
    explanation: q.explanation,
    topicTag: q.topic || '',
    difficulty: 'medium', // Default or map if provided
  }));
  return { questions, quizId: data.quiz_id };
};

// New: Submit Diagnostic Quiz (POST /api/quiz/submit)
export const submitDiagnosticQuiz = async (
  config: ApiConfig,
  quizId: string,
  questions: QuizQuestion[],
  answers: number[],
  userId: string
): Promise<any> => {
  // Prepare responses array for backend
  const responses = questions.map((q, idx) => {
    const answerIdx = answers[idx];
    if (answerIdx < 0 || answerIdx > 3) {
      throw new Error('All questions must be answered before submitting.');
    }
    return {
    quiz_id: quizId,
      selected_option: String.fromCharCode(65 + answerIdx), // 'A', 'B', 'C', 'D'
      correct: answerIdx === q.correctAnswer,
    topic: q.topicTag || '',
    };
  });

  const response = await fetch(`${BACKEND_URL}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      quiz_type: 'diagnostic',
      responses
    })
  });

  if (!response.ok) {
    throw new Error('Failed to submit diagnostic quiz');
  }

  const data = await response.json();
  return data.data;
}; 