/**
 * Circle for Life — Chat Message Encryption (AES-256-GCM)
 *
 * Encrypts P2P chat messages at rest in the database.
 * Uses AES-256-GCM with a random IV per message for authenticated encryption.
 *
 * Set CHAT_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * If not set, encryption is transparently bypassed (messages stored as plaintext).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from './logger.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

let encryptionKey: Buffer | null = null;

function getKey(): Buffer | null {
  if (encryptionKey) return encryptionKey;
  const hex = process.env.CHAT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    return null; // encryption disabled
  }
  encryptionKey = Buffer.from(hex, 'hex');
  return encryptionKey;
}

/**
 * Encrypt a plaintext message. Returns encrypted string prefixed with "enc:"
 * If encryption is disabled (no key), returns plaintext unchanged.
 */
export function encryptMessage(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
    return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    logger.error('Failed to encrypt message:', err);
    return plaintext; // graceful fallback
  }
}

/**
 * Decrypt an encrypted message. If message is not encrypted (no "enc:" prefix),
 * returns it unchanged. Gracefully returns original string on any error.
 */
export function decryptMessage(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith(PREFIX)) return ciphertext;

  const key = getKey();
  if (!key) return ciphertext; // can't decrypt without key

  try {
    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return ciphertext;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    logger.error('Failed to decrypt message:', err);
    return ciphertext; // return as-is rather than crash
  }
}
