import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();

const formatCategory = (row: any) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  color: row.color,
  icon: row.icon,
  isDefault: row.is_default === 1,
  order: row.order,
  createdAt: row.created_at,
});

// Get all category templates
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM category_templates ORDER BY "order"').all();
    res.json({ success: true, data: rows.map(formatCategory) });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ success: false, error: 'Failed to get categories' });
  }
});

// Create category template
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const { name, description, color, icon } = req.body;

    const maxOrder = (db.prepare('SELECT MAX("order") as max FROM category_templates').get() as any)?.max || 0;

    db.prepare(`
      INSERT INTO category_templates (id, name, description, color, icon, "order")
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description, color || '#3b82f6', icon || 'folder', maxOrder + 1);

    const category = db.prepare('SELECT * FROM category_templates WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatCategory(category) });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// Update category template
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon } = req.body;

    db.prepare(`
      UPDATE category_templates SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon)
      WHERE id = ?
    `).run(name, description, color, icon, id);

    const category = db.prepare('SELECT * FROM category_templates WHERE id = ?').get(id);
    res.json({ success: true, data: formatCategory(category) });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// Delete category template
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM category_templates WHERE id = ? AND is_default = 0').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// Reorder categories
router.put('/reorder', (req, res) => {
  try {
    const { ids } = req.body;

    const updateStmt = db.prepare('UPDATE category_templates SET "order" = ? WHERE id = ?');
    const reorder = db.transaction((ids: string[]) => {
      ids.forEach((id, index) => {
        updateStmt.run(index, id);
      });
    });

    reorder(ids);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder categories' });
  }
});

export default router;
