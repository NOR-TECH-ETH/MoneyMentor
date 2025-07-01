import React, { useState, useEffect } from 'react';

import { 
  ChatMessage, 
  QuizQuestion,
  Course,
  CoursePage,
  ChatSession,
  UserProfile
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
  CalculationResult,
  MessageButtons,
  QuizHistoryDropdown,
  BotMessage
} from './ChatWidget/index';

// Import Windows component
import { Windows } from './Windows';

// Import Sidebar components
import { Sidebar, SidebarToggle } from './Sidebar';

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
import { useSessionState, useScrollToBottom, useSidebar, useProfile } from '../hooks';

// Import utilities
import {
  // API utilities
  ApiConfig,
  sendChatMessage,
  generateDiagnosticQuiz,

  uploadFile,
  
  SessionIds,
  
  // Diagnostic utilities
  DiagnosticState,
  initializeDiagnosticState,
  
  // Quiz utilities
  QuizFeedback,
  CourseQuizState,
  CourseQuizAnswers,
  initializeCourseQuizAnswers,
  handleCourseQuizAnswer,
  navigateToNextQuizQuestion,
  navigateToPreviousQuizQuestion,
  navigateToQuizQuestion,
  areAllQuestionsAnswered,
 
  
  // Message utilities
  createWelcomeMessage,
  createSystemMessage,
  createUserMessage,
  createAssistantMessage,
 
  formatMessageContent,
  
  // File utilities
  validateFiles,
  UploadProgress,
  initializeUploadProgress,
  updateUploadProgress,
  resetUploadProgress,

} from '../utils/chatWidget';

// Import session utilities
import { getMockChatSessions } from '../utils/sessions';

