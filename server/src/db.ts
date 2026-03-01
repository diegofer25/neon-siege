/**
 * @fileoverview Thin D1 query helpers matching the interface of the old pg adapter.
 *
 * D1 uses positional `?` placeholders (not `$1`).
 * All timestamps are stored as ISO-8601 TEXT — call `new Date(val)` when needed.
 * UUIDs are generated in application code (`crypto.randomUUID()`).
 */

// ─── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Run a query and return all matching rows.
 */
export async function query<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results;
}

/**
 * Run a query and return the first row, or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  const row = await stmt.first<T>();
  return row ?? null;
}

/**
 * Run a write statement (INSERT/UPDATE/DELETE) and return meta info.
 */
export async function run(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.run();
}

/**
 * Execute multiple statements atomically (D1 batch).
 * Each entry is [sql, params[]].
 * Returns an array of D1Result in order.
 */
export async function batch(
  db: D1Database,
  statements: Array<{ sql: string; params?: unknown[] }>,
): Promise<D1Result[]> {
  const prepared = statements.map((s) =>
    db.prepare(s.sql).bind(...(s.params ?? [])),
  );
  return db.batch(prepared);
}

/**
 * ISO timestamp helper — returns `datetime('now')` equivalent for use in params.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Generate a new UUID v4 for use as primary key.
 */
export function newId(): string {
  return crypto.randomUUID();
}
