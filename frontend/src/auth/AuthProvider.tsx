import React, { useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/api';
import { AuthContext } from './AuthContext';
import type { User } from '../types';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const idToken = params.get('id_token');
      if (accessToken) {
        localStorage.setItem('access_token', accessToken);
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
        if (idToken) localStorage.setItem('id_token', idToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      await fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Fehler beim Laden des Benutzers:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/login`;
  };

  const logout = () => {
    const idToken = localStorage.getItem('id_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('id_token');
    setUser(null);
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/logout${idToken ? `?id_token=${idToken}` : ''}`;
  };

  const hasWriteAccess = user?.role === 'write';

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        hasWriteAccess,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};