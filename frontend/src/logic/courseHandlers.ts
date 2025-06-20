import { ChatMessage, Course, CoursePage } from '../types';
import { 
  ApiConfig,
  createSystemMessage,
  formatCourseStartMessage,
  formatCourseCompletionMessage,
  getAvailableCourses,
  startCourse,
  navigateCoursePage,
  submitCourseQuiz,
  formatQuizResultMessage,
  resetCourseQuizState,
  initializeCourseQuiz,
  initializeCourseQuizAnswers,
  CourseQuizState,
  CourseQuizAnswers
} from '../utils/chatWidget';

export interface CourseHandlersProps {
  apiConfig: ApiConfig;
  sessionIds: { userId: string; sessionId: string };
  addMessage: (message: ChatMessage) => void;
  setIsLoading: (loading: boolean) => void;
  closeCurrentDisplays: () => void;
  setAvailableCourses: (courses: Course[]) => void;
  setShowCourseList: (show: boolean) => void;
  setCurrentCoursePage: (page: CoursePage | null) => void;
  setCurrentCourse: (course: Course | null) => void;
  setCourseQuiz: (quiz: CourseQuizState | null) => void;
  setCourseQuizAnswers: (answers: CourseQuizAnswers) => void;
  removeIntroMessage: (pattern: string) => void;
}

export const handleCoursesList = async (props: CourseHandlersProps) => {
  const {
    apiConfig,
    sessionIds,
    addMessage,
    setIsLoading,
    closeCurrentDisplays,
    setAvailableCourses,
    setShowCourseList,
    removeIntroMessage
  } = props;

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

export const handleStartCourse = async (
  courseId: string,
  props: CourseHandlersProps
) => {
  const {
    apiConfig,
    sessionIds,
    addMessage,
    setCurrentCoursePage,
    setCurrentCourse,
    setShowCourseList
  } = props;

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

export const handleNavigateCoursePage = async (
  pageIndex: number,
  props: CourseHandlersProps
) => {
  const {
    apiConfig,
    setCurrentCoursePage
  } = props;

  try {
    const response = await navigateCoursePage(apiConfig, pageIndex);
    
    if (response.success && response.data.page) {
      setCurrentCoursePage(response.data.page);
    }
  } catch (error) {
    console.error('Error navigating course:', error);
  }
};

export const handleCompleteCourse = (
  currentCourse: Course | null,
  props: CourseHandlersProps
) => {
  const {
    sessionIds,
    addMessage,
    setCourseQuiz,
    setCourseQuizAnswers,
    setCurrentCoursePage
  } = props;

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

export const handleSubmitCourseQuiz = async (
  courseQuiz: CourseQuizState | null,
  courseQuizAnswers: CourseQuizAnswers,
  props: CourseHandlersProps
) => {
  const {
    apiConfig,
    sessionIds,
    addMessage,
    setCourseQuiz,
    setCourseQuizAnswers,
    setCurrentCourse
  } = props;

  if (!courseQuiz) return;
  
  try {
    const response = await submitCourseQuiz(apiConfig, courseQuizAnswers.answers);
    
    if (response.success) {
      const { score, passed, explanations } = response.data;
      const resultMessage = formatQuizResultMessage(score, passed, explanations);
      
      const message = createSystemMessage(
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