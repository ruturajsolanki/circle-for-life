import { Types } from 'mongoose';
import { Post } from '../models/Post.model.js';
import { Vote } from '../models/Vote.model.js';
import { User } from '../models/User.model.js';

// ─── Post Service ───────────────────────────────────────────────────────────

export class PostService {
  static async create(params: {
    userId: Types.ObjectId;
    prompt: string;
    refinedPrompt: string;
    imageUrl: string;
    thumbnailUrl: string;
    imageWidth: number;
    imageHeight: number;
    model: 'sdxl-turbo' | 'flux' | 'midjourney';
    generationTimeMs: number;
    category?: string;
    visibility?: 'public' | 'followers' | 'private';
  }) {
    const user = await User.findById(params.userId)
      .select('username avatarUrl tier')
      .lean();
    if (!user) throw new Error('USER_001: User not found');

    const post = await Post.create({
      ...params,
      username: user.username,
      userAvatarUrl: user.avatarUrl,
      userTier: user.tier,
      visibility: params.visibility || 'public',
    });

    await User.updateOne(
      { _id: params.userId },
      { $inc: { totalPosts: 1 } }
    );

    return post.toJSON();
  }

  static async getById(postId: string, requesterId?: Types.ObjectId): Promise<any> {
    const post = await Post.findOne({
      _id: postId,
      deletedAt: null,
    })
      .lean()
      .populate('userId', 'username displayName avatarUrl tier');

    if (!post) throw new Error('POST_001: Post not found');
    return post;
  }

  static async delete(postId: string, userId: Types.ObjectId) {
    const post = await Post.findOne({ _id: postId });
    if (!post) throw new Error('POST_001: Post not found');
    if (post.userId.toString() !== userId.toString()) {
      throw new Error('POST_004: Not authorized to delete this post');
    }
    await Post.updateOne(
      { _id: postId },
      { $set: { deletedAt: new Date() } }
    );
    await User.updateOne(
      { _id: userId },
      { $inc: { totalPosts: -1 } }
    );
    return { success: true };
  }

  static async getVoters(postId: string, limit = 20) {
    const votes = await Vote.find({ postId: new Types.ObjectId(postId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'username displayName avatarUrl')
      .lean();
    return votes.map((v: any) => ({
      userId: v.userId?._id,
      username: v.userId?.username,
      displayName: v.userId?.displayName,
      avatarUrl: v.userId?.avatarUrl,
      votedAt: v.createdAt,
    }));
  }
}
