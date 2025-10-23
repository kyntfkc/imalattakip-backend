const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all companies
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    'SELECT * FROM companies ORDER BY created_at DESC',
    [],
    (err, companies) => {
      if (err) {
        global.logger.error('Firma listesi getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(companies);
    }
  );
});

// Get company by ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM companies WHERE id = ?',
    [id],
    (err, company) => {
      if (err) {
        global.logger.error('Firma getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      if (!company) {
        return res.status(404).json({ error: 'Firma bulunamadı' });
      }
      
      res.json(company);
    }
  );
});

// Create new company
router.post('/', authenticateToken, (req, res) => {
  const { name, type, contact, address, notes } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Firma adı ve tipi gerekli' });
  }
  
  if (!['company', 'person'].includes(type)) {
    return res.status(400).json({ error: 'Geçersiz firma tipi' });
  }
  
  const db = getDatabase();
  
  db.run(
    'INSERT INTO companies (name, type, contact, address, notes) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), type, contact?.trim() || '', address?.trim() || '', notes?.trim() || ''],
    function(err) {
      if (err) {
        global.logger.error('Firma oluşturma hatası:', err);
        return res.status(500).json({ error: 'Firma oluşturulamadı' });
      }
      
      // Get the created company
      db.get(
        'SELECT * FROM companies WHERE id = ?',
        [this.lastID],
        (err, company) => {
          if (err) {
            global.logger.error('Firma getirme hatası:', err);
            return res.status(500).json({ error: 'Sunucu hatası' });
          }
          
          // Log the action
          db.run(
            'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
            [req.user.username, 'Firma Oluşturuldu', `Firma: ${name} (${type})`]
          );
          
          res.status(201).json(company);
        }
      );
    }
  );
});

// Update company
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, type, contact, address, notes } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Firma adı ve tipi gerekli' });
  }
  
  if (!['company', 'person'].includes(type)) {
    return res.status(400).json({ error: 'Geçersiz firma tipi' });
  }
  
  const db = getDatabase();
  
  db.run(
    'UPDATE companies SET name = ?, type = ?, contact = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name.trim(), type, contact?.trim() || '', address?.trim() || '', notes?.trim() || '', id],
    function(err) {
      if (err) {
        global.logger.error('Firma güncelleme hatası:', err);
        return res.status(500).json({ error: 'Firma güncellenemedi' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Firma bulunamadı' });
      }
      
      // Get the updated company
      db.get(
        'SELECT * FROM companies WHERE id = ?',
        [id],
        (err, company) => {
          if (err) {
            global.logger.error('Firma getirme hatası:', err);
            return res.status(500).json({ error: 'Sunucu hatası' });
          }
          
          // Log the action
          db.run(
            'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
            [req.user.username, 'Firma Güncellendi', `Firma: ${name} (${type})`]
          );
          
          res.json(company);
        }
      );
    }
  );
});

// Delete company
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  // First get the company to log the action
  db.get(
    'SELECT * FROM companies WHERE id = ?',
    [id],
    (err, company) => {
      if (err) {
        global.logger.error('Firma getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      if (!company) {
        return res.status(404).json({ error: 'Firma bulunamadı' });
      }
      
      // Delete the company
      db.run(
        'DELETE FROM companies WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            global.logger.error('Firma silme hatası:', err);
            return res.status(500).json({ error: 'Firma silinemedi' });
          }
          
          // Log the action
          db.run(
            'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
            [req.user.username, 'Firma Silindi', `Firma: ${company.name} (${company.type})`]
          );
          
          res.json({ message: 'Firma başarıyla silindi' });
        }
      );
    }
  );
});

// Get company statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN type = 'company' THEN 1 ELSE 0 END) as companies,
      SUM(CASE WHEN type = 'person' THEN 1 ELSE 0 END) as persons
     FROM companies`,
    [],
    (err, stats) => {
      if (err) {
        global.logger.error('Firma istatistikleri hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(stats);
    }
  );
});

module.exports = router;