// Import styles
import '../styles/windows.css';
import '../styles/sidebar.css';

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
  async handleStartDiagnosticTest(courseKey: string = "") {
    await handleStartDiagnosticTest(this.createDiagnosticHandlersProps(), courseKey);
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
  async handleNavigateCoursePage(courseId: string, pageIndex: number) {
    await handleNavigateCoursePage(courseId, pageIndex, this.createCourseHandlersProps());
  }
  
  // Handle complete course
  async handleCompleteCourse(courseId: string) {
    await handleCompleteCourse(courseId, this.createCourseHandlersProps());
  }
  
  // Handle submit course quiz
  async handleSubmitCourseQuiz(courseId: string, pageIndex: number, selectedOption: string, correct: boolean, currentTotalPages?: number) {
    await handleSubmitCourseQuiz(courseId, pageIndex, selectedOption, correct, this.createCourseHandlersProps(), currentTotalPages);
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
  apiUrl = 'https://backend-2-647308514289.us-central1.run.app',
  position = 'fullscreen',
  theme = 'light'
}) => {
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState('chat');
  
  // Session State - using custom hook
  const { sessionIds, setSessionIds } = useSessionState();
  
  // Sidebar and Profile State
  const sidebarHook = useSidebar();
  const profileHook = useProfile();
  
  // Chat Sessions State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(getMockChatSessions());
  
  // Session handlers
  const handleSessionSelect = (sessionId: string) => {
    console.log('Selected session:', sessionId);
    // TODO: Load session messages and update current chat
  };
  
  const handleNewChat = () => {
    console.log('Creating new chat');
    // TODO: Clear current messages and start new session
  };
  
  
  // Command autocomplete state

  
  // Message counter for chat window
  const [chatMessageCount, setChatMessageCount] = useState(0);
  // Quiz answer counters for chat window
  const [chatQuizTotalAnswered, setChatQuizTotalAnswered] = useState(0);
  const [chatQuizCorrectAnswered, setChatQuizCorrectAnswered] = useState(0);
  // Quiz dropdown state and history
  const [showQuizDropdown, setShowQuizDropdown] = useState(false);
  const [chatQuizHistory, setChatQuizHistory] = useState<any[]>([
    // Test data to see if dropdown works
    {
      question: "What is compound interest?",
      options: ["Interest on interest", "Simple interest", "Fixed interest", "Variable interest"],
      correctAnswer: 0,
      userAnswer: 0,
      explanation: "Compound interest is interest earned on both the principal and the accumulated interest.",
      topicTag: "investing"
    }
  ]);
  
  // Available commands
   
  
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


  // Window-specific input change handlers
  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setChatInputValue(value);
    
    // Chat window doesn't process commands - just update input value
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
        // Check if message contains calculation JSON
        const jsonMatch = response.message.match(/```json\n([\s\S]*?)\n```/);
        let calculationResult = null;
        let cleanMessage = response.message;
        
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            // Convert snake_case to camelCase for the component
            calculationResult = {
              type: jsonData.type || 'financial_calculation',
              monthlyPayment: jsonData.monthly_payment,
              monthsToPayoff: jsonData.months_to_payoff,
              totalInterest: jsonData.total_interest,
              totalAmount: jsonData.total_amount,
              stepByStepPlan: jsonData.step_by_step_plan || [],
              disclaimer: "Estimates only. Verify with a certified financial professional.",
              metadata: {
                inputValues: {},
                calculationDate: new Date().toISOString()
              }
            };
            // Clean the message by removing the JSON block
            cleanMessage = response.message.replace(/```json\n[\s\S]*?\n```/, '').trim();
            // Remove the explanation paragraph that comes after the JSON
            cleanMessage = cleanMessage.replace(/\n\nBased on the calculation results[\s\S]*$/, '').trim();
          } catch (error) {
            console.error('Error parsing calculation JSON:', error);
          }
        }

        const assistantMessage = createAssistantMessage(
          cleanMessage,
          sessionIds.sessionId,
          sessionIds.userId
        );

        // Add calculation result to metadata if present
        if (calculationResult) {
          assistantMessage.metadata = {
            ...assistantMessage.metadata,
            calculationResult: calculationResult
          };
        }

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


  // Window-specific wrapper functions for components
  
  const handleChatDiagnosticQuizAnswer = (selectedOption: number, correct: boolean) => 
    chatWindow.handleDiagnosticQuizAnswer(selectedOption, correct, chatDiagnosticState);

  const handleChatStartCourse = (courseId: string) => chatWindow.handleStartCourse(courseId);
  const handleChatNavigateCoursePage = (pageIndex: number) => chatWindow.handleNavigateCoursePage(chatCurrentCourse?.id || '', pageIndex);
  const handleChatCompleteCourse = () => chatWindow.handleCompleteCourse(chatCurrentCourse?.id || '');
  const handleChatSubmitCourseQuiz = (selectedOption: number, correct: boolean) => {
    const pageIndex = chatCourseQuiz?.pageIndex ?? 0;
    const selectedOptionLetter = String.fromCharCode(65 + selectedOption); // Convert 0,1,2,3 to A,B,C,D
    const currentTotalPages = chatCourseQuiz?.totalPages; // Get current total pages from quiz state
    return chatWindow.handleSubmitCourseQuiz(chatCurrentCourse?.id || '', pageIndex, selectedOptionLetter, correct, currentTotalPages);
  };
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

    // Add to quiz history
    if (chatCurrentQuiz) {
      setChatQuizHistory(prev => [
        ...prev,
        {
          question: chatCurrentQuiz.question,
          options: chatCurrentQuiz.options,
          correctAnswer: chatCurrentQuiz.correctAnswer,
          userAnswer: selectedOption,
          explanation: chatCurrentQuiz.explanation,
          topicTag: chatCurrentQuiz.topicTag || '',
        }
      ]);
    }

    // Clear quiz/feedback state
    setChatShowQuizFeedback(false);
    setChatLastQuizAnswer(null);
    setChatCurrentQuiz(null);
  };
  const handleChatFileUpload = async (files: FileList) => {
    const validation = validateFiles(files);
    
    if (validation.validFiles.length === 0) {
      const errorMessage = createSystemMessage(
        'Please upload valid files (PDF, TXT, PPT, PPTX) under 10MB each.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      setChatMessages(prev => [...prev, errorMessage]);
      return;
    }

    setUploadProgress({ isUploading: true, progress: 0 });

    try {
      for (let i = 0; i < validation.validFiles.length; i++) {
        const file = validation.validFiles[i];
        
        try {
          await uploadFile(apiConfig, file);
          setUploadedFiles(prev => [...prev, file]);
          
          const successMessage = createSystemMessage(
            `File "${file.name}" uploaded successfully!`,
            sessionIds.sessionId,
            sessionIds.userId
          );
          setChatMessages(prev => [...prev, successMessage]);
        } catch (error) {
          const errorMessage = createSystemMessage(
            `Failed to upload "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            sessionIds.sessionId,
            sessionIds.userId
          );
          setChatMessages(prev => [...prev, errorMessage]);
        }

        setUploadProgress(updateUploadProgress(i + 1, validation.validFiles.length, file.name));
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = createSystemMessage(
        'Upload failed. Please check your connection and try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setUploadProgress(resetUploadProgress());
    }
  };
  const handleChatRemoveFile = async (fileIndex: number) => {
    // Safety check before attempting to remove
    if (fileIndex < 0 || fileIndex >= uploadedFiles.length) {
      console.error('Invalid file index:', fileIndex, 'uploadedFiles length:', uploadedFiles.length);
      return;
    }

    const file = uploadedFiles[fileIndex];
    if (!file) {
      console.error('File not found at index:', fileIndex);
      return;
    }

    try {
      // Remove file from local state immediately
      const updatedFiles = uploadedFiles.filter((_, index) => index !== fileIndex);
      setUploadedFiles(updatedFiles);
      
      // Add removal message
      const removalMessage = createSystemMessage(
        `File "${file.name}" has been removed.`,
        sessionIds.sessionId,
        sessionIds.userId
      );
      setChatMessages(prev => [...prev, removalMessage]);
      
      // Optionally try to remove from backend, but don't fail if it doesn't work
      try {
        // await removeFile(apiConfig, file.name);
        // Backend remove endpoint might not exist, so we'll just remove locally
      } catch (backendError) {
        console.warn('Backend file removal failed, but file removed locally:', backendError);
      }
    } catch (error) {
      console.error('Remove file error:', error);
      const errorMessage = createSystemMessage(
        'Failed to remove file. Please try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };
  const handleChatCourseQuizAnswerSelection = (questionIndex: number, selectedOption: number) => 
    chatWindow.handleCourseQuizAnswerSelection(questionIndex, selectedOption, chatCourseQuizAnswers);
  const handleChatCourseQuizNavigation = (direction: 'next' | 'previous' | number) => {
    if (direction === 'previous' && chatCourseQuiz) {
      // Navigate to previous page
      const prevPageIndex = chatCourseQuiz.pageIndex - 1;
      if (prevPageIndex >= 0) {
        handleChatNavigateCoursePage(prevPageIndex);
      }
    } else if (direction === 'next' && chatCourseQuiz) {
      // Navigate to next page
      const nextPageIndex = chatCourseQuiz.pageIndex + 1;
      handleChatNavigateCoursePage(nextPageIndex);
    } else {
      // Original quiz navigation logic for question-level navigation
    chatWindow.handleCourseQuizNavigation(direction, chatCourseQuiz, chatCourseQuizAnswers);
    }
  };

 
  const handleLearnDiagnosticQuizAnswer = (selectedOption: number, correct: boolean) => 
    learnWindow.handleDiagnosticQuizAnswer(selectedOption, correct, learnDiagnosticState);
  
 
  const handleLearnStartCourse = (courseId: string) => learnWindow.handleStartCourse(courseId);
  const handleLearnNavigateCoursePage = (pageIndex: number) => learnWindow.handleNavigateCoursePage(learnCurrentCourse?.id || '', pageIndex);
  const handleLearnCompleteCourse = () => learnWindow.handleCompleteCourse(learnCurrentCourse?.id || '');
  const handleLearnSubmitCourseQuiz = (selectedOption: number, correct: boolean) => {
    const pageIndex = learnCourseQuiz?.pageIndex ?? 0;
    const selectedOptionLetter = String.fromCharCode(65 + selectedOption); // Convert 0,1,2,3 to A,B,C,D
    const currentTotalPages = learnCourseQuiz?.totalPages; // Get current total pages from quiz state
    return learnWindow.handleSubmitCourseQuiz(learnCurrentCourse?.id || '', pageIndex, selectedOptionLetter, correct, currentTotalPages);
  };
  const handleLearnQuizAnswer = (selectedOption: number, correct: boolean) => 
    learnWindow.handleQuizAnswer(selectedOption, correct, learnCurrentQuiz);
  const handleLearnCourseQuizAnswerSelection = (questionIndex: number, selectedOption: number) => 
    learnWindow.handleCourseQuizAnswerSelection(questionIndex, selectedOption, learnCourseQuizAnswers);
  const handleLearnCourseQuizNavigation = (direction: 'next' | 'previous' | number) => {
    if (direction === 'previous' && learnCourseQuiz) {
      // Navigate to previous page
      const prevPageIndex = learnCourseQuiz.pageIndex - 1;
      if (prevPageIndex >= 0) {
        handleLearnNavigateCoursePage(prevPageIndex);
      }
    } else if (direction === 'next' && learnCourseQuiz) {
      // Navigate to next page
      const nextPageIndex = learnCourseQuiz.pageIndex + 1;
      handleLearnNavigateCoursePage(nextPageIndex);
    } else {
      // Original quiz navigation logic for question-level navigation
    learnWindow.handleCourseQuizNavigation(direction, learnCourseQuiz, learnCourseQuizAnswers);
    }
  };

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

  // Ref for the quiz tracker button
  const quizTrackerRef = React.useRef<HTMLButtonElement>(null);

  const LEARN_COURSES = [
    { key: 'money-goals-mindset', label: 'Money, Goals and Mindset' },
    { key: 'budgeting-saving', label: 'Budgeting and Saving' },
    { key: 'college-planning-saving', label: 'College Planning and Saving' },
    { key: 'earning-income-basics', label: 'Earning and Income Basics' },
  ];

  const [learnHasShownCourseList, setLearnHasShownCourseList] = useState(false);

  // Handler for course selection in Learning Center
  const handleLearnCourseTopicSelect = async (courseKey: string, courseLabel: string) => {
    // Add a message indicating the user selected a course
    setLearnMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'user',
        content: `Selected course: **${courseLabel}**`,
        timestamp: new Date().toISOString(),
        sessionId: sessionIds.sessionId,
        userId: sessionIds.userId
      }
    ]);
    // Fetch diagnostic test for the selected course
    // You may want to pass the courseKey as a topic to the API if supported
    await learnWindow.handleStartDiagnosticTest(courseKey);
  };

  // Show course list as a persistent chat message on first open of Learning Center
  useEffect(() => {
    if (currentWindow === 'learn' && !learnHasShownCourseList) {
      setLearnMessages(prev => [
        ...prev,
        {
          id: 'learn-courses-list',
          type: 'assistant',
          content: 'Please select a course to get started:',
          timestamp: new Date().toISOString(),
          sessionId: sessionIds.sessionId,
          userId: sessionIds.userId,
          metadata: {
            buttons: LEARN_COURSES.map(course => ({
              label: course.label,
              action: () => handleLearnCourseTopicSelect(course.key, course.label)
            }))
          }
        }
      ]);
      setLearnHasShownCourseList(true);
    }
  }, [currentWindow, learnHasShownCourseList, sessionIds.sessionId, sessionIds.userId]);

  useEffect(() => {
    // Listen for recommended course start event
    const handler = (e: any) => {
      const course = e.detail;
      if (course && course.id) {
        // Start the recommended course using the course ID
        learnWindow.handleStartCourse(course.id);
      }
    };
    window.addEventListener('start-recommended-course', handler);
    return () => window.removeEventListener('start-recommended-course', handler);
  }, [learnWindow]);

  return (
    <div className={`chat-app ${theme}`}>
      {/* Sidebar - only show in chat window */}
      {currentWindow === 'chat' && (
        <Sidebar
          sidebarState={sidebarHook.sidebarState}
          setSidebarState={sidebarHook.setSidebarState}
          chatSessions={chatSessions}
          userProfile={profileHook.userProfile}
          profileModalState={profileHook.profileModalState}
          setProfileModalState={profileHook.setProfileModalState}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onProfileUpdate={profileHook.updateProfile}
          theme={theme}
        />
      )}

      <div className={`chat-widget ${theme} ${position}`}>
        <div className="chat-header">
          <div className="header-left">
            {/* SidebarToggle - only show in chat window */}
            {currentWindow === 'chat' ? (
              <SidebarToggle 
                isOpen={sidebarHook.sidebarState.isOpen}
                onClick={sidebarHook.toggleSidebar}
              />
            ) : (
              <div className="sidebar-toggle-placeholder" />
            )}
            <h3>💰 MoneyMentor</h3>
          </div>
          <div className="mode-navigation-centered">
            <div className="mode-navigation-glass">
              <button
                className={`mode-btn ${currentWindow === 'chat' ? 'active' : ''}`}
                onClick={() => setCurrentWindow('chat')}
              >
                <span className="mode-icon">💬</span>
                <span className="mode-text">Chat</span>
              </button>
              <button 
                className={`mode-btn ${currentWindow === 'learn' ? 'active' : ''}`}
                onClick={() => setCurrentWindow('learn')}
              >
                <span className="mode-icon">🎓</span>
                <span className="mode-text">Learn</span>
              </button>
            </div>
          </div>
          <div className="header-spacer"></div>
        </div>

        {/* Upload Progress Indicator Component */}
        <UploadProgressIndicator uploadProgress={uploadProgress} />

        {/* Uploaded Files Display Component - only show when there are files */}
        {uploadedFiles.length > 0 && (
        <UploadedFilesDisplay 
          uploadedFiles={uploadedFiles}
            onRemoveFile={handleChatRemoveFile}
        />
        )}

        {/* Windows Component */}
        <Windows
          currentWindow={currentWindow}
          onNavigateToChat={() => setCurrentWindow('chat')}
          onNavigateToLearn={() => setCurrentWindow('learn')}
          onNavigateToIntro={() => setCurrentWindow('intro')}
          isExpanded={true}
          hasUploads={uploadProgress.isUploading || uploadedFiles.length > 0}
          showQuizDropdown={showQuizDropdown}
          onToggleQuizDropdown={() => setShowQuizDropdown(prev => !prev)}
          onCloseQuizDropdown={() => setShowQuizDropdown(false)}
          quizTrackerRef={quizTrackerRef}
          chatQuizCorrectAnswered={chatQuizCorrectAnswered}
          chatQuizTotalAnswered={chatQuizTotalAnswered}
          chatQuizHistory={chatQuizHistory}
          QuizHistoryDropdown={QuizHistoryDropdown}
          chatChildren={
            <div className="chat-window">
              {/* Chat Messages Container with Scrollbar */}
              <div className="chat-messages-container">
        <div className="chat-messages">
                {chatMessages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
                      {message.type === 'assistant' ? (
                        <BotMessage
                          content={message.content}
                          onCopy={undefined}
                          messageId={message.id}
                        />
                      ) : (
              <div className="message-content">
                {formatMessageContent(message.content)}
              </div>
                      )}
              {/* Display buttons if present */}
              {message.metadata?.buttons && (
                <MessageButtons buttons={message.metadata.buttons} messageId={message.id} />
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
          {/* Course Page Component (only for non-quiz pages) */}
          {chatCourseQuiz == null && chatCurrentCoursePage && (
          <CoursePageComponent
                  currentCoursePage={chatCurrentCoursePage}
                  onNavigateCoursePage={handleChatNavigateCoursePage}
                  onCompleteCourse={handleChatCompleteCourse}
          />
          )}
          {/* Course Quiz Component (for quiz pages) */}
          {chatCourseQuiz && (
          <CourseQuiz
                  courseQuiz={chatCourseQuiz}
                  courseQuizAnswers={chatCourseQuizAnswers}
                  onCourseQuizAnswerSelection={handleChatCourseQuizAnswerSelection}
                  onCourseQuizNavigation={handleChatCourseQuizNavigation}
                  onSubmitCourseQuiz={handleChatSubmitCourseQuiz}
                  areAllQuestionsAnswered={(answers) => areAllQuestionsAnswered(answers)}
                />
          )}
                {chatIsLoading && (
            <div className="message assistant">
              <div className="message-content">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
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
            </div>
          }
          learnChildren={
            <div className="chat-window">
              {/* Learn Window Content */}
              <div className="chat-messages-container">
              <div className="chat-messages" style={{ paddingBottom: '20px', marginBottom: '20px' }}>
                {learnMessages.map((message) => (
                  <div key={message.id} className={`message ${message.type}`}>
                    <div className="message-content">
                      {formatMessageContent(message.content)}
                    </div>
                    {/* Display buttons if present */}
                    {message.metadata?.buttons && (
                      <MessageButtons buttons={message.metadata.buttons} messageId={message.id} />
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
                {/* Learn Course Page Component (only for non-quiz pages) */}
                {learnCourseQuiz == null && learnCurrentCoursePage && (
                <CoursePageComponent
                  currentCoursePage={learnCurrentCoursePage}
                  onNavigateCoursePage={handleLearnNavigateCoursePage}
                  onCompleteCourse={handleLearnCompleteCourse}
                />
                )}
                {/* Learn Course Quiz Component (for quiz pages) */}
                {learnCourseQuiz && (
                <CourseQuiz
                  courseQuiz={learnCourseQuiz}
                  courseQuizAnswers={learnCourseQuizAnswers}
                  onCourseQuizAnswerSelection={handleLearnCourseQuizAnswerSelection}
                  onCourseQuizNavigation={handleLearnCourseQuizNavigation}
                  onSubmitCourseQuiz={handleLearnSubmitCourseQuiz}
                  areAllQuestionsAnswered={(answers) => areAllQuestionsAnswered(answers)}
                />
                )}
                {learnIsLoading && (
                  <div className="message assistant">
                    <div className="message-content">Thinking...</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}; 