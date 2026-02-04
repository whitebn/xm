import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

const formatProject = (row: any): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
});

// Get all projects
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM projects ORDER BY name ASC').all() as any[];
    res.json({ success: true, data: rows.map(formatProject) });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ success: false, error: 'Failed to get projects' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Project name is required' });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)').run(id, name, description || null);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatProject(project) });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    db.prepare('UPDATE projects SET name = COALESCE(?, name), description = ? WHERE id = ?')
      .run(name, description, req.params.id);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: formatProject(updated) });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Remove project from photos (don't delete photos)
    db.prepare('UPDATE photos SET project_id = NULL WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

export default router;
