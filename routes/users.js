const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  
  try {
    const db = getDatabase();
    const result = await db.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    
    global.logger.info(`Kullanıcı listesi getirildi: ${result.rows.length} kullanıcı`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Kullanıcı listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Update user role (admin only)
router.put('/:id/role', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  
  const { id } = req.params;
  const { role } = req.body;
  
  if (!['admin', 'normal_user'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol' });
  }
  
  try {
    const db = getDatabase();
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [role, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Kullanıcı Rol Güncelleme', `Kullanıcı ID: ${id}, Yeni Rol: ${role}`]
    );
    
    global.logger.info(`Kullanıcı rolü güncellendi: ID ${id}, Rol: ${role}`);
    res.json({ message: 'Kullanıcı rolü başarıyla güncellendi' });
  } catch (error) {
    global.logger.error('Kullanıcı rol güncelleme hatası:', error);
    res.status(500).json({ error: 'Rol güncellenemedi' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  
  const { id } = req.params;
  
  // Cannot delete self
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
  }
  
  try {
    const db = getDatabase();
    
    // First get user details for logging
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const username = userResult.rows[0].username;
    
    // Delete user
    const deleteResult = await db.query('DELETE FROM users WHERE id = $1', [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Kullanıcı Silme', `Silinen kullanıcı: ${username}`]
    );
    
    global.logger.info(`Kullanıcı silindi: ${username}`);
    res.json({ message: 'Kullanıcı başarıyla silindi' });
  } catch (error) {
    global.logger.error('Kullanıcı silme hatası:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
  }
});

module.exports = router;
