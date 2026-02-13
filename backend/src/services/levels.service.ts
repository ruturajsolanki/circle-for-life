/**
 * Circle for Life — Level & Progression System
 *
 * 10-tier progression system based on total gems earned.
 * Each level unlocks new features, perks, and dashboard sections.
 *
 * Level flow:
 *   Newcomer → Explorer → Creator → Influencer → Champion →
 *   Legend → Mythic → Titan → Ascendant → Eternal
 */

// ─── Level Definitions ──────────────────────────────────────────────────────

export interface LevelDef {
  level: number;
  name: string;
  title: string;          // Display title
  minGems: number;        // Total gems earned threshold
  icon: string;           // Emoji icon
  color: string;          // Theme color (hex)
  perks: string[];        // Human-readable perk descriptions
  unlocks: string[];      // Feature unlock keys (used for gating)
  dailyGenLimit: number;  // Daily AI generation limit
  voteMultiplier: number; // Gem multiplier on received votes
  badge: string;          // Profile badge text
}

export const LEVELS: LevelDef[] = [
  {
    level: 1,
    name: 'newcomer',
    title: 'Newcomer',
    minGems: 0,
    icon: '🌱',
    color: '#71717A',
    perks: [
      'Access to Circle Feed',
      'Basic AI chat (cloud providers)',
      '5 AI generations per day',
      'Standard voting',
    ],
    unlocks: ['feed', 'chat_basic', 'profile'],
    dailyGenLimit: 5,
    voteMultiplier: 1.0,
    badge: 'Newcomer',
  },
  {
    level: 2,
    name: 'explorer',
    title: 'Explorer',
    minGems: 50,
    icon: '🔍',
    color: '#38BDF8',
    perks: [
      'Everything from Newcomer',
      'Blog reading & commenting',
      'Custom profile bio & avatar',
      '10 AI generations per day',
      'View trending leaderboard',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read'],
    dailyGenLimit: 10,
    voteMultiplier: 1.0,
    badge: 'Explorer',
  },
  {
    level: 3,
    name: 'creator',
    title: 'Creator',
    minGems: 200,
    icon: '🎨',
    color: '#22C55E',
    perks: [
      'Everything from Explorer',
      'Blog posting & publishing',
      'Local LLM (in-browser models)',
      'All cloud chat providers',
      '25 AI generations per day',
      '1.2x gem multiplier on votes',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule'],
    dailyGenLimit: 25,
    voteMultiplier: 1.2,
    badge: 'Creator',
  },
  {
    level: 4,
    name: 'influencer',
    title: 'Influencer',
    minGems: 500,
    icon: '⭐',
    color: '#F59E0B',
    perks: [
      'Everything from Creator',
      'API Tester access',
      'Image generation access',
      'Analytics dashboard',
      '50 AI generations per day',
      '1.5x gem multiplier on votes',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate'],
    dailyGenLimit: 50,
    voteMultiplier: 1.5,
    badge: 'Influencer',
  },
  {
    level: 5,
    name: 'champion',
    title: 'Champion',
    minGems: 1500,
    icon: '🏆',
    color: '#A855F7',
    perks: [
      'Everything from Influencer',
      'AI Helpdesk access',
      'Premium AI models (GPT-4o, Claude)',
      '100 AI generations per day',
      '2x gem multiplier on votes',
      'Exclusive champion badge',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate', 'premium_models', 'ai_helpdesk'],
    dailyGenLimit: 100,
    voteMultiplier: 2.0,
    badge: 'Champion',
  },
  {
    level: 6,
    name: 'legend',
    title: 'Legend',
    minGems: 5000,
    icon: '👑',
    color: '#EC4899',
    perks: [
      'Everything from Champion',
      'User management panel',
      'Audit log access',
      'Unlimited AI generations',
      '3x gem multiplier on votes',
      'Custom watermark removal',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate', 'premium_models', 'ai_helpdesk', 'user_management', 'audit_log', 'no_watermark'],
    dailyGenLimit: 999999,
    voteMultiplier: 3.0,
    badge: 'Legend',
  },
  {
    level: 7,
    name: 'mythic',
    title: 'Mythic',
    minGems: 15000,
    icon: '💎',
    color: '#EF4444',
    perks: [
      'Everything from Legend',
      'Moderation tools access',
      'Full admin dashboard access',
      '5x gem multiplier on votes',
      'Mythic animated profile badge',
      'Early access to new features',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate', 'premium_models', 'ai_helpdesk', 'user_management', 'audit_log', 'no_watermark', 'moderation_tools', 'full_admin', 'early_access'],
    dailyGenLimit: 999999,
    voteMultiplier: 5.0,
    badge: 'Mythic',
  },
  {
    level: 8,
    name: 'titan',
    title: 'Titan',
    minGems: 30000,
    icon: '🔥',
    color: '#F97316',
    perks: [
      'Everything from Mythic',
      'Economy controls',
      'System configuration access',
      '7x gem multiplier on votes',
      'Titan exclusive badge',
      'Direct feature request channel',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate', 'premium_models', 'ai_helpdesk', 'user_management', 'audit_log', 'no_watermark', 'moderation_tools', 'full_admin', 'early_access', 'economy_controls', 'system_config'],
    dailyGenLimit: 999999,
    voteMultiplier: 7.0,
    badge: 'Titan',
  },
  {
    level: 9,
    name: 'ascendant',
    title: 'Ascendant',
    minGems: 50000,
    icon: '🌟',
    color: '#06B6D4',
    perks: [
      'Everything from Titan',
      'P2P Chat preview access',
      'AI Smart Chat features',
      '10x gem multiplier on votes',
      'Ascendant cosmic badge',
      'Exclusive Ascendant community',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate', 'premium_models', 'ai_helpdesk', 'user_management', 'audit_log', 'no_watermark', 'moderation_tools', 'full_admin', 'early_access', 'economy_controls', 'system_config', 'p2p_preview'],
    dailyGenLimit: 999999,
    voteMultiplier: 10.0,
    badge: 'Ascendant',
  },
  {
    level: 10,
    name: 'eternal',
    title: 'Eternal',
    minGems: 100000,
    icon: '♾️',
    color: '#8B5CF6',
    perks: [
      'Everything from Ascendant',
      'Full P2P Chat unlocked',
      'AI Auto-Translate in chat',
      'AI Tone Check assistant',
      'AI Smart Scheduling',
      '15x gem multiplier on votes',
      'Eternal legendary badge',
      'Founding member status',
    ],
    unlocks: ['feed', 'chat_basic', 'profile', 'profile_custom', 'leaderboard', 'blog_read', 'blog_write', 'local_llm', 'chat_all_providers', 'post_schedule', 'api_tester', 'image_gen', 'analytics', 'profile_theme', 'voice_translate', 'premium_models', 'ai_helpdesk', 'user_management', 'audit_log', 'no_watermark', 'moderation_tools', 'full_admin', 'early_access', 'economy_controls', 'system_config', 'p2p_preview', 'p2p_chat', 'ai_translate', 'ai_tone_check', 'ai_scheduling'],
    dailyGenLimit: 999999,
    voteMultiplier: 15.0,
    badge: 'Eternal',
  },
];

// ─── Level Calculation ──────────────────────────────────────────────────────

export interface UserLevel {
  current: LevelDef;
  next: LevelDef | null;
  gemsToNext: number;
  progress: number;           // 0-100 percentage to next level
  totalGemsEarned: number;
  unlockedFeatures: string[];
  allLevels: (LevelDef & { unlocked: boolean; current: boolean })[];
}

/**
 * Calculate a user's level and progression from their total gems earned.
 */
export function calculateLevel(totalGemsEarned: number): UserLevel {
  let currentLevel = LEVELS[0];

  for (const level of LEVELS) {
    if (totalGemsEarned >= level.minGems) {
      currentLevel = level;
    } else {
      break;
    }
  }

  const nextLevel = LEVELS[currentLevel.level] || null; // next by array index (level is 1-based)
  const gemsToNext = nextLevel ? nextLevel.minGems - totalGemsEarned : 0;

  let progress = 100;
  if (nextLevel) {
    const rangeStart = currentLevel.minGems;
    const rangeEnd = nextLevel.minGems;
    const earned = totalGemsEarned - rangeStart;
    const range = rangeEnd - rangeStart;
    progress = Math.min(100, Math.max(0, Math.round((earned / range) * 100)));
  }

  const allLevels = LEVELS.map(l => ({
    ...l,
    unlocked: totalGemsEarned >= l.minGems,
    current: l.level === currentLevel.level,
  }));

  return {
    current: currentLevel,
    next: nextLevel,
    gemsToNext,
    progress,
    totalGemsEarned,
    unlockedFeatures: currentLevel.unlocks,
    allLevels,
  };
}

/**
 * Check if a user has unlocked a specific feature.
 */
export function hasFeatureUnlock(totalGemsEarned: number, feature: string): boolean {
  const level = calculateLevel(totalGemsEarned);
  return level.unlockedFeatures.includes(feature);
}

/**
 * Map dashboard sections to required feature unlocks.
 */
export const SECTION_REQUIREMENTS: Record<string, { feature: string; minLevel: number; label: string }> = {
  overview:  { feature: 'feed',            minLevel: 1,  label: 'Overview' },
  chat:      { feature: 'chat_basic',      minLevel: 1,  label: 'AI Chat' },
  blog:      { feature: 'blog_read',       minLevel: 2,  label: 'Blog' },
  voice:     { feature: 'voice_translate', minLevel: 4,  label: 'Voice Lab' },
  api:       { feature: 'api_tester',      minLevel: 4,  label: 'API Tester' },
  users:     { feature: 'user_management', minLevel: 6,  label: 'User Management' },
  audit:     { feature: 'audit_log',       minLevel: 6,  label: 'Audit Log' },
  prompts:   { feature: 'system_config',   minLevel: 8,  label: 'System Prompts' },
  p2p_chat:  { feature: 'p2p_chat',        minLevel: 10, label: 'P2P Chat' },
};
