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

// Configure multer for photo uploads
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
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();

// Tag type
interface FormattedTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

// Photo type
interface FormattedPhoto {
  id: string;
  projectId: string | null;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  path: string;
  oneDriveUrl: string | null;
  categoryId: string | null;
  uploadedById: string | null;
  createdAt: string;
  tags: FormattedTag[];
}

// Helper to format photo data
const formatPhoto = (row: any): FormattedPhoto => ({
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
  tags: [],
});

// Helper to format tag data
const formatTag = (row: any): FormattedTag => ({
  id: row.id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
});

// Get all photos with optional filters
router.get('/', (req, res) => {
  try {
    const { search, projectId, tagIds, page = 1, pageSize = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = `
      SELECT DISTINCT f.* FROM files f
      WHERE f.mime_type LIKE 'image/%'
    `;
    const params: any[] = [];

    // Filter by project
    if (projectId) {
      if (projectId === 'global') {
        query += ' AND f.project_id IS NULL';
      } else {
        query += ' AND f.project_id = ?';
        params.push(projectId);
      }
    }

    // Filter by search term
    if (search) {
      query += ' AND f.name LIKE ?';
      params.push(`%${search}%`);
    }

    // Filter by tags
    if (tagIds) {
      const tags = (tagIds as string).split(',');
      query += ` AND f.id IN (
        SELECT file_id FROM photo_tag_assignments
        WHERE tag_id IN (${tags.map(() => '?').join(',')})
        GROUP BY file_id
        HAVING COUNT(DISTINCT tag_id) = ?
      )`;
      params.push(...tags, tags.length);
    }

    // Get total count
    const countQuery = query.replace('SELECT DISTINCT f.*', 'SELECT COUNT(DISTINCT f.id) as total');
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalRow?.total || 0;

    // Add pagination
    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(pageSize), offset);

    const rows = db.prepare(query).all(...params) as any[];
    const photos = rows.map(formatPhoto);

    // Get tags for each photo
    const tagQuery = db.prepare(`
      SELECT pt.*, pta.file_id
      FROM photo_tags pt
      JOIN photo_tag_assignments pta ON pt.id = pta.tag_id
      WHERE pta.file_id IN (${photos.map(() => '?').join(',') || "''"})
    `);

    if (photos.length > 0) {
      const tagRows = tagQuery.all(...photos.map(p => p.id)) as any[];
      tagRows.forEach((tag) => {
        const photo = photos.find(p => p.id === tag.file_id);
        if (photo) {
          photo.tags.push(formatTag(tag));
        }
      });
    }

    res.json({
      success: true,
      data: {
        items: photos,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({ success: false, error: 'Failed to get photos' });
  }
});

// Upload photo(s)
router.post('/upload', upload.array('photos', 20), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const userId = req.headers['x-user-id'] as string;
    const { projectId, categoryId, tagIds } = req.body;
    const parsedTagIds = tagIds ? JSON.parse(tagIds) : [];

    const insertFile = db.prepare(`
      INSERT INTO files (id, project_id, name, type, mime_type, size, path, category_id, uploaded_by_id)
      VALUES (?, ?, ?, 'local', ?, ?, ?, ?, ?)
    `);

    const insertTagAssignment = db.prepare(`
      INSERT OR IGNORE INTO photo_tag_assignments (id, file_id, tag_id)
      VALUES (?, ?, ?)
    `);

    const uploadedPhotos: any[] = [];

    db.transaction(() => {
      for (const file of files) {
        const id = uuidv4();
        insertFile.run(
          id,
          projectId || null,
          file.originalname,
          file.mimetype,
          file.size,
          file.filename,
          categoryId || null,
          userId || null
        );

        // Add tag assignments
        for (const tagId of parsedTagIds) {
          insertTagAssignment.run(uuidv4(), id, tagId);
        }

        const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
        uploadedPhotos.push(formatPhoto(photo));
      }
    })();

    res.status(201).json({ success: true, data: uploadedPhotos });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ success: false, error: 'Failed to upload photos' });
  }
});

// Link OneDrive photo
router.post('/onedrive', (req, res) => {
  try {
    const id = uuidv4();
    const userId = req.headers['x-user-id'] as string;
    const { itemId, name, url, mimeType, size, projectId, categoryId, tagIds = [] } = req.body;

    // Verify it's an image
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Only image files are allowed' });
    }

    db.prepare(`
      INSERT INTO files (id, project_id, name, type, mime_type, size, path, onedrive_url, category_id, uploaded_by_id)
      VALUES (?, ?, ?, 'onedrive_link', ?, ?, ?, ?, ?, ?)
    `).run(id, projectId || null, name, mimeType, size, itemId, url, categoryId || null, userId || null);

    // Add tag assignments
    const insertTagAssignment = db.prepare(`
      INSERT OR IGNORE INTO photo_tag_assignments (id, file_id, tag_id)
      VALUES (?, ?, ?)
    `);

    for (const tagId of tagIds) {
      insertTagAssignment.run(uuidv4(), id, tagId);
    }

    const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatPhoto(photo) });
  } catch (error) {
    console.error('Error linking OneDrive photo:', error);
    res.status(500).json({ success: false, error: 'Failed to link OneDrive photo' });
  }
});

