import { useState, useEffect } from 'react';
import { initializeSession, SessionIds } from '../utils/chatWidget';

export const useSessionState = () => {
  const [sessionIds, setSessionIds] = useState<SessionIds>({ userId: '', sessionId: '' });

  // Initialize session on component mount
  useEffect(() => {
    const ids = initializeSession();
    setSessionIds(ids);
  }, []);

  return {
    sessionIds,
    setSessionIds
  };
}; 