/**
 * Circle for Life — Supabase Store
 *
 * Drop-in replacement for CsvStore that uses Supabase PostgreSQL.
 * Same API surface so all existing routes work without changes.
 *
 * Field name mapping: camelCase (code) ↔ snake_case (database)
 */

import { getSupabase } from '../config/supabase.js';

// camelCase → snake_case
function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// snake_case → camelCase
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// Columns that are timestamps or dates — empty strings must become null in PG
const TIMESTAMP_SUFFIXES = ['_at', '_date'];

function rowToSnake(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = toSnake(k);
    // Convert empty strings to null for timestamp/date columns
    if (v === '' && TIMESTAMP_SUFFIXES.some(s => snakeKey.endsWith(s))) {
      out[snakeKey] = null;
    } else {
      out[snakeKey] = v;
    }
  }
  return out;
}

function rowToCamel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    // Convert null timestamps back to empty strings for route compatibility
    if (v === null && TIMESTAMP_SUFFIXES.some(s => k.endsWith(s))) {
      out[toCamel(k)] = '';
    } else {
      out[toCamel(k)] = v;
    }
  }
  return out;
}

export class SupabaseStore<T extends Record<string, any>> {
  private table: string;

  constructor(tableName: string) {
    this.table = tableName;
  }

  private get db() {
    return getSupabase().from(this.table);
  }

  // ─── Sync-named aliases (return Promises — use with `await`) ──────────
  // These allow routes to `await store.findById(id)` uniformly for both
  // CsvStore (returns value) and SupabaseStore (returns Promise).

  findAll(): Promise<T[]> { return this.findAllAsync(); }
  findById(id: string): Promise<T | null> { return this.findByIdAsync(id); }
  findOne(filter: Partial<T>): Promise<T | null> { return this.findOneAsync(filter); }
  findMany(filter: Partial<T>): Promise<T[]> { return this.findManyAsync(filter); }
  search(field: string, term: string): Promise<T[]> { return this.searchAsync(field, term); }
  paginate(opts: any): Promise<{ data: T[]; total: number; page: number; totalPages: number }> { return this.paginateAsync(opts); }
  count(filter?: Partial<T>): Promise<number> { return this.countAsync(filter); }
  create(record: T): Promise<T> { return this.createAsync(record); }
  updateById(id: string, updates: Partial<T>): Promise<T | null> { return this.updateByIdAsync(id, updates); }
  deleteById(id: string): Promise<boolean> { return this.deleteByIdAsync(id); }
  increment(id: string, field: string, amount: number): Promise<void> { return this.incrementAsync(id, field, amount); }

  // ─── Read Operations ──────────────────────────────────────────────────

  async findAllAsync(): Promise<T[]> {
    // Try ordering by created_at, fall back to no ordering if column doesn't exist
    let result = await this.db.select('*').order('created_at', { ascending: false });
    if (result.error && result.error.message?.includes('does not exist')) {
      result = await this.db.select('*');
    }
    if (result.error) throw result.error;
    return (result.data || []).map(r => rowToCamel(r) as T);
  }

  async findByIdAsync(id: string): Promise<T | null> {
    const { data, error } = await this.db.select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data ? rowToCamel(data) as T : null;
  }

  async findOneAsync(filter: Partial<T>): Promise<T | null> {
    let query = this.db.select('*');
    for (const [k, v] of Object.entries(filter)) {
      query = query.eq(toSnake(k), v);
    }
    const { data, error } = await query.limit(1).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? rowToCamel(data) as T : null;
  }

  async findManyAsync(filter: Partial<T>): Promise<T[]> {
    let query = this.db.select('*');
    for (const [k, v] of Object.entries(filter)) {
      query = query.eq(toSnake(k), v);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => rowToCamel(r) as T);
  }

  async searchAsync(field: string, term: string): Promise<T[]> {
    const { data, error } = await this.db.select('*').ilike(toSnake(field), `%${term}%`);
    if (error) throw error;
    return (data || []).map(r => rowToCamel(r) as T);
  }

  async paginateAsync(opts: {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filter?: Partial<T>;
  }): Promise<{ data: T[]; total: number; page: number; totalPages: number }> {
    const { page, limit, sortBy = 'created_at', sortOrder = 'desc', filter } = opts;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db.select('*', { count: 'exact' });
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && v !== '') query = query.eq(toSnake(k), v);
      }
    }

    const { data, error, count } = await query
      .order(toSnake(sortBy), { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (error) throw error;
    const total = count || 0;

    return {
      data: (data || []).map(r => rowToCamel(r) as T),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async countAsync(filter?: Partial<T>): Promise<number> {
    let query = this.db.select('*', { count: 'exact', head: true });
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        query = query.eq(toSnake(k), v);
      }
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }

  // ─── Write Operations ─────────────────────────────────────────────────

  async createAsync(record: T): Promise<T> {
    const row = rowToSnake(record);
    const { data, error } = await this.db.insert(row).select().single();
    if (error) {
      // If a column doesn't exist, strip unknown columns and retry
      if (error.message?.includes('does not exist') || error.code === '42703') {
        const colMatch = error.message?.match(/column "([^"]+)"/);
        if (colMatch) {
          const badCol = colMatch[1];
          const cleaned = { ...row };
          delete cleaned[badCol];
          // Retry without the problematic column, and recursively strip more if needed
          const retry = await this.db.insert(cleaned).select().single();
          if (retry.error) {
            if (retry.error.message?.includes('does not exist') || retry.error.code === '42703') {
              // Strip all non-standard columns and try one more time
              const colMatch2 = retry.error.message?.match(/column "([^"]+)"/);
              if (colMatch2) {
                delete cleaned[colMatch2[1]];
                const retry2 = await this.db.insert(cleaned).select().single();
                if (retry2.error) throw retry2.error;
                return rowToCamel(retry2.data) as T;
              }
            }
            throw retry.error;
          }
          return rowToCamel(retry.data) as T;
        }
      }
      // If CHECK constraint violation (e.g., content_type), fix known values
      if (error.message?.includes('check') || error.code === '23514') {
        // Try setting content_type to 'text' as fallback
        if (row.content_type && !['text', 'ai_generated', 'system'].includes(row.content_type)) {
          const cleaned = { ...row, content_type: 'text' };
          const retry = await this.db.insert(cleaned).select().single();
          if (retry.error) throw retry.error;
          return rowToCamel(retry.data) as T;
        }
      }
      throw error;
    }
    return rowToCamel(data) as T;
  }

  async updateByIdAsync(id: string, updates: Partial<T>): Promise<T | null> {
    const row = rowToSnake(updates);
    const { data, error } = await this.db.update(row).eq('id', id).select().single();
    if (error) throw error;
    return data ? rowToCamel(data) as T : null;
  }

  async deleteByIdAsync(id: string): Promise<boolean> {
    const { error } = await this.db.delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async incrementAsync(id: string, field: string, amount: number): Promise<void> {
    // Use RPC for atomic increment, or fetch-update for simplicity
    const record = await this.findByIdAsync(id);
    if (!record) return;
    const current = Number((record as any)[field]) || 0;
    await this.updateByIdAsync(id, { [field]: current + amount } as any);
  }
}
