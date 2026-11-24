import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, LogIn, UserPlus, LogOut, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import useIssueStore from '../../store/useIssueStore';

export default function AuthModal() {
  const {
    user,
    isAuthenticated,
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    login,
    register,
    logout,
    isLoading,
    error,
  } = useAuthStore();

  const { fetchMyReports } = useIssueStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    const res = await login(email, password);
    if (res.success) {
      fetchMyReports();
      closeAuthModal();
      setEmail('');
      setPassword('');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!name || !email || !password) {
      setLocalError('Please fill in your name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    const res = await register(name, email, password);
    if (res.success) {
      fetchMyReports();
      closeAuthModal();
      setName('');
      setEmail('');
      setPassword('');
    }
  };

  const handleLogout = () => {
    logout();
    closeAuthModal();
  };

  const displayError = localError || error;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="absolute inset-0 bg-ink/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 font-sans"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white p-6 relative">
            <button
              onClick={closeAuthModal}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                {user?.avatar || '👤'}
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white tracking-tight">
                  {isAuthenticated ? 'Civic Profile' : 'LocalWatch Account'}
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                  {isAuthenticated
                    ? `Logged in as ${user.name}`
                    : 'Report, verify, and track civic neighborhood issues'}
                </p>
              </div>
            </div>

            {/* Profile badge if authenticated */}
            {isAuthenticated && (
              <div className="mt-4 p-3 bg-white/10 rounded-xl border border-white/15 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck size={12} /> {user.role || 'Citizen'}
                  </span>
                  <span className="text-white/60">•</span>
                  <span className="text-white/80 font-medium">⚡ {user.reputationScore || 100} civic pts</span>
                </div>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="p-6">
            {isAuthenticated ? (
              // LOGGED IN VIEW: Profile details and Logout
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2 text-sm text-ink/80">
                  <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                    <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Full Name</span>
                    <span className="font-medium text-ink">{user.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                    <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Email</span>
                    <span className="font-mono text-xs text-ink/80">{user.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">User ID</span>
                    <span className="font-mono text-xs text-ink/60">#{user.id}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={closeAuthModal}
                    className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-sm font-medium text-ink hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              // AUTHENTICATION FORMS: Sign In / Create Account
              <div>
                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-xl mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('login');
                      setLocalError('');
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      authModalMode === 'login'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    <LogIn size={14} /> Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('register');
                      setLocalError('');
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      authModalMode === 'register'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    <UserPlus size={14} /> Create Account
                  </button>
                </div>

                {/* Error Banner */}
                {displayError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{displayError}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={authModalMode === 'login' ? handleSignIn : handleSignUp} className="space-y-3.5">
                  {authModalMode === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-ink/70 mb-1">Full Name</label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Kanishk Sharma"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="email"
                        required
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-lg shadow-gray-900/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : authModalMode === 'login' ? (
                      <>
                        <LogIn size={16} /> Sign In
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} /> Create Account
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
