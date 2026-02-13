import { Types } from 'mongoose';
import { Follow } from '../models/Follow.model.js';
import { User } from '../models/User.model.js';

// ─── Social Service ────────────────────────────────────────────────────────

export class SocialService {
  static async follow(followerId: Types.ObjectId, followingId: Types.ObjectId) {
    if (followerId.toString() === followingId.toString()) {
      throw new Error('SOCIAL_001: Cannot follow yourself');
    }
    const target = await User.findById(followingId);
    if (!target) throw new Error('USER_001: User not found');

    const existing = await Follow.findOne({ followerId, followingId });
    if (existing) {
      return { following: true, alreadyFollowing: true };
    }

    await Follow.create({ followerId, followingId });
    await User.updateOne(
      { _id: followerId },
      { $inc: { followingCount: 1 } }
    );
    await User.updateOne(
      { _id: followingId },
      { $inc: { followersCount: 1 } }
    );
    return { following: true };
  }

  static async unfollow(followerId: Types.ObjectId, followingId: Types.ObjectId) {
    const result = await Follow.findOneAndDelete({ followerId, followingId });
    if (result) {
      await User.updateOne(
        { _id: followerId },
        { $inc: { followingCount: -1 } }
      );
      await User.updateOne(
        { _id: followingId },
        { $inc: { followersCount: -1 } }
      );
    }
    return { following: false };
  }

  /**
   * Get notifications for user (stub — would use Notification model).
   */
  static async getNotifications(
    userId: Types.ObjectId,
    params: { limit?: number; cursor?: string; unreadOnly?: boolean }
  ): Promise<{ notifications: any[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit || 20, 50);
    // Stub: return empty notifications (Notification model not implemented)
    return { notifications: [], nextCursor: null };
  }

  /**
   * Mark notifications as read.
   */
  static async markNotificationsRead(
    userId: Types.ObjectId,
    notificationIds: string[]
  ): Promise<{ marked: number }> {
    // Stub: would update Notification documents
    return { marked: notificationIds.length };
  }
}
