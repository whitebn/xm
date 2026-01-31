import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Get dashboard stats
router.get('/stats', (req, res) => {
  try {
    const totalProjects = (db.prepare('SELECT COUNT(*) as count FROM projects WHERE is_template = 0').get() as any).count;
    const activeProjects = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE is_template = 0 AND status = 'in_progress'").get() as any).count;

    // Count upcoming installs (within 14 days)
    const upcomingInstalls = (db.prepare(`
      SELECT COUNT(*) as count FROM projects
      WHERE is_template = 0
        AND install_start_date IS NOT NULL
        AND date(install_start_date) >= date('now')
        AND date(install_start_date) <= date('now', '+14 days')
    `).get() as any).count;

    // Count overdue gantt items
    const overdueItems = (db.prepare(`
      SELECT COUNT(*) as count FROM gantt_items
      WHERE is_completed = 0
        AND date(end_date) < date('now')
    `).get() as any).count;

    res.json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        upcomingInstalls,
        overdueItems,
      },
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

// Get upcoming events
router.get('/upcoming', (req, res) => {
  try {
    const days = Number(req.query.days) || 14;

    const projects = db.prepare(`
      SELECT id, name, install_start_date, event_start_date, strike_start_date
      FROM projects
      WHERE is_template = 0
        AND (
          (install_start_date IS NOT NULL AND date(install_start_date) >= date('now') AND date(install_start_date) <= date('now', '+' || ? || ' days'))
          OR (event_start_date IS NOT NULL AND date(event_start_date) >= date('now') AND date(event_start_date) <= date('now', '+' || ? || ' days'))
          OR (strike_start_date IS NOT NULL AND date(strike_start_date) >= date('now') AND date(strike_start_date) <= date('now', '+' || ? || ' days'))
        )
      ORDER BY COALESCE(install_start_date, event_start_date, strike_start_date)
      LIMIT 20
    `).all(days, days, days) as any[];

    const upcoming: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    projects.forEach((project) => {
      if (project.install_start_date) {
        const date = new Date(project.install_start_date);
        const daysUntil = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= days) {
          upcoming.push({
            id: project.id,
            name: project.name,
            date: project.install_start_date,
            type: 'install',
            daysUntil,
          });
        }
      }

      if (project.event_start_date) {
        const date = new Date(project.event_start_date);
        const daysUntil = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= days) {
          upcoming.push({
            id: project.id,
            name: project.name,
            date: project.event_start_date,
            type: 'event',
            daysUntil,
          });
        }
      }

      if (project.strike_start_date) {
        const date = new Date(project.strike_start_date);
        const daysUntil = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= days) {
          upcoming.push({
            id: project.id,
            name: project.name,
            date: project.strike_start_date,
            type: 'strike',
            daysUntil,
          });
        }
      }
    });

    // Sort by date
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    res.json({ success: true, data: upcoming.slice(0, 10) });
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({ success: false, error: 'Failed to get upcoming events' });
  }
});

// Get notifications
router.get('/notifications', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    res.json({
      success: true,
      data: notifications.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read === 1,
        link: n.link,
        createdAt: n.created_at,
      })),
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

export default router;
