/**
 * Circle for Life - Authentication Store
 * Zustand store for user session, tokens, and auth actions
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { apiClient, setTokenGetter, clearTokenGetter } from '../config/api';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string): string | null => {
    try {
      return storage.getString(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  profileTheme?: string;
  createdAt: string;
  gemBalance?: number;
  currentStreak?: number;
  longestStreak?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hydrate: () => void;
  setAuth: (user: User, tokens: AuthTokens) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  refreshTokens: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,

      hydrate: () => {
        const state = get();
        if (state.tokens?.accessToken) {
          setTokenGetter(() => state.tokens?.accessToken ?? null);
        }
      },

      setAuth: (user, tokens) => {
        set({
          user,
          tokens,
          isAuthenticated: true,
        });
        setTokenGetter(() => tokens.accessToken);
      },

      logout: async () => {
        const { tokens } = get();
        try {
          if (tokens?.refreshToken) {
            await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken });
          }
        } catch {
          // Ignore logout API errors - still clear local state
        } finally {
          clearTokenGetter();
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
          });
        }
      },

      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },

      refreshTokens: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) return false;

        try {
          const { data } = await apiClient.post<{ accessToken: string; refreshToken: string }>(
            '/auth/refresh',
            { refreshToken: tokens.refreshToken }
          );
          set({
            tokens: {
              ...tokens,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            },
          });
          setTokenGetter(() => data.accessToken);
          return true;
        } catch {
          get().logout();
          return false;
        }
      },
    }),
    {
      name: 'circle-for-life-auth',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.tokens?.accessToken) {
          setTokenGetter(() => state.tokens?.accessToken ?? null);
        }
      },
    }
  )
);
