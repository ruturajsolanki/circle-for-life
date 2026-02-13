/**
 * Circle for Life — Unified Database Layer
 *
 * Conditionally exports from either localdb (CSV) or supabase (PostgreSQL).
 * Uses lazy-loading proxies — no top-level await needed.
 *
 * Routes use `await` on all DB calls, which works uniformly:
 * - Local mode: `await usersDB.findById(id)` → `await T` → T
 * - Supabase mode: `await usersDB.findById(id)` → `await Promise<T>` → T
 */

import { env } from '../config/env.js';

// Always re-export types and role constants (same for both backends)
export {
  type UserRole,
  type Permission,
  type LocalUser,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  hasPermission,
  outranks,
} from '../localdb/index.js';

// ─── Lazy module loader ─────────────────────────────────────────────────────

let _mod: any = null;
let _modPromise: Promise<any> | null = null;

function loadMod(): Promise<any> {
  if (_mod) return Promise.resolve(_mod);
  if (_modPromise) return _modPromise;

  if (env.DB_MODE === 'supabase') {
    _modPromise = import('../supabase/index.js').then(m => { _mod = m; return m; });
  } else {
    _modPromise = import('../localdb/index.js').then(m => { _mod = m; return m; });
  }
  return _modPromise;
}

// ─── Store proxy factory ────────────────────────────────────────────────────

function createStoreProxy(storeName: string): any {
  return new Proxy({} as any, {
    get(_target, prop: string) {
      return (...args: any[]) => {
        // If module is already loaded, call directly (sync or async)
        if (_mod) {
          const store = _mod[storeName];
          return store[prop](...args);
        }
        // Module not loaded yet — load it first, then call
        return loadMod().then(mod => {
          const store = mod[storeName];
          return store[prop](...args);
        });
      };
    },
  });
}

// ─── Function proxy factory ─────────────────────────────────────────────────

function createFnProxy(fnName: string): any {
  return (...args: any[]) => {
    if (_mod) return _mod[fnName](...args);
    return loadMod().then(mod => mod[fnName](...args));
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

export const usersDB: any = createStoreProxy('usersDB');
export const postsDB: any = createStoreProxy('postsDB');
export const votesDB: any = createStoreProxy('votesDB');
export const gemTxDB: any = createStoreProxy('gemTxDB');
export const followsDB: any = createStoreProxy('followsDB');
export const reportsDB: any = createStoreProxy('reportsDB');
export const auditLogDB: any = createStoreProxy('auditLogDB');
export const generationJobsDB: any = createStoreProxy('generationJobsDB');
export const blogPostsDB: any = createStoreProxy('blogPostsDB');
export const blogLikesDB: any = createStoreProxy('blogLikesDB');
export const blogCommentsDB: any = createStoreProxy('blogCommentsDB');
export const conversationsDB: any = createStoreProxy('conversationsDB');
export const chatMessagesDB: any = createStoreProxy('chatMessagesDB');
export const generatedImagesDB: any = createStoreProxy('generatedImagesDB');
export const systemPromptsDB: any = createStoreProxy('systemPromptsDB');
export const translationHistoryDB: any = createStoreProxy('translationHistoryDB');
export const agentCallSessionsDB: any = createStoreProxy('agentCallSessionsDB');
export const logAudit: any = createFnProxy('logAudit');
export const seedDefaultAdmin: any = createFnProxy('seedDefaultAdmin');
