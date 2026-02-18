/**
 * Circle for Life — AI Agent Call Center Routes
 *
 * Handles:
 * - AI agent definitions (Luna, Atlas, Nova, Sage)
 * - Call session management (start, message, end)
 * - LLM integration for conversational AI responses
 * - ElevenLabs TTS for agent voice output
 * - Supervisor agent analysis (safety, escalation)
 * - Twilio escalation to real phone
 * - Call history and admin monitoring
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHmac } from 'crypto';
import axios from 'axios';
import twilio from 'twilio';
import { localAuthenticate, requirePermission } from '../middleware/rbac.middleware.js';
import { ControlPanelService, type ChatMessage, type ProviderConfig } from '../services/controlPanel.service.js';
import { logger } from '../utils/logger.js';

const { jwt: { AccessToken } } = twilio;
const VoiceGrant = AccessToken.VoiceGrant;

// ─── Twilio Webhook Signature Validation ─────────────────────────────────────

/** Ensure webhook URLs use HTTPS in production to prevent man-in-the-middle */
function getSecureServerUrl(): string {
  let url = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
  // In production (non-localhost), force HTTPS
  if (!url.includes('localhost') && !url.includes('127.0.0.1') && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

function validateTwilioSignature(request: any): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    // If no auth token configured, allow (dev mode)
    logger.warn('TWILIO_AUTH_TOKEN not set — skipping webhook signature validation');
    return true;
  }

  const signature = request.headers['x-twilio-signature'];
  if (!signature) {
    logger.warn('Twilio webhook missing X-Twilio-Signature header');
    return false;
  }

  // Build the full URL Twilio used to reach us (must match what Twilio sends to)
  // Twilio signs the FULL URL including query params for POST requests
  const serverUrl = getSecureServerUrl();
  const fullUrl = serverUrl + request.url;

  // Get POST parameters sorted alphabetically
  const body = request.body || {};
  const params = Object.keys(body).sort().reduce((acc: string, key: string) => acc + key + body[key], '');

  // Compute expected signature: HMAC-SHA1 of URL + sorted params, base64-encoded
  const expected = createHmac('sha1', authToken)
    .update(fullUrl + params)
    .digest('base64');

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Agent Definitions ───────────────────────────────────────────────────────

export interface AgentDef {
  id: string;
  name: string;
  specialty: string;
  description: string;
  avatar: string;        // emoji
  color1: string;        // gradient start
  color2: string;        // gradient end
  voiceId: string;       // ElevenLabs voice ID
  voiceName: string;
  deepgramVoice: string; // Deepgram Aura voice model
  systemPrompt: string;
  greeting: string;      // First message when call starts
}

const AGENTS: AgentDef[] = [
  {
    id: 'luna',
    name: 'Luna',
    specialty: 'Emotional Support',
    description: 'A calm and empathetic listener who provides emotional support, active listening, and gentle guidance through difficult moments.',
    avatar: '🌙',
    color1: '#8B5CF6',
    color2: '#6366F1',
    voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
    voiceName: 'Rachel',
    deepgramVoice: 'aura-asteria-en',
    systemPrompt: `You are Luna, an emotional support AI agent for the Circle for Life platform. Your personality:
- Deeply empathetic, warm, and gentle
- Use active listening: reflect back what the user says, validate their feelings
- Never dismiss or minimize emotions
- Ask thoughtful follow-up questions
- Offer coping strategies when appropriate, but prioritize listening first
- Use a calm, reassuring tone
- If someone expresses self-harm or danger, gently encourage professional help
- Keep responses conversational and natural (2-4 sentences max for voice)
- Address the user warmly, use encouraging phrases

LANGUAGE: Detect the language the user is speaking. Always respond in the SAME language as the user. If they speak Hindi, respond in Hindi. If they speak Spanish, respond in Spanish. If unsure, respond in English. Be natural in whatever language you use.

VOICE FORMAT: You are on a voice call. Your text will be read aloud by a text-to-speech engine. NEVER use asterisks, action markers, or stage directions like *gentle tone*, *soothing voice*, *smiles*, etc. Just speak naturally. Keep responses concise (2-4 sentences max).`,
    greeting: "Hi there, I'm Luna. I'm here to listen and support you. How are you feeling today?",
  },
  {
    id: 'atlas',
    name: 'Atlas',
    specialty: 'Tech Support',
    description: 'A patient and knowledgeable tech expert who helps with troubleshooting, coding questions, and technical guidance step-by-step.',
    avatar: '⚡',
    color1: '#3B82F6',
    color2: '#1D4ED8',
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam
    voiceName: 'Adam',
    deepgramVoice: 'aura-orion-en',
    systemPrompt: `You are Atlas, a tech support AI agent for the Circle for Life platform. Your personality:
- Patient, methodical, and knowledgeable
- Break down complex problems into simple steps
- Ask clarifying questions before jumping to solutions
- Explain technical concepts in accessible language
- Provide step-by-step troubleshooting
- Cover: coding, software issues, platform help, general tech questions
- Be encouraging when users struggle with technical concepts
- Keep responses concise for voice (2-4 sentences max)

LANGUAGE: Detect the language the user is speaking. Always respond in the SAME language as the user. If they speak Hindi, respond in Hindi. If they speak Spanish, respond in Spanish. If unsure, respond in English. Be natural in whatever language you use.

VOICE FORMAT: You are on a voice call. Your text will be read aloud by a text-to-speech engine. NEVER use asterisks, action markers, or stage directions like *pauses*, *nods*, etc. Just speak naturally. Be clear, structured, and brief. Number your steps when giving instructions.`,
    greeting: "Hey, I'm Atlas, your tech support specialist. What technical issue can I help you solve today?",
  },
  {
    id: 'nova',
    name: 'Nova',
    specialty: 'General Assistant',
    description: 'A friendly and energetic helper who assists with general questions, platform navigation, FAQs, and everyday tasks.',
    avatar: '✨',
    color1: '#F59E0B',
    color2: '#D97706',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
    voiceName: 'Bella',
    deepgramVoice: 'aura-luna-en',
    systemPrompt: `You are Nova, a general assistant AI agent for the Circle for Life platform. Your personality:
- Friendly, upbeat, and enthusiastic
- Helpful and resourceful — always ready to find an answer
- Great at explaining how things work on the platform
- Can help with: account questions, feature explanations, general knowledge, quick tasks
- Keep the conversation light and engaging
- If you don't know something, be honest and suggest alternatives
- Keep responses natural and concise for voice (2-4 sentences max)

LANGUAGE: Detect the language the user is speaking. Always respond in the SAME language as the user. If they speak Hindi, respond in Hindi. If they speak Spanish, respond in Spanish. If unsure, respond in English. Be natural in whatever language you use.

VOICE FORMAT: You are on a voice call. Your text will be read aloud by a text-to-speech engine. NEVER use asterisks, action markers, or stage directions like *laughs*, *smiles*, etc. Just speak naturally. Be energetic but clear. Keep it conversational.`,
    greeting: "Hey! I'm Nova, your go-to assistant. I'm here to help with anything you need. What can I do for you?",
  },
  {
    id: 'sage',
    name: 'Sage',
    specialty: 'Career & Life Coach',
    description: 'A wise and motivational coach who helps with career planning, goal setting, personal growth, and life decisions.',
    avatar: '🧭',
    color1: '#10B981',
    color2: '#059669',
    voiceId: 'ErXwobaYiN019PkySvjV', // Antoni
    voiceName: 'Antoni',
    deepgramVoice: 'aura-perseus-en',
    systemPrompt: `You are Sage, a career and life coaching AI agent for the Circle for Life platform. Your personality:
- Wise, motivational, and insightful
- Ask powerful, thought-provoking questions
- Help users clarify goals and create actionable plans
- Cover: career planning, skill development, work-life balance, personal growth, decision-making
- Use frameworks (SMART goals, pros/cons) when helpful
- Celebrate user strengths and progress
- Challenge limiting beliefs gently
- Keep responses impactful and concise for voice (2-4 sentences max)

LANGUAGE: Detect the language the user is speaking. Always respond in the SAME language as the user. If they speak Hindi, respond in Hindi. If they speak Spanish, respond in Spanish. If unsure, respond in English. Be natural in whatever language you use.

VOICE FORMAT: You are on a voice call. Your text will be read aloud by a text-to-speech engine. NEVER use asterisks, action markers, or stage directions like *thoughtfully*, *nods*, etc. Just speak naturally. Be inspiring but practical. Ask one powerful question at a time.`,
    greeting: "Welcome, I'm Sage. I'm here to help you navigate your career and personal growth journey. What's on your mind today?",
  },
];

// ─── Supervisor Agent Prompt ─────────────────────────────────────────────────

const SUPERVISOR_SYSTEM_PROMPT = `You are a call quality supervisor AI. You analyze conversation exchanges between a user and an AI support agent.

For each exchange, output a JSON object with EXACTLY this structure (no extra text):
{
  "escalationNeeded": false,
  "reason": "",
  "severity": "low",
  "sentiment": "neutral",
  "flags": []
}

Rules:
- "severity": "low" (normal), "medium" (concerning), "high" (urgent/dangerous)
- "sentiment": "positive", "neutral", "negative", "frustrated", "distressed"
- "flags": array of detected issues, e.g. ["profanity", "self_harm", "threats", "off_topic", "frustrated", "agent_error"]
- Set "escalationNeeded": true if:
  - User explicitly requests a human ("talk to a real person", "let me speak to someone")
  - User expresses self-harm or danger
  - User is extremely frustrated after multiple exchanges
  - Agent cannot adequately address the concern
  - The topic requires real human judgment (legal, medical, financial advice)
- "reason": brief explanation when escalationNeeded is true

IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.`;

// ─── In-Memory Call Sessions ─────────────────────────────────────────────────
// For simplicity, keep active sessions in memory. Transcripts are also persisted to DB.

interface CallSession {
  id: string;
  userId: string;
  userName: string;
  agentId: string;
  status: 'active' | 'ended' | 'escalated';
  transcript: { role: 'user' | 'agent' | 'system'; text: string; timestamp: string }[];
  supervisorNotes: { severity: string; sentiment: string; flags: string[]; escalationNeeded: boolean; reason: string; timestamp: string }[];
  providerConfig: ProviderConfig | null;
  elevenLabsKey: string;
  startedAt: string;
  endedAt: string;
  summary: string;
  source: 'browser' | 'phone';  // Where the call originated
  callerPhone?: string;          // Phone number if from Twilio
  twilioCallSid?: string;        // Twilio Call SID for phone calls
  detectedLanguage?: string;     // Twilio locale code e.g. 'hi-IN', 'es-ES'
}

const activeSessions: Map<string, CallSession> = new Map();

// ─── Phone TTS Audio Cache ──────────────────────────────────────────────────
// Stores ElevenLabs audio buffers temporarily so Twilio can fetch them via <Play>

const audioCache: Map<string, { buffer: Buffer; createdAt: number }> = new Map();
const AUDIO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired audio every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of audioCache) {
    if (now - entry.createdAt > AUDIO_CACHE_TTL_MS) audioCache.delete(id);
  }
}, 2 * 60 * 1000);

