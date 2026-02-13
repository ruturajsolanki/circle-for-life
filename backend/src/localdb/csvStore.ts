/**
 * Circle for Life — CSV-Based Local Database
 *
 * A self-contained, zero-dependency local database using CSV files.
 * Designed for development and demo purposes — no MongoDB or Redis needed.
 *
 * Each "collection" is a CSV file in the /data directory.
 * Supports: CRUD, querying by field, pagination, atomic updates.
 *
 * Files are read/written synchronously on small datasets for simplicity.
 * For production, swap this out with the real MongoDB layer.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ─── CSV Parsing / Serialization ────────────────────────────────────────────

function escapeCSV(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

function serializeValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function deserializeValue(value: string, hint?: string): any {
  if (value === '' || value === 'undefined') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Try number
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  // Try JSON (objects/arrays)
  if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

// ─── CSV Store Class ────────────────────────────────────────────────────────

export class CsvStore<T extends Record<string, any>> {
  private filePath: string;
  private columns: string[];
  private cache: T[] | null = null;
  private dirty = false;

  constructor(name: string, columns: string[]) {
    this.filePath = join(DATA_DIR, `${name}.csv`);
    this.columns = columns;
    this.ensureFile();
  }

  private ensureFile(): void {
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, this.columns.join(',') + '\n', 'utf-8');
      logger.info(`Created CSV store: ${this.filePath}`);
    }
  }

  // ─── Read ───────────────────────────────────────────────────────────────

  private readAll(): T[] {
    if (this.cache && !this.dirty) return this.cache;

    const content = readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    if (lines.length <= 1) {
      this.cache = [];
      return [];
    }

    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);

    const records: T[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const record: any = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = deserializeValue(values[j] || '');
      }
      records.push(record as T);
    }

    this.cache = records;
    this.dirty = false;
    return records;
  }

  private writeAll(records: T[]): void {
    const header = this.columns.join(',');
    const rows = records.map((record) =>
      this.columns.map((col) => escapeCSV(serializeValue(record[col]))).join(',')
    );
    writeFileSync(this.filePath, [header, ...rows].join('\n') + '\n', 'utf-8');
    this.cache = records;
    this.dirty = false;
  }

  // ─── CRUD Operations ───────────────────────────────────────────────────

  findAll(): T[] {
    return [...this.readAll()];
  }

  findById(id: string): T | null {
    return this.readAll().find((r) => (r as any).id === id) || null;
  }

  findOne(query: Partial<T>): T | null {
    const records = this.readAll();
    return records.find((r) =>
      Object.entries(query).every(([k, v]) => (r as any)[k] === v)
    ) || null;
  }

  findMany(query: Partial<T>): T[] {
    const records = this.readAll();
    return records.filter((r) =>
      Object.entries(query).every(([k, v]) => (r as any)[k] === v)
    );
  }

  /**
   * Flexible search: field contains value (case-insensitive).
   */
  search(field: string, value: string): T[] {
    const lower = value.toLowerCase();
    return this.readAll().filter((r) => {
      const fieldVal = (r as any)[field];
      return fieldVal && String(fieldVal).toLowerCase().includes(lower);
    });
  }

  /**
   * Paginated list with optional sort and filter.
   */
  paginate(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filter?: Partial<T>;
  }): { data: T[]; total: number; page: number; totalPages: number } {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', filter } = params;

    let records = this.readAll();

    // Filter
    if (filter) {
      records = records.filter((r) =>
        Object.entries(filter).every(([k, v]) => {
          if (v === undefined || v === null) return true;
          return (r as any)[k] === v;
        })
      );
    }

    // Sort
    records.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = records.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = records.slice(start, start + limit);

    return { data, total, page, totalPages };
  }

  create(record: T): T {
    const records = this.readAll();
    records.push(record);
    this.writeAll(records);
    return record;
  }

  updateById(id: string, updates: Partial<T>): T | null {
    const records = this.readAll();
    const index = records.findIndex((r) => (r as any).id === id);
    if (index === -1) return null;

    records[index] = { ...records[index], ...updates };
    this.writeAll(records);
    return records[index];
  }

  updateMany(query: Partial<T>, updates: Partial<T>): number {
    const records = this.readAll();
    let count = 0;
    for (let i = 0; i < records.length; i++) {
      const matches = Object.entries(query).every(([k, v]) => (records[i] as any)[k] === v);
      if (matches) {
        records[i] = { ...records[i], ...updates };
        count++;
      }
    }
    if (count > 0) this.writeAll(records);
    return count;
  }

  deleteById(id: string): boolean {
    const records = this.readAll();
    const filtered = records.filter((r) => (r as any).id !== id);
    if (filtered.length === records.length) return false;
    this.writeAll(filtered);
    return true;
  }

  count(query?: Partial<T>): number {
    if (!query) return this.readAll().length;
    return this.findMany(query).length;
  }

  /**
   * Atomic increment a numeric field.
   */
  increment(id: string, field: string, amount: number): T | null {
    const records = this.readAll();
    const index = records.findIndex((r) => (r as any).id === id);
    if (index === -1) return null;

    const current = Number((records[index] as any)[field]) || 0;
    (records[index] as any)[field] = current + amount;
    this.writeAll(records);
    return records[index];
  }

  /**
   * Clear all records (keep header).
   */
  clear(): void {
    this.writeAll([]);
  }

  /**
   * Get raw file path (for debugging).
   */
  getFilePath(): string {
    return this.filePath;
  }
}
