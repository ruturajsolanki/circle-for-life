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
import axios from 'axios';
import { localAuthenticate, requirePermission } from '../middleware/rbac.middleware.js';
import { ControlPanelService, type ChatMessage, type ProviderConfig } from '../services/controlPanel.service.js';
import { logger } from '../utils/logger.js';

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

Remember: You are being spoken to via voice call. Keep responses concise and natural for speech.`,
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
    systemPrompt: `You are Atlas, a tech support AI agent for the Circle for Life platform. Your personality:
- Patient, methodical, and knowledgeable
- Break down complex problems into simple steps
- Ask clarifying questions before jumping to solutions
- Explain technical concepts in accessible language
- Provide step-by-step troubleshooting
- Cover: coding, software issues, platform help, general tech questions
- Be encouraging when users struggle with technical concepts
- Keep responses concise for voice (2-4 sentences max)

Remember: You are on a voice call. Be clear, structured, and brief. Number your steps when giving instructions.`,
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
    systemPrompt: `You are Nova, a general assistant AI agent for the Circle for Life platform. Your personality:
- Friendly, upbeat, and enthusiastic
- Helpful and resourceful — always ready to find an answer
- Great at explaining how things work on the platform
- Can help with: account questions, feature explanations, general knowledge, quick tasks
- Keep the conversation light and engaging
- If you don't know something, be honest and suggest alternatives
- Keep responses natural and concise for voice (2-4 sentences max)

Remember: You are on a voice call. Be energetic but clear. Keep it conversational.`,
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
    systemPrompt: `You are Sage, a career and life coaching AI agent for the Circle for Life platform. Your personality:
- Wise, motivational, and insightful
- Ask powerful, thought-provoking questions
- Help users clarify goals and create actionable plans
- Cover: career planning, skill development, work-life balance, personal growth, decision-making
- Use frameworks (SMART goals, pros/cons) when helpful
- Celebrate user strengths and progress
- Challenge limiting beliefs gently
- Keep responses impactful and concise for voice (2-4 sentences max)

