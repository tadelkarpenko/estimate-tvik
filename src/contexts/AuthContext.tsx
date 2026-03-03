import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ isAuthenticated: false, login: () => false, logout: () => {} });

const DEFAULT_PASSWORD = 'tvik2024';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('tvik_auth') === '1');

  const login = useCallback((password: string) => {
    const now = Date.now();
    const attempts = parseInt(localStorage.getItem('tvik_login_attempts') || '0', 10);
    const lockUntil = parseInt(localStorage.getItem('tvik_lockout') || '0', 10);

    if (lockUntil > now) return false;

    const storedPw = localStorage.getItem('tvik_admin_password') || DEFAULT_PASSWORD;
    if (password === storedPw) {
      sessionStorage.setItem('tvik_auth', '1');
      localStorage.setItem('tvik_login_attempts', '0');
      setIsAuthenticated(true);
      return true;
    }

    const newAttempts = attempts + 1;
    localStorage.setItem('tvik_login_attempts', String(newAttempts));
    if (newAttempts >= MAX_ATTEMPTS) {
      localStorage.setItem('tvik_lockout', String(now + LOCKOUT_MS));
      localStorage.setItem('tvik_login_attempts', '0');
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('tvik_auth');
    setIsAuthenticated(false);
  }, []);

  return <AuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
