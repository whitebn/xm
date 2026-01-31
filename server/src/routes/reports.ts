import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();

// Get saved report configs
router.get('/configs', (req, res) => {
  try {
    const configs = db.prepare('SELECT * FROM report_configs ORDER BY name').all();

    res.json({
      success: true,
      data: configs.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        filters: c.filters ? JSON.parse(c.filters) : {},
        columns: c.columns ? JSON.parse(c.columns) : [],
        sortBy: c.sort_by,
        sortOrder: c.sort_order,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Error getting report configs:', error);
    res.status(500).json({ success: false, error: 'Failed to get report configs' });
  }
});

// Save report config
router.post('/configs', (req, res) => {
  try {
    const id = uuidv4();
    const { name, description, type, filters, columns, sortBy, sortOrder } = req.body;

    db.prepare(`
      INSERT INTO report_configs (id, name, description, type, filters, columns, sort_by, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, description, type,
      JSON.stringify(filters || {}),
      JSON.stringify(columns || []),
      sortBy, sortOrder || 'asc'
    );

    const config = db.prepare('SELECT * FROM report_configs WHERE id = ?').get(id) as any;
    res.status(201).json({
      success: true,
      data: {
        id: config.id,
        name: config.name,
        description: config.description,
        type: config.type,
        filters: config.filters ? JSON.parse(config.filters) : {},
        columns: config.columns ? JSON.parse(config.columns) : [],
        sortBy: config.sort_by,
        sortOrder: config.sort_order,
        createdAt: config.created_at,
      },
    });
  } catch (error) {
    console.error('Error saving report config:', error);
    res.status(500).json({ success: false, error: 'Failed to save report config' });
  }
});

// Delete report config
router.delete('/configs/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM report_configs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting report config:', error);
    res.status(500).json({ success: false, error: 'Failed to delete report config' });
  }
});

// Generate report
router.post('/generate', (req, res) => {
  try {
    const { type, filters } = req.body;
    let data: any[] = [];

    switch (type) {
      case 'project_summary': {
        const projects = db.prepare(`
          SELECT p.*,
            (SELECT COUNT(*) FROM gantt_items WHERE project_id = p.id) as gantt_count,
            (SELECT COUNT(*) FROM files WHERE project_id = p.id) as file_count,
            (SELECT COUNT(*) FROM invoices WHERE project_id = p.id) as invoice_count
          FROM projects p
          WHERE p.is_template = 0
          ORDER BY p.created_at DESC
        `).all();
        data = projects;
        break;
      }

      case 'gantt_export': {
        const ganttItems = db.prepare(`
          SELECT g.*, p.name as project_name
          FROM gantt_items g
          JOIN projects p ON g.project_id = p.id
          WHERE p.is_template = 0
          ORDER BY p.name, g."order"
        `).all();
        data = ganttItems;
        break;
      }

      case 'crew_schedule': {
        const crewData = db.prepare(`
          SELECT p.name as project_name, g.type, g.crew_number,
            g.start_date, g.end_date, g.strike_start_date, g.strike_end_date
          FROM gantt_items g
          JOIN projects p ON g.project_id = p.id
          WHERE p.is_template = 0 AND g.crew_number > 0
          ORDER BY g.start_date
        `).all();
        data = crewData;
        break;
      }

      case 'financial': {
        const invoices = db.prepare(`
          SELECT i.*, p.name as project_name
          FROM invoices i
          JOIN projects p ON i.project_id = p.id
          ORDER BY i.issue_date DESC
        `).all();
        data = invoices;
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

// Export report as PDF
router.post('/export/pdf', (req, res) => {
  try {
    const { type, filters } = req.body;

    // In production, use jsPDF to generate actual PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.pdf"`);

    // Placeholder content
    res.send(`${type} Report - Generated ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to export PDF' });
  }
});

// Export report as CSV
router.post('/export/csv', (req, res) => {
  try {
    const { type } = req.body;

    // Generate CSV based on type
    let csv = '';

    switch (type) {
      case 'project_summary':
        csv = 'ID,Name,Contract Number,Status,Install Start,Install End,Event Start,Event End,Strike Start,Strike End\n';
        const projects = db.prepare('SELECT * FROM projects WHERE is_template = 0').all() as any[];
        projects.forEach((p) => {
          csv += `${p.id},"${p.name}","${p.contract_number || ''}",${p.status},${p.install_start_date || ''},${p.install_end_date || ''},${p.event_start_date || ''},${p.event_end_date || ''},${p.strike_start_date || ''},${p.strike_end_date || ''}\n`;
        });
        break;

      case 'gantt_export':
        csv = 'Project,Type,Description,Start Date,End Date,Days,Strike Start,Strike End,Strike Days,Crew\n';
        const ganttItems = db.prepare(`
          SELECT g.*, p.name as project_name
          FROM gantt_items g
          JOIN projects p ON g.project_id = p.id
          WHERE p.is_template = 0
        `).all() as any[];
        ganttItems.forEach((g) => {
          csv += `"${g.project_name}","${g.type}","${g.description || ''}",${g.start_date},${g.end_date},${g.number_of_days},${g.strike_start_date || ''},${g.strike_end_date || ''},${g.number_of_strike_days || 0},${g.crew_number || 0}\n`;
        });
        break;

      default:
        csv = 'No data';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to export CSV' });
  }
});

export default router;
