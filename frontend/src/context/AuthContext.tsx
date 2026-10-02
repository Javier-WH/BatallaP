import { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import api from '@/services/api';
import { Spin } from 'antd';

interface User {
  id: number;
  username: string;
  roles: string[];
  firstName: string;
  lastName: string;
  personId?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Last user confirmed by the server. Lets the installed PWA open offline
// (teachers taking attendance without signal); any server answer wins.
const USER_CACHE_KEY = 'auth-user-cache';
const readCachedUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null');
  } catch {
    return null;
  }
};
const cacheUser = (user: User | null) => {
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_CACHE_KEY);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const nextUser = data.authenticated ? data.user : null;
      cacheUser(nextUser);
      setUser(nextUser);
    } catch (error) {
      console.error("Auth check failed", error);
      // No response at all = no network: keep the cached user.
      const offline = axios.isAxiosError(error) && !error.response;
      setUser(offline ? readCachedUser() : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = (userData: User) => {
    cacheUser(userData);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      cacheUser(null);
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
