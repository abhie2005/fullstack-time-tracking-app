import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Auth.css';
import iconImage from '../Pictures/icon_clock_in_clock_out.png';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fullstack-time-tracking-app-backend.onrender.com/api';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  // Test backend connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/test`, { timeout: 5000 });
        if (response.data) {
          setBackendStatus('connected');
          console.log('✅ Backend connection successful:', response.data);
        }
      } catch (err) {
        setBackendStatus('disconnected');
        console.error('❌ Backend connection failed:', err);
        console.error('Backend URL:', API_BASE_URL);
        if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
          // Don't set error here, just log - let the user try to register to see the actual error
          console.warn('Backend appears to be unreachable. Check if backend is deployed.');
        }
      }
    };
    testConnection();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/login' : '/register';  // ✅ moved here

    try {
      const data = isLogin
        ? { username: formData.username, password: formData.password }
        : formData;

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data);

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      onLogin(response.data.token, response.data.user);
    } catch (err) {
      console.error('Registration/Login error:', err);
      console.error('Error response:', err.response);
      console.error('API URL being used:', `${API_BASE_URL}${endpoint}`); // ✅ now works
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);

      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (
        err.code === 'ERR_NETWORK' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ERR_INTERNET_DISCONNECTED'
      ) {
        setError(
          `Cannot connect to server at ${API_BASE_URL}. Please check: 1) Backend is deployed and running, 2) Backend URL is correct, 3) CORS is configured properly.`
        );
      } else if (err.message) {
        setError(`${err.message} (Trying to connect to: ${API_BASE_URL})`);
      } else {
        setError(`Network error. Check console for details. API URL: ${API_BASE_URL}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={iconImage} alt="Clock In/Out System" className="auth-icon" />
          <h1>Clock In/Out System</h1>
        </div>

        {error && (
          <div className="auth-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Enter your username"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              className="toggle-link"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ username: '', email: '', password: '' });
              }}
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;
