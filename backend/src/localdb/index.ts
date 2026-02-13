/**
 * Circle for Life — Local CSV Database Collections
 *
 * All "collections" using CSV files for local dev/demo.
 * Includes user roles, permissions, and full game loop data.
 *
 * To switch to MongoDB in production, replace imports from
 * this file with the Mongoose models — the field names match.
 */

import { CsvStore } from './csvStore.js';
import { logger } from '../utils/logger.js';

// ─── User Roles & Permissions ───────────────────────────────────────────────

export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'creator' | 'user' | 'guest';

/**
 * Role hierarchy (higher number = more power):
 *   super_admin: 100  — Full system access, can manage admins
 *   admin:        80  — User management, moderation, economy controls
 *   moderator:    60  — Content moderation, user warnings, reports
 *   creator:      40  — Verified creator, extra generation limits, profile badge
 *   user:         20  — Standard registered user
 *   guest:         0  — Read-only, cannot vote or post
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  admin: 80,
  moderator: 60,
  creator: 40,
  user: 20,
  guest: 0,
};

export type Permission =
  | 'users.list'
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.assign_role'
  | 'users.ban'
  | 'users.shadow_ban'
  | 'users.manage_gems'
  | 'posts.create'
  | 'posts.read'
  | 'posts.delete_own'
  | 'posts.delete_any'
  | 'posts.moderate'
  | 'votes.cast'
  | 'votes.view_fraud'
  | 'moderation.view_queue'
  | 'moderation.review'
  | 'moderation.appeal'
  | 'economy.view_health'
  | 'economy.adjust'
  | 'analytics.view'
  | 'analytics.export'
  | 'control_panel.access'
  | 'control_panel.manage_keys'
  | 'system.feature_flags'
  | 'system.config';

/**
 * Role → Permissions mapping.
 * Each role gets its permissions + all permissions from lower roles.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  guest: [
    'posts.read',
  ],
  user: [
    'posts.read',
    'posts.create',
    'posts.delete_own',
    'votes.cast',
    'control_panel.access',
  ],
  creator: [
    'posts.read',
    'posts.create',
    'posts.delete_own',
    'votes.cast',
    'control_panel.access',
    'control_panel.manage_keys',
    'analytics.view',
  ],
  moderator: [
    'posts.read',
    'posts.create',
    'posts.delete_own',
    'posts.delete_any',
    'posts.moderate',
    'votes.cast',
    'votes.view_fraud',
    'moderation.view_queue',
    'moderation.review',
    'moderation.appeal',
    'users.list',
    'users.read',
    'users.shadow_ban',
    'control_panel.access',
    'analytics.view',
  ],
  admin: [
    'posts.read',
    'posts.create',
    'posts.delete_own',
    'posts.delete_any',
    'posts.moderate',
    'votes.cast',
    'votes.view_fraud',
    'moderation.view_queue',
    'moderation.review',
    'moderation.appeal',
    'users.list',
    'users.read',
    'users.create',
    'users.update',
    'users.delete',
    'users.assign_role',
    'users.ban',
    'users.shadow_ban',
    'users.manage_gems',
    'economy.view_health',
    'economy.adjust',
    'analytics.view',
    'analytics.export',
    'control_panel.access',
    'control_panel.manage_keys',
    'system.feature_flags',
  ],
  super_admin: [
    'posts.read',
    'posts.create',
    'posts.delete_own',
    'posts.delete_any',
    'posts.moderate',
    'votes.cast',
    'votes.view_fraud',
    'moderation.view_queue',
    'moderation.review',
    'moderation.appeal',
    'users.list',
    'users.read',
    'users.create',
    'users.update',
    'users.delete',
    'users.assign_role',
    'users.ban',
    'users.shadow_ban',
    'users.manage_gems',
    'economy.view_health',
    'economy.adjust',
    'analytics.view',
    'analytics.export',
    'control_panel.access',
    'control_panel.manage_keys',
    'system.feature_flags',
    'system.config',
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if roleA outranks roleB.
 */
