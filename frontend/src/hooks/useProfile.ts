import { useState, useCallback } from 'react';
import { ProfileModalState, UserProfile } from '../types';
import { getDefaultUserProfile } from '../utils/profile';

export const useProfile = () => {
  const [profileModalState, setProfileModalState] = useState<ProfileModalState>({
    isOpen: false,
    activeTab: 'profile',
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(getDefaultUserProfile());

  const openProfileModal = useCallback((tab: 'profile' | 'settings' | 'subscription' = 'profile') => {
    setProfileModalState({
      isOpen: true,
      activeTab: tab,
    });
  }, []);

  const closeProfileModal = useCallback(() => {
    setProfileModalState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const switchTab = useCallback((tab: 'profile' | 'settings' | 'subscription') => {
    setProfileModalState(prev => ({
      ...prev,
      activeTab: tab,
    }));
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const toggleTheme = useCallback(() => {
    setUserProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        theme: prev.preferences.theme === 'light' ? 'dark' : 'light',
      },
    }));
  }, []);

  const toggleNotifications = useCallback(() => {
    setUserProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        notifications: !prev.preferences.notifications,
      },
    }));
  }, []);

  const toggleAutoSave = useCallback(() => {
    setUserProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        autoSave: !prev.preferences.autoSave,
      },
    }));
  }, []);

  return {
    profileModalState,
    setProfileModalState,
    userProfile,
    setUserProfile,
    openProfileModal,
    closeProfileModal,
    switchTab,
    updateProfile,
    toggleTheme,
    toggleNotifications,
    toggleAutoSave,
  };
}; 