// Get photo by ID
router.get('/:id', (req, res) => {
  try {
    const photo = db.prepare('SELECT * FROM files WHERE id = ? AND mime_type LIKE \'image/%\'').get(req.params.id) as any;

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const formattedPhoto = formatPhoto(photo);

    // Get tags
    const tags = db.prepare(`
      SELECT pt.* FROM photo_tags pt
      JOIN photo_tag_assignments pta ON pt.id = pta.tag_id
      WHERE pta.file_id = ?
    `).all(req.params.id) as any[];

    formattedPhoto.tags = tags.map(formatTag);

    res.json({ success: true, data: formattedPhoto });
  } catch (error) {
    console.error('Error getting photo:', error);
    res.status(500).json({ success: false, error: 'Failed to get photo' });
  }
});

// Delete photo
router.delete('/:id', (req, res) => {
  try {
    const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as any;

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    // Delete physical file if local
    if (photo.type === 'local') {
      const filePath = join(UPLOAD_DIR, photo.path);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    // Delete tag assignments and file (cascade delete handles assignments)
    db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

// Bulk delete photos
router.post('/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No photo IDs provided' });
    }

    db.transaction(() => {
      for (const id of ids) {
        const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
        if (photo && photo.type === 'local') {
          const filePath = join(UPLOAD_DIR, photo.path);
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }
        }
        db.prepare('DELETE FROM files WHERE id = ?').run(id);
      }
    })();

    res.json({ success: true, message: `Deleted ${ids.length} photos` });
  } catch (error) {
    console.error('Error bulk deleting photos:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photos' });
  }
});

// ============ Tag Routes ============

// Get all tags
router.get('/tags/all', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM photo_tags ORDER BY name ASC').all() as any[];
    res.json({ success: true, data: rows.map(formatTag) });
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ success: false, error: 'Failed to get tags' });
  }
});

// Create tag
router.post('/tags', (req, res) => {
  try {
    const { name, color = '#3b82f6' } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Tag name is required' });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO photo_tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color);

    const tag = db.prepare('SELECT * FROM photo_tags WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatTag(tag) });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'Tag name already exists' });
    }
    console.error('Error creating tag:', error);
    res.status(500).json({ success: false, error: 'Failed to create tag' });
  }
});

// Update tag
router.put('/tags/:id', (req, res) => {
  try {
    const { name, color } = req.body;
    const tag = db.prepare('SELECT * FROM photo_tags WHERE id = ?').get(req.params.id);

    if (!tag) {
      return res.status(404).json({ success: false, error: 'Tag not found' });
    }

    db.prepare('UPDATE photo_tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
      .run(name, color, req.params.id);

    const updatedTag = db.prepare('SELECT * FROM photo_tags WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: formatTag(updatedTag) });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'Tag name already exists' });
    }
    console.error('Error updating tag:', error);
    res.status(500).json({ success: false, error: 'Failed to update tag' });
  }
});

// Delete tag
router.delete('/tags/:id', (req, res) => {
  try {
    const tag = db.prepare('SELECT * FROM photo_tags WHERE id = ?').get(req.params.id);

    if (!tag) {
      return res.status(404).json({ success: false, error: 'Tag not found' });
    }

    // Cascade delete handles tag assignments
    db.prepare('DELETE FROM photo_tags WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ success: false, error: 'Failed to delete tag' });
  }
});

// ============ Tag Assignment Routes ============

// Add tags to a photo
router.post('/:id/tags', (req, res) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ success: false, error: 'Tag IDs are required' });
    }

    const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const insertTagAssignment = db.prepare(`
      INSERT OR IGNORE INTO photo_tag_assignments (id, file_id, tag_id)
      VALUES (?, ?, ?)
    `);

    db.transaction(() => {
      for (const tagId of tagIds) {
        insertTagAssignment.run(uuidv4(), req.params.id, tagId);
      }
    })();

    // Return updated tags
    const tags = db.prepare(`
      SELECT pt.* FROM photo_tags pt
      JOIN photo_tag_assignments pta ON pt.id = pta.tag_id
      WHERE pta.file_id = ?
    `).all(req.params.id) as any[];

    res.json({ success: true, data: tags.map(formatTag) });
  } catch (error) {
    console.error('Error adding tags:', error);
    res.status(500).json({ success: false, error: 'Failed to add tags' });
  }
});

