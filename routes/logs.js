const express = require('express');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'imalattakip-secret-key-2024';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// Get all system logs
router.get('/', verifyToken, (req, res) => {
  const db = getDatabase();
  const { page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT * FROM system_logs';
  let params = [];
  
  if (search) {
    query += ' WHERE user LIKE ? OR action LIKE ? OR details LIKE ?';
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
      countQuery += ' WHERE user LIKE ? OR action LIKE ? OR details LIKE ?';
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
router.get('/:id', verifyToken, (req, res) => {
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
router.post('/', verifyToken, (req, res) => {
  const { user, action, entityType, entityName, details } = req.body;
  
  if (!action) {
    return res.status(400).json({ error: 'Aksiyon gerekli' });
  }
  
  const db = getDatabase();
  
  db.run(
    'INSERT INTO system_logs (user, action, entityType, entityName, details) VALUES (?, ?, ?, ?, ?)',
    [user || req.user.username, action, entityType || '', entityName || '', details || ''],
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
router.delete('/clear', verifyToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
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
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Loglar Temizlendi', `${this.changes} log silindi`]
      );
      
      res.json({ 
        message: 'Tüm loglar başarıyla temizlendi',
        deletedCount: this.changes
      });
    }
  );
});

// Delete specific log (admin only)
router.delete('/:id', verifyToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
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
router.get('/stats/summary', verifyToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    `SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT user) as uniqueUsers,
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
router.get('/recent/activity', verifyToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT user, action, COUNT(*) as count, MAX(created_at) as lastActivity
     FROM system_logs 
     WHERE created_at >= DATETIME('now', '-24 hours')
     GROUP BY user, action
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
