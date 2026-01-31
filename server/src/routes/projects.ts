import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();

// Helper to convert DB row to API format
const formatProject = (row: any) => ({
  id: row.id,
  name: row.name,
  contractNumber: row.contract_number,
  status: row.status,
  installStartDate: row.install_start_date,
  installEndDate: row.install_end_date,
  eventStartDate: row.event_start_date,
  eventEndDate: row.event_end_date,
  strikeStartDate: row.strike_start_date,
  strikeEndDate: row.strike_end_date,
  projectManagerId: row.project_manager_id,
  crewLeadId: row.crew_lead_id,
  salesRepId: row.sales_rep_id,
  templateId: row.template_id,
  isTemplate: row.is_template === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Get all projects
router.get('/', (req, res) => {
  try {
    const { status, search, page = 1, pageSize = 50 } = req.query;

    let sql = 'SELECT * FROM projects WHERE is_template = 0';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR contract_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const total = (db.prepare(countSql).get(...params) as any).count;

    // Add pagination
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

    const rows = db.prepare(sql).all(...params);

    res.json({
      items: rows.map(formatProject),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ success: false, error: 'Failed to get projects' });
  }
});

// Get project templates
router.get('/templates', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM projects WHERE is_template = 1 ORDER BY name').all();
    res.json({ success: true, data: rows.map(formatProject) });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ success: false, error: 'Failed to get templates' });
  }
});

// Get single project
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    res.json({ success: true, data: formatProject(row) });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ success: false, error: 'Failed to get project' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const {
      name,
      contractNumber,
      status = 'planning',
      installStartDate,
      installEndDate,
      eventStartDate,
      eventEndDate,
      strikeStartDate,
      strikeEndDate,
      projectManagerId,
      crewLeadId,
      salesRepId,
      isTemplate = false,
    } = req.body;

    db.prepare(`
      INSERT INTO projects (
        id, name, contract_number, status,
        install_start_date, install_end_date,
        event_start_date, event_end_date,
        strike_start_date, strike_end_date,
        project_manager_id, crew_lead_id, sales_rep_id,
        is_template
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, contractNumber, status,
      installStartDate, installEndDate,
      eventStartDate, eventEndDate,
      strikeStartDate, strikeEndDate,
      projectManagerId, crewLeadId, salesRepId,
      isTemplate ? 1 : 0
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatProject(project) });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

// Create project from template
router.post('/from-template/:templateId', (req, res) => {
  try {
    const { templateId } = req.params;
    const id = uuidv4();

    // Get template
    const template = db.prepare('SELECT * FROM projects WHERE id = ? AND is_template = 1').get(templateId) as any;

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const {
      name,
      contractNumber,
      status = 'planning',
      installStartDate,
      installEndDate,
      eventStartDate,
      eventEndDate,
      strikeStartDate,
      strikeEndDate,
      projectManagerId,
      crewLeadId,
      salesRepId,
    } = req.body;

    // Create project
    db.prepare(`
      INSERT INTO projects (
        id, name, contract_number, status,
        install_start_date, install_end_date,
        event_start_date, event_end_date,
        strike_start_date, strike_end_date,
        project_manager_id, crew_lead_id, sales_rep_id,
        template_id, is_template
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id, name, contractNumber, status,
      installStartDate, installEndDate,
      eventStartDate, eventEndDate,
      strikeStartDate, strikeEndDate,
      projectManagerId, crewLeadId, salesRepId,
      templateId
    );

    // Copy gantt item types (headers only) from template
    const templateGantt = db.prepare('SELECT DISTINCT type, color FROM gantt_items WHERE project_id = ?').all(templateId);

    templateGantt.forEach((item: any, index) => {
      const ganttId = uuidv4();
      db.prepare(`
        INSERT INTO gantt_items (id, project_id, type, description, start_date, end_date, color, "order")
        VALUES (?, ?, ?, '', date('now'), date('now'), ?, ?)
      `).run(ganttId, id, item.type, item.color, index);
    });

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatProject(project) });
  } catch (error) {
    console.error('Error creating project from template:', error);
    res.status(500).json({ success: false, error: 'Failed to create project from template' });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      contractNumber,
      status,
      installStartDate,
      installEndDate,
      eventStartDate,
      eventEndDate,
      strikeStartDate,
      strikeEndDate,
      projectManagerId,
      crewLeadId,
      salesRepId,
      isTemplate,
    } = req.body;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        contract_number = COALESCE(?, contract_number),
        status = COALESCE(?, status),
        install_start_date = ?,
        install_end_date = ?,
        event_start_date = ?,
        event_end_date = ?,
        strike_start_date = ?,
        strike_end_date = ?,
        project_manager_id = ?,
        crew_lead_id = ?,
        sales_rep_id = ?,
        is_template = COALESCE(?, is_template),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, contractNumber, status,
      installStartDate, installEndDate,
      eventStartDate, eventEndDate,
      strikeStartDate, strikeEndDate,
      projectManagerId, crewLeadId, salesRepId,
      isTemplate !== undefined ? (isTemplate ? 1 : 0) : null,
      id
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({ success: true, data: formatProject(project) });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// Gantt Items Routes
const formatGanttItem = (row: any) => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type,
  description: row.description,
  startDate: row.start_date,
  endDate: row.end_date,
  numberOfDays: row.number_of_days,
  strikeStartDate: row.strike_start_date,
  strikeEndDate: row.strike_end_date,
  numberOfStrikeDays: row.number_of_strike_days,
  crewNumber: row.crew_number,
  dependsOnId: row.depends_on_id,
  isCompleted: row.is_completed === 1,
  order: row.order,
  color: row.color,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Get gantt items for project
