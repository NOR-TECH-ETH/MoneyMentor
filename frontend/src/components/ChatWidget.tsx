import React, { useState, useEffect, useRef } from 'react';
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

import { fetchDiagnosticQuiz, submitDiagnosticQuizAnswers, setupDiagnosticTest, handleDiagnosticAnswer, goToNextQuestion, calculateDiagnosticResults, resetDiagnosticState } from '../utils/chatWidget/diagnosticUtils';

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
  
  // Session State
  const [sessionIds, setSessionIds] = useState<SessionIds>({ userId: '', sessionId: '' });
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.input-container')) {
        setShowCommandMenu(false);
        setShowCommandSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize session on component mount
  useEffect(() => {
    const ids = initializeSession();
    setSessionIds(ids);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize session when widget opens
  useEffect(() => {
    if (isOpen && sessionIds.sessionId && sessionIds.userId) {
      handleInitializeSession();
    }
  }, [isOpen, sessionIds.sessionId, sessionIds.userId]);

  // Create API config
  const apiConfig: ApiConfig = {
    apiUrl,
    userId: sessionIds.userId,
    sessionId: sessionIds.sessionId
  };

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
    setCourseQuizAnswers({ answers: [], currentQuestionIndex: 0 });
    setDiagnosticState(initializeDiagnosticState());
  };

  const handleSendMessage = async (commandText?: string) => {
    const messageText = commandText || inputValue.trim();
    if (!messageText) return;

    setIsLoading(true);
    setInputValue('');
    setShowCommandSuggestions(false);
    setCommandSuggestions([]);
    setShowCommandMenu(false);

    try {
      // Handle special commands
      if (messageText === 'diagnostic_test') {
        closeCurrentDisplays(); // Close any current displays
        setIsLoading(false);
        await handleStartDiagnosticTest();
        return;
      }

      if (messageText === 'courses') {
        closeCurrentDisplays(); // Close any current displays
        const coursesMessage = createSystemMessage(
          '📚 **Available Courses**\n\nHere are all the courses available for you:',
          sessionIds.sessionId,
          sessionIds.userId
        );
        await handleCoursesList();
        setIsLoading(false);
        setShowCourseList(true);
        addMessage(coursesMessage);
        return;
      }

      if (messageText === 'help') {
        closeCurrentDisplays(); // Close any current displays
        setIsLoading(false);
        const helpMessage = createSystemMessage(
          '🤖 **MoneyMentor Commands**\n\n' +
          availableCommands.map(cmd => `**${cmd.command}** - ${cmd.description}`).join('\n') +
          '\n\n💡 **Tip**: You can also just ask me any financial question directly!',
          sessionIds.sessionId,
          sessionIds.userId
        );
        addMessage(helpMessage);
        return;
      }

      if (messageText === 'chat') {
        closeCurrentDisplays(); // Close any current displays
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
    handleSendMessage(command);
  };

  // Quiz handling
  const handleQuizAnswer = async (selectedOption: number, correct: boolean) => {
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

  // Add a helper function to remove specific messages by content pattern
  const removeIntroMessage = (contentPattern: string) => {
    setMessages(prev => prev.filter(msg => !msg.content.includes(contentPattern)));
  };

  // Diagnostic test handling
  const handleStartDiagnosticTest = async () => {
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

  const handleDiagnosticQuizAnswer = async (selectedOption: number, correct: boolean) => {
    if (!diagnosticState.test || !isDiagnosticMode) return;
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
      setDiagnosticState(prevState => {
        if (
          prevState.test &&
          prevState.currentQuestionIndex < prevState.test.questions.length - 1
        ) {
          return goToNextQuestion(prevState);
        } else {
          // Call complete outside of setDiagnosticState
          setTimeout(() => handleCompleteDiagnosticTest(prevState), 0);
          return prevState;
        }
      });
    }, 3000);
  };

  const handleCompleteDiagnosticTest = async (state: DiagnosticState) => {
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

  // Course handling
  const handleCoursesList = async () => {
    closeCurrentDisplays();
    setIsLoading(true);
    
    // Add intro message while loading
    const coursesMessage = createSystemMessage(
      '📚 **Available Courses**\n\nHere are all the courses available for you:',
      sessionIds.sessionId,
      sessionIds.userId
    );
    addMessage(coursesMessage);
    
    try {
      const response = await getAvailableCourses(apiConfig);
      
      // Ensure the response matches the Course interface
      const courses = Array.isArray(response) ? response : [];
      setAvailableCourses(courses);
      setShowCourseList(true);
      
      // Remove the intro message once courses are loaded
      removeIntroMessage('📚 **Available Courses**');
      
    } catch (error) {
      console.error('Error fetching courses:', error);
      const errorMessage = createSystemMessage(
        'Failed to fetch courses. Please try again later.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCourse = async (courseId: string) => {
    try {
      const response = await startCourse(apiConfig, courseId);
      
      if (response.success && response.data.currentPage) {
        setCurrentCoursePage(response.data.currentPage);
        setCurrentCourse(response.data.courseSession.activeCourse);
        setShowCourseList(false);
        
        const startMessage = createSystemMessage(
          formatCourseStartMessage(response.data.courseSession.activeCourse.title),
          sessionIds.sessionId,
          sessionIds.userId
        );
        addMessage(startMessage);
      }
    } catch (error) {
      console.error('Error starting course:', error);
      const errorMessage = createSystemMessage(
        'Failed to start course. Please try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(errorMessage);
    }
  };

  const handleNavigateCoursePage = async (pageIndex: number) => {
    try {
      const response = await navigateCoursePage(apiConfig, pageIndex);
      
      if (response.success && response.data.page) {
        setCurrentCoursePage(response.data.page);
      }
    } catch (error) {
      console.error('Error navigating course:', error);
    }
  };

  const handleCompleteCourse = () => {
    if (currentCourse) {
      setCourseQuiz(initializeCourseQuiz(currentCourse));
      setCourseQuizAnswers(initializeCourseQuizAnswers(currentCourse.quizQuestions.length));
      setCurrentCoursePage(null);
      
      const completionMessage = createSystemMessage(
        formatCourseCompletionMessage(),
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(completionMessage);
    }
  };

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

  const handleSubmitCourseQuiz = async () => {
    if (!courseQuiz) return;
    
    try {
      const response = await submitCourseQuiz(apiConfig, courseQuizAnswers.answers);
      
      if (response.success) {
        const { score, passed, explanations } = response.data;
        const resultMessage = formatQuizResultMessage(score, passed, explanations);
        
        const message = createAssistantMessage(
          resultMessage,
          sessionIds.sessionId,
          sessionIds.userId
        );
        addMessage(message);
        
        const resetState = resetCourseQuizState();
        setCourseQuiz(resetState.quiz);
        setCourseQuizAnswers(resetState.answers);
        setCurrentCourse(null);
      }
    } catch (error) {
      console.error('Error submitting course quiz:', error);
      const errorMessage = createSystemMessage(
        'Failed to submit quiz. Please try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(errorMessage);
    }
  };

  // File upload handling
  const handleFileUpload = async (files: FileList) => {
    const validation = validateFiles(files);
    
    if (validation.validFiles.length === 0) {
      const errorMessage = createSystemMessage(
        'Please upload valid files (PDF, TXT, PPT, PPTX) under 10MB each.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(errorMessage);
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
            formatUploadSuccessMessage(file.name),
            sessionIds.sessionId,
            sessionIds.userId
          );
          addMessage(successMessage);
        } catch (error) {
          const errorMessage = createSystemMessage(
            formatUploadErrorMessage(file.name, error instanceof Error ? error.message : 'Unknown error'),
            sessionIds.sessionId,
            sessionIds.userId
          );
          addMessage(errorMessage);
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
      addMessage(errorMessage);
    } finally {
      setUploadProgress(resetUploadProgress());
    }
  };

  const handleRemoveFile = async (fileIndex: number) => {
    const file = uploadedFiles[fileIndex];
    try {
      await removeFile(apiConfig, file.name);
      
      setUploadedFiles(prev => prev.filter((_, index) => index !== fileIndex));
      
      const removalMessage = createSystemMessage(
        formatFileRemovalMessage(file.name),
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(removalMessage);
    } catch (error) {
      console.error('Remove file error:', error);
      const errorMessage = createSystemMessage(
        'Failed to remove file. Please try again.',
        sessionIds.sessionId,
        sessionIds.userId
      );
      addMessage(errorMessage);
    }
  };

  const hasDiagnosticTest = diagnosticState.test && diagnosticState.test.questions.length > 0;
  const currentDiagnosticQuiz = hasDiagnosticTest ? diagnosticState.test!.questions[diagnosticState.currentQuestionIndex] : null;
  const currentDiagnosticQuestionIndex = hasDiagnosticTest ? diagnosticState.currentQuestionIndex : 0;
  const diagnosticTotalQuestions = diagnosticState.test ? diagnosticState.test.questions.length : 0;

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
          onRemoveFile={handleRemoveFile}
        />

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
            onDiagnosticQuizAnswer={handleDiagnosticQuizAnswer}
          />

          {/* Quiz Component */}
          <Quiz
            currentQuiz={currentQuiz}
            showQuizFeedback={showQuizFeedback}
            lastQuizAnswer={lastQuizAnswer}
            isDiagnosticMode={isDiagnosticMode}
            onQuizAnswer={handleQuizAnswer}
          />

          {/* Course List Component */}
          <CourseList
            showCourseList={showCourseList}
            availableCourses={availableCourses}
            onStartCourse={handleStartCourse}
          />

          {/* Course Page Component */}
          <CoursePageComponent
            currentCoursePage={currentCoursePage}
            onNavigateCoursePage={handleNavigateCoursePage}
            onCompleteCourse={handleCompleteCourse}
          />

          {/* Course Quiz Component */}
          <CourseQuiz
            courseQuiz={courseQuiz}
            courseQuizAnswers={courseQuizAnswers}
            onCourseQuizAnswerSelection={handleCourseQuizAnswerSelection}
            onCourseQuizNavigation={handleCourseQuizNavigation}
            onSubmitCourseQuiz={handleSubmitCourseQuiz}
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
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          onCommandSelect={handleCommandSelect}
          onToggleCommandMenu={() => setShowCommandMenu(!showCommandMenu)}
          onCloseCommandMenu={() => setShowCommandMenu(false)}
        />
      </div>
    </div>
  );
}; 