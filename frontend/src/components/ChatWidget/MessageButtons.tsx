import React from 'react';
import '../../styles/ChatWidget.css';

interface MessageButtonsProps {
  buttons: {
    label: string;
    action: () => void;
  }[];
}

export const MessageButtons: React.FC<MessageButtonsProps> = ({ buttons }) => {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className="message-buttons">
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