import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();

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

const formatLineItem = (row: any) => ({
  id: row.id,
  invoiceId: row.invoice_id,
  description: row.description,
  quantity: row.quantity,
  unitPrice: row.unit_price,
  total: row.total,
  order: row.order,
});

// Get invoice by ID
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const lineItems = db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY "order"').all(req.params.id);

    res.json({
      success: true,
      data: {
        ...formatInvoice(invoice),
        lineItems: lineItems.map(formatLineItem),
      },
    });
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoice' });
  }
});

// Update invoice
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyLogo,
      clientName,
      clientAddress,
      clientEmail,
      issueDate,
      dueDate,
      terms,
      notes,
      subtotal,
      taxRate,
      taxAmount,
      total,
    } = req.body;

    db.prepare(`
      UPDATE invoices SET
        status = COALESCE(?, status),
        company_name = COALESCE(?, company_name),
        company_address = COALESCE(?, company_address),
        company_phone = COALESCE(?, company_phone),
        company_email = COALESCE(?, company_email),
        company_logo = COALESCE(?, company_logo),
        client_name = COALESCE(?, client_name),
        client_address = COALESCE(?, client_address),
        client_email = COALESCE(?, client_email),
        issue_date = COALESCE(?, issue_date),
        due_date = ?,
        terms = COALESCE(?, terms),
        notes = ?,
        subtotal = COALESCE(?, subtotal),
        tax_rate = COALESCE(?, tax_rate),
        tax_amount = COALESCE(?, tax_amount),
        total = COALESCE(?, total),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status, companyName, companyAddress, companyPhone, companyEmail, companyLogo,
      clientName, clientAddress, clientEmail, issueDate, dueDate, terms, notes,
      subtotal, taxRate, taxAmount, total, id
    );

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    const lineItems = db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY "order"').all(id);

    res.json({
      success: true,
      data: {
        ...formatInvoice(invoice),
        lineItems: lineItems.map(formatLineItem),
      },
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to update invoice' });
  }
});

// Delete invoice
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
});

// Add line item
router.post('/:invoiceId/items', (req, res) => {
  try {
    const id = uuidv4();
    const { invoiceId } = req.params;
    const { description, quantity, unitPrice, total } = req.body;

    const maxOrder = (db.prepare('SELECT MAX("order") as max FROM invoice_line_items WHERE invoice_id = ?').get(invoiceId) as any)?.max || 0;

    db.prepare(`
      INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, total, "order")
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, invoiceId, description, quantity, unitPrice, total, maxOrder + 1);

    // Update invoice totals
    updateInvoiceTotals(invoiceId);

    const item = db.prepare('SELECT * FROM invoice_line_items WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: formatLineItem(item) });
  } catch (error) {
    console.error('Error adding line item:', error);
    res.status(500).json({ success: false, error: 'Failed to add line item' });
  }
});

// Update line item
router.put('/:invoiceId/items/:itemId', (req, res) => {
  try {
    const { invoiceId, itemId } = req.params;
    const { description, quantity, unitPrice, total } = req.body;

    db.prepare(`
      UPDATE invoice_line_items SET
        description = COALESCE(?, description),
        quantity = COALESCE(?, quantity),
        unit_price = COALESCE(?, unit_price),
        total = COALESCE(?, total)
      WHERE id = ?
    `).run(description, quantity, unitPrice, total, itemId);

    // Update invoice totals
    updateInvoiceTotals(invoiceId);

    const item = db.prepare('SELECT * FROM invoice_line_items WHERE id = ?').get(itemId);
    res.json({ success: true, data: formatLineItem(item) });
  } catch (error) {
    console.error('Error updating line item:', error);
    res.status(500).json({ success: false, error: 'Failed to update line item' });
  }
});

// Delete line item
router.delete('/:invoiceId/items/:itemId', (req, res) => {
  try {
    const { invoiceId, itemId } = req.params;

    db.prepare('DELETE FROM invoice_line_items WHERE id = ?').run(itemId);

    // Update invoice totals
    updateInvoiceTotals(invoiceId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting line item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete line item' });
  }
});

// Generate PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const lineItems = db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY "order"').all(req.params.id);

    // For now, return a simple text response
    // In production, use jsPDF to generate actual PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);

    // Placeholder PDF content
    const pdfContent = `Invoice ${invoice.invoice_number} - Total: $${invoice.total}`;
    res.send(pdfContent);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});

// Send email
router.post('/:id/send', async (req, res) => {
  try {
    const { email } = req.body;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // In production, use nodemailer to send email
    console.log(`Sending invoice ${invoice.invoice_number} to ${email}`);

    // Update status to sent
    db.prepare("UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ?").run(req.params.id);

    res.json({ success: true, message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to send invoice' });
  }
});

// Helper function to update invoice totals
function updateInvoiceTotals(invoiceId: string) {
  const items = db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').all(invoiceId) as any[];
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const invoice = db.prepare('SELECT tax_rate FROM invoices WHERE id = ?').get(invoiceId) as any;
  const taxAmount = subtotal * (invoice.tax_rate / 100);
  const total = subtotal + taxAmount;

  db.prepare(`
    UPDATE invoices SET
      subtotal = ?,
      tax_amount = ?,
      total = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(subtotal, taxAmount, total, invoiceId);
}

export default router;
