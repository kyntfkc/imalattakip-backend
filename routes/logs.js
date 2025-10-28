const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all system logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM system_logs';
    let params = [];
    
    if (search) {
      query += ' WHERE username LIKE $1 OR action LIKE $2 OR details LIKE $3';
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM system_logs';
    let countParams = [];
    
    if (search) {
      countQuery += ' WHERE username LIKE $1 OR action LIKE $2 OR details LIKE $3';
      countParams = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    global.logger.info(`Sistem logları: ${result.rows.length} log (toplam: ${total})`);
    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    global.logger.error('Sistem logları getirme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get log by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  try {
    const result = await db.query('SELECT * FROM system_logs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    global.logger.error('Log getirme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Add new log
router.post('/', authenticateToken, async (req, res) => {
  const { username, action, entityType, entityName, details } = req.body;
  
  if (!action) {
    return res.status(400).json({ error: 'Aksiyon gerekli' });
  }
  
  const db = getDatabase();
  
  try {
    const result = await db.query(
      'INSERT INTO system_logs (username, action, entity_type, entity_name, details) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username || req.user?.username || 'system', action, entityType || '', entityName || '', details || '']
    );
    
    const log = result.rows[0];
    res.status(201).json(log);
  } catch (err) {
    global.logger.error('Log oluşturma hatası:', err);
    res.status(500).json({ error: 'Log oluşturulamadı' });
  }
});

// Clear all logs (admin only)
router.delete('/clear', authenticateToken, async (req, res) => {
  // Check if username is admin
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
  }
  
  const db = getDatabase();
  
  try {
    const result = await db.query('DELETE FROM system_logs RETURNING *');
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Loglar Temizlendi', `${result.rows.length} log silindi`]
    );
    
    res.json({ 
      message: 'Tüm loglar başarıyla temizlendi',
      deletedCount: result.rows.length
    });
  } catch (err) {
    global.logger.error('Log temizleme hatası:', err);
    res.status(500).json({ error: 'Loglar temizlenemedi' });
  }
});

// Delete specific log (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  // Check if username is admin
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
  }
  
  const { id } = req.params;
  const db = getDatabase();
  
  try {
    const result = await db.query('DELETE FROM system_logs WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log bulunamadı' });
    }
    
    res.json({ message: 'Log başarıyla silindi' });
  } catch (err) {
    global.logger.error('Log silme hatası:', err);
    res.status(500).json({ error: 'Log silinemedi' });
  }
});

// Get log statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  const db = getDatabase();
  
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT username) as unique_users,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_count,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_count
       FROM system_logs`
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    global.logger.error('Log istatistikleri hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get recent activity (last 24 hours)
router.get('/recent/activity', authenticateToken, async (req, res) => {
  const db = getDatabase();
  
  try {
    const result = await db.query(
      `SELECT username, action, COUNT(*) as count, MAX(created_at) as last_activity
       FROM system_logs 
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY username, action
       ORDER BY last_activity DESC`
    );
    
    res.json(result.rows);
  } catch (err) {
    global.logger.error('Son aktiviteler getirme hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;