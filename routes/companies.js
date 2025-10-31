const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');
const { emitCompanyCreated, emitCompanyUpdated, emitCompanyDeleted } = require('../socket');

const router = express.Router();

// Get all companies
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM companies ORDER BY created_at DESC');
    
    global.logger.info(`Firma listesi: ${result.rows.length} firma`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Firma listesi getirme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get company by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  try {
    const result = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Firma bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    global.logger.error('Firma getirme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Create new company
router.post('/', authenticateToken, async (req, res) => {
  const { name, type, contact, notes } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Firma adı ve tipi gerekli' });
  }
  
  if (!['company', 'person'].includes(type)) {
    return res.status(400).json({ error: 'Geçersiz firma tipi' });
  }
  
  const db = getDatabase();
  
  try {
    const result = await db.query(
      'INSERT INTO companies (name, type, contact, address, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name.trim(), type, contact?.trim() || '', '', notes?.trim() || '']
    );
    
    const company = result.rows[0];
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Firma Oluşturuldu', `Firma: ${name} (${type})`]
    );
    
    global.logger.info(`Yeni firma eklendi: ${name} (${type})`);
    
    // Emit real-time event
    emitCompanyCreated(company);
    
    res.status(201).json(company);
  } catch (err) {
    global.logger.error('Firma oluşturma hatası:', err);
    res.status(500).json({ error: 'Firma oluşturulamadı' });
  }
});

// Update company
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, type, contact, notes } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Firma adı ve tipi gerekli' });
  }
  
  if (!['company', 'person'].includes(type)) {
    return res.status(400).json({ error: 'Geçersiz firma tipi' });
  }
  
  const db = getDatabase();
  
  try {
    const result = await db.query(
      'UPDATE companies SET name = $1, type = $2, contact = $3, address = $4, notes = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name.trim(), type, contact?.trim() || '', '', notes?.trim() || '', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Firma bulunamadı' });
    }
    
    const company = result.rows[0];
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Firma Güncellendi', `Firma: ${name} (${type})`]
    );
    
    // Emit real-time event
    emitCompanyUpdated(company);
    
    res.json(company);
  } catch (err) {
    global.logger.error('Firma güncelleme hatası:', err);
    res.status(500).json({ error: 'Firma güncellenemedi' });
  }
});

// Delete company
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  try {
    // First get the company to log the action
    const getResult = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
    
    if (getResult.rows.length === 0) {
      return res.status(404).json({ error: 'Firma bulunamadı' });
    }
    
    const company = getResult.rows[0];
    
    // Delete the company
    await db.query('DELETE FROM companies WHERE id = $1', [id]);
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Firma Silindi', `Firma: ${company.name} (${company.type})`]
    );
    
    global.logger.info(`Firma silindi: ID ${id}`);
    
    // Emit real-time event
    emitCompanyDeleted(id);
    
    res.json({ message: 'Firma başarıyla silindi' });
  } catch (err) {
    global.logger.error('Firma silme hatası:', err);
    res.status(500).json({ error: 'Firma silinemedi' });
  }
});

// Get company statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  const db = getDatabase();
  
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'company' THEN 1 ELSE 0 END) as companies,
        SUM(CASE WHEN type = 'person' THEN 1 ELSE 0 END) as persons
       FROM companies`
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    global.logger.error('Firma istatistikleri hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;