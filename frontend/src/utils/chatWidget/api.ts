import { ChatResponse, DiagnosticTest, QuizSession } from '../../types';

export interface ApiConfig {
  apiUrl: string;
  userId: string;
  sessionId: string;
}

// Chat API calls
export const sendChatMessage = async (
  config: ApiConfig,
  message: string
): Promise<ChatResponse> => {
  const response = await fetch(`${config.apiUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: config.userId,
      sessionId: config.sessionId,
      message
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
};

// Quiz API calls
export const initializeQuizSession = async (
  config: ApiConfig
): Promise<QuizSession> => {
  const response = await fetch(`${config.apiUrl}/api/quiz/session`, {
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
  const response = await fetch(`${apiUrl}/api/quiz/diagnostic`);
  
  if (!response.ok) {
    throw new Error('Failed to load diagnostic test');
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
  const response = await fetch(`${config.apiUrl}/api/quiz/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: config.userId,
      sessionId: config.sessionId,
      timestamp: new Date().toISOString(),
      quizId,
      selectedOption,
      correct,
      topicTag
    })
  });

  if (!response.ok) {
    throw new Error('Failed to log quiz answer');
  }
};

export const completeDiagnosticTest = async (
  config: ApiConfig,
  score: number
): Promise<any> => {
  const response = await fetch(`${config.apiUrl}/api/quiz/complete-diagnostic`, {
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

// Course API calls
export const startCourse = async (
  config: ApiConfig,
  courseId: string
): Promise<any> => {
  const response = await fetch(`${config.apiUrl}/api/chat/course/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: config.userId, 
      sessionId: config.sessionId, 
      courseId 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to start course');
  }

  return response.json();
};

export const navigateCoursePage = async (
  config: ApiConfig,
  pageIndex: number
): Promise<any> => {
  const response = await fetch(`${config.apiUrl}/api/chat/course/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      sessionId: config.sessionId, 
      pageIndex 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to navigate course page');
  }

  return response.json();
};

export const submitCourseQuiz = async (
  config: ApiConfig,
  answers: number[]
): Promise<any> => {
  const response = await fetch(`${config.apiUrl}/api/chat/course/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      sessionId: config.sessionId, 
      answers 
    })
  });

  if (!response.ok) {
    throw new Error('Failed to submit course quiz');
  }

  return response.json();
};

// Content upload API calls
export const uploadFile = async (
  config: ApiConfig,
  file: File
): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', config.userId);
  formData.append('sessionId', config.sessionId);

  const response = await fetch(`${config.apiUrl}/api/content/upload`, {
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
  const response = await fetch(`${config.apiUrl}/api/content/remove`, {
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

// New simplified diagnostic API functions
export const startDiagnosticTest = async (
  config: ApiConfig
): Promise<any> => {
  const response = await fetch(`${config.apiUrl}/api/quiz/start-diagnostic`, {
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
  const response = await fetch(`${apiUrl}/api/quiz/diagnostic/question/${questionIndex}`);
  
  if (!response.ok) {
    throw new Error('Failed to get diagnostic question');
  }

  const data = await response.json();
  return data.data;
}; 