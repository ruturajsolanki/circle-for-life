/**
 * Circle for Life - Gem Economy Store
 * Zustand store for gem balance, transactions, and multiplier state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { apiClient } from '../config/api';

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

export interface GemTransaction {
  id: string;
  type: 'earn' | 'spend';
  amount: number;
  source: string;
  description?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface GemBalanceResponse {
  balance: number;
  pendingEarnings: number;
  multiplier: number;
  multiplierExpiresAt?: string;
}

interface GemState {
  balance: number;
  pendingEarnings: number;
  multiplier: number;
  multiplierExpiresAt: string | null;
  lastFetchedAt: number | null;
  transactions: GemTransaction[];
  setBalance: (params: Partial<GemBalanceResponse>) => void;
  addGems: (amount: number) => void;
  spendGems: (amount: number) => void;
  fetchBalance: () => Promise<void>;
  fetchTransactions: (cursor?: string) => Promise<{ nextCursor?: string }>;
  clearCache: () => void;
}

const CACHE_TTL_MS = 60_000; // 1 minute

export const useGemStore = create<GemState>()(
  persist(
    (set, get) => ({
      balance: 0,
      pendingEarnings: 0,
      multiplier: 1,
      multiplierExpiresAt: null,
      lastFetchedAt: null,
      transactions: [],

      setBalance: (params) => {
        set({
          balance: params.balance ?? get().balance,
          pendingEarnings: params.pendingEarnings ?? get().pendingEarnings,
          multiplier: params.multiplier ?? get().multiplier,
          multiplierExpiresAt: params.multiplierExpiresAt ?? get().multiplierExpiresAt,
          lastFetchedAt: Date.now(),
        });
      },

      addGems: (amount) => {
        set((state) => ({
          balance: state.balance + amount,
          lastFetchedAt: Date.now(),
        }));
      },

      spendGems: (amount) => {
        set((state) => ({
          balance: Math.max(0, state.balance - amount),
          lastFetchedAt: Date.now(),
        }));
      },

      fetchBalance: async () => {
        const { lastFetchedAt } = get();
        if (lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
          return;
        }

        try {
          const { data } = await apiClient.get<GemBalanceResponse>('/gems/balance');
          set({
            balance: data.balance,
            pendingEarnings: data.pendingEarnings,
            multiplier: data.multiplier,
            multiplierExpiresAt: data.multiplierExpiresAt ?? null,
            lastFetchedAt: Date.now(),
          });
        } catch {
          // Silently fail - balance will show cached or 0
        }
      },

      fetchTransactions: async (cursor) => {
        try {
          const params = new URLSearchParams({ limit: '20' });
          if (cursor) params.set('cursor', cursor);

          const { data } = await apiClient.get<{
            transactions: GemTransaction[];
            nextCursor?: string;
          }>(`/gems/transactions?${params}`);

          set((state) => ({
            transactions: cursor ? [...state.transactions, ...data.transactions] : data.transactions,
          }));

          return { nextCursor: data.nextCursor };
        } catch {
          return {};
        }
      },

      clearCache: () => {
        set({
          balance: 0,
          pendingEarnings: 0,
          multiplier: 1,
          multiplierExpiresAt: null,
          lastFetchedAt: null,
          transactions: [],
        });
      },
    }),
    {
      name: 'circle-for-life-gems',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        balance: state.balance,
        multiplier: state.multiplier,
        multiplierExpiresAt: state.multiplierExpiresAt,
      }),
    }
  )
);