/**
 * Generate ElevenLabs TTS audio for phone calls.
 * Returns a unique audio ID that can be served via /twilio/audio/:id.
 * Returns null if ElevenLabs is unavailable.
 */
async function generatePhoneTTS(text: string, voiceId: string): Promise<string | null> {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) return null;

  try {
    const ttsResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
        output_format: 'mp3_44100_64',
      },
      {
        headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        responseType: 'arraybuffer',
        timeout: 15000,
      },
    );
    const audioId = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    audioCache.set(audioId, { buffer: Buffer.from(ttsResp.data), createdAt: Date.now() });
    logger.info(`Phone TTS generated: ${audioId} (${text.substring(0, 50)}...)`);
    return audioId;
  } catch (e: any) {
    logger.error('Phone ElevenLabs TTS failed:', e.message);
    return null;
  }
}

// ─── Language Detection & Mapping ───────────────────────────────────────────

const LANG_TO_TWILIO_LOCALE: Record<string, string> = {
  english: 'en-US', hindi: 'hi-IN', spanish: 'es-ES', french: 'fr-FR',
  german: 'de-DE', italian: 'it-IT', portuguese: 'pt-BR', russian: 'ru-RU',
  chinese: 'zh-CN', japanese: 'ja-JP', korean: 'ko-KR', arabic: 'ar-SA',
  bengali: 'bn-IN', turkish: 'tr-TR', vietnamese: 'vi-VN', thai: 'th-TH',
  dutch: 'nl-NL', polish: 'pl-PL', swedish: 'sv-SE', ukrainian: 'uk-UA',
  tamil: 'ta-IN', telugu: 'te-IN', marathi: 'mr-IN', gujarati: 'gu-IN',
  kannada: 'kn-IN', malayalam: 'ml-IN', punjabi: 'pa-IN', urdu: 'ur-PK',
};

const TWILIO_LOCALE_TO_NEURAL_VOICE: Record<string, string> = {
  'en-US': 'Google.en-US-Neural2-F', 'hi-IN': 'Google.hi-IN-Neural2-A',
  'es-ES': 'Google.es-ES-Neural2-A', 'fr-FR': 'Google.fr-FR-Neural2-A',
  'de-DE': 'Google.de-DE-Neural2-C', 'it-IT': 'Google.it-IT-Neural2-A',
  'pt-BR': 'Google.pt-BR-Neural2-A', 'ja-JP': 'Google.ja-JP-Neural2-B',
  'ko-KR': 'Google.ko-KR-Neural2-A', 'zh-CN': 'Google.cmn-CN-Neural2-A',
  'ar-SA': 'Google.ar-XA-Neural2-A', 'ru-RU': 'Google.ru-RU-Neural2-A',
  'nl-NL': 'Google.nl-NL-Neural2-A', 'tr-TR': 'Google.tr-TR-Neural2-A',
};

function getFallbackVoice(locale?: string): string {
  if (locale && TWILIO_LOCALE_TO_NEURAL_VOICE[locale]) {
    return TWILIO_LOCALE_TO_NEURAL_VOICE[locale];
  }
  return 'Google.en-US-Neural2-F';
}

