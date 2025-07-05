import Cookies from 'js-cookie';

export interface SessionInfo {
  token: string;
  expiresAt: Date | null;
  isExpired: boolean;
  timeUntilExpiry: number; // in milliseconds
}

/**
 * Get session information including expiration details
 */
export const getSessionInfo = (): SessionInfo | null => {
  const token = Cookies.get('auth_token');
  if (!token) return null;

  // For now, we'll use a simpler approach since js-cookie doesn't expose expiration easily
  // We'll store the expiration time in localStorage when setting the cookie
  const storedExpiresAt = localStorage.getItem('auth_token_expires');
  
  let expiresAt: Date | null = null;
  let isExpired = false;
  let timeUntilExpiry = 0;

  if (storedExpiresAt) {
    expiresAt = new Date(storedExpiresAt);
    const now = new Date();
    timeUntilExpiry = expiresAt.getTime() - now.getTime();
    isExpired = timeUntilExpiry <= 0;
  }

  return {
    token,
    expiresAt,
    isExpired,
    timeUntilExpiry
  };
};

/**
 * Check if session is expired or will expire soon (within 5 minutes)
 */
export const isSessionExpiredOrExpiringSoon = (): boolean => {
  const sessionInfo = getSessionInfo();
  if (!sessionInfo) return true;

  // Consider expired if:
  // 1. Session is already expired
  // 2. Session will expire within 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  return sessionInfo.isExpired || sessionInfo.timeUntilExpiry <= fiveMinutes;
};

/**
 * Extend session with new expiration
 */
export const extendSession = (keepLoggedIn: boolean = true): void => {
  const token = Cookies.get('auth_token');
  if (!token) return;

  let expiresAt: Date;

  if (keepLoggedIn) {
    // Extend to 30 days
    Cookies.set('auth_token', token, { expires: 30 });
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  } else {
    // Extend to 2 hours
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    Cookies.set('auth_token', token, { expires });
    expiresAt = expires;
  }

  // Store expiration time in localStorage for tracking
  localStorage.setItem('auth_token_expires', expiresAt.toISOString());
};

/**
 * Clear session
 */
export const clearSession = (): void => {
  Cookies.remove('auth_token');
  localStorage.removeItem('auth_token_expires');
}; 