Remember: You are on a voice call. Be inspiring but practical. Ask one powerful question at a time.`,
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
}

const activeSessions: Map<string, CallSession> = new Map();

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

  // ═══ POST /start — Start a call session ════════════════════════════════════
  app.post('/start', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const body = z.object({
      agentId: z.string(),
      provider: z.object({
        provider: z.string(),
        apiKey: z.string(),
        model: z.string().optional(),
        baseUrl: z.string().optional(),
      }).optional(),
      elevenLabsKey: z.string().optional(),
    }).parse(request.body);

    const agent = AGENTS.find(a => a.id === body.agentId);
    if (!agent) return reply.status(404).send({ error: { message: 'Agent not found' } });

    const userId = request.userId;
    const user = request.userData || {};

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
      providerConfig: body.provider ? body.provider as ProviderConfig : null,
      elevenLabsKey: body.elevenLabsKey || process.env.ELEVENLABS_API_KEY || '',
      startedAt: now,
      endedAt: '',
      summary: '',
      source: 'browser',
    };

    activeSessions.set(sessionId, session);

    // Resolve ElevenLabs key: client → server env → none
    const elevenKey = body.elevenLabsKey || process.env.ELEVENLABS_API_KEY || '';

    // Generate TTS for greeting if ElevenLabs key available
    let greetingAudio = '';
    let voiceEngine = 'web_speech';
    if (elevenKey) {
      try {
        logger.info(`Generating ElevenLabs greeting TTS for agent ${agent.id} (voice: ${agent.voiceId}), keySource=${body.elevenLabsKey ? 'client' : 'server_env'}`);
        const ttsResp = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
          {
            text: agent.greeting,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
          },
          {
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            responseType: 'arraybuffer',
            timeout: 15000,
          },
        );
        greetingAudio = Buffer.from(ttsResp.data).toString('base64');
        voiceEngine = 'elevenlabs';
        logger.info(`ElevenLabs TTS greeting generated (${greetingAudio.length} bytes base64)`);
      } catch (e: any) {
        logger.error('ElevenLabs TTS greeting FAILED:', {
          status: e?.response?.status,
          data: e?.response?.data ? Buffer.from(e.response.data).toString('utf8').substring(0, 300) : null,
          message: e.message,
          hint: e?.response?.status === 401 ? 'Invalid API key — check ELEVENLABS_API_KEY or the key on the Agent page' : '',
        });
        // Will fall back to Web Speech on the client
      }
    } else {
      logger.info('No ElevenLabs key — using Web Speech fallback');
    }

    return reply.status(201).send({
      sessionId,
      agent: {
        id: agent.id,
        name: agent.name,
        specialty: agent.specialty,
        avatar: agent.avatar,
        color1: agent.color1,
        color2: agent.color2,
      },
      greeting: agent.greeting,
      greetingAudio,
      greetingAudioType: 'audio/mpeg',
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

    // Try configured provider first, fall back to simple echo
    if (session.providerConfig && session.providerConfig.apiKey) {
      try {
        const resp = await ControlPanelService.chat({
          provider: session.providerConfig,
          messages: llmMessages,
          maxTokens: 256,
          temperature: 0.7,
        });
        responseText = resp.content;
      } catch (e: any) {
        logger.error('Agent LLM error:', e.error || e.message);
        responseText = "I'm sorry, I'm having a technical issue right now. Could you repeat that?";
      }
    } else {
      // No provider configured — return a helpful message
      responseText = "I'd love to help, but I need an AI provider to be configured. Please set up an API key in the settings to enable my full capabilities.";
    }

    // Add agent response to transcript
    const agentTime = new Date().toISOString();
    session.transcript.push({ role: 'agent', text: responseText, timestamp: agentTime });

    // Generate TTS via ElevenLabs (session key → server env → skip)
    let audioBase64 = '';
    const msgElevenKey = session.elevenLabsKey || process.env.ELEVENLABS_API_KEY || '';
    if (msgElevenKey) {
      try {
        const ttsResp = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${agent.voiceId}`,
          {
            text: responseText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
          },
          {
            headers: {
              'xi-api-key': msgElevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            responseType: 'arraybuffer',
            timeout: 15000,
          },
        );
        audioBase64 = Buffer.from(ttsResp.data).toString('base64');
      } catch (e: any) {
        logger.error('ElevenLabs TTS message FAILED:', {
          status: e?.response?.status,
          message: e.message,
          hint: e?.response?.status === 401 ? 'Invalid API key' : e?.response?.status === 422 ? 'Invalid voice ID or quota exceeded' : '',
        });
        // Falls back to Web Speech on client side
      }
    }

    // Run supervisor analysis and check for auto-escalation
    let autoEscalated = false;
    let autoEscalationMessage = '';
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

    return {
      text: responseText,
      audioBase64,
      audioType: 'audio/mpeg',
      transcript: session.transcript,
      supervisorAlert: getLatestSupervisorAlert(session),
      autoEscalated,
      autoEscalationMessage,
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
      const { agentCallSessionsDB } = await import('../db/index.js');
      if (agentCallSessionsDB) {
        await agentCallSessionsDB.create({
          id: session.id,
          userId: session.userId,
          agentId: session.agentId,
          status: session.status,
          transcript: JSON.stringify(session.transcript),
          supervisorNotes: JSON.stringify(session.supervisorNotes),
          summary: session.summary,
          duration: durationSec,
          escalatedTo: '',
          escalatedAt: '',
          createdAt: session.startedAt,
          endedAt: session.endedAt,
        });
      }
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

  // ═══ POST /:id/escalate — Trigger escalation to human ════════════════════
  app.post('/:id/escalate', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const session = activeSessions.get(id);
    if (!session) return reply.status(404).send({ error: { message: 'Session not found' } });
    if (session.userId !== request.userId) return reply.status(403).send({ error: { message: 'Not your session' } });

    session.status = 'escalated';

    const agent = AGENTS.find(a => a.id === session.agentId)!;
    const escalationResult = await triggerTwilioEscalation(session, agent);

    // Add escalation note to transcript
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  TWILIO INBOUND IVR — Call the Twilio number → AI agent via phone
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══ POST /twilio/incoming — Main entry: incoming call to Twilio number ════
  app.post('/twilio/incoming', async (request: any, reply) => {
    const body = request.body as any;
    const callerPhone = body?.From || 'Unknown';
    const callSid = body?.CallSid || '';
    logger.info(`Incoming Twilio call from ${callerPhone} (SID: ${callSid})`);

    // IVR Menu: Press 1-4 for an agent
    const agentMenu = AGENTS.map((a, i) => `Press ${i + 1} for ${a.name}, ${a.specialty}.`).join(' ');
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Welcome to Circle for Life AI Support. ${escapeXml(agentMenu)} Or press 0 to speak with a real person.</Say>
  <Gather numDigits="1" action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/agent-select?from=${encodeURIComponent(callerPhone)}&amp;callSid=${encodeURIComponent(callSid)}" method="POST" timeout="10">
    <Say voice="Polly.Joanna">Please press a number now.</Say>
  </Gather>
  <Say voice="Polly.Joanna">We didn't receive a selection. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/agent-select — Handle DTMF digit → start AI session ═════
  app.post('/twilio/agent-select', async (request: any, reply) => {
    const body = request.body as any;
    const digit = body?.Digits;
    const callerPhone = (request.query as any)?.from || body?.From || 'Unknown';
    const callSid = (request.query as any)?.callSid || body?.CallSid || '';
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

    logger.info(`Twilio agent select: digit=${digit}, caller=${callerPhone}`);

    // Press 0 → dial admin directly
    if (digit === '0') {
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      if (adminPhone) {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to a real person now. Please hold.</Say>
  <Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || '')}">${escapeXml(adminPhone)}</Dial>
  <Say voice="Polly.Joanna">The call could not be connected. Please try again later. Goodbye.</Say>
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
  <Say voice="Polly.Joanna">Invalid selection. Goodbye.</Say>
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

    // Say the greeting and start listening
    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">You are now connected with ${escapeXml(agent.name)}, ${escapeXml(agent.specialty)}.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">${escapeXml(agent.greeting)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/converse?session=${encodeURIComponent(sessionId)}" method="POST" timeout="15">
    <Say voice="Polly.Joanna">Go ahead, I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't hear anything. If you'd like to continue, please call back. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/converse — Speech-to-AI loop ════════════════════════════
  app.post('/twilio/converse', async (request: any, reply) => {
    const body = request.body as any;
    const sessionId = (request.query as any)?.session;
    const speechResult = body?.SpeechResult || '';
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

    const session = sessionId ? activeSessions.get(sessionId) : null;
    if (!session || session.status !== 'active') {
      reply.type('text/xml');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Joanna">Session ended. Goodbye.</Say></Response>`;
    }

    if (!speechResult.trim()) {
      // No speech detected — prompt again
      reply.type('text/xml');
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/converse?session=${encodeURIComponent(sessionId)}" method="POST" timeout="15">
    <Say voice="Polly.Joanna">I'm still here. Please go ahead.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't hear anything. Goodbye.</Say>
</Response>`;
    }

    logger.info(`Phone converse [${sessionId}]: "${speechResult}"`);

    // Add user message
    const userTime = new Date().toISOString();
    session.transcript.push({ role: 'user', text: speechResult, timestamp: userTime });

    // Get AI response
    const agent = AGENTS.find(a => a.id === session.agentId)!;
    let responseText = "I'm sorry, I couldn't process that. Could you try again?";

    let llmFailed = false;

    if (session.providerConfig && session.providerConfig.apiKey) {
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: agent.systemPrompt },
          ...session.transcript.filter(t => t.role !== 'system').map(t => ({
            role: t.role === 'agent' ? 'assistant' as const : 'user' as const,
            content: t.text,
          })),
        ];

        logger.info(`Phone LLM call: provider=${session.providerConfig.provider}, model=${session.providerConfig.model || 'default'}, baseUrl=${session.providerConfig.baseUrl || 'none'}`);

        const resp = await ControlPanelService.chat({
          provider: session.providerConfig,
          messages,
          maxTokens: 250,  // Shorter for phone (faster TTS)
          temperature: 0.7,
        });
        responseText = resp.content;
      } catch (e: any) {
        logger.error('Phone AI error:', e.message, e.response?.status, e.response?.data);
        llmFailed = true;
      }
    } else {
      logger.error('Phone call: No LLM provider configured for session', sessionId);
      llmFailed = true;
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

      if (adminPhone) {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm experiencing a technical issue. Let me connect you with a real person right away. Please hold.</Say>
  <Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || '')}" timeout="30">${escapeXml(adminPhone)}</Dial>
  <Say voice="Polly.Joanna">I'm sorry, the call could not be connected. Please try again later. Goodbye.</Say>
</Response>`;
      } else {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, I'm having technical difficulties and no support staff is available right now. Please try again later. Goodbye.</Say>
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
      // Auto-escalate: connect to admin phone
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      session.status = 'escalated';
      session.transcript.push({
        role: 'system',
        text: 'Auto-escalated to human support via phone.',
        timestamp: new Date().toISOString(),
      });
      logger.info(`Phone call auto-escalated: ${sessionId}`);

      if (adminPhone) {
        reply.type('text/xml');
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(responseText)}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">I'm going to connect you with a real person who can help. Please hold.</Say>
  <Dial callerId="${escapeXml(process.env.TWILIO_PHONE_NUMBER || '')}">${escapeXml(adminPhone)}</Dial>
  <Say voice="Polly.Joanna">The call could not be connected. Please try calling back. Goodbye.</Say>
</Response>`;
      }
    }

    // Normal response: say the AI response and gather more speech
    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(responseText)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(serverUrl)}/v1/agent-calls/twilio/converse?session=${encodeURIComponent(sessionId)}" method="POST" timeout="20">
    <Pause length="1"/>
  </Gather>
  <Say voice="Polly.Joanna">I haven't heard from you in a while. If you need more help, please call back. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/voice — TwiML webhook for outbound escalation calls ═════
  app.post('/twilio/voice', async (request: any, reply) => {
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

    reply.type('text/xml');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(sayText)}</Say>
  <Pause length="2"/>
  <Say voice="alice">The full transcript is available in the Circle for Life admin panel. Goodbye.</Say>
</Response>`;
  });

  // ═══ POST /twilio/status — Twilio status callback ════════════════════════
  app.post('/twilio/status', async (request: any) => {
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
          logger.info(`Phone session ${sess.id} ended via Twilio status: ${status}`);
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
      'DEFAULT_LLM_PROVIDER', 'DEFAULT_LLM_KEY',
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
    const serverUrl = process.env.SERVER_URL;
    if (serverUrl && !serverUrl.includes('localhost') && !serverUrl.includes('127.0.0.1')) {
      callParams.StatusCallback = `${serverUrl}/v1/agent-calls/twilio/status`;
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

// ─── Phone Call Provider Configuration ────────────────────────────────────────
// For inbound phone calls, we need a default LLM provider. This checks env vars
// or falls back to the Kaggle/Ollama setup.

function getPhoneCallProvider(): ProviderConfig | null {
  // Priority 1: Dedicated phone LLM provider env vars
  if (process.env.PHONE_LLM_PROVIDER && process.env.PHONE_LLM_API_KEY) {
    logger.info('Phone LLM: using dedicated PHONE_LLM_PROVIDER=' + process.env.PHONE_LLM_PROVIDER);
    return {
      provider: process.env.PHONE_LLM_PROVIDER as any,
      apiKey: process.env.PHONE_LLM_API_KEY,
      model: process.env.PHONE_LLM_MODEL,
      baseUrl: process.env.PHONE_LLM_BASE_URL,
    };
  }

  // Priority 2: Explicit default provider
  if (process.env.DEFAULT_LLM_KEY) {
    const prov = process.env.DEFAULT_LLM_PROVIDER || 'groq';
    logger.info('Phone LLM: using DEFAULT_LLM_KEY with provider=' + prov);
    return {
      provider: prov as any,
      apiKey: process.env.DEFAULT_LLM_KEY,
      model: process.env.DEFAULT_LLM_MODEL,
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
      logger.info(`Phone LLM: auto-detected ${d.env} → provider=${d.provider}`);
      return {
        provider: d.provider as any,
        apiKey: process.env[d.env]!,
        model: d.model,
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
