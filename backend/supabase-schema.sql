-- ═══════════════════════════════════════════════════════════════════════════
-- Circle for Life — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('super_admin','admin','moderator','creator','user','guest')),
  permissions JSONB DEFAULT '[]'::jsonb,
  tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free','pro','premium')),
  gem_balance INTEGER DEFAULT 0,
  total_gems_earned INTEGER DEFAULT 0,
  total_gems_spent INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  total_votes_received INTEGER DEFAULT 0,
  total_votes_given INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date TIMESTAMPTZ,
  referral_code TEXT UNIQUE,
  referred_by TEXT DEFAULT '',
  referral_count INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 50,
  shadow_banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  ban_reason TEXT DEFAULT '',
  ban_expires_at TIMESTAMPTZ,
  report_count INTEGER DEFAULT 0,
  email_verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','suspended','deleted','pending_review')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- ─── Blog Posts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  author_username TEXT DEFAULT '',
  author_display_name TEXT DEFAULT '',
  author_avatar TEXT DEFAULT '',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  status TEXT DEFAULT 'published'
    CHECK (status IN ('draft','published','archived','removed')),
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'direct'
    CHECK (source IN ('direct','playground')),
  playground_data JSONB,
  gems_earned INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_created ON blog_posts(created_at DESC);

-- ─── Blog Likes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- ─── Blog Comments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  username TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  content TEXT NOT NULL,
  parent_id TEXT DEFAULT '',
  like_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','removed','flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);

-- ─── Conversations (P2P Chat) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  participant1_id TEXT NOT NULL REFERENCES users(id),
  participant2_id TEXT NOT NULL REFERENCES users(id),
  participant1_name TEXT DEFAULT '',
  participant2_name TEXT DEFAULT '',
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ,
  last_message_by TEXT DEFAULT '',
  unread_count1 INTEGER DEFAULT 0,
  unread_count2 INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','blocked','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_p1 ON conversations(participant1_id);
CREATE INDEX idx_conversations_p2 ON conversations(participant2_id);

-- ─── Chat Messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_name TEXT DEFAULT '',
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text'
    CHECK (content_type IN ('text','ai_generated','system','image','signal')),
  image_url TEXT DEFAULT '',
  original_content TEXT DEFAULT '',
  translated_content TEXT DEFAULT '',
  language TEXT DEFAULT 'en',
  tone_flag TEXT DEFAULT 'neutral',
  tone_suggestion TEXT DEFAULT '',
  moderation_flag TEXT DEFAULT '',
  scheduling_detected BOOLEAN DEFAULT FALSE,
  scheduling_data JSONB,
  ai_metadata JSONB,
  status TEXT DEFAULT 'sent'
    CHECK (status IN ('sent','delivered','read','deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_convo ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- ─── Gem Transactions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gem_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  reference_id TEXT DEFAULT '',
  reference_type TEXT DEFAULT '',
  multiplier REAL DEFAULT 1.0,
  base_amount INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  idempotency_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gem_tx_user ON gem_transactions(user_id);

-- ─── Votes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  post_author_id TEXT DEFAULT '',
  device_id TEXT DEFAULT '',
  ip_hash TEXT DEFAULT '',
  gem_awarded BOOLEAN DEFAULT FALSE,
  gem_batch_id TEXT DEFAULT '',
  fraud_score REAL DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Follows ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id),
  following_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- ─── Reports ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_user_id TEXT DEFAULT '',
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  reviewed_by TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit Log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);

-- ─── Generated Images ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  prompt TEXT NOT NULL,
  negative_prompt TEXT DEFAULT '',
  provider TEXT NOT NULL,
  model TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  width INTEGER DEFAULT 1024,
  height INTEGER DEFAULT 1024,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_images_user ON generated_images(user_id);
CREATE INDEX idx_generated_images_created ON generated_images(created_at DESC);

-- ─── System Prompts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_prompts (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT ''
);

-- ─── Translation History ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translation_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  source_text TEXT NOT NULL,
  source_language TEXT DEFAULT '',
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider TEXT DEFAULT '',
  model TEXT DEFAULT '',
  source_type TEXT DEFAULT 'text'
    CHECK (source_type IN ('text','voice')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translation_history_user ON translation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_translation_history_created ON translation_history(created_at DESC);

-- ─── Supabase Storage bucket for images ────────────────────────────────────
-- Run this AFTER the tables above:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', true);

-- ─── Enable Row Level Security (optional, for direct client access) ─────
-- For now we skip RLS since our backend handles all access control.
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
-- etc.

-- ─── Migrations for existing deployments ─────────────────────────────────
-- Add image_url and moderation_flag to chat_messages (safe to re-run)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS moderation_flag TEXT DEFAULT '';
-- Update content_type CHECK to allow 'image' and 'signal'
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_content_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_content_type_check
  CHECK (content_type IN ('text','ai_generated','system','image','signal'));
-- Add location and website to users (for profile page)
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';

-- ─── Agent Call Sessions (persistent call logs) ─────────────────────────────
CREATE TABLE IF NOT EXISTS agent_call_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ended',
  source TEXT NOT NULL DEFAULT 'browser',
  caller_phone TEXT DEFAULT '',
  transcript JSONB DEFAULT '[]'::jsonb,
  supervisor_notes JSONB DEFAULT '[]'::jsonb,
  summary TEXT DEFAULT '',
  duration INTEGER DEFAULT 0,
  escalated_to TEXT DEFAULT '',
  escalated_at TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_user ON agent_call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_call_sessions_created ON agent_call_sessions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Done! Your database is ready for Circle for Life.
-- ═══════════════════════════════════════════════════════════════════════════
