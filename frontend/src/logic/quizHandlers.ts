import { 
  ApiConfig,
  createQuizFeedback,
  logQuizAnswer
} from '../utils/chatWidget';
import { QuizQuestion } from '../types';

export interface QuizHandlersProps {
  apiConfig: ApiConfig;
  setLastQuizAnswer: (feedback: any) => void;
  setShowQuizFeedback: (show: boolean) => void;
  setCurrentQuiz: (quiz: QuizQuestion | null) => void;
}

export const handleQuizAnswer = async (
  selectedOption: number,
  correct: boolean,
  currentQuiz: QuizQuestion | null,
  props: QuizHandlersProps
) => {
  const {
    apiConfig,
    setLastQuizAnswer,
    setShowQuizFeedback,
    setCurrentQuiz
  } = props;

  if (!currentQuiz) return;

  try {
    await logQuizAnswer(
      apiConfig,
      currentQuiz.id,
      selectedOption,
      correct,
      currentQuiz.topicTag
    );

    const feedback = createQuizFeedback(selectedOption, currentQuiz.correctAnswer, currentQuiz.explanation);
    setLastQuizAnswer(feedback);
    setShowQuizFeedback(true);
    
    // Auto-hide feedback after 3 seconds
    setTimeout(() => {
      setShowQuizFeedback(false);
      setCurrentQuiz(null);
      setLastQuizAnswer(null);
    }, 3000);
  } catch (error) {
    console.error('Quiz logging error:', error);
  }
}; 