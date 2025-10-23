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

// Get all users (admin only)
router.get('/', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  
  const db = getDatabase();
  
  db.all(
    'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC',
    [],
    (err, users) => {
      if (err) {
        global.logger.error('Kullanıcı listesi hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(users);
    }
  );
});

// Update user role (admin only)
router.put('/:id/role', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  
  const { id } = req.params;
  const { role } = req.body;
  
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol' });
  }
  
  const db = getDatabase();
  
  db.run(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, id],
    function(err) {
      if (err) {
        global.logger.error('Kullanıcı rol güncelleme hatası:', err);
        return res.status(500).json({ error: 'Rol güncellenemedi' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Kullanıcı Rol Güncelleme', `Kullanıcı ID: ${id}, Yeni Rol: ${role}`]
      );
      
      res.json({ message: 'Kullanıcı rolü başarıyla güncellendi' });
    }
  );
});

// Delete user (admin only)
router.delete('/:id', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }
  
  const { id } = req.params;
  
  // Cannot delete self
  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
  }
  
  const db = getDatabase();
  
  // First get user details for logging
  db.get('SELECT username FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      global.logger.error('Kullanıcı silme hatası:', err);
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    // Delete user
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
      if (err) {
        global.logger.error('Kullanıcı silme hatası:', err);
        return res.status(500).json({ error: 'Kullanıcı silinemedi' });
      }
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Kullanıcı Silme', `Silinen kullanıcı: ${user.username}`]
      );
      
      res.json({ message: 'Kullanıcı başarıyla silindi' });
    });
  });
});

module.exports = router;
