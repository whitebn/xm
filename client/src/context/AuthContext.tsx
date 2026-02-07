import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types';

// Dev mode: skip Microsoft login entirely when Azure credentials are not configured
const DEV_MODE = !import.meta.env.VITE_AZURE_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID === 'your-azure-client-id';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  hasRole: (roles: UserRole[]) => boolean;
  canEdit: () => boolean;
  canManage: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default dev user — automatically logged in when Azure AD is not configured
const DEV_USER: User = {
  id: 'dev-admin-001',
  email: 'admin@localhost.dev',
  name: 'Local Admin',
  role: 'admin' as UserRole,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(DEV_MODE ? DEV_USER : null);
  const [isLoading, setIsLoading] = useState(!DEV_MODE);

  useEffect(() => {
    if (DEV_MODE) {
      // In dev mode, register the dev user with the backend so API calls work
      fetch('/api/auth/me', {
        headers: {
          'X-User-Email': DEV_USER.email,
          'X-User-Name': DEV_USER.name,
        },
      }).then(res => {
        if (res.ok) return res.json();
      }).then(data => {
        if (data?.user) setUser(data.user);
      }).catch(() => {
        // Backend might not be running yet, keep the local dev user
      });
      return;
    }

    // Production mode: use Microsoft authentication
    const initAuth = async () => {
      try {
        const { PublicClientApplication } = await import('@azure/msal-browser');

        const msalConfig = {
          auth: {
            clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
            redirectUri: window.location.origin,
          },
          cache: {
            cacheLocation: 'sessionStorage' as const,
            storeAuthStateInCookie: false,
          },
        };

        const msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        const response = await msalInstance.handleRedirectPromise();

        if (response) {
          await loadUserData(response.account.username, response.account.name || response.account.username, response.account.localAccountId);
        } else {
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            await loadUserData(accounts[0].username, accounts[0].name || accounts[0].username, accounts[0].localAccountId);
          }
        }

        // Store msalInstance for login/logout/token methods
        (window as any).__msalInstance = msalInstance;
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const loadUserData = async (email: string, name: string, localId: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'X-User-Email': email,
          'X-User-Name': name,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser({
          id: localId,
          email: email,
          name: name,
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUser({
        id: localId,
        email: email,
        name: name,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const login = async () => {
    if (DEV_MODE) {
      setUser(DEV_USER);
      return;
    }

    try {
      setIsLoading(true);
      const msalInstance = (window as any).__msalInstance;
      const loginRequest = { scopes: ['User.Read', 'Files.Read.All', 'Files.ReadWrite.All'] };
      const response = await msalInstance.loginPopup(loginRequest);
      await loadUserData(response.account.username, response.account.name || response.account.username, response.account.localAccountId);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (DEV_MODE) {
      setUser(null);
      return;
    }

    try {
      const msalInstance = (window as any).__msalInstance;
      await msalInstance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
      });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (DEV_MODE) return null;

    const msalInstance = (window as any).__msalInstance;
    if (!msalInstance) return null;

    try {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length === 0) return null;
      const graphScopes = { scopes: ['User.Read', 'Files.Read.All', 'Files.ReadWrite.All'] };
      const response = await msalInstance.acquireTokenSilent({
        ...graphScopes,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      console.error('Token acquisition error:', error);
      return null;
    }
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
