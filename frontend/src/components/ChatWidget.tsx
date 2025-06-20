import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Maximize2, Minimize2 } from 'lucide-react';
import { 
  ChatMessage, 
  ChatResponse, 
  QuizQuestion,
  QuizSession,
  Course,
  CoursePage
} from '../types';

// Import ChatWidget components
import { 
  DiagnosticTest, 
  Quiz, 
  CourseList, 
  CoursePage as CoursePageComponent, 
  CourseQuiz,
  UploadProgressIndicator,
  UploadedFilesDisplay,
  ChatInput,
  CommandInput,
  CalculationResult,
  MessageButtons,
} from './ChatWidget/index';

// Import Windows component
import { Windows } from './Windows';

// Import logic handlers
import {
  handleSendMessage,
  handleStartDiagnosticTest,
  handleDiagnosticQuizAnswer,
  handleCompleteDiagnosticTest,
  handleCoursesList,
  handleStartCourse,
  handleNavigateCoursePage,
  handleCompleteCourse,
  handleSubmitCourseQuiz,
  handleQuizAnswer,
  handleFileUpload,
  handleRemoveFile,
  MessageHandlersProps,
  DiagnosticHandlersProps,
  CourseHandlersProps,
  QuizHandlersProps,
  FileHandlersProps
} from '../logic';

// Import custom hooks
import { useSessionState, useScrollToBottom } from '../hooks';

// Import utilities
import {
  // API utilities
  ApiConfig,
  sendChatMessage,
  generateDiagnosticQuiz,
  initializeQuizSession,
  loadDiagnosticTest,
  startDiagnosticTest,
  getDiagnosticQuestion,
  logQuizAnswer,
  completeDiagnosticTest,
  startCourse,
  navigateCoursePage,
  submitCourseQuiz,
  uploadFile,
  removeFile,
  getAvailableCourses,
  
  // Session utilities
  initializeSession,
  SessionIds,
  
  // Diagnostic utilities
  DiagnosticState,
  initializeDiagnosticState,
  
  // Quiz utilities
  QuizFeedback,
  CourseQuizState,
  CourseQuizAnswers,
  initializeCourseQuiz,
  initializeCourseQuizAnswers,
  handleCourseQuizAnswer,
  navigateToNextQuizQuestion,
  navigateToPreviousQuizQuestion,
  navigateToQuizQuestion,
  areAllQuestionsAnswered,
  formatQuizResultMessage,
  resetCourseQuizState,
  createQuizFeedback,
  
  // Message utilities
  createWelcomeMessage,
  createSystemMessage,
  createUserMessage,
  createAssistantMessage,
  formatUploadSuccessMessage,
  formatUploadErrorMessage,
  formatFileRemovalMessage,
  formatCourseStartMessage,
  formatCourseCompletionMessage,
  renderMarkdown,
  formatMessageContent,
  
  // File utilities
  validateFiles,
  UploadProgress,
  initializeUploadProgress,
  updateUploadProgress,
  resetUploadProgress,
  formatFileSize,
} from '../utils/chatWidget';

// Import styles
import '../styles/windows.css';

// Window class to encapsulate all window state and functionality
class WindowInstance {
  // Messages and input
  messages: ChatMessage[] = [];
  inputValue: string = '';
  isLoading: boolean = false;
  
  // Quiz state
  currentQuiz: QuizQuestion | null = null;
  showQuizFeedback: boolean = false;
  lastQuizAnswer: QuizFeedback | null = null;
  
  // Diagnostic state
  diagnosticState: DiagnosticState = initializeDiagnosticState();
  isDiagnosticMode: boolean = false;
  showDiagnosticFeedback: boolean = false;
  diagnosticFeedback: QuizFeedback | null = null;
  
  // Course state
  availableCourses: Course[] = [];
  currentCourse: Course | null = null;
  currentCoursePage: CoursePage | null = null;
  showCourseList: boolean = false;
  courseQuiz: CourseQuizState | null = null;
  courseQuizAnswers: CourseQuizAnswers = initializeCourseQuizAnswers(0);
  
  // File upload state (only for chat window)
  uploadedFiles: File[] = [];
  uploadProgress: UploadProgress = initializeUploadProgress();
  
  constructor(
    private apiConfig: ApiConfig,
    private sessionIds: SessionIds,
    private windowName: 'chat' | 'learn',
    private addMessage: (message: ChatMessage) => void,
    private setInputValue: (value: string) => void,
    private setIsLoading: (loading: boolean) => void,
    private setCurrentQuiz: (quiz: QuizQuestion | null) => void,
    private setShowQuizFeedback: (show: boolean) => void,
    private setLastQuizAnswer: (answer: QuizFeedback | null) => void,
    private setDiagnosticState: (state: DiagnosticState) => void,
    private setIsDiagnosticMode: (mode: boolean) => void,
    private setShowDiagnosticFeedback: (show: boolean) => void,
    private setDiagnosticFeedback: (feedback: QuizFeedback | null) => void,
    private setAvailableCourses: (courses: Course[]) => void,
    private setShowCourseList: (show: boolean) => void,
    private setCurrentCoursePage: (page: CoursePage | null) => void,
    private setCurrentCourse: (course: Course | null) => void,
    private setCourseQuiz: (quiz: CourseQuizState | null) => void,
    private setCourseQuizAnswers: (answers: CourseQuizAnswers) => void,
    private setUploadedFiles: (files: File[]) => void,
    private setUploadProgress: (progress: UploadProgress) => void,
    private removeIntroMessage: (pattern: string) => void
  ) {}
  
