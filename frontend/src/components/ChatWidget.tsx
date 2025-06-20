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
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeMode, setActiveMode] = useState('chat');
  
  // Session State - using custom hook
  const { sessionIds, setSessionIds } = useSessionState();
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  
  // Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Quiz State
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion | null>(null);
  const [showQuizFeedback, setShowQuizFeedback] = useState(false);
  const [lastQuizAnswer, setLastQuizAnswer] = useState<QuizFeedback | null>(null);
  
  // Diagnostic State
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>(initializeDiagnosticState());
  const [isDiagnosticMode, setIsDiagnosticMode] = useState(false);
  const [showDiagnosticFeedback, setShowDiagnosticFeedback] = useState(false);
  const [diagnosticFeedback, setDiagnosticFeedback] = useState<QuizFeedback | null>(null);
  
  // Command autocomplete state
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<string[]>([]);
  const [showCommandMenu, setShowCommandMenu] = useState(true);
  
  // Available commands
  const availableCommands = [
    { command: 'diagnostic_test', description: 'Take a quick financial knowledge assessment' },
    { command: 'courses', description: 'View available learning courses' },
    { command: 'chat', description: 'Start regular financial Q&A chat' }
  ];
  
  // Course State
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [currentCoursePage, setCurrentCoursePage] = useState<CoursePage | null>(null);
  const [showCourseList, setShowCourseList] = useState(false);
  const [courseQuiz, setCourseQuiz] = useState<CourseQuizState | null>(null);
  const [courseQuizAnswers, setCourseQuizAnswers] = useState<CourseQuizAnswers>(
    initializeCourseQuizAnswers(0)
  );
  
  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(initializeUploadProgress());
  
  // Window management state
  const [currentWindow, setCurrentWindow] = useState<'intro' | 'chat' | 'learn'>('intro');

  // Custom hook for scroll to bottom
  const messagesEndRef = useScrollToBottom([messages]);

  // Create API config
  const apiConfig: ApiConfig = {
    apiUrl,
    userId: sessionIds.userId,
    sessionId: sessionIds.sessionId
  };

  // Initialize session when widget opens
  useEffect(() => {
    if (isOpen && sessionIds.sessionId && sessionIds.userId) {
      handleInitializeSession();
    }
  }, [isOpen, sessionIds.sessionId, sessionIds.userId]);

  // Session initialization
  const handleInitializeSession = async () => {
    try {
      // Initialize quiz session only
      // await initializeQuizSession(apiConfig);
      
      if (messages.length === 0) {
        const welcomeMessage = createWelcomeMessage(
          sessionIds.sessionId,
          sessionIds.userId
        );
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Session initialization error:', error);
      if (messages.length === 0) {
        const welcomeMessage = createWelcomeMessage(
          sessionIds.sessionId,
          sessionIds.userId,
        );
        setMessages([welcomeMessage]);
      }
    }
  };

  // Message handling
  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  // Close current displays (courses, quizzes, etc.) when a new command is executed
  const closeCurrentDisplays = () => {
    setShowCourseList(false);
    setCurrentCoursePage(null);
    setCurrentCourse(null);
    setCurrentQuiz(null);
    setIsDiagnosticMode(false);
    setShowDiagnosticFeedback(false);
    setDiagnosticFeedback(null);
    setShowQuizFeedback(false);
    setLastQuizAnswer(null);
    setCourseQuiz(null);
    setCourseQuizAnswers(initializeCourseQuizAnswers(0));
    setDiagnosticState(initializeDiagnosticState());
  };

  // Add a helper function to remove specific messages by content pattern
  const removeIntroMessage = (contentPattern: string) => {
    setMessages(prev => prev.filter(msg => !msg.content.includes(contentPattern)));
  };

  // Handle input changes for command autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
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
    setInputValue(command);
    setShowCommandSuggestions(false);
    setCommandSuggestions([]);
    setShowCommandMenu(false);
    // Send the command directly instead of waiting for input value update
    handleSendMessageWrapper(command);
  };

  // Wrapper functions for logic handlers
  const handleSendMessageWrapper = async (commandText?: string) => {
    const messageText = commandText || inputValue.trim();
    if (!messageText) return;

    const props: MessageHandlersProps = {
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
    };

    await handleSendMessage(messageText, props);
  };

  const handleStartDiagnosticTestWrapper = async () => {
    const props: DiagnosticHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setDiagnosticState,
      setIsDiagnosticMode,
      setShowDiagnosticFeedback,
      setDiagnosticFeedback,
      removeIntroMessage,
      handleCompleteDiagnosticTestWrapper
    };

    await handleStartDiagnosticTest(props);
  };

  const handleDiagnosticQuizAnswerWrapper = async (selectedOption: number, correct: boolean) => {
    const props: DiagnosticHandlersProps = {
        apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setDiagnosticState,
      setIsDiagnosticMode,
      setShowDiagnosticFeedback,
      setDiagnosticFeedback,
      removeIntroMessage,
      handleCompleteDiagnosticTestWrapper
    };

    await handleDiagnosticQuizAnswer(selectedOption, correct, diagnosticState, props);
  };

  const handleCompleteDiagnosticTestWrapper = async (state: DiagnosticState) => {
    const props: DiagnosticHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setDiagnosticState,
      setIsDiagnosticMode,
      setShowDiagnosticFeedback,
      setDiagnosticFeedback,
      removeIntroMessage,
      handleCompleteDiagnosticTestWrapper
    };

    await handleCompleteDiagnosticTest(state, props);
  };

  const handleCoursesListWrapper = async () => {
    const props: CourseHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setAvailableCourses,
      setShowCourseList,
      setCurrentCoursePage,
      setCurrentCourse,
      setCourseQuiz,
      setCourseQuizAnswers,
      removeIntroMessage
    };

    await handleCoursesList(props);
  };

  const handleStartCourseWrapper = async (courseId: string) => {
    const props: CourseHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setAvailableCourses,
      setShowCourseList,
      setCurrentCoursePage,
      setCurrentCourse,
      setCourseQuiz,
      setCourseQuizAnswers,
      removeIntroMessage
    };

    await handleStartCourse(courseId, props);
  };

  const handleNavigateCoursePageWrapper = async (pageIndex: number) => {
    const props: CourseHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setAvailableCourses,
      setShowCourseList,
      setCurrentCoursePage,
      setCurrentCourse,
      setCourseQuiz,
      setCourseQuizAnswers,
      removeIntroMessage
    };

    await handleNavigateCoursePage(pageIndex, props);
  };

  const handleCompleteCourseWrapper = () => {
    const props: CourseHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setAvailableCourses,
      setShowCourseList,
      setCurrentCoursePage,
      setCurrentCourse,
      setCourseQuiz,
      setCourseQuizAnswers,
      removeIntroMessage
    };

    handleCompleteCourse(currentCourse, props);
  };

  const handleSubmitCourseQuizWrapper = async () => {
    const props: CourseHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setIsLoading,
      closeCurrentDisplays,
      setAvailableCourses,
      setShowCourseList,
      setCurrentCoursePage,
      setCurrentCourse,
      setCourseQuiz,
      setCourseQuizAnswers,
      removeIntroMessage
    };

    await handleSubmitCourseQuiz(courseQuiz, courseQuizAnswers, props);
  };

  const handleQuizAnswerWrapper = async (selectedOption: number, correct: boolean) => {
    const props: QuizHandlersProps = {
      apiConfig,
      setLastQuizAnswer,
      setShowQuizFeedback,
      setCurrentQuiz
    };

    await handleQuizAnswer(selectedOption, correct, currentQuiz, props);
  };

  const handleFileUploadWrapper = async (files: FileList) => {
    const props: FileHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setUploadedFiles,
      setUploadProgress,
      uploadedFiles
    };

    await handleFileUpload(files, props);
  };

  const handleRemoveFileWrapper = async (fileIndex: number) => {
    const props: FileHandlersProps = {
      apiConfig,
      sessionIds,
      addMessage,
      setUploadedFiles,
      setUploadProgress,
      uploadedFiles
    };

    await handleRemoveFile(fileIndex, props);
  };

  // Course quiz functions
  const handleCourseQuizAnswerSelection = (questionIndex: number, selectedOption: number) => {
    const newAnswers = handleCourseQuizAnswer(courseQuizAnswers, questionIndex, selectedOption);
    setCourseQuizAnswers(newAnswers);
  };

  const handleCourseQuizNavigation = (direction: 'next' | 'previous' | number) => {
    if (!courseQuiz) return;
    
    let newAnswers = courseQuizAnswers;
    
    if (direction === 'next') {
      newAnswers = navigateToNextQuizQuestion(courseQuizAnswers, courseQuiz.questions.length);
    } else if (direction === 'previous') {
      newAnswers = navigateToPreviousQuizQuestion(courseQuizAnswers);
    } else if (typeof direction === 'number') {
      newAnswers = navigateToQuizQuestion(courseQuizAnswers, direction, courseQuiz.questions.length);
    }
    
    setCourseQuizAnswers(newAnswers);
  };

  const hasDiagnosticTest = diagnosticState.test && diagnosticState.test.questions.length > 0;
  const currentDiagnosticQuiz = hasDiagnosticTest ? diagnosticState.test!.questions[diagnosticState.currentQuestionIndex] : null;
  const currentDiagnosticQuestionIndex = hasDiagnosticTest ? diagnosticState.currentQuestionIndex : 0;
  const diagnosticTotalQuestions = diagnosticState.test ? diagnosticState.test.questions.length : 0;

  // Navigation functions
  const navigateToChat = () => {
    console.log('navigateToChat called');
    setCurrentWindow('chat');
    closeCurrentDisplays();
  };

  const navigateToLearn = () => {
    console.log('navigateToLearn called');
    setCurrentWindow('learn');
    closeCurrentDisplays();
  };

  const navigateToIntro = () => {
    console.log('navigateToIntro called');
    setCurrentWindow('intro');
    closeCurrentDisplays();
  };

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
          onRemoveFile={handleRemoveFileWrapper}
        />

        {/* Windows Component */}
        <Windows
          currentWindow={currentWindow}
          onNavigateToChat={navigateToChat}
          onNavigateToLearn={navigateToLearn}
          onNavigateToIntro={navigateToIntro}
          isExpanded={isExpanded}
          hasUploads={uploadProgress.isUploading || uploadedFiles.length > 0}
        >
          {/* Chat Window Content */}
        <div className="chat-messages">
          {messages.map((message) => (
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
            isDiagnosticMode={isDiagnosticMode}
              currentQuiz={currentDiagnosticQuiz}
            showDiagnosticFeedback={showDiagnosticFeedback}
            diagnosticFeedback={diagnosticFeedback}
              diagnosticQuestionIndex={currentDiagnosticQuestionIndex}
            diagnosticTotalQuestions={diagnosticTotalQuestions}
              onDiagnosticQuizAnswer={handleDiagnosticQuizAnswerWrapper}
          />

          {/* Quiz Component */}
          <Quiz
            currentQuiz={currentQuiz}
            showQuizFeedback={showQuizFeedback}
            lastQuizAnswer={lastQuizAnswer}
            isDiagnosticMode={isDiagnosticMode}
              onQuizAnswer={handleQuizAnswerWrapper}
          />

          {/* Course List Component */}
          <CourseList
            showCourseList={showCourseList}
            availableCourses={availableCourses}
              onStartCourse={handleStartCourseWrapper}
          />

          {/* Course Page Component */}
          <CoursePageComponent
            currentCoursePage={currentCoursePage}
              onNavigateCoursePage={handleNavigateCoursePageWrapper}
              onCompleteCourse={handleCompleteCourseWrapper}
          />

          {/* Course Quiz Component */}
          <CourseQuiz
            courseQuiz={courseQuiz}
            courseQuizAnswers={courseQuizAnswers}
            onCourseQuizAnswerSelection={handleCourseQuizAnswerSelection}
            onCourseQuizNavigation={handleCourseQuizNavigation}
              onSubmitCourseQuiz={handleSubmitCourseQuizWrapper}
            areAllQuestionsAnswered={areAllQuestionsAnswered}
          />
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">Thinking...</div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Component */}
        <ChatInput
          inputValue={inputValue}
          isLoading={isLoading}
          uploadProgress={uploadProgress}
          showCommandSuggestions={showCommandSuggestions}
          commandSuggestions={commandSuggestions}
          showCommandMenu={showCommandMenu}
          availableCommands={availableCommands}
          activeMode={activeMode}
          onInputChange={handleInputChange}
            onSendMessage={handleSendMessageWrapper}
            onFileUpload={handleFileUploadWrapper}
          onCommandSelect={handleCommandSelect}
          onToggleCommandMenu={() => setShowCommandMenu(!showCommandMenu)}
          onCloseCommandMenu={() => setShowCommandMenu(false)}
            disabled={currentWindow === 'intro'}
        />
        </Windows>
      </div>
    </div>
  );
}; 