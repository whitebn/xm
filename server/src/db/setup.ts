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
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'view_only' CHECK (role IN ('admin', 'vp', 'manager', 'view_only')),
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Category templates table
  CREATE TABLE IF NOT EXISTS category_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'folder',
    is_default INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Projects table
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contract_number TEXT,
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold', 'cancelled')),

    install_start_date TEXT,
    install_end_date TEXT,
    event_start_date TEXT,
    event_end_date TEXT,
    strike_start_date TEXT,
    strike_end_date TEXT,

    project_manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    crew_lead_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    sales_rep_id TEXT REFERENCES users(id) ON DELETE SET NULL,

    template_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    is_template INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Project categories table
  CREATE TABLE IF NOT EXISTS project_categories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category_template_id TEXT NOT NULL REFERENCES category_templates(id) ON DELETE CASCADE,
    notes TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Gantt items table
  CREATE TABLE IF NOT EXISTS gantt_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    number_of_days INTEGER NOT NULL DEFAULT 0,
    strike_start_date TEXT,
    strike_end_date TEXT,
    number_of_strike_days INTEGER NOT NULL DEFAULT 0,
    crew_number INTEGER NOT NULL DEFAULT 0,
    depends_on_id TEXT REFERENCES gantt_items(id) ON DELETE SET NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Files table
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('local', 'onedrive', 'onedrive_link')),
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL,
    onedrive_url TEXT,
    category_id TEXT REFERENCES project_categories(id) ON DELETE SET NULL,
    uploaded_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Invoices table
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),

    company_name TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_email TEXT,
    company_logo TEXT,

    client_name TEXT,
    client_address TEXT,
    client_email TEXT,

    issue_date TEXT NOT NULL,
    due_date TEXT,
    terms TEXT,
    notes TEXT,

    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Invoice line items table
  CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0
  );

  -- Company settings table
  CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo TEXT,
    default_terms TEXT DEFAULT 'Net 30',
    default_tax_rate REAL DEFAULT 0
  );

  -- Notifications table
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Report configs table
  CREATE TABLE IF NOT EXISTS report_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    filters TEXT,
    columns TEXT,
    sort_by TEXT,
    sort_order TEXT DEFAULT 'asc',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Photo tags table
  CREATE TABLE IF NOT EXISTS photo_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Photo tag assignments (many-to-many between files and tags)
  CREATE TABLE IF NOT EXISTS photo_tag_assignments (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES photo_tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(file_id, tag_id)
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_template ON projects(is_template);
  CREATE INDEX IF NOT EXISTS idx_gantt_items_project ON gantt_items(project_id);
  CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
  CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
  CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_photo_tag_assignments_file ON photo_tag_assignments(file_id);
  CREATE INDEX IF NOT EXISTS idx_photo_tag_assignments_tag ON photo_tag_assignments(tag_id);
`);

// Insert default category templates
const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO category_templates (id, name, description, color, icon, is_default, "order")
  VALUES (?, ?, ?, ?, ?, 1, ?)
`);

const defaultCategories = [
  { id: 'crew_hotel', name: 'Crew Hotel', description: 'Hotel accommodations for crew', color: '#3b82f6', icon: 'hotel' },
  { id: 'equipment_list', name: 'Equipment List', description: 'Equipment and materials needed', color: '#10b981', icon: 'list' },
  { id: 'photos', name: 'Photos', description: 'Project photos and documentation', color: '#f59e0b', icon: 'camera' },
  { id: 'heavy_equipment', name: 'Heavy Equipment', description: 'Heavy machinery and vehicles', color: '#ef4444', icon: 'truck' },
  { id: 'invoices_quotes', name: 'Invoices & Quotes', description: 'Financial documents', color: '#8b5cf6', icon: 'file-text' },
  { id: 'hours', name: 'Hours', description: 'Time tracking and labor hours', color: '#ec4899', icon: 'clock' },
  { id: 'recap', name: 'Recap', description: 'Project summary and notes', color: '#06b6d4', icon: 'clipboard' },
];

defaultCategories.forEach((cat, index) => {
  insertCategory.run(cat.id, cat.name, cat.description, cat.color, cat.icon, index);
});

// Insert default company settings
db.prepare(`
  INSERT OR IGNORE INTO company_settings (id, default_terms, default_tax_rate)
  VALUES ('default', 'Net 30', 0)
`).run();

// Insert default photo tags
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

export { DB_PATH };