  // Initialize welcome message
  initializeWelcome() {
    if (this.messages.length === 0) {
      if (this.windowName === 'chat') {
        const welcomeMessage = createWelcomeMessage(
          this.sessionIds.sessionId,
          this.sessionIds.userId
        );
        this.addMessage(welcomeMessage);
      } else {
        const learnWelcomeMessage = {
          id: Date.now().toString(),
          type: 'system' as const,
          content: '📚 **Welcome to the Learning Center!**\n\nThis is your dedicated space for structured learning. Here you can access courses, track your progress, and earn certificates.\n\nTry typing: `/courses` to see available courses or `/diagnostic_test` to assess your knowledge level.',
          timestamp: new Date().toISOString(),
          sessionId: this.sessionIds.sessionId,
          userId: this.sessionIds.userId
        };
        this.addMessage(learnWelcomeMessage);
      }
    }
  }
  
  // Close current displays
  closeCurrentDisplays() {
    this.setShowCourseList(false);
    this.setCurrentCoursePage(null);
    this.setCurrentCourse(null);
    this.setCurrentQuiz(null);
    this.setIsDiagnosticMode(false);
    this.setShowDiagnosticFeedback(false);
    this.setDiagnosticFeedback(null);
    this.setShowQuizFeedback(false);
    this.setLastQuizAnswer(null);
    this.setCourseQuiz(null);
    this.setCourseQuizAnswers(initializeCourseQuizAnswers(0));
    this.setDiagnosticState(initializeDiagnosticState());
    this.setAvailableCourses([]);
  }
  
  // Create message handlers props
  createMessageHandlersProps(): MessageHandlersProps {
    return {
      apiConfig: this.apiConfig,
      sessionIds: this.sessionIds,
      addMessage: this.addMessage,
      setInputValue: this.setInputValue,
      setShowCommandSuggestions: () => {},
      setCommandSuggestions: () => {},
      setShowCommandMenu: () => {},
      setIsLoading: this.setIsLoading,
      closeCurrentDisplays: this.closeCurrentDisplays.bind(this),
      handleStartDiagnosticTestWrapper: this.handleStartDiagnosticTest.bind(this),
      handleCoursesListWrapper: this.handleCoursesList.bind(this),
      setCurrentQuiz: this.setCurrentQuiz
    };
  }
  
  // Create diagnostic handlers props
  createDiagnosticHandlersProps(): DiagnosticHandlersProps {
    return {
      apiConfig: this.apiConfig,
      sessionIds: this.sessionIds,
      addMessage: this.addMessage,
      setIsLoading: this.setIsLoading,
      closeCurrentDisplays: this.closeCurrentDisplays.bind(this),
      setDiagnosticState: this.setDiagnosticState,
      setIsDiagnosticMode: this.setIsDiagnosticMode,
      setShowDiagnosticFeedback: this.setShowDiagnosticFeedback,
      setDiagnosticFeedback: this.setDiagnosticFeedback,
      removeIntroMessage: this.removeIntroMessage,
      handleCompleteDiagnosticTestWrapper: this.handleCompleteDiagnosticTest.bind(this)
    };
  }
  
  // Create course handlers props
  createCourseHandlersProps(): CourseHandlersProps {
    return {
      apiConfig: this.apiConfig,
      sessionIds: this.sessionIds,
      addMessage: this.addMessage,
      setIsLoading: this.setIsLoading,
      closeCurrentDisplays: this.closeCurrentDisplays.bind(this),
      setAvailableCourses: this.setAvailableCourses,
      setShowCourseList: this.setShowCourseList,
      setCurrentCoursePage: this.setCurrentCoursePage,
      setCurrentCourse: this.setCurrentCourse,
      setCourseQuiz: this.setCourseQuiz,
      setCourseQuizAnswers: this.setCourseQuizAnswers,
      removeIntroMessage: this.removeIntroMessage
    };
  }
  
  // Create quiz handlers props
  createQuizHandlersProps(): QuizHandlersProps {
    return {
      apiConfig: this.apiConfig,
      setLastQuizAnswer: this.setLastQuizAnswer,
      setShowQuizFeedback: this.setShowQuizFeedback,
      setCurrentQuiz: this.setCurrentQuiz
    };
  }
  
  // Create file handlers props
  createFileHandlersProps(): FileHandlersProps {
    return {
      apiConfig: this.apiConfig,
      sessionIds: this.sessionIds,
      addMessage: this.addMessage,
      setUploadedFiles: this.setUploadedFiles,
      setUploadProgress: this.setUploadProgress,
      uploadedFiles: this.uploadedFiles
    };
  }
  