function detectLanguageFromText(text: string): string | null {
  const lower = text.toLowerCase();
  // Hindi detection (Devanagari script)
  if (/[\u0900-\u097F]/.test(text)) return 'hindi';
  // Arabic script
  if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) return 'chinese';
  // Japanese (Hiragana/Katakana)
  if (/[\u3040-\u30ff]/.test(text)) return 'japanese';
  // Korean (Hangul)
  if (/[\uac00-\ud7af]/.test(text)) return 'korean';
  // Bengali script
  if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
  // Tamil script
  if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
  // Telugu script
  if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
  // Gujarati script
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gujarati';
  // Cyrillic (Russian/Ukrainian)
  if (/[\u0400-\u04FF]/.test(text)) return 'russian';
  // Thai script
  if (/[\u0E00-\u0E7F]/.test(text)) return 'thai';
  // Common Spanish keywords
  if (/\b(hola|cómo|estás|gracias|buenos|buenas|sí|por favor|qué|dónde)\b/i.test(text)) return 'spanish';
  // Common French keywords
  if (/\b(bonjour|merci|comment|oui|s'il vous plaît|je suis|au revoir)\b/i.test(text)) return 'french';
  // Common German keywords
  if (/\b(hallo|danke|wie geht|bitte|guten|ich bin|ja|nein)\b/i.test(text)) return 'german';
  // Common Hindi in Roman script — require 2+ distinct Hindi words to avoid false positives
  const hindiRomanWords = ['namaste','kaise','hain','mujhe','theek','accha','dhanyavaad','bahut','kripya','aapka','kaisa','kaisi','suniye','bataiye','samajh'];
  const hindiMatches = hindiRomanWords.filter(function(w) { return new RegExp('\\b' + w + '\\b', 'i').test(lower); });
  if (hindiMatches.length >= 2) return 'hindi';
  return null;
}

/** Build TwiML <Say> or <Play> depending on whether ElevenLabs audio is available */
function buildTwimlSpeak(audioId: string | null, text: string, fallbackVoice: string, serverUrl: string): string {
  if (audioId) {
    return `<Play>${escapeXml(serverUrl)}/v1/agent-calls/twilio/audio/${audioId}</Play>`;
  }
  return `<Say voice="${escapeXml(fallbackVoice)}">${escapeXml(text)}</Say>`;
}

// ─── Persist helper ──────────────────────────────────────────────────────────

async function persistCallSession(session: CallSession, durationSec: number) {
  const { agentCallSessionsDB } = await import('../db/index.js');
  if (!agentCallSessionsDB) return;

  // Check if already persisted (avoid duplicates)
  try {
    const existing = await agentCallSessionsDB.findById(session.id);
    if (existing) {
      // Update instead of create
      await agentCallSessionsDB.updateById(session.id, {
        status: session.status,
        transcript: session.transcript,
        supervisorNotes: session.supervisorNotes || [],
        summary: session.summary || '',
        duration: durationSec,
        endedAt: session.endedAt || new Date().toISOString(),
      });
      return;
    }
  } catch { /* not found — create below */ }

  await agentCallSessionsDB.create({
    id: session.id,
    userId: session.userId,
    userName: session.userName || '',
    agentId: session.agentId,
    status: session.status,
    source: session.source || 'browser',
    callerPhone: session.callerPhone || '',
    transcript: session.transcript,
    supervisorNotes: session.supervisorNotes || [],
    summary: session.summary || '',
    duration: durationSec,
    escalatedTo: '',
    escalatedAt: '',
    createdAt: session.startedAt,
    endedAt: session.endedAt || new Date().toISOString(),
  });
  logger.info(`Call session ${session.id} persisted to DB (${session.source})`);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function agentCallRoutes(app: FastifyInstance) {

  // ═══ GET /agents — List all available AI agents ════════════════════════════
  app.get('/agents', {
    preHandler: [localAuthenticate],
  }, async () => {
    return {
      agents: AGENTS.map(a => ({
        id: a.id,
        name: a.name,
        specialty: a.specialty,
        description: a.description,
        avatar: a.avatar,
        color1: a.color1,
        color2: a.color2,
        voiceName: a.voiceName,
      })),
    };
  });

  // ═══ GET /deepgram-token — Return Deepgram API key for client-side STT/TTS ═
  app.get('/deepgram-token', {
    preHandler: [localAuthenticate],
  }, async (_request: any, reply) => {
    const key = process.env.DEEPGRAM_API_KEY || '';
    if (!key) {
      return reply.status(200).send({ key: '', available: false });
    }
    return reply.status(200).send({ key, available: true });
  });

  // ═══ POST /start — Start a call session ════════════════════════════════════
  app.post('/start', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const body = z.object({
      agentId: z.string(),
      provider: z.object({
        provider: z.string(),
        apiKey: z.string().optional(),
        model: z.string().optional(),
        baseUrl: z.string().optional(),
      }).optional(),
      elevenLabsKey: z.string().optional(),
    }).parse(request.body);

    const agent = AGENTS.find(a => a.id === body.agentId);
    if (!agent) return reply.status(404).send({ error: { message: 'Agent not found' } });

    const userId = request.userId;
    const user = request.user || request.userData || {};

    // Check if user already has an active session
    for (const [, sess] of activeSessions) {
      if (sess.userId === userId && sess.status === 'active') {
        return reply.status(409).send({ error: { message: 'You already have an active call. End it first.' } });
      }
    }

    const sessionId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const session: CallSession = {
      id: sessionId,
      userId,
      userName: user.displayName || user.username || 'User',
      agentId: body.agentId,
      status: 'active',
      transcript: [
        { role: 'agent', text: agent.greeting, timestamp: now },
      ],
      supervisorNotes: [],
      providerConfig: (() => {
        if (!body.provider || body.provider.provider === 'server_default') return getPhoneCallProvider();
        if (!body.provider.apiKey?.trim()) return getPhoneCallProvider();
        // If kaggle/ollama is specified but baseUrl looks invalid, fallback to server default
        const baseUrl = body.provider.baseUrl?.trim() || undefined;
        if (body.provider.provider === 'kaggle' && baseUrl) {
          try { new URL(baseUrl); } catch { return getPhoneCallProvider(); }
        }
        return {
          provider: body.provider.provider as any,
          apiKey: body.provider.apiKey.trim(),
          model: body.provider.model?.trim() || undefined,
          baseUrl,
        };
      })(),
      elevenLabsKey: body.elevenLabsKey || process.env.ELEVENLABS_API_KEY || '',
      startedAt: now,
      endedAt: '',
      summary: '',
      source: 'browser',
    };

    // Apply admin-panel model override to browser calls too
    if (process.env.PHONE_LLM_MODEL && session.providerConfig) {
      session.providerConfig.model = process.env.PHONE_LLM_MODEL;
    }

    logger.info(`Browser call provider: ${session.providerConfig?.provider || 'none'}, model=${session.providerConfig?.model || 'default'}, source=${body.provider?.provider === 'server_default' || !body.provider ? 'server_config' : 'client'}`);

    activeSessions.set(sessionId, session);

    // Resolve voice engine keys: Deepgram → ElevenLabs → Web Speech
    const deepgramKey = process.env.DEEPGRAM_API_KEY || '';
    const elevenKey = body.elevenLabsKey || process.env.ELEVENLABS_API_KEY || '';

    // Voice engine priority: Deepgram (best) → ElevenLabs → Web Speech fallback
    const voiceEngine = deepgramKey ? 'deepgram' : (elevenKey ? 'elevenlabs_client' : 'web_speech');

    logger.info(`Browser call started: agent=${agent.id}, voiceEngine=${voiceEngine}, deepgram=${deepgramKey ? 'available' : 'none'}, elevenLabs=${elevenKey ? 'available' : 'none'}`);

    return reply.status(201).send({
      sessionId,
      agent: {
        id: agent.id,
        name: agent.name,
        specialty: agent.specialty,
        avatar: agent.avatar,
        color1: agent.color1,
        color2: agent.color2,
        voiceId: agent.voiceId,
        voiceName: agent.voiceName,
        deepgramVoice: agent.deepgramVoice,
      },
      greeting: agent.greeting,
      elevenLabsKey: elevenKey,
      deepgramKey,
      deepgramVoice: agent.deepgramVoice,
      voiceEngine,
    });
  });

  // ═══ POST /:id/message — Send user message, get AI response + TTS ════════
  app.post('/:id/message', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const body = z.object({
      text: z.string().min(1).max(5000),
    }).parse(request.body);

    const session = activeSessions.get(id);
    if (!session) return reply.status(404).send({ error: { message: 'Call session not found' } });
    if (session.userId !== request.userId) return reply.status(403).send({ error: { message: 'Not your session' } });
    if (session.status !== 'active') return reply.status(400).send({ error: { message: 'Call has ended' } });

    const agent = AGENTS.find(a => a.id === session.agentId)!;
    const now = new Date().toISOString();

    // Add user message to transcript
    session.transcript.push({ role: 'user', text: body.text, timestamp: now });

    // Detect language from user's text (only switch if using non-Latin script detection)
    const detLang = detectLanguageFromText(body.text);
    if (detLang && detLang !== 'english') {
      // For browser calls, only switch language if we detect a non-Latin script
      // (Devanagari, Arabic, CJK, etc.) to avoid false positives from Roman-script keyword matching
      const nonLatinScripts = ['hindi', 'arabic', 'chinese', 'japanese', 'korean', 'bengali', 'tamil', 'telugu', 'gujarati', 'russian', 'thai'];
      const isScriptBased = /[\u0900-\u097F\u0600-\u06FF\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F\u0A80-\u0AFF\u0400-\u04FF\u0E00-\u0E7F]/.test(body.text);
      if (session.source === 'browser' && !isScriptBased) {
        // Browser call with Latin text — keep current language, don't switch on keyword-only detection
        logger.info(`Language hint: ${detLang} (keyword-only, not switching for browser call)`);
      } else {
        session.detectedLanguage = LANG_TO_TWILIO_LOCALE[detLang] || 'en-US';
        logger.info(`Language switched to: ${detLang} → ${session.detectedLanguage}`);
      }
    }

    // Build LLM messages
    const llmMessages: ChatMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      ...session.transcript
        .filter(t => t.role !== 'system')
        .map(t => ({
          role: t.role === 'agent' ? 'assistant' as const : 'user' as const,
          content: t.text,
        })),
    ];

    let responseText = '';
    let llmSucceeded = false;
    let llmError: any = null;

    const primaryProvider = (session.providerConfig && session.providerConfig.apiKey)
      ? session.providerConfig
      : null;

    // Try session/provider from request first.
    if (primaryProvider) {
      try {
        const resp = await ControlPanelService.chat({
          provider: primaryProvider,
          messages: llmMessages,
          maxTokens: 256,
          temperature: 0.7,
        });
        responseText = resp.content;
        llmSucceeded = true;
      } catch (e: any) {
        llmError = e;
        logger.error(`Agent LLM error (primary): ${e?.error || e?.message || 'unknown error'}`);
      }
    }

    // Fallback to server/default provider, even when provider name matches, as long as config differs.
    if (!llmSucceeded) {
      const fallback = getPhoneCallProvider();
      const canUseFallback = !!(fallback && fallback.apiKey) && !isSameProviderConfig(primaryProvider, fallback);
      if (canUseFallback && fallback) {
        try {
          logger.info(`Agent LLM fallback to ${fallback.provider}/${fallback.model || 'default'}`);
          const resp = await ControlPanelService.chat({
            provider: fallback,
            messages: llmMessages,
            maxTokens: 256,
            temperature: 0.7,
          });
          session.providerConfig = fallback;
          responseText = resp.content;
          llmSucceeded = true;
        } catch (e: any) {
          llmError = e;
          logger.error(`Agent LLM fallback failed: ${e?.error || e?.message || 'unknown error'}`);
        }
      } else if (!primaryProvider && !fallback) {
        responseText = "I'd love to help, but I need an AI provider to be configured. Please set up an API key in the settings to enable my full capabilities.";
      }
    }

    if (!llmSucceeded && !responseText) {
      responseText = formatLlmUserMessage(llmError);
    }

    // Strip action markers like *gentle tone*, *smiles*, etc. that LLMs sometimes add
    responseText = responseText.replace(/\*[^*]{1,40}\*/g, '').replace(/\s{2,}/g, ' ').trim();

    // Add agent response to transcript
    const agentTime = new Date().toISOString();
    session.transcript.push({ role: 'agent', text: responseText, timestamp: agentTime });

    // For browser calls, TTS is handled CLIENT-SIDE to avoid cloud IP blocks on ElevenLabs free tier.
    // We just pass the voiceId so the frontend can generate TTS directly from user's browser.
    const voiceId = agent.voiceId;

    // Run supervisor analysis and check for auto-escalation
    let autoEscalated = false;
    let autoEscalationMessage = '';
    if (llmSucceeded) {
      try {
        await supervisorAnalyze(session, body.text, responseText);

        // Check if supervisor flagged high-severity escalation
        const latest = session.supervisorNotes.length > 0
          ? session.supervisorNotes[session.supervisorNotes.length - 1]
          : null;

        if (latest && latest.escalationNeeded && latest.severity === 'high' && session.status === 'active') {
          // Auto-escalate: the supervisor detected urgent need for a real human
          logger.info(`AUTO-ESCALATION triggered for session ${id}: ${latest.reason}`);

          const escalationResult = await triggerTwilioEscalation(session, agent);
          autoEscalated = true;
          session.status = 'escalated';

          // Add a compassionate system message
          const systemMsg = latest.flags?.includes('self_harm')
            ? "I can hear you're going through something really serious. I've connected you with a real person who can help. They're being notified right now and will reach out to you shortly. You're not alone."
            : "I can tell this is really important to you, and I want to make sure you get the best help possible. I've connected you with a real person who's being notified right now. They'll be in touch shortly.";

          session.transcript.push({ role: 'system', text: systemMsg, timestamp: new Date().toISOString() });
          autoEscalationMessage = systemMsg;

          logger.info(`Auto-escalation complete for session ${id}: ${escalationResult}`);
        }
      } catch (e: any) {
        // Supervisor/escalation errors shouldn't break the message flow
        logger.error('Supervisor/auto-escalation error:', e.message || e);
      }
    }

    return {
      text: responseText,
      voiceId,
      deepgramVoice: agent.deepgramVoice,
      transcript: session.transcript,
      supervisorAlert: getLatestSupervisorAlert(session),
      autoEscalated,
      autoEscalationMessage,
      detectedLanguage: session.detectedLanguage || 'en-US',
    };
  });

  // ═══ POST /:id/end — End call session ═════════════════════════════════════
  app.post('/:id/end', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const session = activeSessions.get(id);
    if (!session) return reply.status(404).send({ error: { message: 'Session not found' } });
    if (session.userId !== request.userId) return reply.status(403).send({ error: { message: 'Not your session' } });

    session.status = 'ended';
    session.endedAt = new Date().toISOString();

    // Generate summary
    if (session.providerConfig && session.providerConfig.apiKey) {
      try {
        const summaryResp = await ControlPanelService.chat({
          provider: session.providerConfig,
          messages: [
            { role: 'system', content: 'Summarize this call transcript in 1-2 sentences. Be concise.' },
            { role: 'user', content: session.transcript.map(t => `${t.role}: ${t.text}`).join('\n') },
          ],
          maxTokens: 100,
          temperature: 0.3,
        });
        session.summary = summaryResp.content;
      } catch { session.summary = 'Call completed.'; }
    } else {
      session.summary = 'Call completed.';
    }

    // Calculate duration
    const durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    const durationSec = Math.floor(durationMs / 1000);

    // Persist to DB (best effort) — store in agent_call_sessions
    try {
      await persistCallSession(session, durationSec);
    } catch (e: any) {
      logger.error('Failed to persist call session:', e.message);
    }

    // Clean up from memory after a delay
    setTimeout(() => activeSessions.delete(id), 60000);

    return {
      sessionId: id,
      status: 'ended',
      duration: durationSec,
      summary: session.summary,
      messageCount: session.transcript.length,
    };
  });

  // ═══ POST /admin/force-end/:id — Admin force-end a stuck call ═════════════
  app.post('/admin/force-end/:id', {
    preHandler: [localAuthenticate, requirePermission('system.config')],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const session = activeSessions.get(id);
    if (!session) return reply.status(404).send({ error: { message: 'Session not found or already cleaned up' } });

    if (session.status !== 'active') {
      return reply.status(400).send({ error: { message: `Session already ${session.status}` } });
    }

    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    session.summary = `Force-ended by admin (${request.userData?.username || 'unknown'}).`;

    // Calculate duration
    const durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    const durationSec = Math.floor(durationMs / 1000);

    // Persist to DB
    try { await persistCallSession(session, durationSec); } catch (e: any) {
      logger.error('Failed to persist force-ended session:', e.message);
    }

    // Clean up from memory after a delay
    setTimeout(() => activeSessions.delete(id), 30000);

    logger.info(`Admin ${request.userData?.username} force-ended call session ${id}`);

    return {
      sessionId: id,
      status: 'ended',
      duration: durationSec,
      message: 'Call force-ended successfully',
    };
  });

  // ═══ GET /:id/transcript — Get full transcript ════════════════════════════
  app.get('/:id/transcript', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const session = activeSessions.get(id);
    if (!session) return reply.status(404).send({ error: { message: 'Session not found' } });

    const isAdmin = request.userData?.role === 'admin' || request.userData?.role === 'super_admin';
    if (session.userId !== request.userId && !isAdmin) {
      return reply.status(403).send({ error: { message: 'Not authorized' } });
    }

    return {
      sessionId: id,
      agentId: session.agentId,
      status: session.status,
      transcript: session.transcript,
      supervisorNotes: isAdmin ? session.supervisorNotes : [],
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    };
  });

  // ═══ POST /:id/escalate — Trigger escalation with live voice bridge ═════
  app.post('/:id/escalate', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const session = activeSessions.get(id);
    if (!session) return reply.status(404).send({ error: { message: 'Session not found' } });
    if (session.userId !== request.userId) return reply.status(403).send({ error: { message: 'Not your session' } });

    session.status = 'escalated';
    const agent = AGENTS.find(a => a.id === session.agentId)!;

    // Try live voice bridge first, fall back to notification-only
    const voiceResources = await ensureTwilioVoiceResources();
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;

    if (voiceResources && twilioSid && twilioToken && twilioFrom && adminPhone) {
      try {
        const conferenceName = `escalation_${id}_${Date.now()}`;
        escalationConferences.set(id, { conferenceName, userConnected: false, adminConnected: false });

        // Generate access token for the browser user
        const accessToken = new AccessToken(twilioSid, voiceResources.apiKeySid, voiceResources.apiKeySecret, {
          identity: `user_${session.userId}_${id}`,
          ttl: 3600,
        });
        accessToken.addGrant(new VoiceGrant({
          outgoingApplicationSid: voiceResources.twimlAppSid,
          incomingAllow: false,
        }));

        // Call the admin's phone and connect to the conference
        const serverUrl = getSecureServerUrl();
        const client = twilio(twilioSid, twilioToken);
        const adminCall = await client.calls.create({
          to: adminPhone,
          from: twilioFrom,
          twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Incoming escalation from Circle for Life. User ${escapeXml(session.userName)} was speaking with ${escapeXml(agent.name)}. Connecting you now.</Say><Dial><Conference waitUrl="" beep="true" startConferenceOnEnter="true" endConferenceOnExit="true">${escapeXml(conferenceName)}</Conference></Dial></Response>`,
          statusCallback: serverUrl ? `${serverUrl}/v1/agent-calls/escalate/admin-status?session=${encodeURIComponent(id)}` : undefined,
          statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
        });

        escalationConferences.get(id)!.adminCallSid = adminCall.sid;
        logger.info(`Live bridge: admin call placed (SID=${adminCall.sid}), conference=${conferenceName}`);

        session.transcript.push({
          role: 'system',
          text: 'Live voice bridge initiated. Admin is being called and will be connected directly.',
          timestamp: new Date().toISOString(),
        });

        return {
          status: 'escalated',
          method: 'live_bridge',
          conferenceName,
          twilioToken: accessToken.toJwt(),
          message: 'Calling admin now. You will be connected directly when they pick up.',
        };
      } catch (e: any) {
        logger.error('Live bridge failed, falling back to notification:', e.message);
        escalationConferences.delete(id);
      }
    }

    // Fallback: old notification-only escalation
    const escalationResult = await triggerTwilioEscalation(session, agent);
    session.transcript.push({
      role: 'system',
      text: `Call escalated to human support. ${escalationResult === 'twilio_call_placed' ? 'An admin has been notified via phone call.' : 'An admin notification has been sent.'}`,
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'escalated',
      method: escalationResult,
      message: escalationResult === 'twilio_call_placed'
        ? 'A human support agent has been notified and will connect with you shortly.'
        : 'Your request has been escalated. An admin will review your case.',
    };
  });

  // ═══ POST /escalate/voice-webhook — TwiML for browser user joining conference ═
  app.post('/escalate/voice-webhook', async (request: any, reply) => {
    const body = request.body as any;
    const sessionId = body?.sessionId || '';
    const conf = escalationConferences.get(sessionId);

    if (!conf) {
      logger.warn('Voice webhook: no conference found for session', sessionId);
      return reply.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>No active escalation found.</Say></Response>');
    }

    conf.userConnected = true;
    logger.info(`Voice webhook: user joined conference ${conf.conferenceName}`);

    return reply.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Connecting you to the admin now. Please hold.</Say><Dial><Conference waitUrl="" beep="true" startConferenceOnEnter="true">${escapeXml(conf.conferenceName)}</Conference></Dial></Response>`
    );
  });

  // ═══ POST /escalate/admin-status — Admin call status callback ══════════════
  app.post('/escalate/admin-status', async (request: any, reply) => {
    const body = request.body as any;
    const sessionId = (request.query as any)?.session || '';
    const callStatus = body?.CallStatus || '';

    logger.info(`Admin call status: ${callStatus} for session ${sessionId}`);

    if (['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
      const conf = escalationConferences.get(sessionId);
      if (conf) {
        conf.adminConnected = false;
        logger.info(`Admin disconnected from conference ${conf.conferenceName}`);
      }
    }

    return reply.status(200).send('OK');
  });

  // ═══ GET /escalate/status/:id — Check escalation bridge status ═════════════
  app.get('/escalate/status/:id', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const { id } = request.params as any;
    const conf = escalationConferences.get(id);
    if (!conf) return { active: false };
    return {
      active: true,
      conferenceName: conf.conferenceName,
      adminConnected: conf.adminConnected,
      userConnected: conf.userConnected,
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  TWILIO INBOUND IVR — Call the Twilio number → AI agent via phone
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Twilio webhook guard ─────────────────────────────────────────────────
  function twilioGuard(request: any, reply: any): boolean {
    if (!validateTwilioSignature(request)) {
      logger.warn('Twilio webhook rejected: invalid signature from ' + (request.ip || 'unknown'));
      reply.status(403).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unauthorized.</Say></Response>');
      return false;
    }
    return true;
  }

  // ═══ GET /twilio/audio/:id — Serve ElevenLabs TTS audio for phone calls ════
  app.get('/twilio/audio/:id', async (request: any, reply) => {
    const { id } = request.params as any;
    const entry = audioCache.get(id);
    if (!entry) {
      return reply.status(404).send('Audio not found');
    }
    reply.type('audio/mpeg');
    return reply.send(entry.buffer);
  });

  // ═══ POST /twilio/incoming — Main entry: incoming call to Twilio number ════
  app.post('/twilio/incoming', async (request: any, reply) => {
    if (!twilioGuard(request, reply)) return;
    const body = request.body as any;
    const callerPhone = body?.From || 'Unknown';
    const callSid = body?.CallSid || '';
    logger.info(`Incoming Twilio call from ${callerPhone} (SID: ${callSid})`);

    // IVR Menu: Press 1-4 for an agent
    const agentMenu = AGENTS.map((a, i) => `Press ${i + 1} for ${a.name}, ${a.specialty}.`).join(' ');
    const serverUrl = getSecureServerUrl();
    const fallback = getFallbackVoice('en-US');

    // Generate natural TTS for IVR greeting
    const ivrText = `Welcome to Circle for Life AI Support. ${agentMenu} Or press 0 to speak with a real person.`;
    const ivrAudio = await generatePhoneTTS(ivrText, AGENTS[2].voiceId); // Nova's voice for IVR
    const promptAudio = await generatePhoneTTS('Please press a number now.', AGENTS[2].voiceId);

    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildTwimlSpeak(ivrAudio, ivrText, fallback, serverUrl)}
  <Gather numDigits="1" action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/agent-select?from=${encodeURIComponent(callerPhone)}&amp;callSid=${encodeURIComponent(callSid)}" method="POST" timeout="10">
    ${buildTwimlSpeak(promptAudio, 'Please press a number now.', fallback, serverUrl)}
  </Gather>
  <Say voice="${escapeXml(fallback)}">We didn't receive a selection. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/agent-select — Handle DTMF digit → start AI session ═════
  app.post('/twilio/agent-select', async (request: any, reply) => {
    if (!twilioGuard(request, reply)) return;
    const body = request.body as any;
    const digit = body?.Digits;
    const callerPhone = (request.query as any)?.from || body?.From || 'Unknown';
    const callSid = (request.query as any)?.callSid || body?.CallSid || '';
    const serverUrl = getSecureServerUrl();

    logger.info(`Twilio agent select: digit=${digit}, caller=${callerPhone}`);

    const fallback = getFallbackVoice('en-US');

    // Press 0 → dial admin directly
    if (digit === '0') {
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      if (adminPhone) {
        const connectAudio = await generatePhoneTTS('Connecting you to a real person now. Please hold.', AGENTS[2].voiceId);
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildTwimlSpeak(connectAudio, 'Connecting you to a real person now. Please hold.', fallback, serverUrl)}
  <Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || '')}">${escapeXml(adminPhone)}</Dial>
  <Say voice="${escapeXml(fallback)}">The call could not be connected. Please try again later. Goodbye.</Say>
</Response>`;
      }
    }

    // Map digit to agent (1-4)
    const agentIndex = parseInt(digit) - 1;
    const agent = AGENTS[agentIndex];
    if (!agent) {
      reply.type('text/xml');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(fallback)}">Invalid selection. Goodbye.</Say>
</Response>`;
    }

    // Create a phone-based call session
    const sessionId = `phone_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    // Use the default Kaggle/Ollama or env-configured provider for phone calls
    const phoneProvider = getPhoneCallProvider();

    const session: CallSession = {
      id: sessionId,
      userId: 'phone_' + callerPhone.replace(/\D/g, ''),
      userName: 'Phone: ' + callerPhone,
      agentId: agent.id,
      status: 'active',
      transcript: [
        { role: 'agent', text: agent.greeting, timestamp: now },
      ],
      supervisorNotes: [],
      providerConfig: phoneProvider,
      elevenLabsKey: '',
      startedAt: now,
      endedAt: '',
      summary: '',
      source: 'phone',
      callerPhone,
      twilioCallSid: callSid,
    };

    activeSessions.set(sessionId, session);
    logger.info(`Phone session created: ${sessionId} with agent ${agent.name} for ${callerPhone}`);

    // Generate natural TTS for agent greeting
    const introText = `You are now connected with ${agent.name}, ${agent.specialty}.`;
    const introAudio = await generatePhoneTTS(introText, agent.voiceId);
    const greetAudio = await generatePhoneTTS(agent.greeting, agent.voiceId);
    const listenAudio = await generatePhoneTTS("Go ahead, I'm listening.", agent.voiceId);

    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildTwimlSpeak(introAudio, introText, fallback, serverUrl)}
  <Pause length="1"/>
  ${buildTwimlSpeak(greetAudio, agent.greeting, fallback, serverUrl)}
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/converse?session=${encodeURIComponent(sessionId)}" method="POST" timeout="15">
    ${buildTwimlSpeak(listenAudio, "Go ahead, I'm listening.", fallback, serverUrl)}
  </Gather>
  <Say voice="${escapeXml(fallback)}">I didn't hear anything. If you'd like to continue, please call back. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/converse — Speech-to-AI loop ════════════════════════════
  app.post('/twilio/converse', async (request: any, reply) => {
    if (!twilioGuard(request, reply)) return;
    const body = request.body as any;
    const sessionId = (request.query as any)?.session;
    const speechResult = body?.SpeechResult || '';
    const serverUrl = getSecureServerUrl();

    const session = sessionId ? activeSessions.get(sessionId) : null;
    const agent = session ? AGENTS.find(a => a.id === session.agentId)! : null;
    const sessionLang = session?.detectedLanguage || 'en-US';
    const fallback = getFallbackVoice(sessionLang);
    const gatherLang = sessionLang !== 'en-US' ? ` language="${sessionLang}"` : '';

    if (!session || session.status !== 'active') {
      reply.type('text/xml');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="${escapeXml(fallback)}">Session ended. Goodbye.</Say></Response>`;
    }

    if (!speechResult.trim()) {
      const promptAudio = agent ? await generatePhoneTTS("I'm still here. Please go ahead.", agent.voiceId) : null;
      reply.type('text/xml');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto"${gatherLang} action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/converse?session=${encodeURIComponent(sessionId)}" method="POST" timeout="15">
    ${buildTwimlSpeak(promptAudio, "I'm still here. Please go ahead.", fallback, serverUrl)}
  </Gather>
  <Say voice="${escapeXml(fallback)}">I didn't hear anything. Goodbye.</Say>
</Response>`;
    }

    logger.info(`Phone converse [${sessionId}]: "${speechResult}"`);

    // Detect language from user's speech and store in session
    const detectedLang = detectLanguageFromText(speechResult);
    if (detectedLang) {
      const locale = LANG_TO_TWILIO_LOCALE[detectedLang] || 'en-US';
      session.detectedLanguage = locale;
      logger.info(`Language detected: ${detectedLang} → ${locale} for session ${sessionId}`);
    }
    const currentLang = session.detectedLanguage || 'en-US';
    const currentFallback = getFallbackVoice(currentLang);
    const currentGatherLang = currentLang !== 'en-US' ? ` language="${currentLang}"` : '';

    // Add user message
    const userTime = new Date().toISOString();
    session.transcript.push({ role: 'user', text: speechResult, timestamp: userTime });

    // Get AI response
    let responseText = "I'm sorry, I couldn't process that. Could you try again?";
    let llmFailed = false;
    let llmError: any = null;
    const messages: ChatMessage[] = [
      { role: 'system', content: agent!.systemPrompt },
      ...session.transcript.filter(t => t.role !== 'system').map(t => ({
        role: t.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: t.text,
      })),
    ];
    const primaryProvider = (session.providerConfig && session.providerConfig.apiKey)
      ? session.providerConfig
      : null;

    if (primaryProvider) {
      try {
        logger.info(`Phone LLM call: provider=${primaryProvider.provider}, model=${primaryProvider.model || 'default'}, baseUrl=${primaryProvider.baseUrl || 'none'}`);
        const resp = await ControlPanelService.chat({
          provider: primaryProvider,
          messages,
          maxTokens: 250,
          temperature: 0.7,
        });
        responseText = resp.content;
      } catch (e: any) {
        llmError = e;
        llmFailed = true;
        logger.error(`Phone AI error (primary): ${e?.error || e?.message || 'unknown error'}`);
      }
    } else {
      llmFailed = true;
    }

    if (llmFailed) {
      const fallback = getPhoneCallProvider();
      const canUseFallback = !!(fallback && fallback.apiKey) && !isSameProviderConfig(primaryProvider, fallback);
      if (canUseFallback && fallback) {
        try {
          logger.info(`Phone LLM fallback: provider=${fallback.provider}, model=${fallback.model || 'default'}, baseUrl=${fallback.baseUrl || 'none'}`);
          const resp = await ControlPanelService.chat({
            provider: fallback,
            messages,
            maxTokens: 250,
            temperature: 0.7,
          });
          session.providerConfig = fallback;
          responseText = resp.content;
          llmFailed = false;
        } catch (e: any) {
          llmError = e;
          logger.error(`Phone AI error (fallback): ${e?.error || e?.message || 'unknown error'}`);
        }
      }
    }

    if (llmFailed && !primaryProvider) {
      logger.error(`Phone call: no LLM provider configured for session ${sessionId}`);
    } else if (llmFailed) {
      logger.error(`Phone call LLM unavailable for session ${sessionId}: ${llmError?.error || llmError?.message || 'unknown error'}`);
    }

    // If LLM failed, try to connect to a real person
    if (llmFailed) {
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      session.status = 'escalated';
      session.transcript.push({
        role: 'system',
        text: 'LLM unavailable — auto-escalated to human support.',
        timestamp: new Date().toISOString(),
      });
      logger.info(`Phone call LLM-failed escalation: ${sessionId} → ${adminPhone || 'NO ADMIN PHONE'}`);

      const escalateText = "I'm experiencing a technical issue. Let me connect you with a real person right away. Please hold.";
      const escalateAudio = agent ? await generatePhoneTTS(escalateText, agent.voiceId) : null;

      if (adminPhone) {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildTwimlSpeak(escalateAudio, escalateText, currentFallback, serverUrl)}
  <Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || '')}" timeout="30">${escapeXml(adminPhone)}</Dial>
  <Say voice="${escapeXml(currentFallback)}">I'm sorry, the call could not be connected. Please try again later. Goodbye.</Say>
</Response>`;
      } else {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(currentFallback)}">I'm sorry, I'm having technical difficulties and no support staff is available right now. Please try again later. Goodbye.</Say>
</Response>`;
      }
    }

    // Add agent response
    const agentTime = new Date().toISOString();
    session.transcript.push({ role: 'agent', text: responseText, timestamp: agentTime });

    // Run supervisor analysis (best effort, don't block)
    supervisorAnalyze(session, speechResult, responseText).catch(() => {});

    // Check if supervisor says escalation needed
    const latestNote = session.supervisorNotes.length > 0 ? session.supervisorNotes[session.supervisorNotes.length - 1] : null;
    const shouldEscalate = latestNote && latestNote.escalationNeeded && latestNote.severity === 'high';

    if (shouldEscalate) {
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      session.status = 'escalated';
      session.transcript.push({
        role: 'system',
        text: 'Auto-escalated to human support via phone.',
        timestamp: new Date().toISOString(),
      });
      logger.info(`Phone call auto-escalated: ${sessionId}`);

      // Generate TTS for escalation
      const respAudio = agent ? await generatePhoneTTS(responseText, agent.voiceId) : null;
      const holdText = "I'm going to connect you with a real person who can help. Please hold.";
      const holdAudio = agent ? await generatePhoneTTS(holdText, agent.voiceId) : null;

      if (adminPhone) {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildTwimlSpeak(respAudio, responseText, currentFallback, serverUrl)}
  <Pause length="1"/>
  ${buildTwimlSpeak(holdAudio, holdText, currentFallback, serverUrl)}
  <Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || '')}">${escapeXml(adminPhone)}</Dial>
  <Say voice="${escapeXml(currentFallback)}">The call could not be connected. Please try calling back. Goodbye.</Say>
</Response>`;
      }
    }

    // Normal response: generate natural TTS and gather more speech
    const responseAudio = agent ? await generatePhoneTTS(responseText, agent.voiceId) : null;

    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildTwimlSpeak(responseAudio, responseText, currentFallback, serverUrl)}
  <Gather input="speech" speechTimeout="auto"${currentGatherLang} action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/converse?session=${encodeURIComponent(sessionId)}" method="POST" timeout="20">
    <Pause length="1"/>
  </Gather>
  <Say voice="${escapeXml(currentFallback)}">I haven't heard from you in a while. If you need more help, please call back. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/voice — TwiML webhook for outbound escalation calls ═════
  app.post('/twilio/voice', async (request: any, reply) => {
    if (!twilioGuard(request, reply)) return;
    const { sessionId } = request.query as any;
    const session = sessionId ? activeSessions.get(sessionId) : null;

    let sayText = 'You have an escalated support call from a Circle for Life user.';
    if (session) {
      const agent = AGENTS.find(a => a.id === session.agentId);
      sayText = `Escalated call alert. User ${session.userName} was speaking with ${agent?.name || 'an agent'} about ${agent?.specialty || 'support'}. `;
      const lastUserMsg = [...session.transcript].reverse().find(t => t.role === 'user');
      if (lastUserMsg) {
        sayText += `Their last message was: ${lastUserMsg.text.substring(0, 200)}. `;
      }
      sayText += 'Please review the full transcript in the admin panel.';
    }

    const escalationFallback = getFallbackVoice('en-US');
    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeXml(escalationFallback)}">${escapeXml(sayText)}</Say>
  <Pause length="2"/>
  <Say voice="${escapeXml(escalationFallback)}">The full transcript is available in the Circle for Life admin panel. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/status — Twilio status callback ════════════════════════
  app.post('/twilio/status', async (request: any, reply) => {
    if (!twilioGuard(request, reply)) return;
    const body = request.body as any;
    const callSid = body?.CallSid;
    const status = body?.CallStatus;
    logger.info('Twilio status callback:', { callSid, status });

    // If call completed, try to end the associated session
    if (status === 'completed' || status === 'failed' || status === 'no-answer' || status === 'busy') {
      for (const [, sess] of activeSessions) {
        if (sess.twilioCallSid === callSid && sess.source === 'phone' && sess.status === 'active') {
          sess.status = 'ended';
          sess.endedAt = new Date().toISOString();
          sess.summary = 'Phone call ended.';
          const dur = Math.floor((new Date(sess.endedAt).getTime() - new Date(sess.startedAt).getTime()) / 1000);
          logger.info(`Phone session ${sess.id} ended via Twilio status: ${status}`);
          // Persist phone call to DB
          try { await persistCallSession(sess, dur); } catch (e: any) { logger.error('Failed to persist phone call:', e.message); }
          break;
        }
      }
    }
    return { ok: true };
  });

  // ═══ GET /history — User's call history ══════════════════════════════════
  app.get('/history', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const userId = request.userId;
    const sessions: any[] = [];

    // Check in-memory sessions
    for (const [, sess] of activeSessions) {
      if (sess.userId === userId) {
        const agent = AGENTS.find(a => a.id === sess.agentId);
        sessions.push({
          id: sess.id,
          agentId: sess.agentId,
          agentName: agent?.name || 'Unknown',
          agentAvatar: agent?.avatar || '?',
          status: sess.status,
          summary: sess.summary,
          messageCount: sess.transcript.length,
          startedAt: sess.startedAt,
          endedAt: sess.endedAt,
          source: sess.source || 'browser',
          callerPhone: sess.callerPhone || '',
        });
      }
    }

    // Also check persisted sessions from DB
    try {
      const { agentCallSessionsDB } = await import('../db/index.js');
      if (agentCallSessionsDB) {
        const dbSessions = await agentCallSessionsDB.findMany({ userId } as any);
        for (const ds of (dbSessions || [])) {
          // Avoid duplicates
          if (!sessions.find(s => s.id === ds.id)) {
            const agent = AGENTS.find(a => a.id === ds.agentId);
            sessions.push({
              id: ds.id,
              agentId: ds.agentId,
              agentName: agent?.name || 'Unknown',
              agentAvatar: agent?.avatar || '?',
              status: ds.status,
              summary: ds.summary || '',
              messageCount: 0,
              startedAt: ds.createdAt,
              endedAt: ds.endedAt || '',
            });
          }
        }
      }
    } catch { /* DB not available */ }

    sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return { sessions };
  });

  // ═══ GET /admin/call-logs — Admin: all calls with transcripts ═══════════════
  app.get('/admin/call-logs', {
    preHandler: [localAuthenticate, requirePermission('users.list')],
  }, async () => {
    const logs: any[] = [];
    const seenIds = new Set<string>();

    // 1) Collect active in-memory sessions (these are the most up-to-date)
    for (const [, sess] of activeSessions) {
      const agent = AGENTS.find(a => a.id === sess.agentId);
      const duration = sess.endedAt
        ? Math.floor((new Date(sess.endedAt).getTime() - new Date(sess.startedAt).getTime()) / 1000)
        : Math.floor((Date.now() - new Date(sess.startedAt).getTime()) / 1000);
      logs.push({
        id: sess.id,
        userId: sess.userId,
        userName: sess.userName,
        agentId: sess.agentId,
        agentName: agent?.name || 'Unknown',
        agentAvatar: agent?.avatar || '?',
        agentSpecialty: agent?.specialty || '',
        status: sess.status,
        summary: sess.summary || '',
        messageCount: sess.transcript.filter((t: any) => t.role !== 'system').length,
        startedAt: sess.startedAt,
        endedAt: sess.endedAt || '',
        durationSec: duration,
        source: sess.source || 'browser',
        callerPhone: sess.callerPhone || '',
        transcript: sess.transcript,
        supervisorNotes: sess.supervisorNotes || [],
      });
      seenIds.add(sess.id);
    }

    // 2) Load persisted sessions from DB (survived restarts)
    try {
      const { agentCallSessionsDB } = await import('../db/index.js');
      const dbRows = await agentCallSessionsDB.findAll();
      for (const row of dbRows) {
        if (seenIds.has(row.id)) continue; // already from memory
        const agent = AGENTS.find(a => a.id === row.agentId);
        const transcript = Array.isArray(row.transcript)
          ? row.transcript
          : (typeof row.transcript === 'string' ? JSON.parse(row.transcript || '[]') : []);
        const supervisorNotes = Array.isArray(row.supervisorNotes)
          ? row.supervisorNotes
          : (typeof row.supervisorNotes === 'string' ? JSON.parse(row.supervisorNotes || '[]') : []);
        logs.push({
          id: row.id,
          userId: row.userId || '',
          userName: row.userName || '',
          agentId: row.agentId || '',
          agentName: agent?.name || 'Unknown',
          agentAvatar: agent?.avatar || '?',
          agentSpecialty: agent?.specialty || '',
          status: row.status || 'ended',
          summary: row.summary || '',
          messageCount: transcript.filter((t: any) => t.role !== 'system').length,
          startedAt: row.createdAt || '',
          endedAt: row.endedAt || '',
          durationSec: row.duration || 0,
          source: row.source || 'browser',
          callerPhone: row.callerPhone || '',
          transcript,
          supervisorNotes,
        });
      }
    } catch (e: any) {
      logger.warn('Could not load persisted call logs:', e.message);
    }

    logs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return { logs };
  });

  // ═══ DELETE /admin/call-logs/:id — Admin: delete a call log ════════════════
  app.delete('/admin/call-logs/:id', {
    preHandler: [localAuthenticate, requirePermission('users.list')],
  }, async (request: any, reply) => {
    const { id } = request.params;
    if (!id) return reply.status(400).send({ error: 'Missing call log id' });

    // Remove from in-memory active sessions
    if (activeSessions.has(id)) {
      activeSessions.delete(id);
    }

    // Remove from database
    try {
      const { agentCallSessionsDB } = await import('../db/index.js');
      await agentCallSessionsDB.deleteById(id);
    } catch (e: any) {
      logger.warn('Could not delete call log from DB:', e.message);
    }

    return { ok: true, deleted: id };
  });

  // ═══ DELETE /admin/call-logs — Admin: delete all call logs ═════════════════
  app.delete('/admin/call-logs', {
    preHandler: [localAuthenticate, requirePermission('users.list')],
  }, async (_request: any) => {
    // Clear in-memory ended sessions (keep active ones)
    for (const [id, sess] of activeSessions) {
      if (sess.status !== 'active') {
        activeSessions.delete(id);
      }
    }

    // Clear from database
    try {
      const { agentCallSessionsDB } = await import('../db/index.js');
      const allRows = await agentCallSessionsDB.findAll();
      let deleted = 0;
      for (const row of allRows) {
        await agentCallSessionsDB.deleteById(row.id);
        deleted++;
      }
      logger.info(`Deleted ${deleted} call logs from DB`);
    } catch (e: any) {
      logger.warn('Could not clear call logs from DB:', e.message);
    }

    return { ok: true };
  });

  // ═══ GET /admin/active — Admin: view all active calls ═════════════════════
  app.get('/admin/active', {
    preHandler: [localAuthenticate, requirePermission('users.list')],
  }, async () => {
    const activeCalls: any[] = [];
    for (const [, sess] of activeSessions) {
      if (sess.status === 'active' || sess.status === 'escalated') {
        const agent = AGENTS.find(a => a.id === sess.agentId);
        activeCalls.push({
          id: sess.id,
          userId: sess.userId,
          userName: sess.userName,
          agentId: sess.agentId,
          agentName: agent?.name || 'Unknown',
          status: sess.status,
          transcript: sess.transcript,
          supervisorNotes: sess.supervisorNotes,
          messageCount: sess.transcript.length,
          startedAt: sess.startedAt,
          durationSec: Math.floor((Date.now() - new Date(sess.startedAt).getTime()) / 1000),
          source: sess.source || 'browser',
          callerPhone: sess.callerPhone || '',
        });
      }
    }
    return { activeCalls };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ BLUEPRINT ROADMAP API ═════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  const ROADMAP_PHASES = [
    {
      id: 'phase1',
      title: 'Phase 1: Foundation',
      subtitle: 'Core platform with all essential features',
      status: 'current',
      items: [
        'AI Chat Playground', 'Blog Platform', 'Gamification (Gems & Levels)',
        'P2P Chat (Free for all)', 'AI Agent Call Center', 'Phone IVR System',
        'Image Studio', 'Voice Lab', 'API Tester', 'Admin Dashboard',
      ],
    },
    {
      id: 'phase2',
      title: 'Phase 2: Standalone Modules',
      subtitle: 'Release features as independent tools with sign-up funnels',
      status: 'planned',
      items: [
        'AI Chat as standalone web tool', 'Image Studio as standalone tool',
        'Voice Lab as standalone tool', 'API Tester as standalone tool',
        'AI Agent Demo page', '"Powered by Circle for Life" branding',
      ],
    },
    {
      id: 'phase3',
      title: 'Phase 3: Mobile + Growth',
      subtitle: 'Mobile apps, referral campaigns, user acquisition',
      status: 'planned',
      items: [
        'Progressive Web App (PWA)', 'iOS App (App Store)',
        'Android App (Play Store)', 'Referral campaign launch',
        'Influencer partnerships', 'Product Hunt launch',
        'SEO landing pages per feature',
      ],
    },
    {
      id: 'phase4',
      title: 'Phase 4: Scale + Monetize',
      subtitle: 'Premium features, enterprise offerings, marketplace',
      status: 'planned',
      items: [
        'Premium subscription tiers', 'Enterprise API access',
        'White-label module licensing', 'AI tools marketplace',
        'Advanced analytics dashboard', 'Custom branding options',
      ],
    },
  ];

  const MODULES = [
    { id: 'ai_chat', name: 'AI Chat Playground', standalone: true, status: 'built', priority: 'Release first', description: 'Multi-provider AI chat with local LLM support' },
    { id: 'image_studio', name: 'Image Studio', standalone: true, status: 'built', priority: 'Release second', description: 'AI image generation with gallery and editing' },
    { id: 'voice_lab', name: 'Voice Lab', standalone: true, status: 'built', priority: 'Release third', description: 'Text-to-speech, speech-to-text, and translation' },
    { id: 'api_tester', name: 'API Tester', standalone: true, status: 'built', priority: 'Release fourth', description: 'Interactive REST API testing tool' },
    { id: 'agent_calls', name: 'AI Agent Call Center', standalone: true, status: 'built', priority: 'High-impact demo', description: 'Voice AI agents with phone IVR and escalation' },
    { id: 'p2p_chat', name: 'P2P Chat', standalone: false, status: 'built', priority: 'Core feature', description: 'Real-time peer-to-peer messaging with AI features' },
    { id: 'blog', name: 'Blog Platform', standalone: true, status: 'built', priority: 'Content funnel', description: 'Publishing platform with comments, likes, and categories' },
    { id: 'gem_economy', name: 'Gem Economy', standalone: false, status: 'built', priority: 'Retention engine', description: 'Gamification system with gems, levels, streaks, and leaderboards' },
  ];

  // In-memory milestone storage (persists across requests, resets on deploy)
  const DEFAULT_MILESTONES = [
    { id: 'ms_standalone_chat', title: 'Launch standalone AI Chat tool', status: 'planned', category: 'module' },
    { id: 'ms_standalone_image', title: 'Launch standalone Image Studio', status: 'planned', category: 'module' },
    { id: 'ms_standalone_voice', title: 'Launch standalone Voice Lab', status: 'planned', category: 'module' },
    { id: 'ms_landing_page', title: 'Set up landing page with SEO', status: 'planned', category: 'growth' },
    { id: 'ms_product_hunt', title: 'Submit to Product Hunt', status: 'planned', category: 'growth' },
    { id: 'ms_100_users', title: 'Reach 100 users', status: 'planned', category: 'growth' },
    { id: 'ms_1000_users', title: 'Reach 1,000 users', status: 'planned', category: 'growth' },
    { id: 'ms_pwa', title: 'Launch Progressive Web App (PWA)', status: 'planned', category: 'mobile' },
    { id: 'ms_app_store', title: 'Submit to App Store', status: 'planned', category: 'mobile' },
    { id: 'ms_play_store', title: 'Submit to Play Store', status: 'planned', category: 'mobile' },
    { id: 'ms_10k_downloads', title: 'Reach 10,000 downloads', status: 'planned', category: 'growth' },
    { id: 'ms_referral', title: 'Launch referral campaign', status: 'planned', category: 'growth' },
    { id: 'ms_enterprise', title: 'First enterprise client', status: 'planned', category: 'revenue' },
    { id: 'ms_premium', title: 'Launch premium subscription', status: 'planned', category: 'revenue' },
  ];

  let milestones = [...DEFAULT_MILESTONES];

  // GET /blueprint/roadmap — public (any authenticated user)
  app.get('/blueprint/roadmap', {
    preHandler: [localAuthenticate],
  }, async () => {
    return {
      phases: ROADMAP_PHASES,
      modules: MODULES,
      milestones,
    };
  });

  // PUT /blueprint/milestone/:id — super_admin only
  app.put('/blueprint/milestone/:id', {
    preHandler: [localAuthenticate, requirePermission('system.config')],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const ms = milestones.find(m => m.id === id);
    if (!ms) return reply.status(404).send({ error: { message: 'Milestone not found' } });

    const validStatuses = ['planned', 'in_progress', 'done', 'shipped'];
    if (body.status && validStatuses.includes(body.status)) {
      ms.status = body.status;
    }
    if (body.title) ms.title = body.title;

    logger.info(`Blueprint milestone updated: ${id} → ${ms.status}`);
    return { ok: true, milestone: ms };
  });

  // ═══ GET /admin/platform-config — Read runtime config (super_admin only) ════
  app.get('/admin/platform-config', {
    preHandler: [localAuthenticate, requirePermission('system.config')],
  }, async () => {
    // Return current config — mask API keys (show last 4 chars only)
    const mask = (val?: string) => val ? ('*'.repeat(Math.max(0, val.length - 4)) + val.slice(-4)) : '';
    return {
      ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER || '',
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
      GROQ_API_KEY: mask(process.env.GROQ_API_KEY),
      OPENAI_API_KEY: mask(process.env.OPENAI_API_KEY),
      ANTHROPIC_API_KEY: mask(process.env.ANTHROPIC_API_KEY),
      GOOGLE_API_KEY: mask(process.env.GOOGLE_API_KEY),
      OPENROUTER_API_KEY: mask(process.env.OPENROUTER_API_KEY),
      TOGETHER_API_KEY: mask(process.env.TOGETHER_API_KEY),
      DEEPSEEK_API_KEY: mask(process.env.DEEPSEEK_API_KEY),
      MISTRAL_API_KEY: mask(process.env.MISTRAL_API_KEY),
      DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER || '',
      DEFAULT_LLM_KEY: mask(process.env.DEFAULT_LLM_KEY),
      PHONE_LLM_MODEL: process.env.PHONE_LLM_MODEL || '',
      KAGGLE_OLLAMA_URL: process.env.KAGGLE_OLLAMA_URL || '',
      ELEVENLABS_API_KEY: mask(process.env.ELEVENLABS_API_KEY),
      SERVER_URL: process.env.SERVER_URL || '',
    };
  });

  // ═══ PUT /admin/platform-config — Update runtime config (super_admin only) ══
  app.put('/admin/platform-config', {
    preHandler: [localAuthenticate, requirePermission('system.config')],
  }, async (request: any) => {
    const body = request.body || {};
    const ALLOWED_KEYS = [
      'ADMIN_PHONE_NUMBER', 'TWILIO_PHONE_NUMBER',
      'GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
      'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'TOGETHER_API_KEY',
      'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY',
      'DEFAULT_LLM_PROVIDER', 'DEFAULT_LLM_KEY', 'PHONE_LLM_MODEL',
      'KAGGLE_OLLAMA_URL', 'ELEVENLABS_API_KEY', 'SERVER_URL',
    ];

    const updated: string[] = [];
    for (const key of ALLOWED_KEYS) {
      if (key in body) {
        const val = String(body[key]).trim();
        // Skip masked values (they start with ***) — means user didn't change them
        if (val.startsWith('***')) continue;
        if (val === '') {
          delete process.env[key];
          updated.push(key + ' (cleared)');
        } else {
          process.env[key] = val;
          updated.push(key);
        }
      }
    }

    logger.info('Platform config updated by super_admin:', updated);
    return { ok: true, updated };
  });
}

// ─── Supervisor Analysis ─────────────────────────────────────────────────────

// ─── Twilio Escalation Helper ──────────────────────────────────────────────

// ─── Twilio Voice Bridge: Auto-provisioning + Conference ─────────────────

let _twilioApiKeySid: string | null = null;
let _twilioApiKeySecret: string | null = null;
let _twilioTwimlAppSid: string | null = null;

async function ensureTwilioVoiceResources(): Promise<{ apiKeySid: string; apiKeySecret: string; twimlAppSid: string } | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;

  // Use cached values if available
  if (_twilioApiKeySid && _twilioApiKeySecret && _twilioTwimlAppSid) {
    return { apiKeySid: _twilioApiKeySid, apiKeySecret: _twilioApiKeySecret, twimlAppSid: _twilioTwimlAppSid };
  }

  // Check env first
  if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && process.env.TWILIO_TWIML_APP_SID) {
    _twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
    _twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    _twilioTwimlAppSid = process.env.TWILIO_TWIML_APP_SID;
    return { apiKeySid: _twilioApiKeySid, apiKeySecret: _twilioApiKeySecret, twimlAppSid: _twilioTwimlAppSid };
  }

  try {
    const client = twilio(sid, token);
    const serverUrl = getSecureServerUrl();

    // Auto-create TwiML App
    logger.info('Auto-provisioning Twilio TwiML App...');
    const app = await client.applications.create({
      friendlyName: 'Circle for Life Voice Bridge',
      voiceUrl: `${serverUrl}/v1/agent-calls/escalate/voice-webhook`,
      voiceMethod: 'POST',
    });
    _twilioTwimlAppSid = app.sid;
    logger.info(`TwiML App created: ${app.sid}`);

    // Auto-create API Key
    logger.info('Auto-provisioning Twilio API Key...');
    const key = await client.newKeys.create({ friendlyName: 'Circle for Life Voice Key' });
    _twilioApiKeySid = key.sid;
    _twilioApiKeySecret = key.secret;
    logger.info(`API Key created: ${key.sid}`);

    return { apiKeySid: _twilioApiKeySid!, apiKeySecret: _twilioApiKeySecret!, twimlAppSid: _twilioTwimlAppSid! };
  } catch (e: any) {
    logger.error('Failed to auto-provision Twilio resources:', e.message);
    return null;
  }
}

// Conference rooms mapped by session ID
const escalationConferences = new Map<string, { conferenceName: string; adminCallSid?: string; userConnected: boolean; adminConnected: boolean }>();

async function triggerTwilioEscalation(session: CallSession, agent: AgentDef): Promise<string> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioFrom || !adminPhone) {
    logger.warn('Twilio escalation skipped — missing env vars:', {
      hasSid: !!twilioSid, hasToken: !!twilioToken, hasFrom: !!twilioFrom, hasAdmin: !!adminPhone,
    });
    return 'notification_only';
  }

  try {
    // Build a summary for the phone call message
    let sayText = `Circle for Life escalation alert. User ${session.userName} was speaking with ${agent.name} about ${agent.specialty}. `;
    const lastUserMsg = [...session.transcript].reverse().find(t => t.role === 'user');
    if (lastUserMsg) {
      sayText += `Their last message was: ${lastUserMsg.text.substring(0, 150)}. `;
    }
    sayText += 'Please review the full transcript in the admin panel. Goodbye.';

    // Escape XML special characters for TwiML
    const safeSayText = sayText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Use inline Twiml parameter — no webhook URL needed!
    // This means Twilio doesn't need to call back to our server.
    const inlineTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${safeSayText}</Say><Pause length="1"/><Say voice="alice">End of escalation alert.</Say></Response>`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;

    const callParams: Record<string, string> = {
      To: adminPhone,
      From: twilioFrom,
      Twiml: inlineTwiml,
    };

    // Optionally add status callback if we have a public SERVER_URL
    const secureUrl = getSecureServerUrl();
    if (secureUrl && !secureUrl.includes('localhost') && !secureUrl.includes('127.0.0.1')) {
      callParams.StatusCallback = `${secureUrl}/v1/agent-calls/twilio/status`;
      callParams.StatusCallbackMethod = 'POST';
    }

    logger.info(`Placing Twilio call: From=${twilioFrom}, To=${adminPhone}`);

    const resp = await axios.post(
      twilioUrl,
      new URLSearchParams(callParams).toString(),
      {
        auth: { username: twilioSid, password: twilioToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      },
    );

    logger.info(`Twilio call placed successfully for session ${session.id}:`, {
      callSid: resp.data?.sid,
      to: adminPhone,
      status: resp.data?.status,
    });
    return 'twilio_call_placed';
  } catch (e: any) {
    const errData = e?.response?.data;
    logger.error('Twilio escalation FAILED:', {
      status: e?.response?.status,
      code: errData?.code,
      message: errData?.message || e.message,
      moreInfo: errData?.more_info,
    });

    // Common Twilio errors:
    // 21614 = unverified number (trial account)
    // 21211 = invalid phone number
    // 20003 = authentication error
    if (errData?.code === 21614 || errData?.code === 21608) {
      logger.error(
        'TWILIO TRIAL LIMITATION: The destination phone number must be verified in your Twilio console. '
        + 'Go to https://console.twilio.com/us1/develop/phone-numbers/manage/verified and add your number.',
      );
    }

    return 'twilio_failed_notification_sent';
  }
}

// ─── Supervisor Analysis ──────────────────────────────────────────────────

async function supervisorAnalyze(session: CallSession, userText: string, agentText: string): Promise<void> {
  if (!session.providerConfig || !session.providerConfig.apiKey) return;

  try {
    const recentTranscript = session.transcript.slice(-6).map(t => `${t.role}: ${t.text}`).join('\n');

    const resp = await ControlPanelService.chat({
      provider: session.providerConfig,
      messages: [
        { role: 'system', content: SUPERVISOR_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this exchange:\n\n${recentTranscript}` },
      ],
      maxTokens: 200,
      temperature: 0.1,
    });

    let parsed: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = resp.content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch { parsed = null; }

    if (parsed) {
      session.supervisorNotes.push({
        severity: parsed.severity || 'low',
        sentiment: parsed.sentiment || 'neutral',
        flags: parsed.flags || [],
        escalationNeeded: !!parsed.escalationNeeded,
        reason: parsed.reason || '',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e: any) {
    // Supervisor analysis is best-effort
    logger.error('Supervisor analysis error:', e.message || e.error);
  }
}

function getLatestSupervisorAlert(session: CallSession): any {
  if (session.supervisorNotes.length === 0) return null;
  const latest = session.supervisorNotes[session.supervisorNotes.length - 1];
  if (latest.severity === 'medium' || latest.severity === 'high' || latest.escalationNeeded) {
    return latest;
  }
  return null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isSameProviderConfig(a: ProviderConfig | null | undefined, b: ProviderConfig | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.provider === b.provider &&
    (a.apiKey || '').trim() === (b.apiKey || '').trim() &&
    (a.model || '').trim() === (b.model || '').trim() &&
    (a.baseUrl || '').trim() === (b.baseUrl || '').trim()
  );
}

function formatLlmUserMessage(err: any): string {
  const status = Number(err?.status || err?.response?.status || 0);
  const raw = String(err?.error || err?.message || err?.response?.data?.error?.message || '');
  const msg = raw.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    msg.includes('invalid api key') ||
    msg.includes('authentication') ||
    msg.includes('unauthorized')
  ) {
    return "I'm having trouble authenticating with the AI provider. Please check your provider API key in settings and try again.";
  }

  if (status === 429 || msg.includes('rate limit') || msg.includes('quota')) {
    return "I'm currently being rate-limited by the AI provider. Please wait a moment and try again.";
  }

  return "I'm sorry, I'm having a technical issue right now. Could you repeat that?";
}

