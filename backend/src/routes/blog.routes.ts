/**
 * Circle for Life — Blog Routes
 *
 * Full blog system: create posts, like, comment, share.
 * Posts can come from the AI Playground ("Post to Blog" feature).
 * Level-gated: reading at Lv2, writing at Lv3.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SafetyService } from '../services/safety.service.js';
import {
  usersDB,
  blogPostsDB,
  blogLikesDB,
  blogCommentsDB,
  logAudit,
} from '../db/index.js';
import { localAuthenticate } from '../middleware/rbac.middleware.js';
import { calculateLevel, hasFeatureUnlock } from '../services/levels.service.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  excerpt: z.string().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  tags: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published']).default('published'),
  source: z.enum(['direct', 'playground']).default('direct'),
  playgroundData: z.string().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function blogRoutes(app: FastifyInstance) {

  // ═══ GET /posts — Public blog feed ═══════════════════════════════════════
  app.get('/posts', async (request, reply) => {
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
    const sort = query.sort || 'newest';
    const tag = query.tag || '';
    const authorId = query.authorId || '';
    const search = query.search || '';

    let posts = await blogPostsDB.findMany({ status: 'published' } as any);

    if (tag) {
      posts = posts.filter((p: any) => (p.tags || '').toLowerCase().includes(tag.toLowerCase()));
    }
    if (authorId) {
      posts = posts.filter((p: any) => p.authorId === authorId);
    }
    if (search) {
      const q = search.toLowerCase();
      posts = posts.filter((p: any) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        (p.authorUsername || '').toLowerCase().includes(q)
      );
    }

    if (sort === 'popular') {
      posts.sort((a: any, b: any) => (Number(b.likeCount) || 0) - (Number(a.likeCount) || 0));
    } else if (sort === 'trending') {
      posts.sort((a: any, b: any) => {
        const scoreA = (Number(a.likeCount) || 0) + (Number(a.commentCount) || 0) * 2;
        const scoreB = (Number(b.likeCount) || 0) + (Number(b.commentCount) || 0) * 2;
        return scoreB - scoreA;
      });
    } else {
      posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const featured = posts.filter((p: any) => p.featured === true || p.featured === 'true');
    const regular = posts.filter((p: any) => p.featured !== true && p.featured !== 'true');
    posts = [...featured, ...regular];

    const total = posts.length;
    const start = (page - 1) * limit;
    const paged = posts.slice(start, start + limit);

    return {
      posts: paged.map((p: any) => ({
        ...p,
        content: p.content?.substring(0, 500) + (p.content?.length > 500 ? '...' : ''),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  });

  // ═══ GET /posts/:id — Single post ═══════════════════════════════════════
  app.get('/posts/:id', async (request, reply) => {
    const { id } = request.params as any;
    const post = await blogPostsDB.findById(id);
    if (!post || post.status === 'removed') {
      return reply.status(404).send({ error: { message: 'Post not found' } });
    }

    await blogPostsDB.increment(id, 'viewCount', 1);

    const allComments = await blogCommentsDB.findMany({ postId: id } as any);
    const comments = allComments
      .filter((c: any) => c.status === 'active')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return { post: { ...post, viewCount: (Number(post.viewCount) || 0) + 1 }, comments };
  });

  // ═══ POST /posts — Create blog post ═════════════════════════════════════
  app.post('/posts', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const body = createPostSchema.parse(request.body);
    const userId = request.userId;
    const user = await usersDB.findById(userId);
    if (!user) return reply.status(401).send({ error: { message: 'User not found' } });

    if (!hasFeatureUnlock(Number(user.totalGemsEarned) || 0, 'blog_write') &&
        user.role !== 'admin' && user.role !== 'super_admin') {
      return reply.status(403).send({
        error: { message: 'Blog posting unlocks at Level 3 — Creator. Keep earning gems!' },
      });
    }

    // Safety scan blog content
    const combinedText = `${body.title}\n${body.content}`;
    const safetyResult = await SafetyService.scan(combinedText);
    if (!safetyResult.isSafe) {
      const highSeverity = safetyResult.violations.filter(v => v.severity === 'high');
      if (highSeverity.length > 0) {
        return reply.status(400).send({
          error: { message: 'Content blocked by safety filter: ' + safetyResult.summary },
          safety: safetyResult,
        });
      }
      // Medium/low severity: warn but allow
    }

    const id = `blog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const post = {
      id,
      authorId: user.id,
      authorUsername: user.username,
      authorDisplayName: user.displayName || user.username,
      authorAvatar: user.avatarUrl || '',
      title: body.title,
      content: body.content,
      contentHtml: '',
      excerpt: body.excerpt || body.content.substring(0, 200),
      imageUrl: body.imageUrl || '',
      tags: body.tags || '',
      category: body.category || 'general',
      status: body.status,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      shareCount: 0,
      source: body.source,
      playgroundData: body.playgroundData || '',
      gemsEarned: 0,
      featured: false,
      createdAt: now,
      updatedAt: now,
      publishedAt: body.status === 'published' ? now : '',
    };

    await blogPostsDB.create(post);
    await usersDB.increment(userId, 'totalPosts', 1);
    await usersDB.increment(userId, 'gemBalance', 2);
    await usersDB.increment(userId, 'totalGemsEarned', 2);

    await logAudit({
      actorId: userId,
      actorRole: user.role,
      action: 'blog.create',
      targetType: 'blog_post',
      targetId: id,
      details: `Created blog post: "${body.title}" (source: ${body.source})`,
    });

    return reply.status(201).send({ post, gemsAwarded: 2 });
  });

  // ═══ POST /posts/:id/like — Toggle like ════════════════════════════════
  app.post('/posts/:id/like', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const userId = request.userId;

    const post = await blogPostsDB.findById(id);
    if (!post) return reply.status(404).send({ error: { message: 'Post not found' } });

    const existing = await blogLikesDB.findOne({ postId: id, userId } as any);
    if (existing) {
      await blogLikesDB.deleteById(existing.id);
      await blogPostsDB.increment(id, 'likeCount', -1);
      return { liked: false, likeCount: Math.max(0, (Number(post.likeCount) || 0) - 1) };
    }

    await blogLikesDB.create({
      id: `like_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      postId: id,
      userId,
      createdAt: new Date().toISOString(),
    });
    await blogPostsDB.increment(id, 'likeCount', 1);

    if (post.authorId !== userId) {
      await usersDB.increment(post.authorId, 'gemBalance', 1);
      await usersDB.increment(post.authorId, 'totalGemsEarned', 1);
      await blogPostsDB.increment(id, 'gemsEarned', 1);
    }

    return { liked: true, likeCount: (Number(post.likeCount) || 0) + 1 };
  });

  // ═══ POST /posts/:id/comment — Add comment ═════════════════════════════
  app.post('/posts/:id/comment', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const userId = request.userId;
    const body = commentSchema.parse(request.body);

    const post = await blogPostsDB.findById(id);
    if (!post) return reply.status(404).send({ error: { message: 'Post not found' } });

    const user = await usersDB.findById(userId);
    if (!user) return reply.status(401).send({ error: { message: 'User not found' } });

    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const comment = {
      id: commentId,
      postId: id,
      userId,
      username: user.username,
      displayName: user.displayName || user.username,
      content: body.content,
      parentId: body.parentId || '',
      likeCount: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await blogCommentsDB.create(comment);
    await blogPostsDB.increment(id, 'commentCount', 1);
    await usersDB.increment(userId, 'gemBalance', 1);
    await usersDB.increment(userId, 'totalGemsEarned', 1);

    return reply.status(201).send({ comment, gemsAwarded: 1 });
  });

  // ═══ DELETE /posts/:id — Delete post ════════════════════════════════════
  app.delete('/posts/:id', {
    preHandler: [localAuthenticate],
  }, async (request: any, reply) => {
    const { id } = request.params as any;
    const userId = request.userId;
    const user = await usersDB.findById(userId);

    const post = await blogPostsDB.findById(id);
    if (!post) return reply.status(404).send({ error: { message: 'Post not found' } });

    if (post.authorId !== userId && user?.role !== 'admin' && user?.role !== 'super_admin') {
      return reply.status(403).send({ error: { message: 'Not authorized' } });
    }

    await blogPostsDB.updateById(id, { status: 'removed', updatedAt: new Date().toISOString() });

    await logAudit({
      actorId: userId,
      actorRole: user?.role || 'user',
      action: 'blog.delete',
      targetType: 'blog_post',
      targetId: id,
    });

    return { success: true };
  });

  // ═══ GET /posts/:id/has-liked — Check if current user liked ═════════════
  app.get('/posts/:id/has-liked', {
    preHandler: [localAuthenticate],
  }, async (request: any) => {
    const { id } = request.params as any;
    const existing = await blogLikesDB.findOne({ postId: id, userId: request.userId } as any);
    return { liked: !!existing };
  });

  // ═══ GET /stats — Blog stats ════════════════════════════════════════════
  app.get('/stats', async () => {
    const allPosts = await blogPostsDB.findMany({ status: 'published' } as any);
    const totalLikes = allPosts.reduce((sum: number, p: any) => sum + (Number(p.likeCount) || 0), 0);
    const totalComments = allPosts.reduce((sum: number, p: any) => sum + (Number(p.commentCount) || 0), 0);
    return {
      totalPosts: allPosts.length,
      totalLikes,
      totalComments,
      totalViews: allPosts.reduce((sum: number, p: any) => sum + (Number(p.viewCount) || 0), 0),
    };
  });
}
