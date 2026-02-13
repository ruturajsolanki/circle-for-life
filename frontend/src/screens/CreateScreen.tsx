/**
 * Circle for Life - Image Generation Screen
 * Prompt input, model selector, enhanced prompt display, generation status
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGeneration, GenerationModel } from '../hooks/useGeneration';
import { useGemStore } from '../store/gemStore';
import { GemBadge } from '../components/GemBadge';
import { enhancePrompt } from '../services/onDeviceAI';

const MODELS: { id: GenerationModel; label: string }[] = [
  { id: 'sdxl-turbo', label: 'SDXL Turbo' },
  { id: 'flux', label: 'Flux' },
  { id: 'midjourney', label: 'Midjourney' },
];

export function CreateScreen() {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<GenerationModel>('sdxl-turbo');

  const { balance, multiplier } = useGemStore();
  const {
    job,
    isComplete,
    isFailed,
    isProcessing,
    createGeneration,
    retryGeneration,
    reset,
  } = useGeneration(jobId);

  const handleEnhance = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const result = await enhancePrompt({ prompt: prompt.trim() });
      setRefinedPrompt(result.refinedPrompt);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    const textToUse = refinedPrompt ?? prompt.trim();
    if (!textToUse) return;

    try {
      const result = await createGeneration({
        prompt: prompt.trim(),
        refinedPrompt: refinedPrompt ?? undefined,
        model: selectedModel,
      });
      setJobId(result.jobId);
    } catch {
      // Handle error (insufficient gems, rate limit, etc.)
    }
  };

  const handleRetry = async () => {
    if (!job?.jobId) return;
    try {
      const result = await retryGeneration(job.jobId);
      setJobId(result.jobId);
    } catch {
      // Handle error
    }
  };

  const handleReset = () => {
    setJobId(null);
    setRefinedPrompt(null);
    reset();
  };

  const displayPrompt = refinedPrompt ?? prompt;
  const canGenerate = prompt.trim().length > 0 && !isProcessing;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create</Text>
          <GemBadge count={balance} multiplier={multiplier} showMultiplier />
        </View>

        {/* Result / Preview */}
        {job && (
          <View style={styles.resultSection}>
            {isProcessing && (
              <View style={[styles.imagePlaceholder, styles.placeholderLoading]}>
                <ActivityIndicator size="large" color="#7DD3FC" />
                <Text style={styles.statusText}>
                  {job.status === 'queued' ? 'Queued...' : 'Generating...'}
                </Text>
                {job.estimatedWaitMs && (
                  <Text style={styles.waitText}>
                    ~{Math.ceil(job.estimatedWaitMs / 1000)}s
                  </Text>
                )}
              </View>
            )}
            {isComplete && job.imageUrl && (
              <Image
                source={{ uri: job.imageUrl }}
                style={styles.resultImage}
                contentFit="cover"
              />
            )}
            {isFailed && (
              <View style={[styles.imagePlaceholder, styles.placeholderError]}>
                <Text style={styles.errorText}>Generation failed</Text>
                <Pressable style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            )}
            {(isComplete || isFailed) && (
              <Pressable style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Create another</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Prompt input */}
        {!job || isProcessing ? (
          <>
            <View style={styles.inputSection}>
              <TextInput
                style={styles.input}
                placeholder="Describe your image..."
                placeholderTextColor="#636366"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                maxLength={500}
                editable={!isProcessing}
              />
              <View style={styles.inputActions}>
                <Pressable
                  onPress={handleEnhance}
                  disabled={!prompt.trim() || isEnhancing || isProcessing}
                  style={[
                    styles.enhanceButton,
                    (!prompt.trim() || isEnhancing || isProcessing) &&
                      styles.enhanceButtonDisabled,
                  ]}
                >
                  {isEnhancing ? (
                    <ActivityIndicator size="small" color="#7DD3FC" />
                  ) : (
                    <Text style={styles.enhanceButtonText}>Enhance</Text>
                  )}
                </Pressable>
                <Text style={styles.charCount}>{prompt.length}/500</Text>
              </View>
            </View>

            {refinedPrompt && (
              <View style={styles.enhancedSection}>
                <Text style={styles.enhancedLabel}>Enhanced prompt</Text>
                <Text style={styles.enhancedText}>{refinedPrompt}</Text>
              </View>
            )}

            <View style={styles.modelSection}>
              <Text style={styles.modelLabel}>Model</Text>
              <View style={styles.modelGrid}>
                {MODELS.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedModel(m.id)}
                    style={[
                      styles.modelChip,
                      selectedModel === m.id && styles.modelChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modelChipText,
                        selectedModel === m.id && styles.modelChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={handleGenerate}
              disabled={!canGenerate}
              style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#0D0D0F" />
              ) : (
                <Text style={styles.generateButtonText}>Generate</Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  resultSection: {
    marginBottom: 24,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderLoading: {
    backgroundColor: '#1C1C1E',
  },
  placeholderError: {
    backgroundColor: '#1C1C1E',
  },
  resultImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
  },
  statusText: {
    color: '#E5E5EA',
    fontSize: 16,
    marginTop: 12,
  },
  waitText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 12,
    alignSelf: 'center',
  },
  resetButtonText: {
    color: '#7DD3FC',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  enhanceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(125, 211, 252, 0.2)',
    borderRadius: 8,
  },
  enhanceButtonDisabled: {
    opacity: 0.5,
  },
  enhanceButtonText: {
    color: '#7DD3FC',
    fontWeight: '600',
  },
  charCount: {
    color: '#636366',
    fontSize: 12,
  },
  enhancedSection: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  enhancedLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  enhancedText: {
    color: '#E5E5EA',
    fontSize: 14,
    lineHeight: 20,
  },
  modelSection: {
    marginBottom: 24,
  },
  modelLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modelGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  modelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
  },
  modelChipActive: {
    backgroundColor: 'rgba(125, 211, 252, 0.2)',
  },
  modelChipText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  modelChipTextActive: {
    color: '#7DD3FC',
  },
  generateButton: {
    backgroundColor: '#7DD3FC',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    color: '#0D0D0F',
    fontSize: 18,
    fontWeight: '700',
  },
});
