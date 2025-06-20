import { ChatMessage } from '../types';
import { 
  ApiConfig,
  sendChatMessage,
  createSystemMessage,
  createUserMessage,
  createAssistantMessage,
} from '../utils/chatWidget';

export interface MessageHandlersProps {
  apiConfig: ApiConfig;
  sessionIds: { userId: string; sessionId: string };
  addMessage: (message: ChatMessage) => void;
  setInputValue: (value: string) => void;
  setShowCommandSuggestions: (show: boolean) => void;
  setCommandSuggestions: (suggestions: string[]) => void;
  setShowCommandMenu: (show: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  closeCurrentDisplays: () => void;
  handleStartDiagnosticTestWrapper: () => Promise<void>;
  handleCoursesListWrapper: () => Promise<void>;
  setCurrentQuiz: (quiz: any) => void;
}

export const handleSendMessage = async (
  messageText: string,
  props: MessageHandlersProps
) => {
  const {
    apiConfig,
    sessionIds,
    addMessage,
    setInputValue,
    setShowCommandSuggestions,
    setCommandSuggestions,
    setShowCommandMenu,
    setIsLoading,
    closeCurrentDisplays,
    handleStartDiagnosticTestWrapper,
    handleCoursesListWrapper,
    setCurrentQuiz
  } = props;

  if (!messageText) return;

  setIsLoading(true);
  setInputValue('');
  setShowCommandSuggestions(false);
  setCommandSuggestions([]);
  setShowCommandMenu(false);

  try {
    // Handle special commands
    if (messageText === 'diagnostic_test') {
      closeCurrentDisplays();
      setIsLoading(false);
      await handleStartDiagnosticTestWrapper();
      return;
    }

    if (messageText === 'courses') {
      closeCurrentDisplays();
      const coursesMessage = createSystemMessage(
        '📚 **Available Courses**\n\nHere are all the courses available for you:',
        sessionIds.sessionId,
        sessionIds.userId
      );
      await handleCoursesListWrapper();
      setIsLoading(false);
      addMessage(coursesMessage);
      return;
    }

    if (messageText === 'help') {
      closeCurrentDisplays();
      setIsLoading(false);
      const helpMessage = createSystemMessage(
        '🤖 **MoneyMentor Commands**\n\n' +
        '**diagnostic_test** - Take a quick financial knowledge assessment\n' +
        '**courses** - View available learning courses\n' +
        '**chat** - Start regular financial Q&A chat\n\n' +
        '💡 **Tip**: You can also just ask me any financial question directly!',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(helpMessage);
      return;
    }

    if (messageText === 'chat') {
      closeCurrentDisplays();
      setIsLoading(false);
      const chatMessage = createSystemMessage(
        '💬 **Chat Mode**\n\nI\'m ready to answer your financial questions! Ask me about budgeting, investing, debt management, and more.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(chatMessage);
      return;
    }

    // Add user message to chat
    const userMessage = createUserMessage(
      messageText,
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(userMessage);

    const response = await sendChatMessage(apiConfig, messageText);
    
    // Handle backend response
    if (response.message) {
      const assistantMessage = createAssistantMessage(
        response.message,
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(assistantMessage);
      
      // Handle quiz if present
      if (response.quiz) {
        setCurrentQuiz(response.quiz);
      }
    } else {
      const errorMessage = createSystemMessage(
        'Sorry, I encountered an error. Please try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(errorMessage);
    }
  } catch (error) {
    console.error('Chat error:', error);
    const errorMessage = createSystemMessage(
      'Network error. Please check your connection.',
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(errorMessage);
  } finally {
    setIsLoading(false);
  }
}; 