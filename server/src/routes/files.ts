import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { mkdirSync, existsSync, unlinkSync, createReadStream } from 'fs';
import db from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 52428800, // 50MB default
  },
});

const router = Router();

const formatFile = (row: any) => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  type: row.type,
  mimeType: row.mime_type,
  size: row.size,
  path: row.path,
  oneDriveUrl: row.onedrive_url,
  categoryId: row.category_id,
  uploadedById: row.uploaded_by_id,
  createdAt: row.created_at,
});

// Get global files
router.get('/global', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM files WHERE project_id IS NULL ORDER BY created_at DESC').all();
    res.json({ success: true, data: rows.map(formatFile) });
  } catch (error) {
    console.error('Error getting global files:', error);
    res.status(500).json({ success: false, error: 'Failed to get files' });
  }
});

// Upload file (global)
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const id = uuidv4();
    const userId = req.headers['x-user-id'] as string;
    const { categoryId } = req.body;

    db.prepare(`
      INSERT INTO files (id, project_id, name, type, mime_type, size, path, category_id, uploaded_by_id)
      VALUES (?, NULL, ?, 'local', ?, ?, ?, ?, ?)
    `).run(id, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, categoryId || null, userId || null);

    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatFile(file) });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// Link OneDrive file (global)
router.post('/onedrive', (req, res) => {
  try {
    const id = uuidv4();
    const userId = req.headers['x-user-id'] as string;
    const { itemId, name, url, mimeType, size, categoryId } = req.body;

    db.prepare(`
      INSERT INTO files (id, project_id, name, type, mime_type, size, path, onedrive_url, category_id, uploaded_by_id)
      VALUES (?, NULL, ?, 'onedrive_link', ?, ?, ?, ?, ?, ?)
    `).run(id, name, mimeType, size, itemId, url, categoryId || null, userId || null);

    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatFile(file) });
  } catch (error) {
    console.error('Error linking OneDrive file:', error);
    res.status(500).json({ success: false, error: 'Failed to link OneDrive file' });
  }
});

// Get project files
router.get('/project/:projectId', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM files WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId);
    res.json({ success: true, data: rows.map(formatFile) });
  } catch (error) {
    console.error('Error getting project files:', error);
    res.status(500).json({ success: false, error: 'Failed to get files' });
  }
});

// Delete file
router.delete('/:id', (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as any;

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Delete physical file if local
    if (file.type === 'local') {
      const filePath = join(UPLOAD_DIR, file.path);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

// Download file
router.get('/:id/download', (req, res) => {
  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as any;

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    if (file.type !== 'local') {
      return res.status(400).json({ success: false, error: 'Cannot download external files directly' });
    }

    const filePath = join(UPLOAD_DIR, file.path);
    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', file.mime_type);

    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ success: false, error: 'Failed to download file' });
  }
});

export default router;
