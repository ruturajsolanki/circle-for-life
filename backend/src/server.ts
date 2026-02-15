// Circle for Life — Backend Server
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import formbody from '@fastify/formbody';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';

// Unified DB layer — auto-selects local CSV or Supabase based on DB_MODE
import { seedDefaultAdmin } from './db/index.js';

// Routes
import { localAuthRoutes } from './routes/localAuth.routes.js';
import { userManagementRoutes } from './routes/userManagement.routes.js';
import { controlPanelRoutes } from './routes/controlPanel.routes.js';
import { blogRoutes } from './routes/blog.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { imageRoutes } from './routes/images.routes.js';
import { voiceRoutes } from './routes/voice.routes.js';
import { translateRoutes } from './routes/translate.routes.js';
import { systemPromptsRoutes, seedSystemPrompts } from './routes/systemPrompts.routes.js';
import { agentCallRoutes } from './routes/agentCall.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';

// ─── Server Setup ─────────────────────────────────────────────────────────────

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
    requestTimeout: 120000,  // 2min for AI API calls
    bodyLimit: 15 * 1024 * 1024, // 15MB to handle base64 image payloads
  });

  // ─── Plugins ──────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // ── HTTPS redirect in production (behind Railway/reverse proxy) ────────
  if (env.NODE_ENV === 'production') {
    app.addHook('onRequest', async (request, reply) => {
      const proto = request.headers['x-forwarded-proto'];
      if (proto === 'http') {
        const host = request.headers['host'] || '';
        return reply.redirect(301, `https://${host}${request.url}`);
      }
    });
  }

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRY },
  });

  // Parse application/x-www-form-urlencoded (required for Twilio webhooks)
  await app.register(formbody);

  // ─── Health Check ─────────────────────────────────────────────────────────

  app.get('/v1/health', async () => {
    return {
      status: 'ok',
      mode: env.DB_MODE,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  // ─── Routes ───────────────────────────────────────────────────────────────

  if (env.DB_MODE === 'local' || env.DB_MODE === 'supabase') {
    logger.info(`Running in ${env.DB_MODE.toUpperCase()} mode`);

    if (env.DB_MODE === 'supabase') {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for supabase mode');
      }
    }

    // Seed admin user (works for both CSV and Supabase)
    await seedDefaultAdmin();

    // Auth
    await app.register(localAuthRoutes, { prefix: '/v1/auth' });

    // User management with roles
    await app.register(userManagementRoutes, { prefix: '/v1/manage' });

    // Control Panel (multi-provider AI playground)
    await app.register(controlPanelRoutes, { prefix: '/v1/control-panel' });

    // Blog system
    await app.register(blogRoutes, { prefix: '/v1/blog' });

    // P2P Chat system
    await app.register(chatRoutes, { prefix: '/v1/chat' });

    // Image upload & gallery
    await app.register(imageRoutes, { prefix: '/v1/images' });

    // Voice (STT/TTS)
    await app.register(voiceRoutes, { prefix: '/v1/voice' });

    // Translation
    await app.register(translateRoutes, { prefix: '/v1/translate' });

    // System Prompts (admin)
    await app.register(systemPromptsRoutes, { prefix: '/v1/system-prompts' });

    // AI Agent Call Center
    await app.register(agentCallRoutes, { prefix: '/v1/agent-calls' });

    // Seed system prompts
    await seedSystemPrompts();

    // Web Dashboard (served at root)
    await app.register(dashboardRoutes);

  } else {
    // Cloud mode — requires MongoDB + Redis
    logger.info('Running in CLOUD mode (MongoDB + Redis)');
  }

  // ─── Error Handler ────────────────────────────────────────────────────────

  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, req: request }, 'Unhandled error');

    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'SYS_003',
          message: 'Invalid request format',
          details: error.validation,
        },
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_001',
          message: 'Rate limit exceeded. Please slow down.',
        },
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: 'SYS_001',
        message:
          env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
      },
    });
  });

  return app;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  try {
    const app = await buildServer();

    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Server running on http://${env.HOST}:${env.PORT}`);
    logger.info(`DB Mode: ${env.DB_MODE}`);
    logger.info(`Control Panel: ${env.ENABLE_CONTROL_PANEL ? 'enabled' : 'disabled'}`);

    if (env.DB_MODE === 'local') {
      logger.info(`Default admin login: admin@circleforlife.app / admin123456`);
      logger.info(`CSV data stored in: ./data/`);
    } else if (env.DB_MODE === 'supabase') {
      logger.info(`Connected to Supabase: ${env.SUPABASE_URL}`);
      logger.info(`Default admin login: admin@circleforlife.app / admin123456`);
    }

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error(error);
    process.exit(1);
  }
}

main();

export { buildServer };