export function outranks(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

// ─── User Record Type ───────────────────────────────────────────────────────

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  role: UserRole;
  permissions: string;     // JSON stringified Permission[] for custom overrides
  tier: string;            // 'free' | 'pro' | 'premium'
  gemBalance: number;
  totalGemsEarned: number;
  totalGemsSpent: number;
  totalPosts: number;
  totalVotesReceived: number;
  totalVotesGiven: number;
  followersCount: number;
  followingCount: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  referralCode: string;
  referredBy: string;
  referralCount: number;
  trustScore: number;
  shadowBanned: boolean;
  bannedAt: string;
  banReason: string;
  banExpiresAt: string;
  reportCount: number;
  emailVerified: boolean;
  status: string;          // 'active' | 'suspended' | 'deleted' | 'pending_review'
  notes: string;           // admin notes about this user
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

// ─── CSV Column Definitions ─────────────────────────────────────────────────

const USER_COLUMNS = [
  'id', 'username', 'email', 'passwordHash', 'displayName', 'avatarUrl', 'bio',
  'location', 'website',
  'role', 'permissions', 'tier',
  'gemBalance', 'totalGemsEarned', 'totalGemsSpent',
  'totalPosts', 'totalVotesReceived', 'totalVotesGiven',
  'followersCount', 'followingCount',
  'currentStreak', 'longestStreak', 'lastActiveDate',
  'referralCode', 'referredBy', 'referralCount',
  'trustScore', 'shadowBanned', 'bannedAt', 'banReason', 'banExpiresAt',
  'reportCount', 'emailVerified', 'status', 'notes',
  'createdAt', 'updatedAt', 'lastLoginAt',
];

const POST_COLUMNS = [
  'id', 'userId', 'username', 'userAvatarUrl', 'userTier',
  'prompt', 'refinedPrompt', 'imageUrl', 'thumbnailUrl',
  'model', 'generationTimeMs', 'hasWatermark',
  'voteCount', 'commentCount', 'shareCount', 'viewCount',
  'engagementScore', 'trendingScore', 'hotScore',
  'tags', 'category', 'nsfw', 'nsfwScore',
  'moderationStatus', 'visibility',
  'createdAt', 'updatedAt', 'deletedAt',
];

const VOTE_COLUMNS = [
  'id', 'postId', 'userId', 'postAuthorId',
  'deviceId', 'ipHash',
  'gemAwarded', 'gemBatchId',
  'fraudScore', 'flagged',
  'createdAt',
];

const GEM_TX_COLUMNS = [
  'id', 'userId', 'type', 'source',
  'amount', 'balanceBefore', 'balanceAfter',
  'referenceId', 'referenceType',
  'multiplier', 'baseAmount',
  'description', 'idempotencyKey',
  'createdAt',
];

const FOLLOW_COLUMNS = ['id', 'followerId', 'followingId', 'createdAt'];

const REPORT_COLUMNS = [
  'id', 'reporterId', 'targetType', 'targetId', 'targetUserId',
  'reason', 'description', 'status', 'reviewedBy', 'reviewedAt', 'actionTaken',
  'createdAt',
];

const AUDIT_LOG_COLUMNS = [
  'id', 'actorId', 'actorRole', 'action', 'targetType', 'targetId',
  'details', 'ipAddress',
  'createdAt',
];

const GENERATION_JOB_COLUMNS = [
  'id', 'userId', 'prompt', 'refinedPrompt', 'model', 'priority',
  'status', 'imageUrl', 'thumbnailUrl', 'generationTimeMs',
  'workerId', 'attempts', 'lastError', 'computeCostUsd',
  'createdAt', 'startedAt', 'completedAt',
];

// ─── Blog System ─────────────────────────────────────────────────────────────

const BLOG_POST_COLUMNS = [
  'id', 'authorId', 'authorUsername', 'authorDisplayName', 'authorAvatar',
  'title', 'content', 'contentHtml', 'excerpt',
  'imageUrl', 'tags', 'category',
  'status',         // 'draft' | 'published' | 'archived' | 'removed'
  'likeCount', 'commentCount', 'viewCount', 'shareCount',
  'source',         // 'direct' | 'playground' — where the post was created
  'playgroundData', // JSON: { provider, model, prompt, response } if from playground
  'gemsEarned',     // Total gems earned from this post
  'featured',       // boolean — pinned/featured by admin
  'createdAt', 'updatedAt', 'publishedAt',
];

const BLOG_LIKE_COLUMNS = [
  'id', 'postId', 'userId', 'createdAt',
];

const BLOG_COMMENT_COLUMNS = [
  'id', 'postId', 'userId', 'username', 'displayName',
  'content', 'parentId',   // for replies
  'likeCount',
  'status',     // 'active' | 'removed' | 'flagged'
  'createdAt', 'updatedAt',
];

// ─── P2P Chat System ─────────────────────────────────────────────────────────

const CONVERSATION_COLUMNS = [
  'id', 'participant1Id', 'participant2Id',
  'participant1Name', 'participant2Name',
  'lastMessageText', 'lastMessageAt', 'lastMessageBy',
  'unreadCount1', 'unreadCount2',   // unread for each participant
  'status',       // 'active' | 'blocked' | 'archived'
  'createdAt', 'updatedAt',
];

const CHAT_MESSAGE_COLUMNS = [
  'id', 'conversationId', 'senderId', 'senderName',
  'content', 'contentType',       // 'text' | 'ai_generated' | 'system' | 'image' | 'signal'
  'imageUrl',                     // base64 image data for image messages
  'originalContent',              // pre-translate original text
  'translatedContent',            // AI-translated text
  'language',                     // detected language
  'toneFlag',                     // AI tone detection: 'neutral' | 'angry' | 'happy' | etc
  'toneSuggestion',               // AI suggestion for softening
  'moderationFlag',               // content moderation flags
  'schedulingDetected',           // boolean — AI detected a scheduling intent
  'schedulingData',               // JSON: { date, time, description }
  'aiMetadata',                   // JSON: any extra AI processing data
  'status',                       // 'sent' | 'delivered' | 'read' | 'deleted'
  'createdAt',
];

// ─── Generated Images ────────────────────────────────────────────────────────

const GENERATED_IMAGE_COLUMNS = [
  'id', 'userId', 'prompt', 'negativePrompt',
  'provider', 'model', 'imageUrl',
  'width', 'height',
  'createdAt',
];

// ─── Store Instances (Singletons) ───────────────────────────────────────────

export const usersDB = new CsvStore<LocalUser>('users', USER_COLUMNS);
export const postsDB = new CsvStore<any>('posts', POST_COLUMNS);
export const votesDB = new CsvStore<any>('votes', VOTE_COLUMNS);
export const gemTxDB = new CsvStore<any>('gem_transactions', GEM_TX_COLUMNS);
export const followsDB = new CsvStore<any>('follows', FOLLOW_COLUMNS);
export const reportsDB = new CsvStore<any>('reports', REPORT_COLUMNS);
export const auditLogDB = new CsvStore<any>('audit_log', AUDIT_LOG_COLUMNS);
export const generationJobsDB = new CsvStore<any>('generation_jobs', GENERATION_JOB_COLUMNS);

// Blog stores
export const blogPostsDB = new CsvStore<any>('blog_posts', BLOG_POST_COLUMNS);
export const blogLikesDB = new CsvStore<any>('blog_likes', BLOG_LIKE_COLUMNS);
export const blogCommentsDB = new CsvStore<any>('blog_comments', BLOG_COMMENT_COLUMNS);

// Chat stores
export const conversationsDB = new CsvStore<any>('conversations', CONVERSATION_COLUMNS);
export const chatMessagesDB = new CsvStore<any>('chat_messages', CHAT_MESSAGE_COLUMNS);

// Generated images store
export const generatedImagesDB = new CsvStore<any>('generated_images', GENERATED_IMAGE_COLUMNS);

// System prompts store
const SYSTEM_PROMPT_COLUMNS = [
  'id', 'key', 'label', 'content', 'version', 'updatedAt', 'updatedBy',
];
export const systemPromptsDB = new CsvStore<any>('system_prompts', SYSTEM_PROMPT_COLUMNS);

// Translation history store
const TRANSLATION_HISTORY_COLUMNS = [
  'id', 'userId', 'sourceText', 'sourceLanguage', 'targetLanguage',
  'translatedText', 'provider', 'model', 'sourceType', 'createdAt',
];
export const translationHistoryDB = new CsvStore<any>('translation_history', TRANSLATION_HISTORY_COLUMNS);

// Agent call sessions store
const AGENT_CALL_SESSION_COLUMNS = [
  'id', 'userId', 'agentId', 'status', 'transcript', 'supervisorNotes',
  'summary', 'duration', 'escalatedTo', 'escalatedAt', 'createdAt', 'endedAt',
];
export const agentCallSessionsDB = new CsvStore<any>('agent_call_sessions', AGENT_CALL_SESSION_COLUMNS);

// ─── Seed Default Super Admin ───────────────────────────────────────────────

export async function seedDefaultAdmin(): Promise<void> {
  const existing = usersDB.findOne({ role: 'super_admin' as any });
  if (existing) return;

  // Import bcrypt dynamically to hash the default password
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('admin123456', 12);

  usersDB.create({
    id: 'usr_admin_001',
    username: 'admin',
    email: 'admin@circleforlife.app',
    passwordHash: hash,
    displayName: 'System Admin',
    avatarUrl: '',
    bio: 'Circle for Life administrator',
    role: 'super_admin',
    permissions: '[]',
    tier: 'premium',
    gemBalance: 99999,
    totalGemsEarned: 99999,
    totalGemsSpent: 0,
    totalPosts: 0,
    totalVotesReceived: 0,
    totalVotesGiven: 0,
    followersCount: 0,
    followingCount: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    referralCode: 'ADMIN001',
    referredBy: '',
    referralCount: 0,
    trustScore: 100,
    shadowBanned: false,
    bannedAt: '',
    banReason: '',
    banExpiresAt: '',
    reportCount: 0,
    emailVerified: true,
    status: 'active',
    notes: 'Default super admin — change password immediately',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: '',
  });

  logger.info('Default super_admin created: admin@circleforlife.app / admin123456');
}

// ─── Audit Logger ───────────────────────────────────────────────────────────

export function logAudit(params: {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  ipAddress?: string;
}): void {
  auditLogDB.create({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details || '',
    ipAddress: params.ipAddress || '',
    createdAt: new Date().toISOString(),
  });
}
