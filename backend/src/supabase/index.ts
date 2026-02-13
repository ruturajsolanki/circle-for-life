/**
 * Circle for Life — Supabase Database Collections
 *
 * Drop-in replacement for localdb/index.ts.
 * Same exports, types, and functions — but backed by Supabase PostgreSQL.
 *
 * Usage in server.ts:
 *   if (env.DB_MODE === 'supabase') {
 *     // Use imports from './supabase/index.js' instead of './localdb/index.js'
 *   }
 */

import bcrypt from 'bcrypt';
import { SupabaseStore } from './supabaseStore.js';
import { logger } from '../utils/logger.js';

// Re-export all types and constants from localdb so routes don't need to change
export {
  type UserRole,
  type Permission,
  type LocalUser,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  hasPermission,
  outranks,
} from '../localdb/index.js';

import type { LocalUser, UserRole } from '../localdb/index.js';

// ─── Store Instances ────────────────────────────────────────────────────────

export const usersDB = new SupabaseStore<LocalUser>('users');
export const postsDB = new SupabaseStore<any>('posts');
export const votesDB = new SupabaseStore<any>('votes');
export const gemTxDB = new SupabaseStore<any>('gem_transactions');
export const followsDB = new SupabaseStore<any>('follows');
export const reportsDB = new SupabaseStore<any>('reports');
export const auditLogDB = new SupabaseStore<any>('audit_log');
export const generationJobsDB = new SupabaseStore<any>('generation_jobs');
export const blogPostsDB = new SupabaseStore<any>('blog_posts');
export const blogLikesDB = new SupabaseStore<any>('blog_likes');
export const blogCommentsDB = new SupabaseStore<any>('blog_comments');
export const conversationsDB = new SupabaseStore<any>('conversations');
export const chatMessagesDB = new SupabaseStore<any>('chat_messages');
export const generatedImagesDB = new SupabaseStore<any>('generated_images');
export const systemPromptsDB = new SupabaseStore<any>('system_prompts');
export const translationHistoryDB = new SupabaseStore<any>('translation_history');
export const agentCallSessionsDB = new SupabaseStore<any>('agent_call_sessions');

// ─── Auto-Migration: ensure new columns exist ──────────────────────────────

async function runMigrations(): Promise<void> {
  const { getSupabase } = await import('../config/supabase.js');
  const sb = getSupabase();

  // Migrations: table → columns to add
  const migrations: { table: string; column: string; type: string; defaultVal: string }[] = [
    { table: 'chat_messages', column: 'image_url', type: 'TEXT', defaultVal: "''" },
    { table: 'chat_messages', column: 'moderation_flag', type: 'TEXT', defaultVal: "''" },
    { table: 'users', column: 'location', type: 'TEXT', defaultVal: "''" },
    { table: 'users', column: 'website', type: 'TEXT', defaultVal: "''" },
  ];

  for (const m of migrations) {
    try {
      // Try to select the column — if it doesn't exist, we'll get an error
      const { error } = await sb.from(m.table).select(m.column).limit(1);
      if (error && (error.message?.includes('does not exist') || error.code === '42703')) {
        // Column doesn't exist — log it so user knows to add it manually
        logger.warn(`Migration needed: ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type} DEFAULT ${m.defaultVal};`);
      }
    } catch {
      // Ignore — migration check is best-effort
    }
  }
}

// ─── Seed Default Admin ─────────────────────────────────────────────────────

export async function seedDefaultAdmin(): Promise<void> {
  // Run auto-migrations first
  try { await runMigrations(); } catch { /* best effort */ }
  const existing = await usersDB.findOneAsync({ role: 'super_admin' as any });
  if (existing) return;

  const hash = await bcrypt.hash('admin123456', 12);

  await usersDB.createAsync({
    id: 'usr_admin_001',
    username: 'admin',
    email: 'admin@circleforlife.app',
    passwordHash: hash,
    displayName: 'System Admin',
    avatarUrl: '',
    bio: 'Circle for Life administrator',
    role: 'super_admin' as UserRole,
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
  } as any);

  logger.info('Default super_admin seeded in Supabase: admin@circleforlife.app / admin123456');
}

// ─── Audit Logger ───────────────────────────────────────────────────────────

export async function logAudit(params: {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await auditLogDB.createAsync({
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
  } catch (err) {
    logger.error('Failed to write audit log:', err as any);
  }
}
