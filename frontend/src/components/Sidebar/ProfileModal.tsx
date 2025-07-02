import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { 
  getUserInitials, 
  formatJoinDate, 
  formatProfileStats
} from '../../utils/profile';
import { 
  handleModalBackdropClick,
  handleModalEscapeKey,
  handleNameUpdate,
  handleEmailUpdate,
  handleThemeToggle
} from '../../logic/profileHandlers';

interface ProfileModalProps {
  isOpen: boolean;
  activeTab: 'profile' | 'settings';
  userProfile: UserProfile;
  onClose: () => void;
  onTabSwitch: (tab: 'profile' | 'settings') => void;
  onProfileUpdate: (profile: Partial<UserProfile>) => void;
  theme?: 'light' | 'dark';
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  activeTab,
  userProfile,
  onClose,
  onTabSwitch,
  onProfileUpdate,
  theme = 'light'
}) => {
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [tempName, setTempName] = useState(userProfile.name);
  const [tempEmail, setTempEmail] = useState(userProfile.email);

  // Handle escape key
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      handleModalEscapeKey(event, {
        profileModalState: { isOpen, activeTab },
        setProfileModalState: ({ isOpen: newIsOpen }) => {
          if (!newIsOpen) onClose();
        },
        userProfile,
        onProfileUpdate,
      });
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, activeTab, onClose, userProfile, onProfileUpdate]);

  // Reset temp values when profile changes
  useEffect(() => {
    setTempName(userProfile.name);
    setTempEmail(userProfile.email);
  }, [userProfile.name, userProfile.email]);

  if (!isOpen) return null;

  const initials = getUserInitials(userProfile.name);
  const stats = formatProfileStats(userProfile);

  const handleSaveName = async () => {
    const result = await handleNameUpdate(tempName, {
      profileModalState: { isOpen, activeTab },
      setProfileModalState: () => {},
      userProfile,
      onProfileUpdate,
    });
    
    if (result.success) {
      setEditingName(false);
    } else {
      alert(result.error);
    }
  };

  const handleSaveEmail = async () => {
    const result = await handleEmailUpdate(tempEmail, {
      profileModalState: { isOpen, activeTab },
      setProfileModalState: () => {},
      userProfile,
      onProfileUpdate,
    });
    
    if (result.success) {
      setEditingEmail(false);
    } else {
      alert(result.error);
    }
  };

  const handleToggleTheme = async () => {
    await handleThemeToggle({
      profileModalState: { isOpen, activeTab },
      setProfileModalState: () => {},
      userProfile,
      onProfileUpdate,
    });
  };

  const renderProfileTab = () => (
    <div>
      <div className="profile-header">
        <div className="profile-avatar-large">
          {userProfile.avatar && userProfile.avatar !== '👤' ? (
            <span>{userProfile.avatar}</span>
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="profile-details">
          {editingName ? (
            <div className="form-group">
              <input
                type="text"
                className="form-input"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSaveName}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
            </div>
          ) : (
            <h3 onClick={() => setEditingName(true)} style={{ cursor: 'pointer' }}>
              {userProfile.name} ✏️
            </h3>
          )}
          
          {editingEmail ? (
            <div className="form-group">
              <input
                type="email"
                className="form-input"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                onBlur={handleSaveEmail}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveEmail()}
                autoFocus
              />
            </div>
          ) : (
            <p onClick={() => setEditingEmail(true)} style={{ cursor: 'pointer' }}>
              {userProfile.email} ✏️
            </p>
          )}
          
          <p className="join-date">{formatJoinDate(userProfile.joinDate)}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{stats.totalChats}</div>
          <div className="stat-label">Total Chats</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.totalQuizzes}</div>
          <div className="stat-label">Quizzes Taken</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.streakDays}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.daysSinceJoining}</div>
          <div className="stat-label">Days Active</div>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div>
      <div className="setting-item">
        <div className="setting-info">
          <h4>Dark Mode</h4>
          <p>Switch between light and dark themes</p>
        </div>
        <button
          className={`toggle-switch ${userProfile.preferences.theme === 'dark' ? 'active' : ''}`}
          onClick={handleToggleTheme}
        />
      </div>

      <div className="action-buttons">
        <button className="btn btn-danger">
          🗑️ Delete Account
        </button>
      </div>
    </div>
  );

  return (
    <div 
      className={`profile-modal-overlay ${isOpen ? 'active' : ''}`}
      onClick={(e) => handleModalBackdropClick(e, {
        profileModalState: { isOpen, activeTab },
        setProfileModalState: ({ isOpen: newIsOpen }) => {
          if (!newIsOpen) onClose();
        },
        userProfile,
        onProfileUpdate,
      })}
    >
      <div className={`profile-modal ${theme}`}>
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 className="modal-title">Profile</h2>
            <button className="modal-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
          
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => onTabSwitch('profile')}
            >
              👤 Profile
            </button>
            <button
              className={`modal-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onTabSwitch('settings')}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        <div className="modal-content">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </div>
      </div>
    </div>
  );
}; 