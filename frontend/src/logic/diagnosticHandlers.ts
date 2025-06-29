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
  resetDiagnosticState,
  initializeDiagnosticState
} from '../utils/chatWidget/diagnosticUtils';
import { DiagnosticState } from '../utils/chatWidget';
import { submitDiagnosticQuiz as apiSubmitDiagnosticQuiz, getCourseDetails } from '../utils/chatWidget/api';

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

export const handleStartDiagnosticTest = async (props: DiagnosticHandlersProps, courseKey?: string) => {
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
    
    // Fetch diagnostic quiz from backend with topic if provided
    const { test, quizId } = await fetchDiagnosticQuiz(apiConfig, courseKey);
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
    
    const isLastQuestion =
      diagnosticState.test &&
      diagnosticState.currentQuestionIndex === diagnosticState.test.questions.length - 1;

    if (!isLastQuestion) {
      const nextState = goToNextQuestion(updatedState);
      setDiagnosticState(nextState);
      } else {
      // Mark as inactive and clear current question index to prevent further answers
      setDiagnosticState({ ...updatedState, isActive: false, currentQuestionIndex: -1 });
      setTimeout(() => handleCompleteDiagnosticTestWrapper({ ...updatedState, isActive: false, currentQuestionIndex: -1 }), 0);
    }
  }, 3000);
};

/**
 * Helper to create a recommended course message with Yes/No buttons
 */
const createRecommendedCourseMessage = (
  courseId: string,
  courseTitle: string,
  onStart: () => void,
  onDecline: () => void
): ChatMessage => ({
  id: `recommended-course-${Date.now()}`,
  type: 'assistant',
  content: `🎓 **Recommended Course:** ${courseTitle}

Based on your diagnostic results, I've created a personalized course to help you improve your financial knowledge.

Would you like to start this course now?`,
  timestamp: new Date().toISOString(),
  sessionId: '', // Will be set by caller
  userId: '',    // Will be set by caller
  metadata: {
    buttons: [
      { label: 'Yes, start course', action: onStart },
      { label: 'No, maybe later', action: onDecline }
    ]
  }
});

/**
 * Helper to create a course declined message
 */
const createCourseDeclinedMessage = (
  sessionId: string,
  userId: string
): ChatMessage => ({
  id: `course-declined-${Date.now()}`,
  type: 'assistant',
  content: `No problem! You can start a course anytime from the course list. Feel free to explore other topics or ask me any questions about personal finance.`,
  timestamp: new Date().toISOString(),
  sessionId,
  userId
});

export const handleCompleteDiagnosticTest = async (
  state: DiagnosticState,
  props: DiagnosticHandlersProps
) => {
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
    setIsLoading(true);
    closeCurrentDisplays();

    // Check if quizId exists
    if (!state.quizId) {
      throw new Error('Quiz ID is missing. Cannot submit diagnostic test.');
    }

    // Submit diagnostic quiz using the existing API function
    const result = await apiSubmitDiagnosticQuiz(
      apiConfig,
      state.quizId,
      state.test!.questions,
      state.answers,
      sessionIds.userId
    );
    
    if (result) {
      // Show diagnostic results
      const correctAnswers = state.answers.filter((answer, index) => 
        answer === state.test!.questions[index].correctAnswer
      ).length;
      
      const totalQuestions = state.test!.questions.length;
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      
      // Create a simple, clean diagnostic summary
      const resultsMessage = createSystemMessage(
        `🎯 **Diagnostic Test Complete!**

📊 **Your Score:** ${correctAnswers}/${totalQuestions} (${score}%)

Based on your performance, I have a personalized course recommendation for you. Would you like to continue?`,
      sessionIds.sessionId,
      sessionIds.userId
    );
      
      addMessage(resultsMessage);
      
      // Check if a course was recommended - look at top level of result
      const recommendedCourseId = result.recommended_course_id;
      
      if (recommendedCourseId) {
        // Get course details to display title
        try {
          const courseDetails = await getCourseDetails(apiConfig, recommendedCourseId);
          if (courseDetails.success) {
            const courseTitle = courseDetails.data.title;
            
            // Create course recommendation message with buttons
            const courseMessage = createRecommendedCourseMessage(
              recommendedCourseId,
              courseTitle,
              () => {
                // Add a small delay to ensure course is fully registered
                setTimeout(() => {
                  // Dispatch custom event to start course
                  window.dispatchEvent(new CustomEvent('start-recommended-course', {
                    detail: { id: recommendedCourseId, title: courseTitle }
                  }));
                }, 500); // 500ms delay
              },
              () => {
                // Add declined message
                const declinedMessage = createCourseDeclinedMessage(sessionIds.sessionId, sessionIds.userId);
                addMessage(declinedMessage);
              }
            );
            
            courseMessage.sessionId = sessionIds.sessionId;
            courseMessage.userId = sessionIds.userId;
            addMessage(courseMessage);
          }
        } catch (error) {
          console.error('Failed to get course details:', error);
          // Still show recommendation with just the ID
          const courseMessage = createRecommendedCourseMessage(
            recommendedCourseId,
            'Recommended Course',
            () => {
              // Add a small delay to ensure course is fully registered
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('start-recommended-course', {
                  detail: { id: recommendedCourseId, title: 'Recommended Course' }
                }));
              }, 500); // 500ms delay
            },
            () => {
              const declinedMessage = createCourseDeclinedMessage(sessionIds.sessionId, sessionIds.userId);
              addMessage(declinedMessage);
            }
          );
          
          courseMessage.sessionId = sessionIds.sessionId;
          courseMessage.userId = sessionIds.userId;
          addMessage(courseMessage);
        }
      } else {
        // No course was recommended - show a simple failed message
        const failedMessage = createSystemMessage(
          `📚 **Course Recommendation Failed**

Sorry, I couldn't generate a personalized course recommendation at this time. You can type \`/courses\` to see all available courses, or ask me any financial question!`,
          sessionIds.sessionId,
          sessionIds.userId
        );
        addMessage(failedMessage);
      }
    } else {
      throw new Error('Failed to submit diagnostic quiz');
    }
    
  } catch (error) {
    console.error('Diagnostic completion error:', error);
    const errorMessage = createSystemMessage(
      'Sorry, there was an error processing your diagnostic test. Please try again.',
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(errorMessage);
  } finally {
    setIsLoading(false);
    setDiagnosticState(resetDiagnosticState());
    setIsDiagnosticMode(false);
    setShowDiagnosticFeedback(false);
    setDiagnosticFeedback(null);
  }
}; 