  // Handle send message
  async handleSendMessage(messageText: string) {
    await handleSendMessage(messageText, this.createMessageHandlersProps());
  }
  
  // Handle start diagnostic test
  async handleStartDiagnosticTest() {
    await handleStartDiagnosticTest(this.createDiagnosticHandlersProps());
  }
  
  // Handle diagnostic quiz answer
  async handleDiagnosticQuizAnswer(selectedOption: number, correct: boolean, diagnosticState: DiagnosticState) {
    await handleDiagnosticQuizAnswer(selectedOption, correct, diagnosticState, this.createDiagnosticHandlersProps());
  }
  
  // Handle complete diagnostic test
  async handleCompleteDiagnosticTest(state: DiagnosticState) {
    await handleCompleteDiagnosticTest(state, this.createDiagnosticHandlersProps());
  }
  
  // Handle courses list
  async handleCoursesList() {
    await handleCoursesList(this.createCourseHandlersProps());
  }
  
  // Handle start course
  async handleStartCourse(courseId: string) {
    await handleStartCourse(courseId, this.createCourseHandlersProps());
  }
  
  // Handle navigate course page
  async handleNavigateCoursePage(pageIndex: number) {
    await handleNavigateCoursePage(pageIndex, this.createCourseHandlersProps());
  }
  
  // Handle complete course
  handleCompleteCourse(currentCourse: Course | null) {
    handleCompleteCourse(currentCourse, this.createCourseHandlersProps());
  }
  
  // Handle submit course quiz
  async handleSubmitCourseQuiz(courseQuiz: CourseQuizState | null, courseQuizAnswers: CourseQuizAnswers) {
    await handleSubmitCourseQuiz(courseQuiz, courseQuizAnswers, this.createCourseHandlersProps());
  }
  
  // Handle quiz answer
  async handleQuizAnswer(selectedOption: number, correct: boolean, currentQuiz: QuizQuestion | null) {
    await handleQuizAnswer(selectedOption, correct, currentQuiz, this.createQuizHandlersProps());
  }
  
  // Handle file upload
  async handleFileUpload(files: FileList) {
    await handleFileUpload(files, this.createFileHandlersProps());
  }
  
  // Handle remove file
  async handleRemoveFile(fileIndex: number) {
    await handleRemoveFile(fileIndex, this.createFileHandlersProps());
  }
  
  // Course quiz answer selection
  handleCourseQuizAnswerSelection(questionIndex: number, selectedOption: number, courseQuizAnswers: CourseQuizAnswers) {
    const newAnswers = handleCourseQuizAnswer(courseQuizAnswers, questionIndex, selectedOption);
    this.setCourseQuizAnswers(newAnswers);
  }
  
  // Course quiz navigation
  handleCourseQuizNavigation(direction: 'next' | 'previous' | number, courseQuiz: CourseQuizState | null, courseQuizAnswers: CourseQuizAnswers) {
    if (!courseQuiz) return;
    
    let newAnswers = courseQuizAnswers;
    
    if (direction === 'next') {
      newAnswers = navigateToNextQuizQuestion(courseQuizAnswers, courseQuiz.questions.length);
    } else if (direction === 'previous') {
      newAnswers = navigateToPreviousQuizQuestion(courseQuizAnswers);
    } else if (typeof direction === 'number') {
      newAnswers = navigateToQuizQuestion(courseQuizAnswers, direction, courseQuiz.questions.length);
    }
    
    this.setCourseQuizAnswers(newAnswers);
  }
}

