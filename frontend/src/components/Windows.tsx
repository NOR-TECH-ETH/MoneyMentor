import React, { useState, useRef, useEffect } from 'react';

interface WindowsProps {
  currentWindow: 'intro' | 'chat' | 'learn';
  onNavigateToChat: () => void;
  onNavigateToLearn: () => void;
  onNavigateToIntro: () => void;
  chatChildren: React.ReactNode;
  learnChildren: React.ReactNode;
  isExpanded?: boolean;
  hasUploads?: boolean;
}

export const Windows: React.FC<WindowsProps> = ({
  currentWindow,
  onNavigateToChat,
  onNavigateToLearn,
  onNavigateToIntro,
  chatChildren,
  learnChildren,
  isExpanded = false,
  hasUploads = false
}) => {
  const [navButtonPosition, setNavButtonPosition] = useState({ x: 410, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const navRef = useRef<HTMLDivElement>(null);

  // Function to ensure position is within bounds
  const ensureValidPosition = (position: { x: number; y: number }) => {
    if (!navRef.current) return position;
    
    const container = navRef.current.parentElement;
    if (!container) return position;
    
    const containerRect = container.getBoundingClientRect();
    const navWidth = navRef.current.offsetWidth;
    const navHeight = navRef.current.offsetHeight;
    
    const padding = 10;
    const maxX = containerRect.width - navWidth - padding;
    const maxY = containerRect.height - navHeight - padding;
    const minY = 60;
    const maxYWithInput = containerRect.height - navHeight - 80;
    
    return {
      x: Math.max(padding, Math.min(position.x, maxX)),
      y: Math.max(minY, Math.min(position.y, maxYWithInput))
    };
  };

  // Update position based on window state
  useEffect(() => {
    if (isExpanded) {
      // When expanded, position on the right side but within bounds
      const newPosition = ensureValidPosition({ x: 580, y: 80 });
      setNavButtonPosition(newPosition);
    } else {
      // When not expanded, position on the right side
      const newPosition = ensureValidPosition({ x: 380, y: 80 });
      setNavButtonPosition(newPosition);
    }
  }, [isExpanded]);

  // Update position when uploads are present
  useEffect(() => {
    if (hasUploads) {
      setNavButtonPosition(prev => ensureValidPosition({ ...prev, y: 140 }));
    } else {
      setNavButtonPosition(prev => ensureValidPosition({ ...prev, y: 80 }));
    }
  }, [hasUploads]);

  // Handle window resize to ensure position stays valid
  useEffect(() => {
    const handleResize = () => {
      setNavButtonPosition(prev => ensureValidPosition(prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on a button
    if ((e.target as HTMLElement).closest('.nav-button')) {
      return;
    }
    
    if (!navRef.current) return;
    
    const rect = navRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  const handleButtonClick = (e: React.MouseEvent, callback: () => void) => {
    // Prevent the click from triggering drag
    e.stopPropagation();
    callback();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !navRef.current) return;

    const container = navRef.current.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const navWidth = navRef.current.offsetWidth;
    const navHeight = navRef.current.offsetHeight;
    
    // Calculate new position
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;

    // Constrain to container bounds with padding
    const padding = 10; // Keep some padding from edges
    const maxX = containerRect.width - navWidth - padding;
    const maxY = containerRect.height - navHeight - padding;
    
    // Ensure minimum Y position (below header) and maximum Y position (above input)
    const minY = 60; // Below header
    const maxYWithInput = containerRect.height - navHeight - 80; // Above input area

    const constrainedX = Math.max(padding, Math.min(newX, maxX));
    const constrainedY = Math.max(minY, Math.min(newY, maxYWithInput));

    setNavButtonPosition({ x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <>
      {/* Navigation Buttons - below header */}
      {currentWindow !== 'intro' && (
        <div 
          ref={navRef}
          className={`window-navigation ${isDragging ? 'dragging' : ''}`}
          style={{
            left: navButtonPosition.x,
            top: navButtonPosition.y,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
        >
          {currentWindow === 'chat' && (
            <button 
              className="nav-button learn-nav"
              onClick={(e) => handleButtonClick(e, onNavigateToLearn)}
              title="Change to Learning Mode"
            >
              📚
            </button>
          )}
          {currentWindow === 'learn' && (
            <button 
              className="nav-button chat-nav"
              onClick={(e) => handleButtonClick(e, onNavigateToChat)}
              title="Change to Chat Mode"
            >
              💬
            </button>
          )}
        </div>
      )}

      {/* Window Content */}
      {currentWindow === 'intro' && (
        <div className="intro-window">
          <div className="intro-content">
            <h2>Welcome to MoneyMentor! 💰</h2>
            <p>Choose how you'd like to get started:</p>
            
            <div className="intro-buttons">
              <button 
                className="intro-button chat-button"
                onClick={(e) => handleButtonClick(e, onNavigateToChat)}
              >
                <div className="intro-icon">💬</div>
                <div className="intro-text">
                  <h3>Chat</h3>
                  <p>Ask questions, take quizzes, and explore courses with AI assistance</p>
                </div>
              </button>
              
              <button 
                className="intro-button learn-button"
                onClick={(e) => handleButtonClick(e, onNavigateToLearn)}
              >
                <div className="intro-icon">📚</div>
                <div className="intro-text">
                  <h3>Learn</h3>
                  <p>Structured learning paths and educational content</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {currentWindow === 'chat' && (
        <div className="chat-window">
          {chatChildren}
        </div>
      )}

      {currentWindow === 'learn' && (
        <div className="chat-window">
          {learnChildren}
        </div>
      )}
    </>
  );
}; 