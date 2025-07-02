import React, { useRef, useEffect } from 'react';
import { ChatSession, SidebarState, UserProfile } from '../../types';
import { ChatSessionsList } from './ChatSessionsList';
import { ProfileButton } from './ProfileButton';
import { ProfileModal } from './ProfileModal';
import { useClickOutside } from '../../hooks';
import { handleOutsideClick, handleEscapeKey } from '../../logic/sidebarHandlers';
import '../../styles/sidebar.css';

interface SidebarProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  chatSessions: ChatSession[];
  userProfile: UserProfile;
  profileModalState: { isOpen: boolean; activeTab: 'profile' | 'settings' | 'subscription' };
  setProfileModalState: (state: { isOpen: boolean; activeTab: 'profile' | 'settings' | 'subscription' }) => void;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onProfileUpdate: (profile: Partial<UserProfile>) => void;
  theme?: 'light' | 'dark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarState,
  setSidebarState,
  chatSessions,
  userProfile,
  profileModalState,
  setProfileModalState,
  onSessionSelect,
  onNewChat,
  onProfileUpdate,
  theme = 'light'
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close sidebar on mobile
  useClickOutside(sidebarRef, () => {
    if (window.innerWidth <= 768 && sidebarState.isOpen) {
      setSidebarState({ ...sidebarState, isOpen: false });
    }
  });

  // Handle escape key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      handleEscapeKey(event, {
        sidebarState,
        setSidebarState,
        onSessionSelect,
        onNewChat,
      });
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [sidebarState, setSidebarState, onSessionSelect, onNewChat]);

  const handleNewChatClick = () => {
    onNewChat();
    // On mobile, close sidebar after creating new chat
    if (window.innerWidth <= 768) {
      setSidebarState({ ...sidebarState, isOpen: false });
    }
  };

  const handleSessionClick = (sessionId: string) => {
    setSidebarState({ ...sidebarState, selectedSessionId: sessionId });
    onSessionSelect(sessionId);
    // On mobile, close sidebar after selection
    if (window.innerWidth <= 768) {
      setSidebarState({ ...sidebarState, selectedSessionId: sessionId, isOpen: false });
    }
  };

  const handleCollapse = () => {
    setSidebarState({ ...sidebarState, isCollapsed: !sidebarState.isCollapsed });
  };

  const handleClose = () => {
    setSidebarState({ ...sidebarState, isOpen: false });
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${sidebarState.isOpen ? 'active' : ''}`}
        onClick={handleClose}
      />

      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className={`sidebar ${sidebarState.isOpen ? 'open' : ''} ${sidebarState.isCollapsed ? 'collapsed' : ''} ${theme}`}
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-header-content">
            <a href="#" className="sidebar-logo">
              <span>💰</span>
              <span className="sidebar-logo-text">MoneyMentor</span>
            </a>
            <div className="sidebar-controls">
              {/* <button 
                className="sidebar-btn"
                onClick={handleCollapse}
                title={sidebarState.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarState.isCollapsed ? '→' : '←'}
              </button> */}
              
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <button className="new-chat-btn" onClick={handleNewChatClick}>
          <span>✏️</span>
          <span className="new-chat-btn-text">New Chat</span>
        </button>

        {/* Chat Sessions List */}
        <ChatSessionsList
          sessions={chatSessions}
          selectedSessionId={sidebarState.selectedSessionId}
          onSessionSelect={handleSessionClick}
          isCollapsed={sidebarState.isCollapsed}
        />

        {/* Profile Section */}
        <ProfileButton
          userProfile={userProfile}
          isCollapsed={sidebarState.isCollapsed}
          onClick={() => setProfileModalState({ isOpen: true, activeTab: 'profile' })}
        />
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalState.isOpen}
        activeTab={profileModalState.activeTab}
        userProfile={userProfile}
        onClose={() => setProfileModalState({ isOpen: false, activeTab: 'profile' })}
        onTabSwitch={(tab) => setProfileModalState({ ...profileModalState, activeTab: tab })}
        onProfileUpdate={onProfileUpdate}
        theme={theme}
      />
    </>
  );
}; 