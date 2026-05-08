import React, { useState } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

const ResetPasswordModal = ({ onClose }) => {
  const { forgotPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1: Email, 2: Code & New Password
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await resetPassword(email, code, newPassword);
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-[2px] p-6">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-10 animate-in">
        <div className="flex justify-end -mt-4 -mr-4">
           <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
              <X size={20} />
           </button>
        </div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl mb-6 text-gray-500">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {success ? 'Success!' : step === 1 ? 'Reset Password' : 'Enter Code'}
          </h2>
          <p className="text-gray-500 text-sm text-center max-w-[280px]">
            {success 
              ? 'Your password has been reset successfully.' 
              : step === 1 
                ? "Enter your email address and we'll send you a reset code." 
                : "Check your email for the verification code."}
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-6">
             <div className="text-emerald-600 font-bold mb-2">Redirecting to login...</div>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <input 
                type="email" 
                required
                disabled={isLoading}
                placeholder="your.email@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-400 focus:ring-0 transition-colors"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={18} className="animate-spin" />}
              Send Reset Code
            </button>

            <div className="text-center">
              <button 
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-gray-400 hover:text-gray-900 transition-colors"
              >
                Back to login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Code</label>
              <input 
                type="text" 
                required
                disabled={isLoading}
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-400 focus:ring-0 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
              <input 
                type="password" 
                required
                disabled={isLoading}
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-400 focus:ring-0 transition-colors"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={18} className="animate-spin" />}
              Reset Password
            </button>

            <div className="text-center">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-semibold text-gray-400 hover:text-gray-900 transition-colors"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
