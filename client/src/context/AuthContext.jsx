import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { getUser, setUser, removeUser, getAuthToken, setAuthToken, removeAuthToken } from '../utils/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUserState(response.data);
          setUser(response.data);
        } catch (error) {
          removeAuthToken();
          removeUser();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      setAuthToken(response.data.token);
      setUserState(response.data.user);
      setUser(response.data.user);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      setAuthToken(response.data.token);
      setUserState(response.data.user);
      setUser(response.data.user);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = () => {
    removeAuthToken();
    removeUser();
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};