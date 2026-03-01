import Database from "@tauri-apps/plugin-sql";
import type { Game, GameFormData } from "@/types/game";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:galmanager.db");
    await initSchema();
  }
  return db;
}

async function initSchema() {
  const d = db!;
  await d.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      title_original TEXT NOT NULL DEFAULT '',
      vndb_id TEXT NOT NULL DEFAULT '',
      developer TEXT NOT NULL DEFAULT '',
      release_date TEXT NOT NULL DEFAULT '',
      exe_path TEXT NOT NULL DEFAULT '',
      install_path TEXT NOT NULL DEFAULT '',
      save_path TEXT NOT NULL DEFAULT '',
      cover_path TEXT NOT NULL DEFAULT '',
      screenshots TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      play_status TEXT NOT NULL DEFAULT 'unplayed',
      rating INTEGER NOT NULL DEFAULT 0,
      vndb_rating INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      engine TEXT NOT NULL DEFAULT '',
      total_playtime INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migration: add new columns if upgrading from older schema
  const pragma = await d.select<Record<string, unknown>[]>("PRAGMA table_info(games)");
  const cols = new Set(pragma.map((r) => r.name as string));
  if (!cols.has("vndb_id")) {
    await d.execute("ALTER TABLE games ADD COLUMN vndb_id TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.has("screenshots")) {
    await d.execute("ALTER TABLE games ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]'");
  }
  if (!cols.has("vndb_rating")) {
    await d.execute("ALTER TABLE games ADD COLUMN vndb_rating INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("vndb_votecount")) {
    await d.execute("ALTER TABLE games ADD COLUMN vndb_votecount INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("length_minutes")) {
    await d.execute("ALTER TABLE games ADD COLUMN length_minutes INTEGER NOT NULL DEFAULT 0");
  }

  await d.execute(`
    CREATE TABLE IF NOT EXISTS play_sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  // Settings table for API keys etc.
  await d.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  // Tag translation cache: English tag → Chinese translation
  await d.execute(`
    CREATE TABLE IF NOT EXISTS tag_translations (
      en TEXT PRIMARY KEY,
      zh TEXT NOT NULL DEFAULT ''
    )
  `);
}

function generateId(): string {
  return crypto.randomUUID();
}

function rowToGame(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    title: row.title as string,
    title_original: row.title_original as string,
    vndb_id: (row.vndb_id as string) || "",
    developer: row.developer as string,
    release_date: row.release_date as string,
    exe_path: row.exe_path as string,
    install_path: row.install_path as string,
    save_path: row.save_path as string,
    cover_path: row.cover_path as string,
    screenshots: JSON.parse((row.screenshots as string) || "[]"),
    tags: JSON.parse((row.tags as string) || "[]"),
    play_status: row.play_status as Game["play_status"],
    rating: row.rating as number,
    vndb_rating: (row.vndb_rating as number) || 0,
    vndb_votecount: (row.vndb_votecount as number) || 0,
    length_minutes: (row.length_minutes as number) || 0,
    notes: row.notes as string,
    engine: row.engine as string,
    total_playtime: row.total_playtime as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getAllGames(): Promise<Game[]> {
  const d = await getDb();
  const rows = await d.select<Record<string, unknown>[]>(
    "SELECT * FROM games ORDER BY created_at DESC"
  );
  return rows.map(rowToGame);
}

export async function getGameById(id: string): Promise<Game | null> {
  const d = await getDb();
  const rows = await d.select<Record<string, unknown>[]>(
    "SELECT * FROM games WHERE id = $1",
    [id]
  );
  return rows.length > 0 ? rowToGame(rows[0]) : null;
}

export async function addGame(data: GameFormData): Promise<Game> {
  const d = await getDb();
  const id = generateId();
  const now = new Date().toISOString();

  await d.execute(
    `INSERT INTO games (id, title, title_original, vndb_id, developer, release_date, exe_path, install_path, save_path, cover_path, screenshots, tags, play_status, rating, vndb_rating, vndb_votecount, length_minutes, notes, engine, total_playtime, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 0, $20, $20)`,
    [
      id,
      data.title,
      data.title_original,
      data.vndb_id || "",
      data.developer,
      data.release_date,
      data.exe_path,
      data.install_path,
      data.save_path,
      data.cover_path,
      JSON.stringify(data.screenshots || []),
      JSON.stringify(data.tags),
      data.play_status,
      data.rating,
      data.vndb_rating || 0,
      data.vndb_votecount || 0,
      data.length_minutes || 0,
      data.notes,
      data.engine,
      now,
    ]
  );

  return (await getGameById(id))!;
}

export async function updateGame(
  id: string,
  data: Partial<GameFormData>
): Promise<Game> {
  const d = await getDb();
  const now = new Date().toISOString();

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const dbKey = key;
      const dbValue = (key === "tags" || key === "screenshots") ? JSON.stringify(value) : value;
      sets.push(`${dbKey} = $${idx}`);
      values.push(dbValue);
      idx++;
    }
  }

  sets.push(`updated_at = $${idx}`);
  values.push(now);
  idx++;

  values.push(id);
  await d.execute(
    `UPDATE games SET ${sets.join(", ")} WHERE id = $${idx}`,
    values
  );

  return (await getGameById(id))!;
}

export async function deleteGame(id: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM games WHERE id = $1", [id]);
}

export async function searchGames(query: string): Promise<Game[]> {
  const d = await getDb();
  const pattern = `%${query}%`;
  const rows = await d.select<Record<string, unknown>[]>(
    `SELECT * FROM games WHERE title LIKE $1 OR title_original LIKE $1 OR developer LIKE $1 OR notes LIKE $1 OR tags LIKE $1 ORDER BY title`,
    [pattern]
  );
  return rows.map(rowToGame);
}

// ─── Play Sessions ──────────────────────────────────────────

export async function addPlaySession(
  gameId: string,
  startTime: string,
  endTime: string,
  duration: number
): Promise<void> {
  const d = await getDb();
  const id = crypto.randomUUID();
  await d.execute(
    `INSERT INTO play_sessions (id, game_id, start_time, end_time, duration)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, gameId, startTime, endTime, duration]
  );
  await d.execute(
    `UPDATE games SET total_playtime = total_playtime + $1, updated_at = $2 WHERE id = $3`,
    [duration, new Date().toISOString(), gameId]
  );
}

// ─── Settings ───────────────────────────────────────────────

export async function getSetting(key: string): Promise<string> {
  const d = await getDb();
  const rows = await d.select<Record<string, unknown>[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key]
  );
  return rows.length > 0 ? (rows[0].value as string) : "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

// ─── Tag Translation Cache ──────────────────────────────────

export interface TagTranslation {
  en: string;
  zh: string;
}

export async function getTagTranslation(en: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<Record<string, unknown>[]>(
    "SELECT zh FROM tag_translations WHERE en = $1",
    [en]
  );
  return rows.length > 0 ? (rows[0].zh as string) : null;
}

export async function getTagTranslations(tags: string[]): Promise<Map<string, string>> {
  const d = await getDb();
  if (tags.length === 0) return new Map();
  const placeholders = tags.map((_, i) => `$${i + 1}`).join(",");
  const rows = await d.select<Record<string, unknown>[]>(
    `SELECT en, zh FROM tag_translations WHERE en IN (${placeholders})`,
    tags
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.en as string, r.zh as string);
  }
  return map;
}

export async function setTagTranslation(en: string, zh: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT INTO tag_translations (en, zh) VALUES ($1, $2)
     ON CONFLICT(en) DO UPDATE SET zh = $2`,
    [en, zh]
  );
}

export async function setTagTranslations(pairs: TagTranslation[]): Promise<void> {
  const d = await getDb();
  for (const { en, zh } of pairs) {
    await d.execute(
      `INSERT INTO tag_translations (en, zh) VALUES ($1, $2)
       ON CONFLICT(en) DO UPDATE SET zh = $2`,
      [en, zh]
    );
  }
}

export async function getAllTagTranslations(): Promise<TagTranslation[]> {
  const d = await getDb();
  const rows = await d.select<Record<string, unknown>[]>(
    "SELECT en, zh FROM tag_translations ORDER BY en"
  );
  return rows.map((r) => ({ en: r.en as string, zh: r.zh as string }));
}

export async function deleteTagTranslation(en: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM tag_translations WHERE en = $1", [en]);
}