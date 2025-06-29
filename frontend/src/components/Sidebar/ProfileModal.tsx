import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { 
  getUserInitials, 
  formatJoinDate, 
  formatProfileStats, 
  getUserAchievements,
  getSubscriptionBadgeColor
} from '../../utils/profile';
import { 
  handleModalBackdropClick,
  handleModalEscapeKey,
  handleNameUpdate,
  handleEmailUpdate,
  handleThemeToggle,
  handleNotificationsToggle,
  handleAutoSaveToggle,
  handleSubscriptionUpgrade,
  handleProfileExport
} from '../../logic/profileHandlers';

interface ProfileModalProps {
  isOpen: boolean;
  activeTab: 'profile' | 'settings' | 'subscription';
  userProfile: UserProfile;
  onClose: () => void;
  onTabSwitch: (tab: 'profile' | 'settings' | 'subscription') => void;
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
  const achievements = getUserAchievements(userProfile);

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

  const handleToggleNotifications = async () => {
    await handleNotificationsToggle({
      profileModalState: { isOpen, activeTab },
      setProfileModalState: () => {},
      userProfile,
      onProfileUpdate,
    });
  };

  const handleToggleAutoSave = async () => {
    await handleAutoSaveToggle({
      profileModalState: { isOpen, activeTab },
      setProfileModalState: () => {},
      userProfile,
      onProfileUpdate,
    });
  };

  const handleUpgrade = async () => {
    await handleSubscriptionUpgrade({
      profileModalState: { isOpen, activeTab },
      setProfileModalState: () => {},
      userProfile,
      onProfileUpdate,
    });
  };

  const handleExport = async () => {
    await handleProfileExport({
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
          
          <p>Member since {formatJoinDate(userProfile.joinDate)}</p>
          
          <div
            className={`subscription-badge ${userProfile.subscription}`}
            style={{
              backgroundColor: getSubscriptionBadgeColor(userProfile.subscription) + '20',
              borderColor: getSubscriptionBadgeColor(userProfile.subscription) + '40',
            }}
          >
            {userProfile.subscription === 'premium' ? '⭐' : '🆓'} {userProfile.subscription.toUpperCase()}
          </div>
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

      {achievements.length > 0 && (
        <div className="achievements">
          <h4>🏆 Achievements</h4>
          <div className="achievement-list">
            {achievements.map((achievement, index) => (
              <div key={index} className="achievement-badge">
                {achievement}
              </div>
            ))}
          </div>
        </div>
      )}
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

      <div className="setting-item">
        <div className="setting-info">
          <h4>Notifications</h4>
          <p>Receive updates and reminders</p>
        </div>
        <button
          className={`toggle-switch ${userProfile.preferences.notifications ? 'active' : ''}`}
          onClick={handleToggleNotifications}
        />
      </div>

      <div className="setting-item">
        <div className="setting-info">
          <h4>Auto-Save</h4>
          <p>Automatically save your progress</p>
        </div>
        <button
          className={`toggle-switch ${userProfile.preferences.autoSave ? 'active' : ''}`}
          onClick={handleToggleAutoSave}
        />
      </div>

      <div className="action-buttons">
        <button className="btn btn-secondary" onClick={handleExport}>
          📊 Export Data
        </button>
        <button className="btn btn-danger">
          🗑️ Delete Account
        </button>
      </div>
    </div>
  );

  const renderSubscriptionTab = () => (
    <div>
      <div className="profile-section">
        <h4>Current Plan</h4>
        <div className="stat-item" style={{ marginBottom: '20px' }}>
          <div className="stat-value" style={{ color: getSubscriptionBadgeColor(userProfile.subscription) }}>
            {userProfile.subscription === 'premium' ? '⭐ Premium' : '🆓 Free'}
          </div>
          <div className="stat-label">
            {userProfile.subscription === 'premium' 
              ? 'Full access to all features' 
              : 'Limited features available'
            }
          </div>
        </div>
      </div>

      {userProfile.subscription === 'free' ? (
        <div className="profile-section">
          <h4>Upgrade to Premium</h4>
          <p>Unlock all features and get unlimited access to:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '20px' }}>
            <li>Unlimited chat sessions</li>
            <li>Advanced financial planning tools</li>
            <li>Priority customer support</li>
            <li>Exclusive premium content</li>
            <li>Advanced analytics and insights</li>
          </ul>
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleUpgrade}>
              ⭐ Upgrade to Premium
            </button>
          </div>
        </div>
      ) : (
        <div className="profile-section">
          <h4>Premium Benefits</h4>
          <p>You're enjoying all premium features:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '20px' }}>
            <li>✅ Unlimited chat sessions</li>
            <li>✅ Advanced financial planning tools</li>
            <li>✅ Priority customer support</li>
            <li>✅ Exclusive premium content</li>
            <li>✅ Advanced analytics and insights</li>
          </ul>
          <div className="action-buttons">
            <button className="btn btn-secondary">
              📧 Contact Support
            </button>
          </div>
        </div>
      )}
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
            <button
              className={`modal-tab ${activeTab === 'subscription' ? 'active' : ''}`}
              onClick={() => onTabSwitch('subscription')}
            >
              💎 Subscription
            </button>
          </div>
        </div>

        <div className="modal-content">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'settings' && renderSettingsTab()}
          {activeTab === 'subscription' && renderSubscriptionTab()}
        </div>
      </div>
    </div>
  );
}; 