import { DiagnosticTest, ChatMessage, QuizQuestion } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { generateDiagnosticQuiz as apiGenerateDiagnosticQuiz, submitDiagnosticQuiz as apiSubmitDiagnosticQuiz, ApiConfig } from './api';

export interface DiagnosticState {
  test: DiagnosticTest | null;
  currentQuestionIndex: number;
  answers: number[];
  isActive: boolean;
  quizId?: string;
}

export interface DiagnosticResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  performanceLevel: string;
  recommendations: string;
}

/**
 * Initialize diagnostic test state
 */
export const initializeDiagnosticState = (): DiagnosticState => ({
  test: null,
  currentQuestionIndex: 0,
  answers: [],
  isActive: false,
  quizId: undefined
});

/**
 * Setup diagnostic test with questions
 */
export const setupDiagnosticTest = (test: DiagnosticTest, quizId: string): DiagnosticState => ({
  test,
  currentQuestionIndex: 0,
  answers: new Array(test.questions.length).fill(-1),
  isActive: true,
  quizId
});

/**
 * Handle diagnostic answer selection
 */
export const handleDiagnosticAnswer = (
  state: DiagnosticState,
  selectedOption: number
): DiagnosticState => {
  if (!state.test) return state;
  
  const newAnswers = [...state.answers];
  newAnswers[state.currentQuestionIndex] = selectedOption;
  
  return {
    ...state,
    answers: newAnswers
  };
};

/**
 * Navigate to next question
 */
export const goToNextQuestion = (state: DiagnosticState): DiagnosticState => {
  if (!state.test || state.currentQuestionIndex >= state.test.questions.length - 1) {
    return state;
  }
  
  return {
    ...state,
    currentQuestionIndex: state.currentQuestionIndex + 1
  };
};

/**
 * Navigate to previous question
 */
export const goToPreviousQuestion = (state: DiagnosticState): DiagnosticState => {
  if (state.currentQuestionIndex <= 0) {
    return state;
  }
  
  return {
    ...state,
    currentQuestionIndex: state.currentQuestionIndex - 1
  };
};

/**
 * Check if diagnostic test is complete
 */
export const isDiagnosticComplete = (state: DiagnosticState): boolean => {
  if (!state.test) return false;
  return state.currentQuestionIndex >= state.test.questions.length - 1;
};

/**
 * Calculate diagnostic test results
 */
export const calculateDiagnosticResults = (state: DiagnosticState): DiagnosticResult | null => {
  if (!state.test) return null;

  let correctAnswers = 0;
  state.answers.forEach((answer, index) => {
    if (answer === state.test!.questions[index].correctAnswer) {
      correctAnswers++;
    }
  });

  const score = Math.round((correctAnswers / state.test.questions.length) * 100);
  
  let performanceLevel = '';
  let recommendations = '';
  
  if (score >= 80) {
    performanceLevel = 'Advanced Level! 🌟';
    recommendations = 'Excellent! You have strong financial knowledge. I recommend starting with **Advanced Portfolio Management** to learn sophisticated investment strategies, or reviewing **Investing Fundamentals** if you want to solidify your foundation first.';
  } else if (score >= 50) {
    performanceLevel = 'Intermediate Level! 👍';
    recommendations = 'Great job! You have solid basic knowledge. I recommend starting with **Investing Fundamentals** to build on your foundation, then progressing to **Emergency Fund Essentials** or **Budgeting Basics** to fill any gaps.';
  } else {
    performanceLevel = 'Beginner Level 🌱';
    recommendations = 'Perfect starting point! I recommend beginning with **Budgeting Basics** to build a strong foundation, followed by **Emergency Fund Essentials** to secure your financial safety net.';
  }

  return {
    score,
    correctAnswers,
    totalQuestions: state.test.questions.length,
    performanceLevel,
    recommendations
  };
};

/**
 * Create diagnostic intro message
 */
export const createDiagnosticIntroMessage = (
  sessionId: string,
  userId: string
): ChatMessage => ({
  id: uuidv4(),
  content: "🎯 **Starting Diagnostic Test**\n\nThis quick assessment will help me understand your financial knowledge level and provide personalized course recommendations.\n\n📊 **5 questions** covering budgeting, saving, investing, and debt management\n⏱️ **Takes about 2-3 minutes**\n\nLet's begin!",
  type: 'assistant',
  timestamp: new Date().toISOString(),
  sessionId,
  userId
});

/**
 * Create diagnostic completion message
 */
export const createDiagnosticCompletionMessage = (
  result: DiagnosticResult,
  sessionId: string,
  userId: string
): ChatMessage => ({
  id: uuidv4(),
  content: `🎉 **Assessment Complete!**\n\n📊 **Your Score**: ${result.score}% (${result.correctAnswers}/${result.totalQuestions} correct)\n🎯 **Performance**: ${result.performanceLevel}\n\n💡 **What this means**: ${result.recommendations}\n\n---\n\n🎯 **What's Next?**\n• I'll show you **personalized course recommendations** below\n• Type \`/courses\` anytime to see all available courses\n• Type \`/chat\` for regular financial Q&A\n• Ask me any financial question to get started!\n\nReady to start learning?`,
  type: 'assistant',
  timestamp: new Date().toISOString(),
  sessionId,
  userId
});

/**
 * Reset diagnostic test state
 */
export const resetDiagnosticState = (): DiagnosticState => ({
  test: null,
  currentQuestionIndex: 0,
  answers: [],
  isActive: false,
  quizId: undefined
});

// --- New API helpers ---
export const fetchDiagnosticQuiz = async (config: ApiConfig, topic?: string): Promise<{ test: DiagnosticTest; quizId: string }> => {
  const { questions, quizId } = await apiGenerateDiagnosticQuiz(config, topic);
  const test: DiagnosticTest = {
    questions,
    totalQuestions: questions.length,
    passingScore: 70 // or whatever logic you want
  };
  return { test, quizId };
};

export const submitDiagnosticQuizAnswers = async (
  config: ApiConfig,
  quizId: string,
  questions: QuizQuestion[],
  answers: number[],
  userId: string
) => {
  return apiSubmitDiagnosticQuiz(config, quizId, questions, answers, userId);
}; 