interface ChatWidgetProps {
  apiUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'fullscreen';
  theme?: 'light' | 'dark';
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  apiUrl = 'http://localhost:3000',
  position = 'bottom-right',
  theme = 'light'
}) => {
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState('chat');
  
  // Session State - using custom hook
  const { sessionIds, setSessionIds } = useSessionState();
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  
  // Command autocomplete state
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
  const [showCommandMenu, setShowCommandMenu] = useState(true);
  
  // Message counter for chat window
  const [chatMessageCount, setChatMessageCount] = useState(0);
  // Quiz answer counters for chat window
  const [chatQuizTotalAnswered, setChatQuizTotalAnswered] = useState(0);
  const [chatQuizCorrectAnswered, setChatQuizCorrectAnswered] = useState(0);
  
  // Available commands
  const availableCommands = [
    { command: 'diagnostic_test', description: 'Take a quick financial knowledge assessment' },
    { command: 'courses', description: 'View available learning courses' },
    { command: 'chat', description: 'Start regular financial Q&A chat' }
  ];
  
  // Window management state
  const [currentWindow, setCurrentWindow] = useState<'intro' | 'chat' | 'learn'>('intro');

  // Window-specific state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [learnMessages, setLearnMessages] = useState<ChatMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState('');
  const [learnInputValue, setLearnInputValue] = useState('');
  const [chatIsLoading, setChatIsLoading] = useState(false);
  const [learnIsLoading, setLearnIsLoading] = useState(false);
  
  // Chat window specific state
  const [chatCurrentQuiz, setChatCurrentQuiz] = useState<QuizQuestion | null>(null);
  const [chatShowQuizFeedback, setChatShowQuizFeedback] = useState(false);
  const [chatLastQuizAnswer, setChatLastQuizAnswer] = useState<QuizFeedback | null>(null);
  const [chatDiagnosticState, setChatDiagnosticState] = useState<DiagnosticState>(initializeDiagnosticState());
  const [chatIsDiagnosticMode, setChatIsDiagnosticMode] = useState(false);
  const [chatShowDiagnosticFeedback, setChatShowDiagnosticFeedback] = useState(false);
  const [chatDiagnosticFeedback, setChatDiagnosticFeedback] = useState<QuizFeedback | null>(null);
  const [chatAvailableCourses, setChatAvailableCourses] = useState<Course[]>([]);
  const [chatCurrentCourse, setChatCurrentCourse] = useState<Course | null>(null);
  const [chatCurrentCoursePage, setChatCurrentCoursePage] = useState<CoursePage | null>(null);
  const [chatShowCourseList, setChatShowCourseList] = useState(false);
  const [chatCourseQuiz, setChatCourseQuiz] = useState<CourseQuizState | null>(null);
  const [chatCourseQuizAnswers, setChatCourseQuizAnswers] = useState<CourseQuizAnswers>(initializeCourseQuizAnswers(0));
  
  // Learn window specific state
  const [learnCurrentQuiz, setLearnCurrentQuiz] = useState<QuizQuestion | null>(null);
  const [learnShowQuizFeedback, setLearnShowQuizFeedback] = useState(false);
  const [learnLastQuizAnswer, setLearnLastQuizAnswer] = useState<QuizFeedback | null>(null);
  const [learnDiagnosticState, setLearnDiagnosticState] = useState<DiagnosticState>(initializeDiagnosticState());
  const [learnIsDiagnosticMode, setLearnIsDiagnosticMode] = useState(false);
  const [learnShowDiagnosticFeedback, setLearnShowDiagnosticFeedback] = useState(false);
  const [learnDiagnosticFeedback, setLearnDiagnosticFeedback] = useState<QuizFeedback | null>(null);
  const [learnAvailableCourses, setLearnAvailableCourses] = useState<Course[]>([]);
  const [learnCurrentCourse, setLearnCurrentCourse] = useState<Course | null>(null);
  const [learnCurrentCoursePage, setLearnCurrentCoursePage] = useState<CoursePage | null>(null);
  const [learnShowCourseList, setLearnShowCourseList] = useState(false);
  const [learnCourseQuiz, setLearnCourseQuiz] = useState<CourseQuizState | null>(null);
  const [learnCourseQuizAnswers, setLearnCourseQuizAnswers] = useState<CourseQuizAnswers>(initializeCourseQuizAnswers(0));
  
  // File Upload State (only for chat window)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(initializeUploadProgress());
  
  // Custom hook for scroll to bottom
  const messagesEndRef = useScrollToBottom([chatMessages, learnMessages, currentWindow]);

  // Create API config
  const apiConfig: ApiConfig = {
    apiUrl,
    userId: sessionIds.userId,
    sessionId: sessionIds.sessionId
  };

  // Create window instances
  const chatWindow = new WindowInstance(
    apiConfig,
    sessionIds,
    'chat',
    (message) => setChatMessages(prev => [...prev, message]),
    setChatInputValue,
    setChatIsLoading,
    setChatCurrentQuiz,
    setChatShowQuizFeedback,
    setChatLastQuizAnswer,
    setChatDiagnosticState,
    setChatIsDiagnosticMode,
    setChatShowDiagnosticFeedback,
    setChatDiagnosticFeedback,
    setChatAvailableCourses,
    setChatShowCourseList,
    setChatCurrentCoursePage,
    setChatCurrentCourse,
    setChatCourseQuiz,
    setChatCourseQuizAnswers,
    setUploadedFiles,
    setUploadProgress,
    (pattern) => setChatMessages(prev => prev.filter(msg => !msg.content.includes(pattern)))
  );

  const learnWindow = new WindowInstance(
    apiConfig,
    sessionIds,
    'learn',
    (message) => setLearnMessages(prev => [...prev, message]),
    setLearnInputValue,
    setLearnIsLoading,
    setLearnCurrentQuiz,
    setLearnShowQuizFeedback,
    setLearnLastQuizAnswer,
    setLearnDiagnosticState,
    setLearnIsDiagnosticMode,
    setLearnShowDiagnosticFeedback,
    setLearnDiagnosticFeedback,
    setLearnAvailableCourses,
    setLearnShowCourseList,
    setLearnCurrentCoursePage,
    setLearnCurrentCourse,
    setLearnCourseQuiz,
    setLearnCourseQuizAnswers,
    () => {}, // No file upload for learn window
    () => {}, // No upload progress for learn window
    (pattern) => setLearnMessages(prev => prev.filter(msg => !msg.content.includes(pattern)))
  );

  // Initialize session when widget opens
  useEffect(() => {
    if (isOpen && sessionIds.sessionId && sessionIds.userId) {
      handleInitializeSession();
    }
  }, [isOpen, sessionIds.sessionId, sessionIds.userId]);

  // Session initialization
  const handleInitializeSession = async () => {
    try {
      // Initialize both windows with welcome messages
      chatWindow.initializeWelcome();
      learnWindow.initializeWelcome();
    } catch (error) {
      console.error('Session initialization error:', error);
      chatWindow.initializeWelcome();
      learnWindow.initializeWelcome();
    }
  };

  // Message handling
  const addMessage = (message: ChatMessage) => {
    if (currentWindow === 'chat') {
      setChatMessages(prev => [...prev, message]);
    } else if (currentWindow === 'learn') {
      setLearnMessages(prev => [...prev, message]);
    }
  };

  // Get current window's messages
  const getCurrentMessages = () => {
    if (currentWindow === 'chat') {
      return chatMessages;
    } else if (currentWindow === 'learn') {
      return learnMessages;
    }
    return [];
  };

  // Get current window's input value
  const getCurrentInputValue = () => {
    if (currentWindow === 'chat') {
      return chatInputValue;
    } else if (currentWindow === 'learn') {
      return learnInputValue;
    }
    return '';
  };

  // Set current window's input value
  const setCurrentInputValue = (value: string) => {
    if (currentWindow === 'chat') {
      setChatInputValue(value);
    } else if (currentWindow === 'learn') {
      setLearnInputValue(value);
    }
  };

  // Get current window's loading state
  const getCurrentIsLoading = () => {
    if (currentWindow === 'chat') {
      return chatIsLoading;
    } else if (currentWindow === 'learn') {
      return learnIsLoading;
    }
    return false;
  };

  // Set current window's loading state
  const setCurrentIsLoading = (loading: boolean) => {
    if (currentWindow === 'chat') {
      setChatIsLoading(loading);
    } else if (currentWindow === 'learn') {
      setLearnIsLoading(loading);
    }
  };

  // Close current displays (courses, quizzes, etc.) when a new command is executed
  const closeCurrentDisplays = () => {
    if (currentWindow === 'chat') {
      chatWindow.closeCurrentDisplays();
    } else if (currentWindow === 'learn') {
      learnWindow.closeCurrentDisplays();
    }
  };

  // Add a helper function to remove specific messages by content pattern
  const removeIntroMessage = (contentPattern: string) => {
    if (currentWindow === 'chat') {
      setChatMessages(prev => prev.filter(msg => !msg.content.includes(contentPattern)));
    } else if (currentWindow === 'learn') {
      setLearnMessages(prev => prev.filter(msg => !msg.content.includes(contentPattern)));
    }
  };

  // Handle input changes for command autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentInputValue(value);
    
    // Handle command autocomplete
    if (value.startsWith('/')) {
      const matchingCommands = availableCommands
        .filter(cmd => cmd.command.toLowerCase().startsWith(value.toLowerCase()))
        .map(cmd => cmd.command);
      
      setCommandSuggestions(matchingCommands);
      setShowCommandSuggestions(matchingCommands.length > 0);
      } else {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  // Window-specific input change handlers
  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setChatInputValue(value);
    
    // Chat window doesn't process commands - just update input value
  };

  const handleLearnInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLearnInputValue(value);
    
    // Handle command autocomplete
    if (value.startsWith('/')) {
      const matchingCommands = availableCommands
        .filter(cmd => cmd.command.toLowerCase().startsWith(value.toLowerCase()))
        .map(cmd => cmd.command);
      
      setCommandSuggestions(matchingCommands);
      setShowCommandSuggestions(matchingCommands.length > 0);
    } else {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  // Handle command selection
  const handleCommandSelect = (command: string) => {
    console.log('Setting active mode to:', command); // Debug log
    setActiveMode(command);
    setCurrentInputValue(command);
    setShowCommandSuggestions(false);
    setCommandSuggestions([]);
    setShowCommandMenu(false);
    // Send the command directly instead of waiting for input value update
    if (currentWindow === 'learn') {
      learnWindow.handleSendMessage(command);
    }
    // Chat window doesn't process commands
  };

  // Window-specific message handlers
  const handleChatSendMessage = async (commandText?: string) => {
    const messageText = commandText || chatInputValue.trim();
    if (!messageText) return;
    
    // For chat window, always send to chat API and increment counter
    setChatIsLoading(true);
    setChatInputValue('');
    
    try {
      // Add user message to chat
      const userMessage = createUserMessage(
        messageText,
        sessionIds.sessionId,
        sessionIds.userId
      );
      setChatMessages(prev => [...prev, userMessage]);
      
      // Increment message counter
      const newMessageCount = chatMessageCount + 1;
      setChatMessageCount(newMessageCount);
      
      // Send to chat API
      const response = await sendChatMessage(apiConfig, messageText);
      
      // Handle backend response
      if (response.message) {
        const assistantMessage = createAssistantMessage(
          response.message,
        sessionIds.sessionId,
        sessionIds.userId
      );
        setChatMessages(prev => [...prev, assistantMessage]);
        
        // Handle quiz if present
        if (response.quiz) {
          setChatCurrentQuiz(response.quiz);
        }
      } else {
      const errorMessage = createSystemMessage(
          'Sorry, I encountered an error. Please try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
        setChatMessages(prev => [...prev, errorMessage]);
      }
      
      // Check if we need to generate a quiz (after 3 user messages)
      if (newMessageCount >= 3) {
        try {
          const quizResponse = await generateDiagnosticQuiz(apiConfig);
          const quizMessage = createSystemMessage(
            `🎯 **Knowledge Check!**\n\nI've generated a quick quiz based on our conversation. Let's test your understanding!`,
          sessionIds.sessionId,
          sessionIds.userId
        );
          setChatMessages(prev => [...prev, quizMessage]);
          
          // Set the quiz
          if (quizResponse.questions.length > 0) {
            setChatCurrentQuiz(quizResponse.questions[0]);
          }
          
          // Reset counter after generating quiz
          setChatMessageCount(0);
        } catch (quizError) {
          console.error('Quiz generation error:', quizError);
          // Don't show error to user, just continue with chat
        }
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = createSystemMessage(
        'Network error. Please check your connection.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatIsLoading(false);
    }
  };

  const handleLearnSendMessage = async (commandText?: string) => {
    const messageText = commandText || learnInputValue.trim();
    if (!messageText) return;
    await learnWindow.handleSendMessage(messageText);
  };

  // Window-specific wrapper functions for components
  const handleChatStartDiagnosticTest = () => chatWindow.handleStartDiagnosticTest();
  const handleChatDiagnosticQuizAnswer = (selectedOption: number, correct: boolean) => 
    chatWindow.handleDiagnosticQuizAnswer(selectedOption, correct, chatDiagnosticState);
  const handleChatCompleteDiagnosticTest = (state: DiagnosticState) => 
    chatWindow.handleCompleteDiagnosticTest(state);
  const handleChatCoursesList = () => chatWindow.handleCoursesList();
  const handleChatStartCourse = (courseId: string) => chatWindow.handleStartCourse(courseId);
  const handleChatNavigateCoursePage = (pageIndex: number) => chatWindow.handleNavigateCoursePage(pageIndex);
  const handleChatCompleteCourse = () => chatWindow.handleCompleteCourse(chatCurrentCourse);
  const handleChatSubmitCourseQuiz = () => chatWindow.handleSubmitCourseQuiz(chatCourseQuiz, chatCourseQuizAnswers);
  const handleChatQuizAnswer = (selectedOption: number, correct: boolean) => {
    // Increment total answered
    setChatQuizTotalAnswered(prev => prev + 1);
    // Increment correct answered if correct
    if (correct) setChatQuizCorrectAnswered(prev => prev + 1);

    // Build feedback string
    const feedbackTitle = correct ? '🎉 Excellent! You got it right!' : '🤔 Good Try! Here\'s what you should know:';
    const feedbackExplanation = chatCurrentQuiz?.explanation || '';
    const feedbackContent = `${feedbackTitle}\n\n💡 ${feedbackExplanation}`;

    // Add feedback as a normal assistant message
    setChatMessages(prev => [
      ...prev,
      createAssistantMessage(
        feedbackContent,
        sessionIds.sessionId,
        sessionIds.userId
      )
    ]);

    // Clear quiz/feedback state
    setChatShowQuizFeedback(false);
    setChatLastQuizAnswer(null);
    setChatCurrentQuiz(null);
  };
  const handleChatFileUpload = (files: FileList) => chatWindow.handleFileUpload(files);
  const handleChatRemoveFile = (fileIndex: number) => chatWindow.handleRemoveFile(fileIndex);
  const handleChatCourseQuizAnswerSelection = (questionIndex: number, selectedOption: number) => 
    chatWindow.handleCourseQuizAnswerSelection(questionIndex, selectedOption, chatCourseQuizAnswers);
  const handleChatCourseQuizNavigation = (direction: 'next' | 'previous' | number) => 
    chatWindow.handleCourseQuizNavigation(direction, chatCourseQuiz, chatCourseQuizAnswers);

  const handleLearnStartDiagnosticTest = () => learnWindow.handleStartDiagnosticTest();
  const handleLearnDiagnosticQuizAnswer = (selectedOption: number, correct: boolean) => 
    learnWindow.handleDiagnosticQuizAnswer(selectedOption, correct, learnDiagnosticState);
  const handleLearnCompleteDiagnosticTest = (state: DiagnosticState) => 
    learnWindow.handleCompleteDiagnosticTest(state);
  const handleLearnCoursesList = () => learnWindow.handleCoursesList();
  const handleLearnStartCourse = (courseId: string) => learnWindow.handleStartCourse(courseId);
  const handleLearnNavigateCoursePage = (pageIndex: number) => learnWindow.handleNavigateCoursePage(pageIndex);
  const handleLearnCompleteCourse = () => learnWindow.handleCompleteCourse(learnCurrentCourse);
  const handleLearnSubmitCourseQuiz = () => learnWindow.handleSubmitCourseQuiz(learnCourseQuiz, learnCourseQuizAnswers);
  const handleLearnQuizAnswer = (selectedOption: number, correct: boolean) => 
    learnWindow.handleQuizAnswer(selectedOption, correct, learnCurrentQuiz);
  const handleLearnCourseQuizAnswerSelection = (questionIndex: number, selectedOption: number) => 
    learnWindow.handleCourseQuizAnswerSelection(questionIndex, selectedOption, learnCourseQuizAnswers);
  const handleLearnCourseQuizNavigation = (direction: 'next' | 'previous' | number) => 
    learnWindow.handleCourseQuizNavigation(direction, learnCourseQuiz, learnCourseQuizAnswers);

  // Chat window diagnostic variables
  const hasChatDiagnosticTest = chatDiagnosticState.test && chatDiagnosticState.test.questions.length > 0;
  const chatCurrentDiagnosticQuiz = hasChatDiagnosticTest ? chatDiagnosticState.test!.questions[chatDiagnosticState.currentQuestionIndex] : null;
  const chatCurrentDiagnosticQuestionIndex = hasChatDiagnosticTest ? chatDiagnosticState.currentQuestionIndex : 0;
  const chatDiagnosticTotalQuestions = chatDiagnosticState.test ? chatDiagnosticState.test.questions.length : 0;

  // Learn window diagnostic variables
  const hasLearnDiagnosticTest = learnDiagnosticState.test && learnDiagnosticState.test.questions.length > 0;
  const learnCurrentDiagnosticQuiz = hasLearnDiagnosticTest ? learnDiagnosticState.test!.questions[learnDiagnosticState.currentQuestionIndex] : null;
  const learnCurrentDiagnosticQuestionIndex = hasLearnDiagnosticTest ? learnDiagnosticState.currentQuestionIndex : 0;
  const learnDiagnosticTotalQuestions = learnDiagnosticState.test ? learnDiagnosticState.test.questions.length : 0;

  if (!isOpen) {
    return (
      <div className={`chat-widget-container ${position}`}>
        <button 
          className="chat-toggle-button"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className={`chat-widget-container ${position} open ${isExpanded ? 'expanded' : ''}`}>
      <div className={`chat-widget ${theme} ${isExpanded ? 'expanded' : ''}`}>
        <div className="chat-header">
          <h3>💰 MoneyMentor</h3>
          {currentWindow === 'chat' && (
            <div className="quiz-progress-simple">
              <span className="quiz-progress-simple-text">
                {chatQuizCorrectAnswered}/{chatQuizTotalAnswered}
              </span>
            </div>
          )}
          <div className="chat-header-buttons">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Minimize' : 'Maximize'}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Upload Progress Indicator Component */}
        <UploadProgressIndicator uploadProgress={uploadProgress} />

        {/* Uploaded Files Display Component */}
        <UploadedFilesDisplay 
          uploadedFiles={uploadedFiles}
          onRemoveFile={() => {}}
        />

        {/* Windows Component */}
        <Windows
          currentWindow={currentWindow}
          onNavigateToChat={() => setCurrentWindow('chat')}
          onNavigateToLearn={() => setCurrentWindow('learn')}
          onNavigateToIntro={() => setCurrentWindow('intro')}
          isExpanded={isExpanded}
          hasUploads={uploadProgress.isUploading || uploadedFiles.length > 0}
          chatChildren={
            <>
              {/* Chat Window Content */}
        <div className="chat-messages">
                {chatMessages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                {formatMessageContent(message.content)}
              </div>
              {/* Display buttons if present */}
              {message.metadata?.buttons && (
                <MessageButtons buttons={message.metadata.buttons} />
              )}
              {/* Display calculation result if present */}
              {message.metadata?.calculationResult && (
                <CalculationResult result={message.metadata.calculationResult} />
              )}
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          ))}
          
          {/* Diagnostic Test Component */}
          <DiagnosticTest
                  isDiagnosticMode={chatIsDiagnosticMode}
                  currentQuiz={chatCurrentDiagnosticQuiz}
                  showDiagnosticFeedback={chatShowDiagnosticFeedback}
                  diagnosticFeedback={chatDiagnosticFeedback}
                  diagnosticQuestionIndex={chatCurrentDiagnosticQuestionIndex}
                  diagnosticTotalQuestions={chatDiagnosticTotalQuestions}
                  onDiagnosticQuizAnswer={handleChatDiagnosticQuizAnswer}
          />

          {/* Quiz Component */}
          <Quiz
                  currentQuiz={chatCurrentQuiz}
                  showQuizFeedback={chatShowQuizFeedback}
                  lastQuizAnswer={chatLastQuizAnswer}
                  isDiagnosticMode={chatIsDiagnosticMode}
                  onQuizAnswer={handleChatQuizAnswer}
          />

          {/* Course List Component */}
          <CourseList
                  showCourseList={chatShowCourseList}
                  availableCourses={chatAvailableCourses}
                  onStartCourse={handleChatStartCourse}
          />

          {/* Course Page Component */}
          <CoursePageComponent
                  currentCoursePage={chatCurrentCoursePage}
                  onNavigateCoursePage={handleChatNavigateCoursePage}
                  onCompleteCourse={handleChatCompleteCourse}
          />

          {/* Course Quiz Component */}
          <CourseQuiz
                  courseQuiz={chatCourseQuiz}
                  courseQuizAnswers={chatCourseQuizAnswers}
                  onCourseQuizAnswerSelection={handleChatCourseQuizAnswerSelection}
                  onCourseQuizNavigation={handleChatCourseQuizNavigation}
                  onSubmitCourseQuiz={handleChatSubmitCourseQuiz}
                  areAllQuestionsAnswered={(answers) => areAllQuestionsAnswered(answers)}
                />
                
                {chatIsLoading && (
            <div className="message assistant">
              <div className="message-content">Thinking...</div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Component */}
        <ChatInput
                inputValue={chatInputValue}
                isLoading={chatIsLoading}
          uploadProgress={uploadProgress}
          showCommandSuggestions={false}
          commandSuggestions={[]}
          showCommandMenu={false}
          availableCommands={[]}
          activeMode={activeMode}
                onInputChange={handleChatInputChange}
                onSendMessage={handleChatSendMessage}
                onFileUpload={handleChatFileUpload}
          onCommandSelect={() => {}}
          onToggleCommandMenu={() => {}}
          onCloseCommandMenu={() => {}}
                disabled={currentWindow === 'intro'}
              />
            </>
          }
          learnChildren={
            <>
              {/* Learn Window Content */}
              <div className="chat-messages">
                {learnMessages.map((message) => (
                  <div key={message.id} className={`message ${message.type}`}>
                    <div className="message-content">
                      {formatMessageContent(message.content)}
                    </div>
                    {/* Display buttons if present */}
                    {message.metadata?.buttons && (
                      <MessageButtons buttons={message.metadata.buttons} />
                    )}
                    {/* Display calculation result if present */}
                    {message.metadata?.calculationResult && (
                      <CalculationResult result={message.metadata.calculationResult} />
                    )}
                    <div className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Learn Diagnostic Test Component */}
                <DiagnosticTest
                  isDiagnosticMode={learnIsDiagnosticMode}
                  currentQuiz={learnCurrentDiagnosticQuiz}
                  showDiagnosticFeedback={learnShowDiagnosticFeedback}
                  diagnosticFeedback={learnDiagnosticFeedback}
                  diagnosticQuestionIndex={learnCurrentDiagnosticQuestionIndex}
                  diagnosticTotalQuestions={learnDiagnosticTotalQuestions}
                  onDiagnosticQuizAnswer={handleLearnDiagnosticQuizAnswer}
                />

                {/* Learn Quiz Component */}
                <Quiz
                  currentQuiz={learnCurrentQuiz}
                  showQuizFeedback={learnShowQuizFeedback}
                  lastQuizAnswer={learnLastQuizAnswer}
                  isDiagnosticMode={learnIsDiagnosticMode}
                  onQuizAnswer={handleLearnQuizAnswer}
                />

                {/* Learn Course List Component */}
                <CourseList
                  showCourseList={learnShowCourseList}
                  availableCourses={learnAvailableCourses}
                  onStartCourse={handleLearnStartCourse}
                />

                {/* Learn Course Page Component */}
                <CoursePageComponent
                  currentCoursePage={learnCurrentCoursePage}
                  onNavigateCoursePage={handleLearnNavigateCoursePage}
                  onCompleteCourse={handleLearnCompleteCourse}
                />

                {/* Learn Course Quiz Component */}
                <CourseQuiz
                  courseQuiz={learnCourseQuiz}
                  courseQuizAnswers={learnCourseQuizAnswers}
                  onCourseQuizAnswerSelection={handleLearnCourseQuizAnswerSelection}
                  onCourseQuizNavigation={handleLearnCourseQuizNavigation}
                  onSubmitCourseQuiz={handleLearnSubmitCourseQuiz}
                  areAllQuestionsAnswered={(answers) => areAllQuestionsAnswered(answers)}
                />
                
                {learnIsLoading && (
                  <div className="message assistant">
                    <div className="message-content">Thinking...</div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Learn Command Input Component */}
              <CommandInput
          showCommandMenu={showCommandMenu}
          availableCommands={availableCommands}
          activeMode={activeMode}
          onCommandSelect={handleCommandSelect}
          onToggleCommandMenu={() => setShowCommandMenu(!showCommandMenu)}
                disabled={false}
              />
            </>
          }
        />
      </div>
    </div>
  );
}; 