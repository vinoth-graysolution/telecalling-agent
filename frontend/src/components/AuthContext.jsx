import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

// ---------------------------------------------------------------------------
// Tiny helper: decode a JWT payload (no signature verification – server does that)
// ---------------------------------------------------------------------------
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function buildUserFromPayload(payload) {
  if (!payload) return null;
  return {
    email: payload.sub,
    name: payload.name || payload.sub,
    type: payload.role === 'admin' ? 'Admin' : 'Vendor',
    role: payload.role,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // On mount – restore session from localStorage OR URL (for social login)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('access_token');
    
    if (tokenFromUrl) {
      localStorage.setItem('medvoice_access_token', tokenFromUrl);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('medvoice_access_token');
    if (token) {
      const payload = parseJwt(token);
      // Check token is not expired
      if (payload && payload.exp > Date.now() / 1000) {
        setUser(buildUserFromPayload(payload));
        setIsAuthenticated(true);
      } else {
        // Expired – clear it
        localStorage.removeItem('medvoice_access_token');
      }
    }
    setIsInitializing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // login: call our own FastAPI endpoint
  // ---------------------------------------------------------------------------
  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      localStorage.setItem('medvoice_access_token', data.access_token);

      const payload = parseJwt(data.access_token);
      const userObj = buildUserFromPayload(payload);
      setUser(userObj);
      setIsAuthenticated(true);
      return userObj;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };


  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------
  const logout = () => {
    localStorage.removeItem('medvoice_access_token');
    setIsAuthenticated(false);
    setUser(null);
  };

  // ---------------------------------------------------------------------------
  // Loading screen while we check localStorage
  // ---------------------------------------------------------------------------
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Verifying Session...</p>
        </div>
      </div>
    );
  }

  const forgotPassword = async (email) => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to initiate password reset');
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to reset password');
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
