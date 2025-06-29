import React, { useEffect, useRef, useState } from 'react';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';

interface BotMessageProps {
  content: string;
  onCopy?: () => void;
  isLoading?: boolean;
  messageId?: string;
}

const TYPING_SPEED = 45; // ms per character

const BotMessage: React.FC<BotMessageProps> = ({ content, onCopy, isLoading, messageId }) => {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const typedMessagesRef = useRef<Set<string>>(new Set());

  // Load typed messages from localStorage on component mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('typedMessages');
      if (stored) {
        const typedMessages = JSON.parse(stored);
        typedMessagesRef.current = new Set(typedMessages);
      }
    } catch (error) {
      console.error('Error loading typed messages from localStorage:', error);
    }
  }, []);

  // Save typed messages to localStorage
  const saveTypedMessages = () => {
    try {
      const typedMessages = Array.from(typedMessagesRef.current);
      localStorage.setItem('typedMessages', JSON.stringify(typedMessages));
    } catch (error) {
      console.error('Error saving typed messages to localStorage:', error);
    }
  };

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Check if this message has already been typed
    const isAlreadyTyped = messageId && typedMessagesRef.current.has(messageId);

    if (isAlreadyTyped) {
      // Show full content immediately for already typed messages
      setDisplayed(content);
      setIsTyping(false);
    } else if (messageId && !typedMessagesRef.current.has(messageId)) {
      // New message - start typing animation
      setDisplayed('');
      setIsTyping(true);
      
      if (content && !isLoading) {
        let i = 0;
        intervalRef.current = setInterval(() => {
          setDisplayed((prev) => {
            if (i >= content.length) {
              clearInterval(intervalRef.current!);
              setIsTyping(false);
              // Mark this message as typed and save to localStorage
              if (messageId) {
                typedMessagesRef.current.add(messageId);
                saveTypedMessages();
              }
              return prev;
            }
            i++;
            return content.slice(0, i);
          });
        }, TYPING_SPEED);
      } else {
        // If no content or loading, show immediately
        setDisplayed(content);
        setIsTyping(false);
        if (messageId) {
          typedMessagesRef.current.add(messageId);
          saveTypedMessages();
        }
      }
    } else {
      // Fallback - show content immediately
      setDisplayed(content);
      setIsTyping(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [content, isLoading, messageId]);

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    if (onCopy) onCopy();
  };

  return (
    <div className="bot-message-block">
      <div className="bot-message-content">
        <div style={{ textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
          {displayed}
          {isTyping && <span className="bot-message-cursor">|</span>}
        </div>
      </div>
      {!isTyping && displayed && (
        <div className="bot-message-actions">
          <button className="bot-action-btn" title="Copy" onClick={handleCopy}>
            <ContentCopyOutlinedIcon style={{ fontSize: 22 }} />
          </button>
          <button className="bot-action-btn" title="Like" disabled>
            <ThumbUpOutlinedIcon style={{ fontSize: 22 }} />
          </button>
          <button className="bot-action-btn" title="Dislike" disabled>
            <ThumbDownOutlinedIcon style={{ fontSize: 22 }} />
          </button>
        </div>
      )}
    </div>
  );
};

export default BotMessage; 