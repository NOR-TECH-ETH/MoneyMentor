import React from 'react';
import '../../styles/ChatWidget.css';

interface MessageButtonsProps {
  buttons: {
    label: string;
    action: () => void;
  }[];
  className?: string;
  messageId?: string;
}

export const MessageButtons: React.FC<MessageButtonsProps> = ({ buttons, className = '', messageId }) => {
  if (!buttons || buttons.length === 0) return null;

  // Check if this is the learning course selection message
  const isLearningCourseSelection = messageId === 'learn-courses-list';

  // Define colors and icons for each course topic
  const getTopicStyle = (label: string) => {
    switch (label) {
      case 'Money, Goals and Mindset':
        return { 
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          icon: '🎯'
        };
      case 'Budgeting and Saving':
        return { 
          gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          icon: '💰'
        };
      case 'College Planning and Saving':
        return { 
          gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          icon: '🎓'
        };
      case 'Earning and Income Basics':
        return { 
          gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          icon: '💼'
        };
      default:
        return { 
          gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
          icon: '📚'
        };
    }
  };

  if (isLearningCourseSelection) {
    return (
      <div className="learning-topic-buttons">
        {buttons.map((button, index) => {
          const style = getTopicStyle(button.label);
          return (
            <button
              key={index}
              className="learning-topic-button"
              onClick={button.action}
              style={{ background: style.gradient }}
            >
              <span className="topic-icon">{style.icon}</span>
              <span className="topic-label">{button.label}</span>
              <span className="topic-arrow">→</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default message buttons for other use cases
  return (
    <div className={`message-buttons ${className}`}>
      {buttons.map((button, index) => (
        <button
          key={index}
          className="message-button"
          onClick={button.action}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}; 