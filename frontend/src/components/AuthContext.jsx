import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';

const AuthContext = createContext();

// ---------------------------------------------------------------------------
// Cognito Configuration
// ---------------------------------------------------------------------------
const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
};
const userPool = new CognitoUserPool(poolData);

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
  
  // Cognito groups are usually in 'cognito:groups'
  const groups = payload['cognito:groups'] || [];
  const role = groups.includes('Admins') ? 'admin' : 'vendor';
  
  return {
    email: payload.email || payload.sub,
    name: payload.name || payload.email || 'User',
    type: role === 'admin' ? 'Admin' : 'Vendor',
    role: role,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Helper to sync session to state
  const syncSession = useCallback((session) => {
    if (session && session.isValid()) {
      const idToken = session.getIdToken().getJwtToken();
      localStorage.setItem('medvoice_access_token', idToken);
      const payload = session.getIdToken().payload;
      setUser(buildUserFromPayload(payload));
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('medvoice_access_token');
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // On mount – restore session from Cognito OR URL (for social login)
  useEffect(() => {
    const checkSession = async () => {
      // 1. Check for social login redirect (token in URL)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('access_token');
      
      if (tokenFromUrl) {
        localStorage.setItem('medvoice_access_token', tokenFromUrl);
        const payload = parseJwt(tokenFromUrl);
        if (payload && payload.exp > Date.now() / 1000) {
          setUser(buildUserFromPayload(payload));
          setIsAuthenticated(true);
        }
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // 2. Check local storage first for a valid, non-expired token (fast-path seamless login)
        const localToken = localStorage.getItem('medvoice_access_token');
        if (localToken) {
          const payload = parseJwt(localToken);
          // If token is valid and has at least 60 seconds before expiration
          if (payload && payload.exp > (Date.now() / 1000) + 60) {
            setUser(buildUserFromPayload(payload));
            setIsAuthenticated(true);
            setIsInitializing(false);
            return;
          }
        }

        // 3. Fallback: Check for existing Cognito session (handles token refresh automatically)
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
          cognitoUser.getSession((err, session) => {
            if (!err) {
              syncSession(session);
            } else {
              localStorage.removeItem('medvoice_access_token');
            }
            setIsInitializing(false);
          });
          return;
        }
      }
      setIsInitializing(false);
    };

    checkSession();
  }, [syncSession]);

  // ---------------------------------------------------------------------------
  // login: use Cognito SDK
  // ---------------------------------------------------------------------------
  const login = (email, password) => {
    return new Promise((resolve, reject) => {
      const authenticationData = {
        Username: email,
        Password: password,
      };
      const authenticationDetails = new AuthenticationDetails(authenticationData);
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          syncSession(result);
          resolve(buildUserFromPayload(result.getIdToken().payload));
        },
        onFailure: (err) => {
          console.error('Login error:', err);
          reject(new Error(err.message || 'Invalid credentials'));
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Handle new password required if necessary
          reject(new Error('New password required'));
        }
      });
    });
  };

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------
  const logout = () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    localStorage.removeItem('medvoice_access_token');
    setIsAuthenticated(false);
    setUser(null);
  };

  const forgotPassword = (email) => {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.forgotPassword({
        onSuccess: (data) => resolve(data),
        onFailure: (err) => reject(new Error(err.message)),
      });
    });
  };

  const resetPassword = (email, code, newPassword) => {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(new Error(err.message)),
      });
    });
  };

  // ---------------------------------------------------------------------------
  // Loading screen while we check session
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

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

