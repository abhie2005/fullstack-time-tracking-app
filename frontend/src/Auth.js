import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Auth.css';

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
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otpData, setOtpData] = useState({ userId: null, email: '' });
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

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

      // Check if email verification is required
      if (response.data.requiresVerification) {
        setOtpData({
          userId: response.data.userId,
          email: response.data.email
        });
        setShowOTPVerification(true);
        setLoading(false);
        return;
      }

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

  const handleOTPVerification = async (e) => {
    e.preventDefault();
    setError('');
    setOtpLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/verify-otp`, {
        userId: otpData.userId,
        otp: otp
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      onLogin(response.data.token, response.data.user);
    } catch (err) {
      console.error('OTP verification error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to verify OTP. Please try again.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setOtpLoading(true);

    try {
      await axios.post(`${API_BASE_URL}/resend-otp`, {
        userId: otpData.userId
      });
      setError('');
      alert('OTP has been resent to your email. Please check your inbox.');
    } catch (err) {
      console.error('Resend OTP error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to resend OTP. Please try again.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Show OTP verification screen if needed
  if (showOTPVerification) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>📧 Email Verification</h1>
            <p className="auth-subtitle">
              Please verify your email address
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '8px' }}>
              We've sent a 6-digit OTP to <strong>{otpData.email}</strong>
            </p>
          </div>

          {error && (
            <div className="auth-error">{error}</div>
          )}

          <form onSubmit={handleOTPVerification} className="auth-form">
            <div className="form-group">
              <label htmlFor="otp">Enter OTP</label>
              <input
                type="text"
                id="otp"
                name="otp"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(value);
                  setError('');
                }}
                required
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                style={{ 
                  textAlign: 'center', 
                  fontSize: '24px', 
                  letterSpacing: '8px',
                  fontWeight: 'bold'
                }}
              />
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={otpLoading || otp.length !== 6}
            >
              {otpLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          <div className="auth-toggle">
            <p>
              Didn't receive the OTP?{' '}
              <button
                type="button"
                className="toggle-link"
                onClick={handleResendOTP}
                disabled={otpLoading}
              >
                Resend OTP
              </button>
            </p>
            <p style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="toggle-link"
                onClick={() => {
                  setShowOTPVerification(false);
                  setOtpData({ userId: null, email: '' });
                  setOtp('');
                  setError('');
                }}
              >
                Back to Login
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🕐 Clock In/Out System</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>
            Backend: {API_BASE_URL}
          </p>
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
