import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function openDb(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'kobling.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', pass TEXT, created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL,
      link_role TEXT NOT NULL DEFAULT 'none', updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ydocs (doc_id TEXT PRIMARY KEY, state BLOB NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships (doc_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (doc_id, user_id));
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY, doc_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
      invited_by TEXT NOT NULL, expires INTEGER NOT NULL, accepted INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mail_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, to_addr TEXT NOT NULL, subject TEXT NOT NULL,
      status TEXT NOT NULL, error TEXT, created INTEGER NOT NULL,
      user_id TEXT, doc_id TEXT, url TEXT, body TEXT, attachments TEXT
    );
  `);
  return db;
}

export const getSetting = (db, key, fallback) => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? JSON.parse(r.value) : fallback;
};
export const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
