/**
 * Circle for Life — Translation Service
 *
 * Text-to-text translation using LLM providers via ControlPanelService.
 * Supports language detection and translation with configurable system prompts.
 */

import { ControlPanelService, ChatProvider, ProviderConfig } from './controlPanel.service.js';
import { systemPromptsDB } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_TRANSLATION_PROMPT } from './safety.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranslationRequest {
  text: string;
  sourceLang?: string;      // auto-detect if empty
  targetLang: string;       // e.g. 'Spanish', 'French', 'Hindi', 'en', 'es'
  provider: ChatProvider;
  apiKey: string;
  model?: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLang?: string;
  targetLang: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: string;
  provider: string;
  latencyMs: number;
}

// ─── Common Languages ────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'uk', name: 'Ukrainian' },
];

// ─── Translation Service ─────────────────────────────────────────────────────

export class TranslationService {
  /**
   * Translate text using an LLM provider.
   */
  static async translate(req: TranslationRequest): Promise<TranslationResult> {
    const { text, sourceLang, targetLang, provider, apiKey, model } = req;
    const startTime = Date.now();

    // Get system prompt from DB
    let systemPrompt = DEFAULT_TRANSLATION_PROMPT;
    try {
      const stored = await systemPromptsDB.findOne({ key: 'translation' });
      if (stored?.content) systemPrompt = stored.content;
    } catch { /* use default */ }

    const sourceLabel = sourceLang ? `from ${sourceLang} ` : '';
    const userMessage = `Translate the following text ${sourceLabel}to ${targetLang}:\n\n${text}`;

    try {
      const result = await ControlPanelService.chat({
        provider: { provider, apiKey, model } as ProviderConfig,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        maxTokens: 2048,
        temperature: 0.3, // Low temperature for accuracy
      });

      return {
        translatedText: result.content.trim(),
        detectedSourceLang: sourceLang || undefined,
        targetLang,
        provider: result.provider,
        model: result.model,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('Translation error:', error);
      throw {
        error: error.error || error.message || 'Translation failed',
        provider,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Detect the language of a text using an LLM.
   */
  static async detectLanguage(
    text: string,
    provider: ChatProvider,
    apiKey: string,
    model?: string,
  ): Promise<LanguageDetectionResult> {
    const startTime = Date.now();

    try {
      const result = await ControlPanelService.chat({
        provider: { provider, apiKey, model } as ProviderConfig,
        messages: [
          {
            role: 'system',
            content: 'You are a language detection expert. Identify the language of the given text. Respond with ONLY a JSON object: { "language": "English", "code": "en", "confidence": "high/medium/low" }. No other text.',
          },
          { role: 'user', content: text },
        ],
        maxTokens: 100,
        temperature: 0,
      });

      // Parse response
      try {
        const parsed = JSON.parse(result.content);
        return {
          language: parsed.language || 'Unknown',
          confidence: parsed.confidence || 'medium',
          provider: result.provider,
          latencyMs: Date.now() - startTime,
        };
      } catch {
        // Fallback: extract language name from text
        return {
          language: result.content.trim().substring(0, 30),
          confidence: 'low',
          provider: result.provider,
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      logger.error('Language detection error:', error);
      throw {
        error: error.error || error.message || 'Detection failed',
        provider,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
