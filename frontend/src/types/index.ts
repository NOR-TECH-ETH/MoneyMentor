// Quiz Types
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topicTag: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizFeedback {
  correct: boolean;
  explanation: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant' | 'system' | 'quiz' | 'calculation' | 'course' | 'course-list';
  timestamp: string;
  sessionId: string;
  userId: string;
  metadata?: {
    quizQuestion?: QuizQuestion;
    calculationResult?: CalculationResult;
    requiresDisclaimer?: boolean;
    coursePage?: CoursePage;
    courseList?: Course[];
    courseQuiz?: {
      questions: QuizQuestion[];
      currentQuestion: number;
      score: number;
      attempts: number;
    };
  };
}

export interface ChatResponse {
  success: boolean;
  data: {
    responseText: string;
    quizQuestion?: QuizQuestion;
    calculationResult?: CalculationResult;
    requiresDisclaimer?: boolean;
    coursePage?: CoursePage;
    courseList?: Course[];
    courseQuiz?: {
      questions: QuizQuestion[];
      currentQuestion: number;
      score: number;
      attempts: number;
    };
    sessionId: string;
    messageId: string;
    needsDiagnosticTest?: boolean;
  };
}

export interface DiagnosticTest {
  questions: QuizQuestion[];
  totalQuestions: number;
  passingScore: number;
}

export interface QuizSession {
  userId: string;
  sessionId: string;
  messageCount: number;
  quizAttempts: number;
  startTime: string;
  lastActivity: string;
  completedPreTest: boolean;
}

// Course Types
export interface CoursePage {
  id: string;
  title: string;
  content: string;
  pageNumber: number;
  totalPages: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topicTag: string;
  estimatedTime: string;
  pages: CoursePage[];
  quizQuestions: QuizQuestion[];
  prerequisites?: string[];
}

// Calculation Types
export interface CalculationResult {
  type: string;
  monthlyPayment?: number;
  monthsToPayoff?: number;
  totalInterest: number;
  totalAmount: number;
  stepByStepPlan: string[];
  disclaimer: string;
  metadata: {
    inputValues: Record<string, number>;
    calculationDate: string;
  };
}

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_ID: 'moneymentor_user_id',
  SESSION_ID: 'moneymentor_session_id',
  QUIZ_PROGRESS: 'moneymentor_quiz_progress',
  CHAT_HISTORY: 'moneymentor_chat_history',
  PREFERENCES: 'moneymentor_preferences',
} as const; 