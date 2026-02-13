import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database Mode: 'local' (CSV), 'supabase' (PostgreSQL), 'cloud' (MongoDB+Redis)
  DB_MODE: z.enum(['local', 'supabase', 'cloud']).default('local'),

  // Supabase (required when DB_MODE=supabase)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),  // service_role key (full access)
  SUPABASE_ANON_KEY: z.string().optional(),     // anon key (for client-side if needed)

  // Database (only required in cloud mode)
  MONGODB_URI: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().min(8).default('circle-for-life-dev-secret-change-in-production-32chars'),
  JWT_REFRESH_SECRET: z.string().min(8).default('circle-for-life-refresh-secret-change-in-production'),
  JWT_ACCESS_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // Storage (S3-compatible — works with Cloudflare R2)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  CDN_BASE_URL: z.string().default('http://localhost:3000/static'),

  // GPU Providers
  RUNPOD_API_KEY: z.string().optional(),
  REPLICATE_API_KEY: z.string().optional(),
  BFL_API_KEY: z.string().optional(),
  MIDJOURNEY_API_KEY: z.string().optional(),

  // Moderation
  NSFW_API_KEY: z.string().optional(),
  PERSPECTIVE_API_KEY: z.string().optional(),

  // Push Notifications
  FCM_SERVER_KEY: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),

  // Rate Limits
  DAILY_VOTE_LIMIT: z.coerce.number().default(100),
  FREE_DAILY_GEN_LIMIT: z.coerce.number().default(10),
  PRO_DAILY_GEN_LIMIT: z.coerce.number().default(50),

  // Gem Economy
  VOTES_PER_GEM: z.coerce.number().default(10),
  DAILY_LOGIN_GEMS: z.coerce.number().default(5),
  REFERRAL_MULTIPLIER: z.coerce.number().default(2),
  REFERRAL_BONUS_DURATION_HOURS: z.coerce.number().default(24),

  // Control Panel
  ENABLE_CONTROL_PANEL: z.coerce.boolean().default(true),

  // Feature Flags
  ENABLE_PREMIUM_MODELS: z.coerce.boolean().default(false),
  ENABLE_ANALYTICS: z.coerce.boolean().default(true),

  // Sentry / Monitoring
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = validateEnv();
