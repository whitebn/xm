import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  hasRole: (roles: UserRole[]) => boolean;
  canEdit: () => boolean;
  canManage: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default demo user - no Microsoft login required
const DEFAULT_USER: User = {
  id: 'demo-user-1',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'admin',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved user in localStorage or auto-login with demo user
    const initAuth = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        } else {
          // Auto-login with demo user for easy testing
          setUser(DEFAULT_USER);
          localStorage.setItem('user', JSON.stringify(DEFAULT_USER));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Fallback to demo user
        setUser(DEFAULT_USER);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email?: string, name?: string) => {
    setIsLoading(true);
    try {
      const newUser: User = {
        id: 'user-' + Date.now(),
        email: email || 'demo@example.com',
        name: name || 'Demo User',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const getAccessToken = async (): Promise<string | null> => {
    // OneDrive integration requires Microsoft login
    // Return null - OneDrive features will show a message to configure Microsoft auth
    console.warn('OneDrive integration requires Microsoft authentication to be configured.');
    return null;
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canEdit = (): boolean => {
    return hasRole(['admin', 'vp', 'manager']);
  };

  const canManage = (): boolean => {
    return hasRole(['admin', 'vp']);
  };

  const isAdmin = (): boolean => {
    return hasRole(['admin']);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        getAccessToken,
        hasRole,
        canEdit,
        canManage,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
