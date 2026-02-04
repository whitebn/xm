import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'database.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Photos table
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'local',
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    project_id TEXT,
    uploaded_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Photo tags table
  CREATE TABLE IF NOT EXISTS photo_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Photo tag assignments (many-to-many between photos and tags)
  CREATE TABLE IF NOT EXISTS photo_tag_assignments (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES photo_tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(photo_id, tag_id)
  );

  -- Projects table (simple, for organizing photos)
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id);
  CREATE INDEX IF NOT EXISTS idx_photos_mime_type ON photos(mime_type);
  CREATE INDEX IF NOT EXISTS idx_photo_tag_assignments_photo ON photo_tag_assignments(photo_id);
  CREATE INDEX IF NOT EXISTS idx_photo_tag_assignments_tag ON photo_tag_assignments(tag_id);
`);

// Insert default tags
const insertTag = db.prepare(`
  INSERT OR IGNORE INTO photo_tags (id, name, color)
  VALUES (?, ?, ?)
`);

const defaultTags = [
  { id: 'tag_install', name: 'Install', color: '#3b82f6' },
  { id: 'tag_event', name: 'Event', color: '#10b981' },
  { id: 'tag_strike', name: 'Strike', color: '#f59e0b' },
  { id: 'tag_before', name: 'Before', color: '#8b5cf6' },
  { id: 'tag_after', name: 'After', color: '#ec4899' },
  { id: 'tag_equipment', name: 'Equipment', color: '#ef4444' },
  { id: 'tag_crew', name: 'Crew', color: '#06b6d4' },
  { id: 'tag_client', name: 'Client', color: '#84cc16' },
];

defaultTags.forEach((tag) => {
  insertTag.run(tag.id, tag.name, tag.color);
});

console.log('Database setup complete!');
db.close();
