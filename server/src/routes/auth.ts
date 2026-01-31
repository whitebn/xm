import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();

// Get or create user from Microsoft auth
router.get('/me', (req, res) => {
  try {
    const email = req.headers['x-user-email'] as string;
    const name = req.headers['x-user-name'] as string;

    if (!email) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // Create new user
      const id = uuidv4();
      const stmt = db.prepare(`
        INSERT INTO users (id, email, name, role)
        VALUES (?, ?, ?, ?)
      `);

      // First user is admin, rest are view_only by default
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      const role = userCount.count === 0 ? 'admin' : 'view_only';

      stmt.run(id, email, name || email.split('@')[0], role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    res.json({
      success: true,
      user: {
        id: (user as any).id,
        email: (user as any).email,
        name: (user as any).name,
        role: (user as any).role,
        avatarUrl: (user as any).avatar_url,
        createdAt: (user as any).created_at,
        updatedAt: (user as any).updated_at,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

export default router;
