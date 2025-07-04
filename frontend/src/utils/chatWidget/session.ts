import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS } from '../../types';
import Cookies from 'js-cookie';

// Get environment variables
const BACKEND_URL = 'https://backend-647308514289.us-central1.run.app';
// const BACKEND_URL = 'http://localhost:8000';

// Helper to get token from cookies
const getAuthToken = () => Cookies.get('auth_token');

// Helper to add Authorization header if token exists
const withAuth = (headers: Record<string, string> = {}) => {
  const token = getAuthToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
};
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
export const generateNewSession = async (): Promise<string> => {
  const response = await fetch(`${BACKEND_URL}/api/quiz/session/`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...withAuth()
    }
  });
  if (!response.ok) {
    throw new Error('Failed to create session');
  }
  const data = await response.json();
  const sessionId = data.id;
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