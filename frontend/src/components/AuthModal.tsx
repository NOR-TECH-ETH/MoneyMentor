import React, { useState } from 'react';
import { registerUser, loginUser } from '../utils/chatWidget/api';
import Cookies from 'js-cookie';
import '../styles/ChatWidget.css';

interface AuthModalProps {
  isOpen: boolean;
  onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === 'register') {
        result = await registerUser(email, password, firstName, lastName);
      } else {
        result = await loginUser(email, password);
      }
      if (result && (result.token || result.access_token)) {
        Cookies.set('auth_token', result.token || result.access_token, { expires: 7 });
        onAuthSuccess();
      } else {
        setError('No token returned.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="modal-content" onSubmit={handleSubmit}>
        <h2 className="modal-title">{mode === 'login' ? 'Login' : 'Register'}</h2>
        {mode === 'register' && (
          <>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              className="modal-input"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
              className="modal-input"
            />
          </>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="modal-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="modal-input"
        />
        {error && <div className="modal-error">{error}</div>}
        <button type="submit" disabled={loading} className="modal-btn">
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
        <div className="modal-switch">
          {mode === 'login' ? (
            <span>Don't have an account? <button type="button" className="modal-link" onClick={() => setMode('register')}>Register</button></span>
          ) : (
            <span>Already have an account? <button type="button" className="modal-link" onClick={() => setMode('login')}>Login</button></span>
          )}
        </div>
      </form>
    </div>
  );
};

export const logout = () => {
  Cookies.remove('auth_token');
  window.location.reload();
};

export default AuthModal; 