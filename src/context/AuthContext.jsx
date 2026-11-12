import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SquishiesAPI } from '../services/api';

const AuthContext = createContext({
  user: null,
  authenticated: false,
  demoMode: true,
  loading: true,
  refreshUser: async () => null,
  login: async () => null,
  register: async () => null,
  logout: async () => null,
  setUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [demoMode, setDemoMode] = useState(true);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await SquishiesAPI.getAuthMe();
      setUser(data?.authenticated ? data.user : null);
      if (typeof data?.demoMode === 'boolean') {
        setDemoMode(data.demoMode);
      }
      return data?.authenticated ? data.user : null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials) => {
    const res = await SquishiesAPI.loginAccount(credentials);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await SquishiesAPI.registerAccount(payload);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await SquishiesAPI.logoutAccount();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authenticated: Boolean(user),
        demoMode,
        loading,
        refreshUser,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

