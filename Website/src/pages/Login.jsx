// src/pages/Login.jsx - Login and registration page
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialIsLogin = !(
    location.state?.mode === 'register' ||
    new URLSearchParams(location.search).get('mode') === 'register'
  );
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotData, setForgotData] = useState({
    email: '',
    otp: '',
    newPassword: '',
  });
  const [forgotInfo, setForgotInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const from = location.state?.from?.pathname || '/overview';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.email, formData.password);
      } else {
        if (!formData.name) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        result = await register(formData.name, formData.email, formData.password);
      }

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ name: '', email: '', password: '' });
    setShowForgotPassword(false);
    setForgotStep(1);
    setForgotData({ email: '', otp: '', newPassword: '' });
    setForgotInfo('');
  };

  const handleForgotChange = (e) => {
    setForgotData({
      ...forgotData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setForgotInfo('');
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setForgotInfo('');
    try {
      const response = await authAPI.requestPasswordOtp(forgotData.email);
      setForgotStep(2);
      setForgotInfo(response.message || 'OTP sent to your registered email.');
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setForgotInfo('');
    try {
      const response = await authAPI.resetPasswordWithOtp(
        forgotData.email,
        forgotData.otp,
        forgotData.newPassword
      );
      setForgotInfo(response.message || 'Password reset successful. Please log in.');
      setShowForgotPassword(false);
      setForgotStep(1);
      setForgotData({ email: '', otp: '', newPassword: '' });
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            AIQuant
          </h1>
          <p className="text-slate-400">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/70 rounded-xl shadow-2xl p-8 border border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name field (register only) */}
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required={!isLogin}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>
            )}

            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 transition-colors"
                placeholder="••••••••"
              />
              {!isLogin && (
                <p className="text-xs text-slate-400 mt-1">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                loading
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Toggle between login/register */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
            {isLogin && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword((prev) => !prev);
                    setError('');
                    setForgotInfo('');
                  }}
                  className="text-sm text-slate-400 hover:text-slate-300"
                >
                  Forgot password? Reset with Email OTP
                </button>
              </div>
            )}
          </div>

          {showForgotPassword && isLogin && (
            <div className="mt-6 border-t border-gray-700 pt-6">
              <h3 className="text-white font-semibold mb-4">Reset Password via OTP</h3>

              {forgotStep === 1 && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-300 mb-2">
                      Registered Email
                    </label>
                    <input
                      type="email"
                      id="forgot-email"
                      name="email"
                      value={forgotData.email}
                      onChange={handleForgotChange}
                      required
                      className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white transition-colors ${
                      loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-otp" className="block text-sm font-medium text-gray-300 mb-2">
                      OTP
                    </label>
                    <input
                      type="text"
                      id="forgot-otp"
                      name="otp"
                      value={forgotData.otp}
                      onChange={handleForgotChange}
                      required
                      pattern="[0-9]{6}"
                      className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-colors"
                      placeholder="6-digit OTP"
                    />
                  </div>
                  <div>
                    <label htmlFor="forgot-new-password" className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="forgot-new-password"
                      name="newPassword"
                      value={forgotData.newPassword}
                      onChange={handleForgotChange}
                      required
                      minLength={6}
                      className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-colors"
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white transition-colors ${
                      loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              )}

              {forgotInfo && (
                <div className="mt-3 bg-green-900/40 border border-green-700 text-green-300 px-3 py-2 rounded text-sm">
                  {forgotInfo}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Demo info */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Paper trading only - no real money involved
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
