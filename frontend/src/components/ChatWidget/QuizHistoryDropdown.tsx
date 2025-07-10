import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/ChatWidget.css';
import Skeleton from 'react-loading-skeleton';

interface QuizHistoryDropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  quizHistory: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    userAnswer: number;
    explanation: string;
    topicTag?: string;
  }>;
  loading?: boolean;
  error?: string | null;
}

export const QuizHistoryDropdown: React.FC<QuizHistoryDropdownProps> = ({
  open,
  onClose,
  anchorRef,
  quizHistory,
  loading = false,
  error = null
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorRef]);

  // Position dropdown centered below anchor
  useEffect(() => {
    if (open && anchorRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const dropdownWidth = 340;
      const top = anchorRect.bottom + 12;
      let left = anchorRect.left + anchorRect.width / 2 - dropdownWidth / 2;
      
      // Ensure it doesn't go off-screen
      if (left < 10) left = 10;
      if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }
      
      setPosition({ top, left });
    }
  }, [open, anchorRef]);

  if (!open) return null;

 

  return ReactDOM.createPortal(
    <div 
      ref={dropdownRef} 
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: '340px',
        maxHeight: '350px',
        background: '#ffffff',
        border: '2px solid #e5e7eb',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 99999,
        color: '#000000',
        fontSize: '14px',
      }}
    >
      {/* Arrow */}
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        height: '18px',
        marginBottom: '-2px',
        zIndex: 100000,
        pointerEvents: 'none',
      }}>
        <svg width="38" height="18" viewBox="0 0 38 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="arrowGradient" x1="19" y1="0" x2="19" y2="18" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" stopOpacity="1"/>
              <stop offset="1" stopColor="#fff" stopOpacity="0.0"/>
            </linearGradient>
          </defs>
          <path d="M0 0L19 18L38 0Z" fill="url(#arrowGradient)"/>
        </svg>
      </div>
      
      <div style={{
        fontWeight: '700',
        fontSize: '15px',
        padding: '12px 18px 8px 18px',
        borderBottom: '1px solid #f3f4f6',
        background: '#f9fafb',
      }}>
        Quiz History
      </div>
      
      <div style={{
        overflowY: 'auto',
        padding: '10px 0 10px 0',
        maxHeight: '300px',
      }}>
        {loading ? (
          <div style={{ padding: '18px' }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height={48} style={{ marginBottom: 12, borderRadius: 8 }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '18px', color: '#ef4444', textAlign: 'center', fontSize: '14px' }}>{error}</div>
        ) : quizHistory.length === 0 ? (
          <div style={{
            padding: '18px',
            color: '#888',
            textAlign: 'center',
            fontSize: '14px',
          }}>
            No quizzes taken yet.
          </div>
        ) : (
          quizHistory.map((quiz, idx) => (
          <div key={idx} style={{
            padding: '12px 18px 14px 18px',
            borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{
              fontWeight: '600',
              marginBottom: '6px',
              fontSize: '14px',
            }}>
              <span style={{ color: '#6366f1', fontWeight: '700', marginRight: '4px' }}>Q{idx + 1}:</span> {quiz.question}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              marginBottom: '6px',
            }}>
              {quiz.options.map((opt: string, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: '13px',
                    padding: '3px 0 3px 0',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    background: i === quiz.correctAnswer ? '#e0fce6' : 
                               i === quiz.userAnswer ? '#eef2ff' : 'none',
                    color: i === quiz.correctAnswer ? '#15803d' : '#000',
                    border: i === quiz.userAnswer ? '1.5px solid #6366f1' : 'none',
                  }}
                >
                  <span style={{ fontWeight: '700', color: '#6366f1', marginRight: '2px' }}>
                    {String.fromCharCode(65 + i)})
                  </span> {opt}
                  {i === quiz.correctAnswer && (
                    <span style={{ color: '#16a34a', fontSize: '13px', marginLeft: '4px', fontWeight: '700' }}>✔</span>
                  )}
                  {i === quiz.userAnswer && (
                    <span style={{ color: '#6366f1', fontSize: '12px', marginLeft: '4px', fontWeight: '600' }}>(You)</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#374151',
              marginTop: '4px',
            }}>
              <span style={{ fontWeight: '600', color: '#6366f1', marginRight: '4px' }}>💡 Explanation:</span> {quiz.explanation}
            </div>
          </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}; 