import { ProfileHandlersProps, UserProfile } from '../types';
import { isValidEmail } from '../utils/profile';

// Handle profile modal open
export const handleOpenProfileModal = (
  tab: 'profile' | 'settings' | 'subscription',
  props: ProfileHandlersProps
) => {
  const { setProfileModalState } = props;
  
  setProfileModalState({
    isOpen: true,
    activeTab: tab,
  });
};

// Handle profile modal close
export const handleCloseProfileModal = (props: ProfileHandlersProps) => {
  const { setProfileModalState } = props;
  
  setProfileModalState({
    isOpen: false,
    activeTab: 'profile',
  });
};

// Handle tab switch in profile modal
export const handleTabSwitch = (
  tab: 'profile' | 'settings' | 'subscription',
  props: ProfileHandlersProps
) => {
  const { profileModalState, setProfileModalState } = props;
  
  setProfileModalState({
    ...profileModalState,
    activeTab: tab,
  });
};

// Handle profile name update
export const handleNameUpdate = async (
  newName: string,
  props: ProfileHandlersProps
) => {
  const { onProfileUpdate } = props;
  
  try {
    if (newName.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }
    
    await onProfileUpdate({ name: newName.trim() });
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update name' 
    };
  }
};

// Handle email update
export const handleEmailUpdate = async (
  newEmail: string,
  props: ProfileHandlersProps
) => {
  const { onProfileUpdate } = props;
  
  try {
    if (!isValidEmail(newEmail)) {
      throw new Error('Please enter a valid email address');
    }
    
    await onProfileUpdate({ email: newEmail.trim() });
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update email' 
    };
  }
};

// Handle theme toggle
export const handleThemeToggle = async (props: ProfileHandlersProps) => {
  const { userProfile, onProfileUpdate } = props;
  
  try {
    const newTheme = userProfile.preferences.theme === 'light' ? 'dark' : 'light';
    
    await onProfileUpdate({
      preferences: {
        ...userProfile.preferences,
        theme: newTheme,
      },
    });
    
    return { success: true, theme: newTheme };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to toggle theme' 
    };
  }
};

// Handle notifications toggle
export const handleNotificationsToggle = async (props: ProfileHandlersProps) => {
  const { userProfile, onProfileUpdate } = props;
  
  try {
    const newNotifications = !userProfile.preferences.notifications;
    
    await onProfileUpdate({
      preferences: {
        ...userProfile.preferences,
        notifications: newNotifications,
      },
    });
    
    return { success: true, notifications: newNotifications };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to toggle notifications' 
    };
  }
};

// Handle auto-save toggle
export const handleAutoSaveToggle = async (props: ProfileHandlersProps) => {
  const { userProfile, onProfileUpdate } = props;
  
  try {
    const newAutoSave = !userProfile.preferences.autoSave;
    
    await onProfileUpdate({
      preferences: {
        ...userProfile.preferences,
        autoSave: newAutoSave,
      },
    });
    
    return { success: true, autoSave: newAutoSave };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to toggle auto-save' 
    };
  }
};

// Handle subscription upgrade (mock implementation)
export const handleSubscriptionUpgrade = async (props: ProfileHandlersProps) => {
  const { onProfileUpdate } = props;
  
  try {
    // Mock subscription upgrade process
    await onProfileUpdate({
      subscription: 'premium',
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to upgrade subscription' 
    };
  }
};

// Handle subscription downgrade (mock implementation)
export const handleSubscriptionDowngrade = async (props: ProfileHandlersProps) => {
  const { onProfileUpdate } = props;
  
  try {
    // Mock subscription downgrade process
    await onProfileUpdate({
      subscription: 'free',
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to downgrade subscription' 
    };
  }
};

// Handle profile export (mock implementation)
export const handleProfileExport = async (props: ProfileHandlersProps) => {
  const { userProfile } = props;
  
  try {
    // Create downloadable profile data
    const profileData = {
      ...userProfile,
      exportedAt: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(profileData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `moneymentor-profile-${userProfile.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to export profile' 
    };
  }
};

// Handle account deletion (mock implementation)
export const handleAccountDeletion = async (props: ProfileHandlersProps) => {
  const { onProfileUpdate } = props;
  
  try {
    // Mock account deletion - in real app this would call API
    console.log('Account deletion requested');
    
    // For now, just log out the user
    await onProfileUpdate({
      preferences: {
        theme: 'light',
        notifications: false,
        autoSave: false,
      },
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete account' 
    };
  }
};

// Handle modal backdrop click
export const handleModalBackdropClick = (
  event: React.MouseEvent<HTMLDivElement>,
  props: ProfileHandlersProps
) => {
  // Close modal if clicking on backdrop
  if (event.target === event.currentTarget) {
    handleCloseProfileModal(props);
  }
};

// Handle escape key press in modal
export const handleModalEscapeKey = (
  event: KeyboardEvent,
  props: ProfileHandlersProps
) => {
  if (event.key === 'Escape') {
    handleCloseProfileModal(props);
  }
}; 