// ─── Phone Call Provider Configuration ────────────────────────────────────────
// For inbound phone calls, we need a default LLM provider. This checks env vars
// or falls back to the Kaggle/Ollama setup.

function getPhoneCallProvider(): ProviderConfig | null {
  // Admin-panel model override: applies to whichever provider is resolved below
  const modelOverride = process.env.PHONE_LLM_MODEL || '';

  // Priority 1: Dedicated phone LLM provider env vars
  if (process.env.PHONE_LLM_PROVIDER && process.env.PHONE_LLM_API_KEY) {
    logger.info('Phone LLM: using dedicated PHONE_LLM_PROVIDER=' + process.env.PHONE_LLM_PROVIDER);
    return {
      provider: process.env.PHONE_LLM_PROVIDER as any,
      apiKey: process.env.PHONE_LLM_API_KEY,
      model: modelOverride || process.env.PHONE_LLM_MODEL,
      baseUrl: process.env.PHONE_LLM_BASE_URL,
    };
  }

  // Priority 2: Explicit default provider
  if (process.env.DEFAULT_LLM_KEY) {
    const prov = process.env.DEFAULT_LLM_PROVIDER || 'groq';
    logger.info('Phone LLM: using DEFAULT_LLM_KEY with provider=' + prov + (modelOverride ? ', model=' + modelOverride : ''));
    return {
      provider: prov as any,
      apiKey: process.env.DEFAULT_LLM_KEY,
      model: modelOverride || process.env.DEFAULT_LLM_MODEL,
    };
  }

  // Priority 3: Auto-detect any cloud API key from env
  const autoDetect: { env: string; provider: string; model: string }[] = [
    { env: 'GROQ_API_KEY', provider: 'groq', model: 'llama-3.1-8b-instant' },
    { env: 'OPENROUTER_API_KEY', provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free' },
    { env: 'OPENAI_API_KEY', provider: 'openai', model: 'gpt-4o-mini' },
    { env: 'ANTHROPIC_API_KEY', provider: 'anthropic', model: 'claude-3-haiku-20240307' },
    { env: 'GOOGLE_API_KEY', provider: 'google', model: 'gemini-1.5-flash' },
    { env: 'TOGETHER_API_KEY', provider: 'together', model: 'meta-llama/Llama-3-8b-chat-hf' },
    { env: 'DEEPSEEK_API_KEY', provider: 'deepseek', model: 'deepseek-chat' },
    { env: 'MISTRAL_API_KEY', provider: 'mistral', model: 'mistral-small-latest' },
  ];

  for (const d of autoDetect) {
    if (process.env[d.env]) {
      const chosenModel = modelOverride || d.model;
      logger.info(`Phone LLM: auto-detected ${d.env} → provider=${d.provider}, model=${chosenModel}`);
      return {
        provider: d.provider as any,
        apiKey: process.env[d.env]!,
        model: chosenModel,
      };
    }
  }

  // Priority 4: Kaggle/Ollama (last because ngrok URLs expire often)
  if (process.env.KAGGLE_OLLAMA_URL) {
    logger.info('Phone LLM: using KAGGLE_OLLAMA_URL=' + process.env.KAGGLE_OLLAMA_URL);
    return {
      provider: 'kaggle' as any,
      apiKey: 'ollama',
      model: 'llama3.2:3b',
      baseUrl: process.env.KAGGLE_OLLAMA_URL,
    };
  }

  logger.warn('No LLM provider configured for phone calls. Set DEFAULT_LLM_KEY, GROQ_API_KEY, PHONE_LLM_PROVIDER/KEY, or KAGGLE_OLLAMA_URL.');
  return null;
}
