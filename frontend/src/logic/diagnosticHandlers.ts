import { ChatMessage } from '../types';
import { 
  ApiConfig,
  createSystemMessage,
  createQuizFeedback,
} from '../utils/chatWidget';
import { 
  fetchDiagnosticQuiz, 
  submitDiagnosticQuizAnswers, 
  setupDiagnosticTest, 
  handleDiagnosticAnswer, 
  goToNextQuestion, 
  resetDiagnosticState 
} from '../utils/chatWidget/diagnosticUtils';
import { DiagnosticState } from '../utils/chatWidget';

export interface DiagnosticHandlersProps {
  apiConfig: ApiConfig;
  sessionIds: { userId: string; sessionId: string };
  addMessage: (message: ChatMessage) => void;
  setIsLoading: (loading: boolean) => void;
  closeCurrentDisplays: () => void;
  setDiagnosticState: (state: DiagnosticState) => void;
  setIsDiagnosticMode: (mode: boolean) => void;
  setShowDiagnosticFeedback: (show: boolean) => void;
  setDiagnosticFeedback: (feedback: any) => void;
  removeIntroMessage: (pattern: string) => void;
  handleCompleteDiagnosticTestWrapper: (state: DiagnosticState) => Promise<void>;
}

export const handleStartDiagnosticTest = async (props: DiagnosticHandlersProps) => {
  const {
    apiConfig,
    sessionIds,
    addMessage,
    setIsLoading,
    closeCurrentDisplays,
    setDiagnosticState,
    setIsDiagnosticMode,
    setShowDiagnosticFeedback,
    setDiagnosticFeedback,
    removeIntroMessage
  } = props;

  try {
    closeCurrentDisplays();
    setIsLoading(true);
    
    // Add intro message while loading
    const introMessage = createSystemMessage(
      '🎯 **Starting Diagnostic Test**\n\nThis quick assessment will help me understand your financial knowledge level and provide personalized course recommendations.\n\n📊 **5 questions** covering budgeting, saving, investing, and debt management\n⏱️ **Takes about 2-3 minutes**\n\nLet\'s begin!',
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(introMessage);
    
    // Fetch diagnostic quiz from backend
    const { test, quizId } = await fetchDiagnosticQuiz(apiConfig);
    setDiagnosticState(setupDiagnosticTest(test, quizId));
    setIsDiagnosticMode(true);
    setShowDiagnosticFeedback(false);
    setDiagnosticFeedback(null);
    
    // Remove the intro message once questions are loaded
    removeIntroMessage('🎯 **Starting Diagnostic Test**');
    
  } catch (error) {
    console.error('Failed to start diagnostic test:', error);
    const errorMessage = createSystemMessage(
      'Failed to start diagnostic test. Please try again later.',
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(errorMessage);
  } finally {
    setIsLoading(false);
  }
};

export const handleDiagnosticQuizAnswer = async (
  selectedOption: number,
  correct: boolean,
  diagnosticState: DiagnosticState,
  props: DiagnosticHandlersProps
) => {
  const {
    setDiagnosticState,
    setDiagnosticFeedback,
    setShowDiagnosticFeedback,
    handleCompleteDiagnosticTestWrapper
  } = props;

  if (!diagnosticState.test || !diagnosticState.isActive) return;

  // Store the answer
  const updatedState = handleDiagnosticAnswer(diagnosticState, selectedOption);
  setDiagnosticState(updatedState);
  
  // Show feedback
  const currentQuestion = diagnosticState.test.questions[diagnosticState.currentQuestionIndex];
  const feedback = createQuizFeedback(selectedOption, currentQuestion.correctAnswer, currentQuestion.explanation);
  setDiagnosticFeedback(feedback);
  setShowDiagnosticFeedback(true);
  
  // Auto-hide feedback and move to next question after 3 seconds
  setTimeout(() => {
    setShowDiagnosticFeedback(false);
    setDiagnosticFeedback(null);
    setDiagnosticState((prevState: DiagnosticState) => {
      if (
        prevState.test &&
        prevState.currentQuestionIndex < prevState.test.questions.length - 1
      ) {
        return goToNextQuestion(prevState);
      } else {
        // Call complete outside of setDiagnosticState
        setTimeout(() => handleCompleteDiagnosticTestWrapper(prevState), 0);
        return prevState;
      }
    });
  }, 3000);
};

export const handleCompleteDiagnosticTest = async (
  state: DiagnosticState,
  props: DiagnosticHandlersProps
) => {
  const {
    apiConfig,
    sessionIds,
    addMessage,
    setIsLoading,
    setIsDiagnosticMode,
    setDiagnosticState
  } = props;

  try {
    if (!state.test || !state.quizId) return;
    setIsLoading(true);
    
    const result = await submitDiagnosticQuizAnswers(
      apiConfig,
      state.quizId,
      state.test.questions,
      state.answers,
      sessionIds.userId
    );
    
    // Optionally, use result to show score, recommendations, etc.
    setIsDiagnosticMode(false);
    setDiagnosticState(resetDiagnosticState());
    
    // Create completion message
    const completionMessage = createSystemMessage(
      `🎉 **Assessment Complete!**\n\n📊 **Your Score**: ${result.overall_score}%\n\n💡 **What's Next**: I'll show you personalized course recommendations below based on your results!`,
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(completionMessage);
    
    // Set recommended courses if available
    if (result.topic_breakdown) {
      // You can use topic_breakdown to recommend courses
    }
  } catch (error) {
    console.error('Failed to complete diagnostic test:', error);
    const errorMessage = createSystemMessage(
      'Failed to complete diagnostic test. Please try again later.',
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(errorMessage);
  } finally {
    setIsLoading(false);
  }
}; 