import React, { createContext, useContext, useEffect, useState } from 'react';
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { User, UserRole } from '../types';

// MSAL Configuration - Update these with your Azure AD app registration values
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: ['User.Read', 'Files.Read.All', 'Files.ReadWrite.All'],
};

const graphScopes = {
  scopes: ['User.Read', 'Files.Read.All', 'Files.ReadWrite.All'],
};

const msalInstance = new PublicClientApplication(msalConfig);

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [account, setAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await msalInstance.initialize();
        const response = await msalInstance.handleRedirectPromise();

        if (response) {
          setAccount(response.account);
          await loadUserData(response.account);
        } else {
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            await loadUserData(accounts[0]);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const loadUserData = async (msalAccount: AccountInfo) => {
    try {
      // Get user from backend or create if new
      const response = await fetch('/api/auth/me', {
        headers: {
          'X-User-Email': msalAccount.username,
          'X-User-Name': msalAccount.name || msalAccount.username,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Create default user object for demo purposes
        setUser({
          id: msalAccount.localAccountId,
          email: msalAccount.username,
          name: msalAccount.name || msalAccount.username,
          role: 'admin', // Default role - backend should manage this
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback user for demo
      setUser({
        id: msalAccount.localAccountId,
        email: msalAccount.username,
        name: msalAccount.name || msalAccount.username,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      const response = await msalInstance.loginPopup(loginRequest);
      setAccount(response.account);
      await loadUserData(response.account);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await msalInstance.logoutPopup({
        account: account,
        postLogoutRedirectUri: window.location.origin,
      });
      setUser(null);
      setAccount(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!account) return null;

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...graphScopes,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const response = await msalInstance.acquireTokenPopup(graphScopes);
        return response.accessToken;
      }
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
