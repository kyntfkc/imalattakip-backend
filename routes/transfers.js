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

// Get all transfers
router.get('/', verifyToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT t.*, u.username as user_name 
     FROM transfers t 
     LEFT JOIN users u ON t.user_id = u.id 
     ORDER BY t.created_at DESC`,
    [],
    (err, transfers) => {
      if (err) {
        global.logger.error('Transfer listesi hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(transfers);
    }
  );
});

// Get transfers by date range
router.get('/date-range', verifyToken, (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Başlangıç ve bitiş tarihi gerekli' });
  }
  
  const db = getDatabase();
  
  db.all(
    `SELECT t.*, u.username as user_name 
     FROM transfers t 
     LEFT JOIN users u ON t.user_id = u.id 
     WHERE DATE(t.created_at) BETWEEN ? AND ?
     ORDER BY t.created_at DESC`,
    [startDate, endDate],
    (err, transfers) => {
      if (err) {
        global.logger.error('Tarih aralığı transfer hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(transfers);
    }
  );
});

// Create new transfer
router.post('/', verifyToken, (req, res) => {
  const { fromUnit, toUnit, amount, karat, notes } = req.body;
  
  if (!fromUnit || !toUnit || !amount || !karat) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ error: 'Miktar pozitif olmalı' });
  }
  
  const db = getDatabase();
  
  db.run(
    'INSERT INTO transfers (from_unit, to_unit, amount, karat, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [fromUnit, toUnit, amount, karat, notes || '', req.user.userId],
    function(err) {
      if (err) {
        global.logger.error('Transfer oluşturma hatası:', err);
        return res.status(500).json({ error: 'Transfer oluşturulamadı' });
      }
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Transfer Oluşturma', `${fromUnit} → ${toUnit}: ${amount}g (${karat}k)`]
      );
      
      res.status(201).json({ 
        message: 'Transfer başarıyla oluşturuldu',
        transferId: this.lastID 
      });
    }
  );
});

// Update transfer
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { fromUnit, toUnit, amount, karat, notes } = req.body;
  
  if (!fromUnit || !toUnit || !amount || !karat) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ error: 'Miktar pozitif olmalı' });
  }
  
  const db = getDatabase();
  
  db.run(
    'UPDATE transfers SET from_unit = ?, to_unit = ?, amount = ?, karat = ?, notes = ? WHERE id = ?',
    [fromUnit, toUnit, amount, karat, notes || '', id],
    function(err) {
      if (err) {
        global.logger.error('Transfer güncelleme hatası:', err);
        return res.status(500).json({ error: 'Transfer güncellenemedi' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Transfer bulunamadı' });
      }
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Transfer Güncelleme', `ID: ${id} - ${fromUnit} → ${toUnit}: ${amount}g (${karat}k)`]
      );
      
      res.json({ message: 'Transfer başarıyla güncellendi' });
    }
  );
});

// Delete transfer
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  // First get transfer details for logging
  db.get('SELECT * FROM transfers WHERE id = ?', [id], (err, transfer) => {
    if (err) {
      global.logger.error('Transfer silme hatası:', err);
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
    
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer bulunamadı' });
    }
    
    // Delete transfer
    db.run('DELETE FROM transfers WHERE id = ?', [id], function(err) {
      if (err) {
        global.logger.error('Transfer silme hatası:', err);
        return res.status(500).json({ error: 'Transfer silinemedi' });
      }
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Transfer Silme', `${transfer.from_unit} → ${transfer.to_unit}: ${transfer.amount}g (${transfer.karat}k)`]
      );
      
      res.json({ message: 'Transfer başarıyla silindi' });
    });
  });
});

// Get transfer statistics
router.get('/stats', verifyToken, (req, res) => {
  const db = getDatabase();
  
  const queries = [
    'SELECT COUNT(*) as total FROM transfers',
    'SELECT SUM(amount) as totalAmount FROM transfers',
    'SELECT COUNT(*) as todayCount FROM transfers WHERE DATE(created_at) = DATE("now")',
    'SELECT SUM(amount) as todayAmount FROM transfers WHERE DATE(created_at) = DATE("now")'
  ];
  
  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.get(query, [], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    })
  )).then(results => {
    res.json({
      totalTransfers: results[0].total,
      totalAmount: results[1].totalAmount || 0,
      todayTransfers: results[2].todayCount,
      todayAmount: results[3].todayAmount || 0
    });
  }).catch(err => {
    global.logger.error('Transfer istatistik hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  });
});

module.exports = router;
