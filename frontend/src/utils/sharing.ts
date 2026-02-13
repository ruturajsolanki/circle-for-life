/**
 * Circle for Life - Share Utility
 * Cross-platform sharing for Instagram, TikTok, WhatsApp with auto-generated captions
 */

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';
import { apiClient } from '../config/api';

export type SharePlatform = 'instagram' | 'tiktok' | 'whatsapp' | 'twitter' | 'copy';

export interface SharePostParams {
  postId: string;
  imageUrl: string;
  prompt: string;
  caption?: string;
  username?: string;
}

export interface ShareResult {
  shareUrl?: string;
  caption: string;
  imageUrl: string;
}

const APP_HASHTAG = '#CircleForLife';
const APP_URL = 'https://circleforlife.app';

/**
 * Generate caption for social sharing
 */
export function generateCaption(params: {
  prompt?: string;
  caption?: string;
  username?: string;
}): string {
  const parts: string[] = [];

  if (params.caption) {
    parts.push(params.caption);
  } else if (params.prompt) {
    parts.push(params.prompt);
  }

  if (params.username) {
    parts.push(`Created by @${params.username} on Circle for Life`);
  }

  parts.push(APP_HASHTAG, APP_URL);
  return parts.join('\n\n');
}

/**
 * Track share event via API (analytics)
 */
export async function trackShare(postId: string, platform: SharePlatform): Promise<void> {
  try {
    await apiClient.post(`/share/post/${postId}`, { platform });
  } catch {
    // Non-blocking - share still succeeds
  }
}

/**
 * Get share URL and caption from API (watermarked image, tracking)
 */
export async function getSharePayload(
  postId: string,
  platform: SharePlatform
): Promise<ShareResult | null> {
  try {
    const { data } = await apiClient.post<ShareResult>(`/share/post/${postId}`, {
      platform,
    });
    return data;
  } catch {
    return null;
  }
}

/**
 * Share post to native share sheet
 */
export async function sharePost(params: SharePostParams): Promise<boolean> {
  const caption = generateCaption({
    prompt: params.prompt,
    caption: params.caption,
    username: params.username,
  });

  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(caption);
      return true;
    }

    const sharePayload = await getSharePayload(params.postId, 'copy');
    const imageUrl = sharePayload?.imageUrl ?? params.imageUrl;
    const shareCaption = sharePayload?.caption ?? caption;

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      await Share.share({
        message: shareCaption,
        url: imageUrl,
        title: 'Check out my creation on Circle for Life',
      });
      return true;
    }

    // Download image to temp file for sharing
    const ext = imageUrl.split('.').pop()?.split('?')[0] ?? 'jpg';
    const filename = `circle-for-life-${params.postId}.${ext}`;
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.downloadAsync(imageUrl, fileUri);

    await Share.share({
      message: shareCaption,
      url: fileUri,
      title: 'Check out my creation on Circle for Life',
    });

    await trackShare(params.postId, 'copy');
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy caption to clipboard (for Instagram/TikTok manual paste)
 */
export async function copyCaptionToClipboard(params: SharePostParams): Promise<boolean> {
  const caption = generateCaption({
    prompt: params.prompt,
    caption: params.caption,
    username: params.username,
  });

  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(caption);
      return true;
    }
    // React Native: use @react-native-clipboard/clipboard if needed
    await Share.share({ message: caption });
    return true;
  } catch {
    return false;
  }
}
