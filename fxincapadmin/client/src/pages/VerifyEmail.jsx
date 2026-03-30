import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_API_URL ?? '').trim();

export const VerifyEmail = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    // Get email from localStorage (set during registration)
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    if (pendingEmail) {
      setEmail(pendingEmail);
    }
    // Initialize cooldown
    const initCooldown = () => {
      const key = `resendCooldownUntil:${pendingEmail || ''}`;
      const untilStr = localStorage.getItem(key);
      if (untilStr) {
        const until = parseInt(untilStr, 10);
        const left = Math.max(0, Math.floor((until - Date.now()) / 1000));
        setCooldownLeft(left);
      }
    };
    initCooldown();

    const timer = setInterval(() => {
      setCooldownLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newCode = pastedData.split('').filter(char => /^\d$/.test(char));
    
    if (newCode.length === 6) {
      setCode(newCode);
      // Focus last input
      const lastInput = document.getElementById('code-5');
      if (lastInput) lastInput.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const verificationCode = code.join('');

    if (verificationCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (!email) {
      setError('Email not found. Please register again.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/admin-auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Clear pending email
        localStorage.removeItem('pendingVerificationEmail');
        // Redirect to login
        navigate('/login', { state: { message: 'Email verified successfully! Please login.' } });
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Email not found. Please register again.');
      return;
    }
    if (cooldownLeft > 0) return;
    setResendLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/admin-auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (data.success) {
        setInfo(data.message || 'Verification code resent. Check your email.');
        // Start 60s cooldown
        const until = Date.now() + 60 * 1000;
        localStorage.setItem(`resendCooldownUntil:${email}`, String(until));
        setCooldownLeft(60);
      } else {
        setError(data.error || 'Failed to resend verification code');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header Section with Logo */}
          <div className="bg-black px-8 py-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <img 
                  src="/logo_white.png" 
                  alt="SUIMFX Logo" 
                  className="w-12 h-12 object-contain"
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
            <p className="text-slate-400 text-sm">
              We've sent a 6-digit code to<br />
              <span className="text-purple-400 font-medium">{email || 'your email'}</span>
            </p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Code Inputs */}
              <div>
                <label className="block text-slate-400 text-sm mb-3 text-center">Enter Verification Code</label>
                <div className="flex gap-2 justify-center">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      id={`code-${index}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="w-12 h-14 text-center text-2xl font-bold bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition-colors"
                    />
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </>
                )}
              </button>

              {/* Resend Code */}
              <div className="text-center">
                <span className="text-slate-500 text-sm">Didn't receive code? </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendLoading || cooldownLeft > 0}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {resendLoading ? 'Resending...' : cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : 'Resend Code'}
                </button>
                {info && (
                  <div className="mt-2 text-emerald-300 text-xs">{info}</div>
                )}
              </div>

              {/* Back to Login */}
              <div className="text-center pt-2">
                <Link 
                  to="/login" 
                  className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
