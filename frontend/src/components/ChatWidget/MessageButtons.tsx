import React from 'react';
import '../../styles/ChatWidget.css';

interface MessageButtonsProps {
  buttons: {
    label: string;
    action: () => void;
  }[];
  className?: string;
}

export const MessageButtons: React.FC<MessageButtonsProps> = ({ buttons, className = '' }) => {
  if (!buttons || buttons.length === 0) return null;

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