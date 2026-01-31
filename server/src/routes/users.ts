import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

const formatUser = (row: any) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  avatarUrl: row.avatar_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Get all users
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM users ORDER BY name').all();
    res.json({ success: true, data: rows.map(formatUser) });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

// Get user by ID
router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: formatUser(user) });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// Update user role
router.put('/:id/role', (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'vp', 'manager', 'view_only'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    db.prepare(`
      UPDATE users SET
        role = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(role, id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ success: true, data: formatUser(user) });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ success: false, error: 'Failed to update user role' });
  }
});

export default router;
