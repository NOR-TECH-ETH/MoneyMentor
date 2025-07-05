import React, { useState } from 'react';
import Cookies from 'js-cookie';
import { extendSession } from '../utils/sessionUtils';
import '../styles/ChatWidget.css';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ 
  isOpen, 
  onStayLoggedIn, 
  onLogout 
}) => {
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  if (!isOpen) return null;

  const handleStayLoggedIn = () => {
    const token = Cookies.get('auth_token');
    if (token) {
      extendSession(keepLoggedIn);
      onStayLoggedIn();
    }
  };

  const handleLogout = () => {
    Cookies.remove('auth_token');
    localStorage.removeItem('auth_token_expires');
    onLogout();
  };

  return (
    <div className="session-expired-overlay">
      <div className="session-expired-card">
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏰</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Session Expired</h3>
          <p style={{ color: '#666', margin: '0', fontSize: '13px', lineHeight: '1.4' }}>
            Your session has expired. Would you like to stay logged in?
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', justifyContent: 'center' }}>
          <input
            type="checkbox"
            id="keepLoggedIn"
            checked={keepLoggedIn}
            onChange={e => setKeepLoggedIn(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          <label htmlFor="keepLoggedIn" style={{ fontSize: 13 }}>
            Keep me logged in for 30 days
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button 
            type="button" 
            onClick={handleStayLoggedIn}
            style={{ 
              backgroundColor: '#10b981',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              flex: 1
            }}
          >
            Stay Logged In
          </button>
          <button 
            type="button" 
            onClick={handleLogout}
            style={{ 
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              color: '#374151',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              flex: 1
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal; 