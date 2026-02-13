import { Types } from 'mongoose';
import { User } from '../models/User.model.js';
import { Post } from '../models/Post.model.js';
import { GemService } from './gem.service.js';

// ─── User Service ───────────────────────────────────────────────────────────

export class UserService {
  static async getMe(userId: Types.ObjectId) {
    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) throw new Error('USER_001: User not found');
    return user;
  }

  static async updateMe(
    userId: Types.ObjectId,
    updates: { displayName?: string; bio?: string; avatarUrl?: string }
  ) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    )
      .select('-passwordHash')
      .lean();
    if (!user) throw new Error('USER_001: User not found');
    return user;
  }

  static async getById(userId: Types.ObjectId) {
    const user = await User.findById(userId)
      .select('username displayName avatarUrl bio tier totalPosts followersCount followingCount createdAt')
      .lean();
    if (!user) throw new Error('USER_001: User not found');
    return user;
  }

  static async getPosts(params: {
    userId: Types.ObjectId;
    cursor?: string;
    limit?: number;
  }): Promise<any> {
    const limit = Math.min(params.limit || 20, 50);
    const query: any = {
      userId: params.userId,
      deletedAt: null,
      moderationStatus: 'approved',
    };
    if (params.cursor) {
      query._id = { $lt: new Types.ObjectId(params.cursor) };
    }
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? resultPosts[resultPosts.length - 1]._id.toString()
      : null;
    return { posts: resultPosts, nextCursor };
  }

  static async getStreak(userId: Types.ObjectId) {
    const user = await User.findById(userId)
      .select('currentStreak longestStreak lastActiveDate')
      .lean();
    if (!user) throw new Error('USER_001: User not found');
    return {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastActiveDate: user.lastActiveDate,
    };
  }

  static async dailyCheckin(userId: Types.ObjectId) {
    return GemService.processDailyLogin(userId);
  }
}
