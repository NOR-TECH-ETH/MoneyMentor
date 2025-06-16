import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS } from '../../types';

export interface SessionIds {
  userId: string;
  sessionId: string;
}

/**
 * Initialize or retrieve user and session IDs from localStorage
 */
export const initializeSession = (): SessionIds => {
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }

  let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  }

  return { userId, sessionId };
};

/**
 * Generate a new session ID and store it
 */
export const generateNewSession = (): string => {
  const sessionId = uuidv4();
  localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  return sessionId;
};

/**
 * Clear session data from localStorage
 */
export const clearSession = (): void => {
  localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
};

/**
 * Get current session IDs without generating new ones
 */
export const getCurrentSession = (): SessionIds | null => {
  const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  
  if (!userId || !sessionId) {
    return null;
  }
  
  return { userId, sessionId };
}; 