import React from 'react';
import '../../styles/ChatWidget.css';
import { QuizQuestion, QuizFeedback } from '../../types';

interface DiagnosticTestProps {
  isDiagnosticMode: boolean;
  currentQuiz: QuizQuestion | null;
  showDiagnosticFeedback: boolean;
  diagnosticFeedback: QuizFeedback | null;
  diagnosticQuestionIndex: number;
  diagnosticTotalQuestions: number;
  onDiagnosticQuizAnswer: (selectedOption: number, correct: boolean) => void;
}

export const DiagnosticTest: React.FC<DiagnosticTestProps> = ({
  isDiagnosticMode,
  currentQuiz,
  showDiagnosticFeedback,
  diagnosticFeedback,
  diagnosticQuestionIndex,
  diagnosticTotalQuestions,
  onDiagnosticQuizAnswer
}) => {
  if (!isDiagnosticMode || (!currentQuiz && !showDiagnosticFeedback)) {
    return null;
  }

  return (
    <div className="diagnostic-container">
      <div className="diagnostic-header">
        <div className="diagnostic-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((diagnosticQuestionIndex + 1) / diagnosticTotalQuestions) * 100}%` }}
            ></div>
          </div>
          <span className="progress-text">
            Question {diagnosticQuestionIndex + 1} of {diagnosticTotalQuestions}
          </span>
        </div>
      </div>

      {/* Show question or feedback */}
      {currentQuiz && !showDiagnosticFeedback && (
        <>
          <div className="diagnostic-question">
            <h3>{currentQuiz.question}</h3>
          </div>

          <div className="diagnostic-options">
            {currentQuiz.options.map((option, index) => (
              <button
                key={index}
                onClick={() => onDiagnosticQuizAnswer(index, index === currentQuiz?.correctAnswer)}
                className="diagnostic-option"
              >
                <div className="option-indicator">
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>

          <div className="diagnostic-footer">
            <span className="diagnostic-hint">💭 Choose the best answer</span>
          </div>
        </>
      )}

      {/* Show feedback in place of question */}
      {showDiagnosticFeedback && diagnosticFeedback && (
        <div className={`diagnostic-feedback-container ${diagnosticFeedback.correct ? 'correct' : 'incorrect'}`}>
          <div className="feedback-header">
            <div className="feedback-icon-container">
              <span className="feedback-icon">
                {diagnosticFeedback.correct ? '🎉' : '🤔'}
              </span>
            </div>
            <div className="feedback-content">
              <div className="feedback-title">
                {diagnosticFeedback.correct ? 'Excellent!' : 'Good Try!'}
              </div>
              <div className="feedback-subtitle">
                {diagnosticFeedback.correct ? 'You got it right!' : 'Here\'s what you should know:'}
              </div>
            </div>
          </div>
          
          <div className="feedback-explanation">
            <div className="explanation-icon">💡</div>
            <p>{diagnosticFeedback.explanation}</p>
          </div>
          
          <div className="feedback-footer">
            <div className="feedback-progress-dots">
              {Array.from({ length: diagnosticTotalQuestions }, (_, i) => (
                <span 
                  key={i} 
                  className={`dot ${i <= diagnosticQuestionIndex ? 'active' : ''}`}
                ></span>
              ))}
            </div>
            <span className="feedback-auto-close">Next question in 3s...</span>
          </div>
        </div>
      )}
    </div>
  );
}; 