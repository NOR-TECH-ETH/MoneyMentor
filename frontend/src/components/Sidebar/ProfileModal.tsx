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
import { getUserProfile, updateUserProfile } from '../../utils/chatWidget/api';
import { ProfileSkeleton } from './ProfileSkeleton';

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
  const [isLoading, setIsLoading] = useState(false);
  const [backendProfile, setBackendProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile data when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'profile') {
      fetchProfileData();
    }
  }, [isOpen, activeTab]);

  const fetchProfileData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getUserProfile();
      setBackendProfile(response);
      
      // Update local profile with backend data
      if (response.user) {
        const updatedProfile = {
          name: `${response.user.first_name} ${response.user.last_name}`.trim(),
          email: response.user.email,
          joinDate: response.user.created_at ? new Date(response.user.created_at).toISOString() : userProfile.joinDate,
          preferences: userProfile.preferences, // Keep existing preferences
          avatar: userProfile.avatar, // Keep existing avatar
        };
        onProfileUpdate(updatedProfile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Failed to fetch profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSaveName = async () => {
    if (!backendProfile?.user) return;
    
    try {
      const [firstName, ...lastNameParts] = tempName.trim().split(' ');
      const lastName = lastNameParts.join(' ') || '';
      
      const response = await updateUserProfile({
        first_name: firstName,
        last_name: lastName
      });
      
      if (response) {
        // Update local state
        const updatedProfile = {
          ...userProfile,
          name: tempName.trim()
        };
        onProfileUpdate(updatedProfile);
        setEditingName(false);
        
        // Refresh backend data
        await fetchProfileData();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update name';
      alert(errorMessage);
      console.error('Failed to update name:', err);
    }
  };

  const handleSaveEmail = async () => {
    if (!backendProfile?.user) return;
    
    try {
      const response = await updateUserProfile({
        email: tempEmail.trim()
      });
      
      if (response) {
        // Update local state
        const updatedProfile = {
          ...userProfile,
          email: tempEmail.trim()
        };
        onProfileUpdate(updatedProfile);
        setEditingEmail(false);
        
        // Refresh backend data
        await fetchProfileData();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update email';
      alert(errorMessage);
      console.error('Failed to update email:', err);
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

  if (!isOpen) return null;

  const initials = getUserInitials(userProfile.name);
  const stats = formatProfileStats(userProfile);

  const renderProfileTab = () => {
    if (isLoading) {
      return <ProfileSkeleton theme={theme} />;
    }

    if (error) {
      return (
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
              <h3>{userProfile.name}</h3>
              <p>{userProfile.email}</p>
              <p className="join-date">{formatJoinDate(userProfile.joinDate)}</p>
              <div className="profile-error-indicator">
                <span className="error-icon">⚠️</span>
                <span className="error-text">Couldn't load latest stats</span>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{stats.totalChats || '—'}</div>
              <div className="stat-label">Total Chats</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.totalQuizzes || '—'}</div>
              <div className="stat-label">Quizzes Taken</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.streakDays || '—'}</div>
              <div className="stat-label">Day Streak</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.daysSinceJoining || '—'}</div>
              <div className="stat-label">Days Active</div>
            </div>
          </div>

          <div className="profile-error-actions">
            <button 
              className="btn btn-secondary" 
              onClick={fetchProfileData}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
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
            <div className="stat-value">
              {backendProfile?.profile?.total_chats != null
                ? backendProfile.profile.total_chats
                : (userProfile.totalChats != null ? userProfile.totalChats : '—')}
            </div>
            <div className="stat-label">Total Chats</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {backendProfile?.statistics?.statistics?.total_quiz_responses != null
                ? backendProfile.statistics.statistics.total_quiz_responses
                : (backendProfile?.profile?.quizzes_taken != null
                    ? backendProfile.profile.quizzes_taken
                    : (userProfile.totalQuizzes != null ? userProfile.totalQuizzes : '—'))}
            </div>
            <div className="stat-label">Quizzes Taken</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {backendProfile?.profile?.day_streak != null
                ? backendProfile.profile.day_streak
                : (userProfile.streakDays != null ? userProfile.streakDays : '—')}
            </div>
            <div className="stat-label">Day Streak</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {backendProfile?.profile?.days_active != null
                ? backendProfile.profile.days_active
                : (userProfile.joinDate ? Math.max(1, Math.floor((Date.now() - new Date(userProfile.joinDate).getTime()) / (1000 * 60 * 60 * 24))) : '—')}
            </div>
            <div className="stat-label">Days Active</div>
          </div>
        </div>
      </div>
    );
  };

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