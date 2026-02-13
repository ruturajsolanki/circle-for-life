/**
 * Circle for Life - Control Panel Store
 * Manages API keys, selected providers/models, and chat history
 * for the multi-provider AI playground.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string): string | null => storage.getString(name) ?? null,
  setItem: (name: string, value: string): void => { storage.set(name, value); },
  removeItem: (name: string): void => { storage.delete(name); },
};

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatProvider =
  | 'openai' | 'anthropic' | 'google' | 'groq'
  | 'mistral' | 'openrouter' | 'together' | 'deepseek';

export type ImageProvider =
  | 'openai' | 'stability' | 'bfl' | 'replicate' | 'fal';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
  latencyMs?: number;
  tokens?: number;
}

export interface SavedApiKey {
  provider: string;
  apiKey: string;
  label: string;
  addedAt: number;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl?: string;
  imageBase64?: string;
  provider: string;
  model: string;
  latencyMs: number;
  timestamp: number;
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface ControlPanelState {
  // API Keys (persisted, per-provider)
  apiKeys: Record<string, string>;       // { 'openai': 'sk-...', 'anthropic': 'sk-ant-...' }

  // Chat state
  chatProvider: ChatProvider;
  chatModel: string;
  chatMessages: ChatMessage[];
  chatSystemPrompt: string;
  chatTemperature: number;
  chatMaxTokens: number;

  // Image gen state
  imageProvider: ImageProvider;
  imageModel: string;
  imageHistory: GeneratedImage[];

  // Actions
  setApiKey: (provider: string, key: string) => void;
  removeApiKey: (provider: string) => void;
  getApiKey: (provider: string) => string | null;

  setChatProvider: (provider: ChatProvider) => void;
  setChatModel: (model: string) => void;
  setChatSystemPrompt: (prompt: string) => void;
  setChatTemperature: (temp: number) => void;
  setChatMaxTokens: (tokens: number) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;

  setImageProvider: (provider: ImageProvider) => void;
  setImageModel: (model: string) => void;
  addGeneratedImage: (img: GeneratedImage) => void;
  clearImageHistory: () => void;
}

export const useControlPanelStore = create<ControlPanelState>()(
  persist(
    (set, get) => ({
      // Defaults
      apiKeys: {},

      chatProvider: 'openai',
      chatModel: 'gpt-4o-mini',
      chatMessages: [],
      chatSystemPrompt: 'You are a helpful assistant.',
      chatTemperature: 0.7,
      chatMaxTokens: 1024,

      imageProvider: 'openai',
      imageModel: 'dall-e-3',
      imageHistory: [],

      // API Key management
      setApiKey: (provider, key) => {
        set((s) => ({
          apiKeys: { ...s.apiKeys, [provider]: key },
        }));
      },
      removeApiKey: (provider) => {
        set((s) => {
          const next = { ...s.apiKeys };
          delete next[provider];
          return { apiKeys: next };
        });
      },
      getApiKey: (provider) => get().apiKeys[provider] || null,

      // Chat
      setChatProvider: (provider) => set({ chatProvider: provider }),
      setChatModel: (model) => set({ chatModel: model }),
      setChatSystemPrompt: (prompt) => set({ chatSystemPrompt: prompt }),
      setChatTemperature: (temp) => set({ chatTemperature: temp }),
      setChatMaxTokens: (tokens) => set({ chatMaxTokens: tokens }),
      addChatMessage: (msg) => {
        set((s) => ({ chatMessages: [...s.chatMessages, msg] }));
      },
      clearChat: () => set({ chatMessages: [] }),

      // Image
      setImageProvider: (provider) => set({ imageProvider: provider }),
      setImageModel: (model) => set({ imageModel: model }),
      addGeneratedImage: (img) => {
        set((s) => ({
          imageHistory: [img, ...s.imageHistory].slice(0, 50), // keep last 50
        }));
      },
      clearImageHistory: () => set({ imageHistory: [] }),
    }),
    {
      name: 'circle-control-panel',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        chatProvider: state.chatProvider,
        chatModel: state.chatModel,
        chatSystemPrompt: state.chatSystemPrompt,
        chatTemperature: state.chatTemperature,
        chatMaxTokens: state.chatMaxTokens,
        imageProvider: state.imageProvider,
        imageModel: state.imageModel,
        // Don't persist messages or image history across sessions
      }),
    }
  )
);
