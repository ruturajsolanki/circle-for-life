/**
 * Circle for Life — P2P Chat Routes
 *
 * Real user-to-user chat system with AI-powered features:
 *   - Auto-translate (any language)
 *   - Tone check ("you sound angry, soften this?")
 *   - Smart scheduling detection
 *
 * Level-gated: Preview at Lv9, Full at Lv10.
 * Every user in chat has earned their way here — bot-free zone.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SafetyService } from '../services/safety.service.js';
import {
  usersDB,
  conversationsDB,
  chatMessagesDB,
  logAudit,
} from '../db/index.js';
import { localAuthenticate } from '../middleware/rbac.middleware.js';
import { hasFeatureUnlock } from '../services/levels.service.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000000),
  contentType: z.enum(['text', 'ai_generated', 'image', 'signal']).default('text'),
  imageUrl: z.string().max(10000000).optional(), // base64 image data
});

const startConversationSchema = z.object({
  targetUserId: z.string().min(1),
  message: z.string().min(1).max(10000),
});

// ─── Simple AI Processing (built-in, no external API needed) ──────────────

function detectLanguage(text: string): string {
  const cjk = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text);
  const cyrillic = /[\u0400-\u04FF]/.test(text);
  const arabic = /[\u0600-\u06FF]/.test(text);
  const devanagari = /[\u0900-\u097F]/.test(text);
  const korean = /[\uAC00-\uD7AF]/.test(text);

  if (cjk) return 'zh/ja';
  if (cyrillic) return 'ru';
  if (arabic) return 'ar';
  if (devanagari) return 'hi';
  if (korean) return 'ko';
  return 'en';
}

function detectTone(text: string): { flag: string; suggestion: string } {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // Expanded word lists with weights
  const angryPatterns = [
    'hate', 'stupid', 'idiot', 'terrible', 'worst', 'angry', 'furious', 'disgusting',
    'pathetic', 'useless', 'shut up', 'wtf', 'damn', 'fuck', 'shit', 'ass', 'hell',
    'piss', 'crap', 'ridiculous', 'absurd', 'outrageous', 'sick of', 'fed up',
    'can\'t stand', 'enough', 'unacceptable', 'rubbish', 'trash', 'garbage',
    'moron', 'fool', 'dumb', 'ugh', 'argh', 'stfu', 'bullshit', 'bs',
    'annoying', 'irritating', 'infuriating', 'pissed', 'mad', 'livid',
  ];
  const frustratedPatterns = [
    'frustrated', 'annoyed', 'bothered', 'not working', 'broken', 'bug',
    'why won\'t', 'keeps failing', 'again', 'still not', 'how many times',
    'seriously', 'come on', 'for real', 'tired of', 'waste of time', 'smh',
    'ffs', 'can\'t believe', 'impossible', 'stuck', 'confused',
  ];
  const happyPatterns = [
    'love', 'amazing', 'awesome', 'great', 'wonderful', 'fantastic', 'excellent',
    'beautiful', 'happy', 'excited', 'yay', 'incredible', 'brilliant', 'perfect',
    'thank', 'thanks', 'lol', 'haha', 'lmao', 'nice', 'cool', 'sweet',
    'congratulations', 'congrats', 'well done', 'bravo', 'cheers', '❤',
    'best', 'superb', 'outstanding', 'delighted', 'thrilled', 'grateful',
  ];
  const sadPatterns = [
    'sad', 'depressed', 'lonely', 'crying', 'hurt', 'disappointed', 'sorry',
    'unfortunate', 'miss you', 'heartbroken', 'devastated', 'miserable', 'grief',
    'lost', 'hopeless', 'helpless', 'regret', 'sorrow', 'tears', 'alone',
    'broken', 'empty', 'pain', 'suffering', 'give up', 'can\'t anymore',
  ];
  const sarcasticPatterns = [
    'oh great', 'wow thanks', 'sure thing', 'yeah right', 'oh really',
    'how wonderful', 'just perfect', 'as if', 'oh joy', 'brilliant idea',
    'what a surprise', 'genius', 'clearly', 'obviously', 'naturally',
  ];

  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const capsRatio = text.replace(/[^a-zA-Z]/g, '').length > 3
    ? text.replace(/[^A-Z]/g, '').length / text.replace(/[^a-zA-Z]/g, '').length
    : 0;
  const hasAllCaps = capsRatio > 0.6 && text.length > 5;
  const repeatChars = /(.)\1{2,}/g.test(text); // "nooo", "whyyy"
  const multiExclaim = exclamationCount >= 2;
  const multiQuestion = questionCount >= 3;

  // Score each tone
  let angryScore = angryPatterns.filter(w => lower.includes(w)).length * 1.5;
  let frustratedScore = frustratedPatterns.filter(w => lower.includes(w)).length * 1.2;
  let happyScore = happyPatterns.filter(w => lower.includes(w)).length;
  let sadScore = sadPatterns.filter(w => lower.includes(w)).length * 1.2;
  let sarcasticScore = sarcasticPatterns.filter(w => lower.includes(w)).length * 2;

  // Modifiers
  if (hasAllCaps) { angryScore += 3; frustratedScore += 2; }
  if (multiExclaim && hasAllCaps) { angryScore += 2; }
  if (multiExclaim && !hasAllCaps) { happyScore += 1; }
  if (repeatChars) { angryScore += 1; sadScore += 0.5; frustratedScore += 1; }
  if (multiQuestion) { frustratedScore += 1.5; }

  // Emoji-based detection
  const angryEmojis = ['😡', '🤬', '😤', '💢', '👿', '🖕'];
  const happyEmojis = ['😊', '😄', '😁', '🎉', '❤️', '💕', '🥰', '😍', '🙌', '👍', '✨', '🔥'];
  const sadEmojis = ['😢', '😭', '😞', '😔', '💔', '🥺', '😿'];
  angryScore += angryEmojis.filter(e => text.includes(e)).length * 2;
  happyScore += happyEmojis.filter(e => text.includes(e)).length * 1.5;
  sadScore += sadEmojis.filter(e => text.includes(e)).length * 2;

  // Determine winner
  const scores: [string, number][] = [
    ['angry', angryScore],
    ['frustrated', frustratedScore],
    ['happy', happyScore],
    ['sad', sadScore],
    ['sarcastic', sarcasticScore],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [topTone, topScore] = scores[0];

  // Need a minimum threshold to flag (1 match isn't enough)
  if (topScore < 1.5) {
    return { flag: 'neutral', suggestion: '' };
  }

  const suggestions: Record<string, string> = {
    angry: 'This message sounds heated. Consider rephrasing with a calmer tone.',
    frustrated: 'Your frustration is understandable. Maybe try explaining the issue more clearly?',
    happy: '',
    sad: 'This sounds heavy. Hope everything is okay.',
    sarcastic: 'This reads as sarcastic. The other person might misunderstand.',
  };

  return {
    flag: topTone,
    suggestion: suggestions[topTone] || '',
  };
}

function detectScheduling(text: string): { detected: boolean; data: string } {
  const lower = text.toLowerCase();
  const schedulingPatterns = [
    /let'?s meet (tomorrow|today|next \w+|on \w+)/i,
    /how about (tomorrow|today|next \w+|on \w+)/i,
    /see you (tomorrow|today|at \d|next)/i,
    /meeting at (\d{1,2}(:\d{2})?\s*(am|pm)?)/i,
    /schedule.*(call|meeting|chat).*(at|on|for)/i,
    /(\d{1,2}(:\d{2})?\s*(am|pm))/i,
    /(tomorrow|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];

  for (const pattern of schedulingPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return {
        detected: true,
        data: JSON.stringify({
          matchedText: match[0],
          suggestion: `Detected scheduling intent: "${match[0]}". Would you like to add this to your calendar?`,
        }),
      };
    }
  }
  return { detected: false, data: '' };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {

  function checkChatAccess(user: any): { allowed: boolean; message: string } {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return { allowed: true, message: '' };
    }
    const gems = Number(user.totalGemsEarned) || 0;
    const hasP2P = hasFeatureUnlock(gems, 'p2p_chat');
    const hasPreview = hasFeatureUnlock(gems, 'p2p_preview');

    if (hasP2P) return { allowed: true, message: '' };
    if (hasPreview) return { allowed: true, message: 'preview' };
    return {
      allowed: false,
      message: 'P2P Chat unlocks at Level 10 — Eternal. You need to earn more gems to access this feature!',
    };
  }

  // ═══ GET /conversations — List user's conversations ═════════════════════
  app.get('/conversations', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const userId = request.userId;
    const user = await usersDB.findById(userId);
    if (!user) return reply.status(401).send({ error: { message: 'User not found' } });

    const access = checkChatAccess(user);
    if (!access.allowed) {
      return reply.status(403).send({ error: { message: access.message, code: 'CHAT_LOCKED' } });
    }

    const all = await conversationsDB.findAll();
    const convos = all.filter((c: any) =>
      c.participant1Id === userId || c.participant2Id === userId
    ).sort((a: any, b: any) =>
      new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
    );

    const enriched = [];
    for (const c of convos) {
      const isP1 = c.participant1Id === userId;
      const otherId = isP1 ? c.participant2Id : c.participant1Id;
      const otherUser = await usersDB.findById(otherId);
      enriched.push({
        ...c,
        otherUser: otherUser ? {
          id: otherUser.id,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatarUrl: otherUser.avatarUrl || '',
        } : null,
        unreadCount: isP1 ? Number(c.unreadCount1) || 0 : Number(c.unreadCount2) || 0,
      });
    }

    return { conversations: enriched, isPreview: access.message === 'preview' };
  });

  // ═══ POST /conversations — Start new conversation ═══════════════════════
  app.post('/conversations', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const userId = request.userId;
    const user = await usersDB.findById(userId);
    if (!user) return reply.status(401).send({ error: { message: 'User not found' } });

    const access = checkChatAccess(user);
    if (!access.allowed) {
      return reply.status(403).send({ error: { message: access.message, code: 'CHAT_LOCKED' } });
    }

    const body = startConversationSchema.parse(request.body);
    const targetUser = await usersDB.findById(body.targetUserId);
    if (!targetUser) {
      return reply.status(404).send({ error: { message: 'User not found' } });
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isAdmin) {
      const targetAccess = checkChatAccess(targetUser);
      if (!targetAccess.allowed) {
        return reply.status(400).send({
          error: { message: `${targetUser.displayName || targetUser.username} hasn't unlocked P2P Chat yet.` },
        });
      }
    }

    // Check for existing conversation
    const all = await conversationsDB.findAll();
    const existing = all.find((c: any) =>
      (c.participant1Id === userId && c.participant2Id === body.targetUserId) ||
      (c.participant1Id === body.targetUserId && c.participant2Id === userId)
    );

    if (existing) {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const tone = detectTone(body.message);
      const lang = detectLanguage(body.message);
      const sched = detectScheduling(body.message);

      const message = {
        id: msgId,
        conversationId: existing.id,
        senderId: userId,
        senderName: user.displayName || user.username,
        content: body.message,
        contentType: 'text',
        originalContent: '',
        translatedContent: '',
        language: lang,
        toneFlag: tone.flag,
        toneSuggestion: tone.suggestion,
        schedulingDetected: sched.detected,
        schedulingData: sched.data,
        aiMetadata: '',
        status: 'sent',
        createdAt: now,
      };

      await chatMessagesDB.create(message);

      const isP1 = existing.participant1Id === userId;
      await conversationsDB.updateById(existing.id, {
        lastMessageText: body.message.substring(0, 100),
        lastMessageAt: now,
        lastMessageBy: userId,
        ...(isP1 ? { unreadCount2: (Number(existing.unreadCount2) || 0) + 1 } : { unreadCount1: (Number(existing.unreadCount1) || 0) + 1 }),
        updatedAt: now,
      });

      return { conversation: existing, message, isNew: false };
    }

    // Create new conversation
    const convoId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const conversation = {
      id: convoId,
      participant1Id: userId,
      participant2Id: body.targetUserId,
      participant1Name: user.displayName || user.username,
      participant2Name: targetUser.displayName || targetUser.username,
      lastMessageText: body.message.substring(0, 100),
      lastMessageAt: now,
      lastMessageBy: userId,
      unreadCount1: 0,
      unreadCount2: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await conversationsDB.create(conversation);

    const tone = detectTone(body.message);
    const lang = detectLanguage(body.message);
    const sched = detectScheduling(body.message);

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const message = {
      id: msgId,
      conversationId: convoId,
      senderId: userId,
      senderName: user.displayName || user.username,
      content: body.message,
      contentType: 'text',
      originalContent: '',
      translatedContent: '',
      language: lang,
      toneFlag: tone.flag,
      toneSuggestion: tone.suggestion,
      schedulingDetected: sched.detected,
      schedulingData: sched.data,
      aiMetadata: '',
      status: 'sent',
      createdAt: now,
    };

    await chatMessagesDB.create(message);
    await usersDB.increment(userId, 'gemBalance', 3);
    await usersDB.increment(userId, 'totalGemsEarned', 3);

    return reply.status(201).send({ conversation, message, isNew: true, gemsAwarded: 3 });
  });

  // ═══ GET /conversations/:id/messages — Get messages ═════════════════════
  app.get('/conversations/:id/messages', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const userId = request.userId;
    const query = request.query as any;
    const limit = Math.min(100, parseInt(query.limit) || 50);
    const before = query.before || '';

    const convo = await conversationsDB.findById(id);
    if (!convo) return reply.status(404).send({ error: { message: 'Conversation not found' } });

    if (convo.participant1Id !== userId && convo.participant2Id !== userId) {
      return reply.status(403).send({ error: { message: 'Not a participant' } });
    }

    let messages = await chatMessagesDB.findMany({ conversationId: id } as any);
    // Filter out signal messages (WebRTC) from display — both proper signals and fallback [signal] prefix
    messages = messages.filter((m: any) => {
      if (m.contentType === 'signal') return false;
      if (m.content && typeof m.content === 'string' && m.content.startsWith('[signal]')) return false;
      return true;
    });
    // Recover image data from embedded content if imageUrl column was missing
    messages = messages.map((m: any) => {
      if (!m.imageUrl && m.content && m.content.startsWith('[image]data:image/')) {
        m.imageUrl = m.content.replace('[image]', '');
        m.content = '[image]';
        m.contentType = 'image';
      }
      return m;
    });
    messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (before) {
      const idx = messages.findIndex((m: any) => m.id === before);
      if (idx > 0) messages = messages.slice(Math.max(0, idx - limit), idx);
    } else {
      messages = messages.slice(-limit);
    }

    const isP1 = convo.participant1Id === userId;
    await conversationsDB.updateById(id, isP1 ? { unreadCount1: 0 } : { unreadCount2: 0 });

    return { messages };
  });

  // ═══ POST /conversations/:id/messages — Send message ════════════════════
  app.post('/conversations/:id/messages', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const userId = request.userId;
    const body = sendMessageSchema.parse(request.body);

    const convo = await conversationsDB.findById(id);
    if (!convo) return reply.status(404).send({ error: { message: 'Conversation not found' } });
    if (convo.participant1Id !== userId && convo.participant2Id !== userId) {
      return reply.status(403).send({ error: { message: 'Not a participant' } });
    }

    const user = await usersDB.findById(userId);
    const now = new Date().toISOString();

    // Signal messages (WebRTC) — skip all processing, just store and return
    if (body.contentType === 'signal') {
      const msgId = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const message: any = {
        id: msgId, conversationId: id, senderId: userId,
        senderName: user?.displayName || user?.username || 'Unknown',
        content: body.content, contentType: 'signal',
        toneFlag: '', toneSuggestion: '', moderationFlag: '', imageUrl: '',
        originalContent: '', translatedContent: '', language: '',
        schedulingDetected: false, schedulingData: '', aiMetadata: '',
        status: 'sent', createdAt: now,
      };
      try {
        await chatMessagesDB.create(message);
      } catch (sigErr: any) {
        // Fallback: DB might not support 'signal' contentType — prefix content and store as 'text'
        const fallback: any = { ...message, contentType: 'text', content: '[signal]' + body.content };
        delete fallback.imageUrl;
        delete fallback.moderationFlag;
        try {
          await chatMessagesDB.create(fallback);
        } catch (e2) {
          return reply.status(500).send({ error: { message: 'Failed to store signal' } });
        }
      }
      return reply.status(201).send({ message });
    }

    // Safety scan P2P messages
    const safetyResult = await SafetyService.scan(body.content);
    let moderationFlag = '';
    if (!safetyResult.isSafe) {
      const highSeverity = safetyResult.violations.filter(v => v.severity === 'high');
      if (highSeverity.length > 0) {
        return reply.status(400).send({
          error: { message: 'Message blocked by safety filter: ' + safetyResult.summary },
          safety: safetyResult,
        });
      }
      // Medium severity: flag but allow through, report to admin
      const medSeverity = safetyResult.violations.filter(v => v.severity === 'medium');
      if (medSeverity.length > 0) {
        moderationFlag = medSeverity.map(v => v.type).join(', ');
        // Report to super admin via audit log
        await logAudit({
          actorId: userId,
          actorRole: user?.role || 'user',
          action: 'content_moderation_flag',
          targetType: 'chat_message',
          targetId: id,
          details: `Flagged message in conversation ${id}: ${moderationFlag}. Content preview: "${body.content.substring(0, 100)}..."`,
        });
      }
    }

    // Abusive/foul language check (additional pattern-based scan)
    const abusePatterns = /\b(fuck|shit|bitch|asshole|dick|pussy|cunt|nigger|faggot|retard|whore|slut)\b/gi;
    const abuseMatches = body.content.match(abusePatterns);
    if (abuseMatches && abuseMatches.length > 0) {
      if (!moderationFlag) moderationFlag = 'foul_language';
      else moderationFlag += ', foul_language';
      // Report to super admin
      await logAudit({
        actorId: userId,
        actorRole: user?.role || 'user',
        action: 'foul_language_detected',
        targetType: 'chat_message',
        targetId: id,
        details: `Foul language detected from ${user?.username || userId} in conversation ${id}: ${abuseMatches.join(', ')}`,
      });
    }

    const tone = detectTone(body.content);
    const lang = detectLanguage(body.content);
    const sched = detectScheduling(body.content);

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const message: any = {
      id: msgId,
      conversationId: id,
      senderId: userId,
      senderName: user?.displayName || user?.username || 'Unknown',
      content: body.content,
      contentType: body.contentType,
      imageUrl: body.imageUrl || '',
      originalContent: '',
      translatedContent: '',
      language: lang,
      toneFlag: tone.flag,
      toneSuggestion: tone.suggestion,
      moderationFlag,
      schedulingDetected: sched.detected,
      schedulingData: sched.data,
      aiMetadata: '',
      status: 'sent',
      createdAt: now,
    };

    try {
      await chatMessagesDB.create(message);
    } catch (createErr: any) {
      // Fallback: strip fields that may not exist in older DB schemas
      const fallbackMsg = { ...message };
      // If imageUrl column doesn't exist, embed in content for image messages
      if (body.contentType === 'image' && body.imageUrl) {
        fallbackMsg.content = '[image]' + body.imageUrl;
      }
      delete fallbackMsg.imageUrl;
      delete fallbackMsg.moderationFlag;
      // If contentType check fails, use 'text'
      if (fallbackMsg.contentType === 'image' || fallbackMsg.contentType === 'signal') {
        fallbackMsg.contentType = 'text';
      }
      try {
        await chatMessagesDB.create(fallbackMsg);
      } catch (retryErr: any) {
        throw createErr; // throw original error
      }
    }

    const isP1 = convo.participant1Id === userId;
    await conversationsDB.updateById(id, {
      lastMessageText: body.content.substring(0, 100),
      lastMessageAt: now,
      lastMessageBy: userId,
      ...(isP1
        ? { unreadCount2: (Number(convo.unreadCount2) || 0) + 1 }
        : { unreadCount1: (Number(convo.unreadCount1) || 0) + 1 }),
      updatedAt: now,
    });

    return reply.status(201).send({ message });
  });

  // ═══ GET /users/available — List chat-eligible users ════════════════════
  app.get('/users/available', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const userId = request.userId;
    const query = request.query as any;
    const search = query.search || '';

    const allUsers = await usersDB.findAll();
    let users = allUsers.filter((u: any) => {
      if (u.id === userId) return false;
      if (u.status !== 'active') return false;
      if (u.shadowBanned === true || u.shadowBanned === 'true') return false;
      return true;
    });

    if (search) {
      const q = search.toLowerCase();
      users = users.filter((u: any) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
      );
    }

    return {
      users: users.map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl || '',
        totalGemsEarned: Number(u.totalGemsEarned) || 0,
        hasChatAccess: hasFeatureUnlock(Number(u.totalGemsEarned) || 0, 'p2p_chat') ||
                       u.role === 'admin' || u.role === 'super_admin',
      })),
    };
  });

  // ═══ POST /ai/tone-check — AI tone analysis ════════════════════════════
  app.post('/ai/tone-check', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const { text } = request.body as any;
    if (!text) return { tone: 'neutral', suggestion: '' };
    const result = detectTone(text);
    return result;
  });

  // ═══ POST /ai/schedule-detect — AI scheduling detection ════════════════
  app.post('/ai/schedule-detect', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const { text } = request.body as any;
    if (!text) return { detected: false, data: '' };
    const result = detectScheduling(text);
    return result;
  });

  // ═══ GET /conversations/:id/signals — Poll WebRTC signals ═══════════════
  // Returns signal messages (call_offer, call_answer, ice, call_end, call_decline)
  // Only returns signals created within the last 30 seconds to avoid stale data
  app.get('/conversations/:id/signals', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const userId = request.userId;
    const query = request.query as any;
    const since = query.since || ''; // ISO timestamp

    const convo = await conversationsDB.findById(id);
    if (!convo) return reply.status(404).send({ error: { message: 'Conversation not found' } });
    if (convo.participant1Id !== userId && convo.participant2Id !== userId) {
      return reply.status(403).send({ error: { message: 'Not a participant' } });
    }

    let messages = await chatMessagesDB.findMany({ conversationId: id } as any);
    // Only signal messages from the other user
    const signals = messages.filter((m: any) => {
      // Check for proper signal OR fallback signal stored as text with [signal] prefix
      const isSignal = m.contentType === 'signal' || (m.content && m.content.startsWith('[signal]'));
      if (!isSignal) return false;
      if (m.senderId === userId) return false;
      // Only return recent signals (last 30 seconds) to avoid stale offers
      const age = Date.now() - new Date(m.createdAt).getTime();
      if (age > 30000) return false;
      // If a `since` filter is provided, only return newer signals
      if (since && new Date(m.createdAt).getTime() <= new Date(since).getTime()) return false;
      return true;
    }).map((m: any) => {
      // Reconstruct fallback signals
      if (m.content && m.content.startsWith('[signal]')) {
        m.content = m.content.replace('[signal]', '');
        m.contentType = 'signal';
      }
      return m;
    });

    return { signals };
  });

  // ═══ GET /incoming-calls — Global poll for incoming calls across all conversations ═══
  app.get('/incoming-calls', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const userId = request.userId;
    // Find all conversations this user is part of
    const allConvos = await conversationsDB.findMany({} as any);
    const myConvos = allConvos.filter((c: any) => c.participant1Id === userId || c.participant2Id === userId);

    const incomingCalls: any[] = [];
    for (const convo of myConvos) {
      const messages = await chatMessagesDB.findMany({ conversationId: convo.id } as any);
      for (const m of messages as any[]) {
        const isSignal = m.contentType === 'signal' || (m.content && m.content.startsWith('[signal]'));
        if (!isSignal) continue;
        if (m.senderId === userId) continue;
        const age = Date.now() - new Date(m.createdAt).getTime();
        if (age > 30000) continue; // Only recent signals (30s)
        let content = m.content;
        if (content.startsWith('[signal]')) content = content.replace('[signal]', '');
        try {
          const sig = JSON.parse(content);
          if (sig.type === 'call_offer') {
            incomingCalls.push({
              conversationId: convo.id,
              signal: sig,
              senderName: m.senderName || sig.callerName || 'Unknown',
              senderId: m.senderId,
              createdAt: m.createdAt,
            });
          }
        } catch (e) {}
      }
    }
    return { incomingCalls };
  });

  // ═══ PUT /heartbeat — Update user online status ═══════════════════════════
  app.put('/heartbeat', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const userId = request.userId;
    try {
      await usersDB.updateById(userId, {
        lastActiveDate: new Date().toISOString(),
      });
    } catch (e) {}
    return { ok: true };
  });

  // ═══ GET /users/:id/status — Get user online status ══════════════════════
  app.get('/users/:uid/status', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const { uid } = request.params as any;
    const targetUser = await usersDB.findById(uid);
    if (!targetUser) return { online: false, lastSeen: '' };

    const lastActive = targetUser.lastActiveDate || targetUser.lastLoginAt || '';
    if (!lastActive) return { online: false, lastSeen: '' };

    const msSinceActive = Date.now() - new Date(lastActive).getTime();
    const isOnline = msSinceActive < 60000; // Active within last 60 seconds

    return {
      online: isOnline,
      lastSeen: lastActive,
    };
  });
}
