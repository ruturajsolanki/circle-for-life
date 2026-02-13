/**
 * Circle for Life - Control Panel
 * Multi-provider AI playground for demo / testing.
 * Chat with any LLM and generate images with any provider using your own API keys.
 *
 * Tabs: Chat | Image | API Keys
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../config/api';
import {
  useControlPanelStore,
  ChatProvider,
  ImageProvider,
  ChatMessage,
} from '../store/controlPanelStore';

// ─── Provider/Model Data ────────────────────────────────────────────────────

const CHAT_PROVIDERS: { id: ChatProvider; label: string; models: string[] }[] = [
  { id: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o3-mini'] },
  { id: 'anthropic', label: 'Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  { id: 'google', label: 'Gemini', models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'groq', label: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'mistral', label: 'Mistral', models: ['mistral-large-latest', 'mistral-small-latest'] },
  { id: 'openrouter', label: 'OpenRouter', models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet'] },
  { id: 'together', label: 'Together', models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'] },
  { id: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
];

const IMAGE_PROVIDERS: { id: ImageProvider; label: string; models: string[] }[] = [
  { id: 'openai', label: 'DALL-E', models: ['dall-e-3', 'dall-e-2'] },
  { id: 'stability', label: 'Stability', models: ['stable-diffusion-xl-1024-v1-0'] },
  { id: 'bfl', label: 'Flux (BFL)', models: ['flux-pro-1.1', 'flux-dev'] },
  { id: 'replicate', label: 'Replicate', models: ['black-forest-labs/flux-schnell', 'black-forest-labs/flux-dev'] },
  { id: 'fal', label: 'fal.ai', models: ['fal-ai/flux/schnell', 'fal-ai/flux/dev'] },
];

type Tab = 'chat' | 'image' | 'keys';

// ─── Main Screen ────────────────────────────────────────────────────────────

export function ControlPanelScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Control Panel</Text>
        <Text style={styles.subtitle}>AI Playground</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['chat', 'image', 'keys'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => { setActiveTab(tab); Haptics.selectionAsync(); }}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'chat' ? 'Chat' : tab === 'image' ? 'Image Gen' : 'API Keys'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'chat' && <ChatTab />}
      {activeTab === 'image' && <ImageTab />}
      {activeTab === 'keys' && <ApiKeysTab />}
    </View>
  );
}

// ─── Chat Tab ───────────────────────────────────────────────────────────────

function ChatTab() {
  const {
    chatProvider, chatModel, chatMessages, chatSystemPrompt,
    chatTemperature, chatMaxTokens,
    setChatProvider, setChatModel, addChatMessage, clearChat,
    getApiKey,
  } = useControlPanelStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<FlatList>(null);

  const currentProviderData = CHAT_PROVIDERS.find((p) => p.id === chatProvider);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const apiKey = getApiKey(chatProvider);
    if (!apiKey) {
      Alert.alert('No API Key', `Add your ${chatProvider} API key in the API Keys tab first.`);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput('');
    setIsLoading(true);

    try {
      const messages = [
        ...(chatSystemPrompt ? [{ role: 'system' as const, content: chatSystemPrompt }] : []),
        ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const { data } = await apiClient.post('/control-panel/chat', {
        provider: chatProvider,
        apiKey,
        model: chatModel,
        messages,
        maxTokens: chatMaxTokens,
        temperature: chatTemperature,
      });

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: Date.now(),
        provider: data.provider,
        model: data.model,
        latencyMs: data.latencyMs,
        tokens: data.usage?.totalTokens,
      };
      addChatMessage(assistantMsg);
    } catch (error: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error?.response?.data?.error || error.message || 'Request failed'}`,
        timestamp: Date.now(),
        provider: chatProvider,
        model: chatModel,
      };
      addChatMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, chatProvider, chatModel, chatMessages, chatSystemPrompt, chatMaxTokens, chatTemperature, getApiKey, addChatMessage]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgAssistant]}>
        <Text style={[styles.msgText, isUser && styles.msgTextUser]}>{item.content}</Text>
        {item.latencyMs !== undefined && (
          <Text style={styles.msgMeta}>
            {item.model} · {item.latencyMs}ms{item.tokens ? ` · ${item.tokens} tokens` : ''}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.tabContent}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={120}
    >
      {/* Provider/Model Selector */}
      <View style={styles.selectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CHAT_PROVIDERS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => { setChatProvider(p.id); setChatModel(p.models[0]); }}
              style={[styles.chip, chatProvider === p.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, chatProvider === p.id && styles.chipTextActive]}>
                {p.label}
              </Text>
              {!getApiKey(p.id) && <View style={styles.chipDot} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Model Selector */}
      <View style={styles.selectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {currentProviderData?.models.map((m) => (
            <Pressable
              key={m}
              onPress={() => setChatModel(m)}
              style={[styles.chipSmall, chatModel === m && styles.chipSmallActive]}
            >
              <Text style={[styles.chipSmallText, chatModel === m && styles.chipSmallTextActive]}>
                {m.length > 25 ? m.split('/').pop() : m}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={clearChat} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </Pressable>
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={scrollRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatTitle}>Start a conversation</Text>
            <Text style={styles.emptyChatSub}>
              Select a provider, add your API key, and start chatting
            </Text>
          </View>
        }
      />

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#7DD3FC" />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.chatInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#636366"
          multiline
          maxLength={4000}
          editable={!isLoading}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
          style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Image Tab ──────────────────────────────────────────────────────────────

function ImageTab() {
  const {
    imageProvider, imageModel, imageHistory,
    setImageProvider, setImageModel, addGeneratedImage,
    getApiKey,
  } = useControlPanelStore();

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const currentProviderData = IMAGE_PROVIDERS.find((p) => p.id === imageProvider);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    const apiKey = getApiKey(imageProvider);
    if (!apiKey) {
      Alert.alert('No API Key', `Add your ${imageProvider} API key in the API Keys tab first.`);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);

    try {
      const { data } = await apiClient.post('/control-panel/image', {
        provider: imageProvider,
        apiKey,
        model: imageModel,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        width: 1024,
        height: 1024,
      });

      addGeneratedImage({
        id: Date.now().toString(),
        prompt: prompt.trim(),
        imageUrl: data.imageUrl,
        imageBase64: data.imageBase64,
        provider: data.provider,
        model: data.model,
        latencyMs: data.latencyMs,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      Alert.alert(
        'Generation Failed',
        error?.response?.data?.error || error.message || 'Something went wrong'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Provider Selector */}
      <View style={styles.selectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {IMAGE_PROVIDERS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => { setImageProvider(p.id); setImageModel(p.models[0]); }}
              style={[styles.chip, imageProvider === p.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, imageProvider === p.id && styles.chipTextActive]}>
                {p.label}
              </Text>
              {!getApiKey(p.id) && <View style={styles.chipDot} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Model Selector */}
      <View style={styles.selectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {currentProviderData?.models.map((m) => (
            <Pressable
              key={m}
              onPress={() => setImageModel(m)}
              style={[styles.chipSmall, imageModel === m && styles.chipSmallActive]}
            >
              <Text style={[styles.chipSmallText, imageModel === m && styles.chipSmallTextActive]}>
                {m.length > 25 ? m.split('/').pop() : m}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Prompt Input */}
      <TextInput
        style={styles.imagePromptInput}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe the image you want to create..."
        placeholderTextColor="#636366"
        multiline
        maxLength={2000}
      />
      <TextInput
        style={styles.negPromptInput}
        value={negativePrompt}
        onChangeText={setNegativePrompt}
        placeholder="Negative prompt (optional)..."
        placeholderTextColor="#48484A"
        maxLength={1000}
      />

      {/* Generate Button */}
      <Pressable
        onPress={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        style={[styles.generateBtn, (!prompt.trim() || isGenerating) && styles.generateBtnDisabled]}
      >
        {isGenerating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color="#0D0D0F" />
            <Text style={styles.generateBtnText}> Generating...</Text>
          </View>
        ) : (
          <Text style={styles.generateBtnText}>Generate Image</Text>
        )}
      </Pressable>

      {/* Image History */}
      {imageHistory.length > 0 && (
        <View style={styles.imageHistorySection}>
          <Text style={styles.sectionLabel}>Recent Generations</Text>
          {imageHistory.map((img) => (
            <View key={img.id} style={styles.imageCard}>
              {img.imageUrl ? (
                <Image
                  source={{ uri: img.imageUrl }}
                  style={styles.generatedImage}
                  contentFit="cover"
                />
              ) : img.imageBase64 ? (
                <Image
                  source={{ uri: img.imageBase64 }}
                  style={styles.generatedImage}
                  contentFit="cover"
                />
              ) : null}
              <Text style={styles.imagePromptText} numberOfLines={2}>
                {img.prompt}
              </Text>
              <Text style={styles.imageMeta}>
                {img.provider} / {img.model.length > 30 ? img.model.split('/').pop() : img.model} · {(img.latencyMs / 1000).toFixed(1)}s
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── API Keys Tab ───────────────────────────────────────────────────────────

function ApiKeysTab() {
  const { apiKeys, setApiKey, removeApiKey } = useControlPanelStore();
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');

  const allProviders = [
    ...CHAT_PROVIDERS.map((p) => ({ id: p.id, label: p.label, type: 'chat' as const })),
    ...IMAGE_PROVIDERS
      .filter((p) => !CHAT_PROVIDERS.find((c) => c.id === p.id)) // Avoid duplicate openai
      .map((p) => ({ id: p.id, label: p.label, type: 'image' as const })),
  ];

  const handleSave = (provider: string) => {
    if (keyInput.trim()) {
      setApiKey(provider, keyInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditingProvider(null);
    setKeyInput('');
  };

  const handleRemove = (provider: string) => {
    Alert.alert('Remove API Key', `Remove the ${provider} API key?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeApiKey(provider),
      },
    ]);
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.keysDescription}>
        Add your own API keys to use different AI providers. Keys are stored locally on your device and sent directly to the provider.
      </Text>

      {allProviders.map((p) => {
        const hasKey = !!apiKeys[p.id];
        const isEditing = editingProvider === p.id;

        return (
          <View key={p.id} style={styles.keyRow}>
            <View style={styles.keyRowHeader}>
              <View style={styles.keyRowLeft}>
                <View style={[styles.keyDot, hasKey ? styles.keyDotActive : styles.keyDotInactive]} />
                <Text style={styles.keyLabel}>{p.label}</Text>
                <Text style={styles.keyType}>{p.type}</Text>
              </View>
              {hasKey && !isEditing ? (
                <View style={styles.keyActions}>
                  <Text style={styles.keySet}>Set</Text>
                  <Pressable onPress={() => handleRemove(p.id)} style={styles.keyRemoveBtn}>
                    <Text style={styles.keyRemoveText}>Remove</Text>
                  </Pressable>
                </View>
              ) : !isEditing ? (
                <Pressable
                  onPress={() => { setEditingProvider(p.id); setKeyInput(''); }}
                  style={styles.keyAddBtn}
                >
                  <Text style={styles.keyAddText}>Add Key</Text>
                </Pressable>
              ) : null}
            </View>

            {isEditing && (
              <View style={styles.keyEditRow}>
                <TextInput
                  style={styles.keyInput}
                  value={keyInput}
                  onChangeText={setKeyInput}
                  placeholder={`Paste your ${p.label} API key...`}
                  placeholderTextColor="#636366"
                  autoFocus
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.keyEditActions}>
                  <Pressable
                    onPress={() => { setEditingProvider(null); setKeyInput(''); }}
                    style={styles.keyCancelBtn}
                  >
                    <Text style={styles.keyCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSave(p.id)}
                    disabled={!keyInput.trim()}
                    style={[styles.keySaveBtn, !keyInput.trim() && { opacity: 0.5 }]}
                  >
                    <Text style={styles.keySaveText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.keysFooter}>
        <Text style={styles.keysFooterText}>
          Your API keys never leave your device except to make direct requests to the provider's API through our backend proxy.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0F' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#8E8E93', fontSize: 14, marginTop: 2 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: 'rgba(125, 211, 252, 0.15)' },
  tabText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#7DD3FC' },
  tabContent: { flex: 1, paddingHorizontal: 16 },

  // Selectors
  selectorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chipScroll: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: 'rgba(125, 211, 252, 0.2)' },
  chipText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#7DD3FC' },
  chipDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FF6B6B',
    marginLeft: 6,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    marginRight: 6,
  },
  chipSmallActive: { backgroundColor: 'rgba(125, 211, 252, 0.15)' },
  chipSmallText: { color: '#636366', fontSize: 11, fontWeight: '500' },
  chipSmallTextActive: { color: '#7DD3FC' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },

  // Chat Messages
  messageList: { flex: 1 },
  messageListContent: { paddingVertical: 8 },
  msgBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  msgUser: {
    backgroundColor: '#7DD3FC',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  msgAssistant: {
    backgroundColor: '#1C1C1E',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  msgText: { color: '#E5E5EA', fontSize: 15, lineHeight: 21 },
  msgTextUser: { color: '#0D0D0F' },
  msgMeta: { color: '#636366', fontSize: 10, marginTop: 4, textAlign: 'right' },

  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyChatTitle: { color: '#E5E5EA', fontSize: 18, fontWeight: '600' },
  emptyChatSub: { color: '#636366', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  loadingText: { color: '#8E8E93', fontSize: 13, marginLeft: 8 },

  // Input Row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#7DD3FC',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#0D0D0F', fontWeight: '700', fontSize: 14 },

  // Image Tab
  imagePromptInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  negPromptInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 16,
  },
  generateBtn: {
    backgroundColor: '#7DD3FC',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText: { color: '#0D0D0F', fontSize: 16, fontWeight: '700' },
  generatingRow: { flexDirection: 'row', alignItems: 'center' },

  imageHistorySection: { marginTop: 8 },
  sectionLabel: { color: '#8E8E93', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  imageCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#2C2C2E',
  },
  imagePromptText: { color: '#E5E5EA', fontSize: 14, paddingHorizontal: 12, paddingTop: 10 },
  imageMeta: { color: '#636366', fontSize: 11, padding: 12, paddingTop: 4 },

  // API Keys Tab
  keysDescription: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  keyRow: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  keyRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyDot: { width: 10, height: 10, borderRadius: 5 },
  keyDotActive: { backgroundColor: '#34C759' },
  keyDotInactive: { backgroundColor: '#48484A' },
  keyLabel: { color: '#E5E5EA', fontSize: 15, fontWeight: '600' },
  keyType: {
    color: '#636366',
    fontSize: 10,
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  keyActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  keySet: { color: '#34C759', fontSize: 12, fontWeight: '600' },
  keyRemoveBtn: {},
  keyRemoveText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  keyAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(125, 211, 252, 0.15)',
    borderRadius: 8,
  },
  keyAddText: { color: '#7DD3FC', fontSize: 12, fontWeight: '600' },
  keyEditRow: { marginTop: 12 },
  keyInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  keyEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  keyCancelBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  keyCancelText: { color: '#8E8E93', fontWeight: '600' },
  keySaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#7DD3FC',
    borderRadius: 8,
  },
  keySaveText: { color: '#0D0D0F', fontWeight: '700' },
  keysFooter: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
  },
  keysFooterText: { color: '#48484A', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
