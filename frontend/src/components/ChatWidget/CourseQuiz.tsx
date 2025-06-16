import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import '../../styles/ChatWidget.css';
import { CourseQuizState, CourseQuizAnswers } from '../../utils/chatWidget';

interface CourseQuizProps {
  courseQuiz: CourseQuizState | null;
  courseQuizAnswers: CourseQuizAnswers;
  onCourseQuizAnswerSelection: (questionIndex: number, selectedOption: number) => void;
  onCourseQuizNavigation: (direction: 'next' | 'previous' | number) => void;
  onSubmitCourseQuiz: () => void;
  areAllQuestionsAnswered: (answers: number[]) => boolean;
}

export const CourseQuiz: React.FC<CourseQuizProps> = ({
  courseQuiz,
  courseQuizAnswers,
  onCourseQuizAnswerSelection,
  onCourseQuizNavigation,
  onSubmitCourseQuiz,
  areAllQuestionsAnswered
}) => {
  if (!courseQuiz) {
    return null;
  }

  return (
    <div className="course-quiz-container">
      <div className="course-quiz-header">
        <div className="quiz-title">
          <span className="quiz-icon">🎯</span>
          <h3>Course Quiz</h3>
        </div>
        <div className="quiz-progress">
          Question {courseQuizAnswers.currentQuestionIndex + 1} of {courseQuiz.questions.length}
        </div>
      </div>
      
      <div className="single-quiz-question">
        {(() => {
          const question = courseQuiz.questions[courseQuizAnswers.currentQuestionIndex];
          return (
            <div className="course-quiz-question">
              <div className="question-header">
                <span className="question-number">Question {courseQuizAnswers.currentQuestionIndex + 1}</span>
                <span className="question-difficulty">{question.difficulty}</span>
              </div>
              
              <p className="question-text">{question.question}</p>
              
              <div className="question-options">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    onClick={() => onCourseQuizAnswerSelection(courseQuizAnswers.currentQuestionIndex, optionIndex)}
                    className={`quiz-option ${
                      courseQuizAnswers.answers[courseQuizAnswers.currentQuestionIndex] === optionIndex ? 'selected' : ''
                    }`}
                  >
                    <div className="option-indicator">
                      {String.fromCharCode(65 + optionIndex)}
                    </div>
                    <span className="option-text">{option}</span>
                    {courseQuizAnswers.answers[courseQuizAnswers.currentQuestionIndex] === optionIndex && (
                      <CheckCircle size={16} className="option-check" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
      
      <div className="course-quiz-navigation">
        <button
          onClick={() => onCourseQuizNavigation('previous')}
          disabled={courseQuizAnswers.currentQuestionIndex === 0}
          className="quiz-nav-btn quiz-nav-prev"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        
        <div className="quiz-progress-dots">
          {courseQuiz.questions.map((_, index) => (
            <div
              key={index}
              className={`quiz-dot ${index === courseQuizAnswers.currentQuestionIndex ? 'active' : ''} ${
                courseQuizAnswers.answers[index] !== -1 ? 'answered' : ''
              }`}
              onClick={() => onCourseQuizNavigation(index)}
            />
          ))}
        </div>
        
        {courseQuizAnswers.currentQuestionIndex < courseQuiz.questions.length - 1 ? (
          <button
            onClick={() => onCourseQuizNavigation('next')}
            className="quiz-nav-btn quiz-nav-next"
          >
            Next
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={onSubmitCourseQuiz}
            disabled={!areAllQuestionsAnswered(courseQuizAnswers.answers)}
            className="quiz-nav-btn submit-quiz-btn"
          >
            Submit Quiz
          </button>
        )}
      </div>
    </div>
  );
}; 