// Remove tags from a photo
router.delete('/:id/tags', (req, res) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ success: false, error: 'Tag IDs are required' });
    }

    db.prepare(`
      DELETE FROM photo_tag_assignments
      WHERE file_id = ? AND tag_id IN (${tagIds.map(() => '?').join(',')})
    `).run(req.params.id, ...tagIds);

    // Return updated tags
    const tags = db.prepare(`
      SELECT pt.* FROM photo_tags pt
      JOIN photo_tag_assignments pta ON pt.id = pta.tag_id
      WHERE pta.file_id = ?
    `).all(req.params.id) as any[];

    res.json({ success: true, data: tags.map(formatTag) });
  } catch (error) {
    console.error('Error removing tags:', error);
    res.status(500).json({ success: false, error: 'Failed to remove tags' });
  }
});

// Set tags for a photo (replace all)
router.put('/:id/tags', (req, res) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ success: false, error: 'Tag IDs are required' });
    }

    const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const insertTagAssignment = db.prepare(`
      INSERT OR IGNORE INTO photo_tag_assignments (id, file_id, tag_id)
      VALUES (?, ?, ?)
    `);

    db.transaction(() => {
      // Remove all existing tags
      db.prepare('DELETE FROM photo_tag_assignments WHERE file_id = ?').run(req.params.id);

      // Add new tags
      for (const tagId of tagIds) {
        insertTagAssignment.run(uuidv4(), req.params.id, tagId);
      }
    })();

    // Return updated tags
    const tags = db.prepare(`
      SELECT pt.* FROM photo_tags pt
      JOIN photo_tag_assignments pta ON pt.id = pta.tag_id
      WHERE pta.file_id = ?
    `).all(req.params.id) as any[];

    res.json({ success: true, data: tags.map(formatTag) });
  } catch (error) {
    console.error('Error setting tags:', error);
    res.status(500).json({ success: false, error: 'Failed to set tags' });
  }
});

// Bulk tag photos
router.post('/bulk-tag', (req, res) => {
  try {
    const { photoIds, tagIds, action = 'add' } = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Photo IDs are required' });
    }

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Tag IDs are required' });
    }

    const insertTagAssignment = db.prepare(`
      INSERT OR IGNORE INTO photo_tag_assignments (id, file_id, tag_id)
      VALUES (?, ?, ?)
    `);

    db.transaction(() => {
      for (const photoId of photoIds) {
        if (action === 'remove') {
          db.prepare(`
            DELETE FROM photo_tag_assignments
            WHERE file_id = ? AND tag_id IN (${tagIds.map(() => '?').join(',')})
          `).run(photoId, ...tagIds);
        } else if (action === 'replace') {
          // Remove all existing tags first
          db.prepare('DELETE FROM photo_tag_assignments WHERE file_id = ?').run(photoId);
          // Add new tags
          for (const tagId of tagIds) {
            insertTagAssignment.run(uuidv4(), photoId, tagId);
          }
        } else {
          // Default: add tags
          for (const tagId of tagIds) {
            insertTagAssignment.run(uuidv4(), photoId, tagId);
          }
        }
      }
    })();

    res.json({
      success: true,
      message: `${action === 'remove' ? 'Removed' : 'Added'} tags for ${photoIds.length} photos`
    });
  } catch (error) {
    console.error('Error bulk tagging photos:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk tag photos' });
  }
});

// Assign photos to project
router.post('/bulk-assign-project', (req, res) => {
  try {
    const { photoIds, projectId } = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Photo IDs are required' });
    }

    db.prepare(`
      UPDATE files SET project_id = ? WHERE id IN (${photoIds.map(() => '?').join(',')})
    `).run(projectId || null, ...photoIds);

    res.json({ success: true, message: `Assigned ${photoIds.length} photos to project` });
  } catch (error) {
    console.error('Error assigning photos to project:', error);
    res.status(500).json({ success: false, error: 'Failed to assign photos to project' });
  }
});

// Get photo thumbnail/preview (serve file)
router.get('/:id/preview', (req, res) => {
  try {
    const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as any;

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    if (photo.type !== 'local') {
      // For OneDrive photos, redirect to the URL
      return res.redirect(photo.onedrive_url);
    }

    const filePath = join(UPLOAD_DIR, photo.path);
    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Photo file not found' });
    }

    res.setHeader('Content-Type', photo.mime_type);
    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Error getting photo preview:', error);
    res.status(500).json({ success: false, error: 'Failed to get photo preview' });
  }
});

// Download photo
router.get('/:id/download', (req, res) => {
  try {
    const photo = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as any;

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    if (photo.type !== 'local') {
      return res.status(400).json({ success: false, error: 'Cannot download external files directly' });
    }

    const filePath = join(UPLOAD_DIR, photo.path);
    if (!existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Photo file not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${photo.name}"`);
    res.setHeader('Content-Type', photo.mime_type);

    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading photo:', error);
    res.status(500).json({ success: false, error: 'Failed to download photo' });
  }
});

export default router;