router.get('/:projectId/gantt', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM gantt_items WHERE project_id = ? ORDER BY "order"').all(req.params.projectId);
    res.json({ success: true, data: rows.map(formatGanttItem) });
  } catch (error) {
    console.error('Error getting gantt items:', error);
    res.status(500).json({ success: false, error: 'Failed to get gantt items' });
  }
});

// Create gantt item
router.post('/:projectId/gantt', (req, res) => {
  try {
    const id = uuidv4();
    const { projectId } = req.params;
    const {
      type,
      description,
      startDate,
      endDate,
      numberOfDays,
      strikeStartDate,
      strikeEndDate,
      numberOfStrikeDays,
      crewNumber,
      dependsOnId,
      isCompleted,
      color,
    } = req.body;

    // Get max order
    const maxOrder = (db.prepare('SELECT MAX("order") as max FROM gantt_items WHERE project_id = ?').get(projectId) as any)?.max || 0;

    db.prepare(`
      INSERT INTO gantt_items (
        id, project_id, type, description,
        start_date, end_date, number_of_days,
        strike_start_date, strike_end_date, number_of_strike_days,
        crew_number, depends_on_id, is_completed, "order", color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, projectId, type, description || '',
      startDate, endDate, numberOfDays || 0,
      strikeStartDate, strikeEndDate, numberOfStrikeDays || 0,
      crewNumber || 0, dependsOnId, isCompleted ? 1 : 0, maxOrder + 1, color || '#3b82f6'
    );

    const item = db.prepare('SELECT * FROM gantt_items WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatGanttItem(item) });
  } catch (error) {
    console.error('Error creating gantt item:', error);
    res.status(500).json({ success: false, error: 'Failed to create gantt item' });
  }
});

// Bulk create gantt items
router.post('/:projectId/gantt/bulk', (req, res) => {
  try {
    const { projectId } = req.params;
    const { items } = req.body;

    const maxOrder = (db.prepare('SELECT MAX("order") as max FROM gantt_items WHERE project_id = ?').get(projectId) as any)?.max || 0;

    const insertStmt = db.prepare(`
      INSERT INTO gantt_items (
        id, project_id, type, description,
        start_date, end_date, number_of_days,
        strike_start_date, strike_end_date, number_of_strike_days,
        crew_number, depends_on_id, is_completed, "order", color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const createdIds: string[] = [];

    const insertMany = db.transaction((items: any[]) => {
      items.forEach((item, index) => {
        const id = uuidv4();
        insertStmt.run(
          id, projectId, item.type, item.description || '',
          item.startDate, item.endDate, item.numberOfDays || 0,
          item.strikeStartDate, item.strikeEndDate, item.numberOfStrikeDays || 0,
          item.crewNumber || 0, item.dependsOnId, item.isCompleted ? 1 : 0,
          maxOrder + index + 1, item.color || '#3b82f6'
        );
        createdIds.push(id);
      });
    });

    insertMany(items);

    const createdItems = createdIds.map(id =>
      formatGanttItem(db.prepare('SELECT * FROM gantt_items WHERE id = ?').get(id))
    );

    res.status(201).json({ success: true, data: createdItems });
  } catch (error) {
    console.error('Error bulk creating gantt items:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk create gantt items' });
  }
});

// Update gantt item
router.put('/:projectId/gantt/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      description,
      startDate,
      endDate,
      numberOfDays,
      strikeStartDate,
      strikeEndDate,
      numberOfStrikeDays,
      crewNumber,
      dependsOnId,
      isCompleted,
      color,
    } = req.body;

    db.prepare(`
      UPDATE gantt_items SET
        type = COALESCE(?, type),
        description = COALESCE(?, description),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        number_of_days = COALESCE(?, number_of_days),
        strike_start_date = ?,
        strike_end_date = ?,
        number_of_strike_days = COALESCE(?, number_of_strike_days),
        crew_number = COALESCE(?, crew_number),
        depends_on_id = ?,
        is_completed = COALESCE(?, is_completed),
        color = COALESCE(?, color),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      type, description, startDate, endDate, numberOfDays,
      strikeStartDate, strikeEndDate, numberOfStrikeDays,
      crewNumber, dependsOnId, isCompleted !== undefined ? (isCompleted ? 1 : 0) : null,
      color, id
    );

    const item = db.prepare('SELECT * FROM gantt_items WHERE id = ?').get(id);
    res.json({ success: true, data: formatGanttItem(item) });
  } catch (error) {
    console.error('Error updating gantt item:', error);
    res.status(500).json({ success: false, error: 'Failed to update gantt item' });
  }
});

// Delete gantt item
router.delete('/:projectId/gantt/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM gantt_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting gantt item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete gantt item' });
  }
});

// Bulk delete gantt items
router.post('/:projectId/gantt/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM gantt_items WHERE id IN (${placeholders})`).run(...ids);
    res.json({ success: true });
  } catch (error) {
    console.error('Error bulk deleting gantt items:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk delete gantt items' });
  }
});

