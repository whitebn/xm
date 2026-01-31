import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import db from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, 'company-logo' + extname(file.originalname));
  },
});

const upload = multer({ storage });

const router = Router();

const formatSettings = (row: any) => ({
  id: row.id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  email: row.email,
  logo: row.logo,
  defaultTerms: row.default_terms,
  defaultTaxRate: row.default_tax_rate,
});

// Get company settings
router.get('/company', (req, res) => {
  try {
    let settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default');

    if (!settings) {
      // Create default settings
      db.prepare(`
        INSERT INTO company_settings (id, default_terms, default_tax_rate)
        VALUES ('default', 'Net 30', 0)
      `).run();
      settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default');
    }

    res.json({ success: true, data: formatSettings(settings) });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// Update company settings
router.put('/company', (req, res) => {
  try {
    const { name, address, phone, email, logo, defaultTerms, defaultTaxRate } = req.body;

    db.prepare(`
      UPDATE company_settings SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        logo = COALESCE(?, logo),
        default_terms = COALESCE(?, default_terms),
        default_tax_rate = COALESCE(?, default_tax_rate)
      WHERE id = 'default'
    `).run(name, address, phone, email, logo, defaultTerms, defaultTaxRate);

    const settings = db.prepare('SELECT * FROM company_settings WHERE id = ?').get('default');
    res.json({ success: true, data: formatSettings(settings) });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// Upload company logo
router.post('/logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const logoUrl = `/uploads/${req.file.filename}`;

    db.prepare(`
      UPDATE company_settings SET logo = ? WHERE id = 'default'
    `).run(logoUrl);

    res.json({ success: true, data: { url: logoUrl } });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ success: false, error: 'Failed to upload logo' });
  }
});

export default router;
