const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all system logs
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT * FROM system_logs';
  let params = [];
  
  if (search) {
    query += ' WHERE username LIKE ? OR action LIKE ? OR details LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  db.all(query, params, (err, logs) => {
    if (err) {
      global.logger.error('Sistem logları getirme hatası:', err);
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM system_logs';
    let countParams = [];
    
    if (search) {
      countQuery += ' WHERE username LIKE ? OR action LIKE ? OR details LIKE ?';
      countParams = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        global.logger.error('Log sayısı getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json({
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Get log by ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM system_logs WHERE id = ?',
    [id],
    (err, log) => {
      if (err) {
        global.logger.error('Log getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      if (!log) {
        return res.status(404).json({ error: 'Log bulunamadı' });
      }
      
      res.json(log);
    }
  );
});

// Add new log
router.post('/', authenticateToken, (req, res) => {
  const { username, action, entityType, entityName, details } = req.body;
  
  if (!action) {
    return res.status(400).json({ error: 'Aksiyon gerekli' });
  }
  
  const db = getDatabase();
  
  db.run(
    'INSERT INTO system_logs (username, action, entityType, entityName, details) VALUES (?, ?, ?, ?, ?)',
    [username || req.username.usernamename, action, entityType || '', entityName || '', details || ''],
    function(err) {
      if (err) {
        global.logger.error('Log oluşturma hatası:', err);
        return res.status(500).json({ error: 'Log oluşturulamadı' });
      }
      
      // Get the created log
      db.get(
        'SELECT * FROM system_logs WHERE id = ?',
        [this.lastID],
        (err, log) => {
          if (err) {
            global.logger.error('Log getirme hatası:', err);
            return res.status(500).json({ error: 'Sunucu hatası' });
          }
          
          res.status(201).json(log);
        }
      );
    }
  );
});

// Clear all logs (admin only)
router.delete('/clear', authenticateToken, (req, res) => {
  // Check if username is admin
  if (req.username.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
  }
  
  const db = getDatabase();
  
  db.run(
    'DELETE FROM system_logs',
    [],
    function(err) {
      if (err) {
        global.logger.error('Log temizleme hatası:', err);
        return res.status(500).json({ error: 'Loglar temizlenemedi' });
      }
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (username, action, details) VALUES (?, ?, ?)',
        [req.username.usernamename, 'Loglar Temizlendi', `${this.changes} log silindi`]
      );
      
      res.json({ 
        message: 'Tüm loglar başarıyla temizlendi',
        deletedCount: this.changes
      });
    }
  );
});

// Delete specific log (admin only)
router.delete('/:id', authenticateToken, (req, res) => {
  // Check if username is admin
  if (req.username.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
  }
  
  const { id } = req.params;
  const db = getDatabase();
  
  db.run(
    'DELETE FROM system_logs WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        global.logger.error('Log silme hatası:', err);
        return res.status(500).json({ error: 'Log silinemedi' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Log bulunamadı' });
      }
      
      res.json({ message: 'Log başarıyla silindi' });
    }
  );
});

// Get log statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    `SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT username) as uniqueUsers,
      COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as todayCount,
      COUNT(CASE WHEN DATE(created_at) >= DATE('now', '-7 days') THEN 1 END) as weekCount
     FROM system_logs`,
    [],
    (err, stats) => {
      if (err) {
        global.logger.error('Log istatistikleri hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(stats);
    }
  );
});

// Get recent activity (last 24 hours)
router.get('/recent/activity', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT username, action, COUNT(*) as count, MAX(created_at) as lastActivity
     FROM system_logs 
     WHERE created_at >= DATETIME('now', '-24 hours')
     GROUP BY username, action
     ORDER BY lastActivity DESC`,
    [],
    (err, activities) => {
      if (err) {
        global.logger.error('Son aktiviteler getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(activities);
    }
  );
});

module.exports = router;