// Project Files Routes
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

// Get project files
router.get('/:projectId/files', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM files WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId);
    res.json({ success: true, data: rows.map(formatFile) });
  } catch (error) {
    console.error('Error getting project files:', error);
    res.status(500).json({ success: false, error: 'Failed to get files' });
  }
});

// Project Invoices Routes
const formatInvoice = (row: any) => ({
  id: row.id,
  projectId: row.project_id,
  invoiceNumber: row.invoice_number,
  status: row.status,
  companyName: row.company_name,
  companyAddress: row.company_address,
  companyPhone: row.company_phone,
  companyEmail: row.company_email,
  companyLogo: row.company_logo,
  clientName: row.client_name,
  clientAddress: row.client_address,
  clientEmail: row.client_email,
  issueDate: row.issue_date,
  dueDate: row.due_date,
  terms: row.terms,
  notes: row.notes,
  subtotal: row.subtotal,
  taxRate: row.tax_rate,
  taxAmount: row.tax_amount,
  total: row.total,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Get project invoices
router.get('/:projectId/invoices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM invoices WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId);
    res.json({ success: true, data: rows.map(formatInvoice) });
  } catch (error) {
    console.error('Error getting project invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoices' });
  }
});

// Create project invoice
router.post('/:projectId/invoices', (req, res) => {
  try {
    const id = uuidv4();
    const { projectId } = req.params;
    const {
      invoiceNumber,
      status = 'draft',
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      clientName,
      clientAddress,
      clientEmail,
      issueDate,
      dueDate,
      terms,
      notes,
      taxRate = 0,
    } = req.body;

    // Get company settings for defaults
    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default') as any;

    db.prepare(`
      INSERT INTO invoices (
        id, project_id, invoice_number, status,
        company_name, company_address, company_phone, company_email, company_logo,
        client_name, client_address, client_email,
        issue_date, due_date, terms, notes,
        subtotal, tax_rate, tax_amount, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0)
    `).run(
      id, projectId, invoiceNumber, status,
      companyName || settings?.name,
      companyAddress || settings?.address,
      companyPhone || settings?.phone,
      companyEmail || settings?.email,
      settings?.logo,
      clientName, clientAddress, clientEmail,
      issueDate, dueDate,
      terms || settings?.default_terms,
      notes,
      taxRate || settings?.default_tax_rate || 0
    );

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatInvoice(invoice) });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
});

export default router;
