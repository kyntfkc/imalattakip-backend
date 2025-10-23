const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all transfers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      `SELECT t.*, u.username as user_name 
       FROM transfers t 
       LEFT JOIN users u ON t.user_id = u.id 
       ORDER BY t.created_at DESC`
    );
    
    global.logger.info(`Transfer listesi getirildi: ${result.rows.length} transfer`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Transfer listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get transfers by date range
router.get('/date-range', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Başlangıç ve bitiş tarihi gerekli' });
  }
  
  try {
    const db = getDatabase();
    const result = await db.query(
      `SELECT t.*, u.username as user_name 
       FROM transfers t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE DATE(t.created_at) BETWEEN $1 AND $2
       ORDER BY t.created_at DESC`,
      [startDate, endDate]
    );
    
    global.logger.info(`Tarih aralığı transfer listesi: ${result.rows.length} transfer`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Tarih aralığı transfer hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Create new transfer
router.post('/', authenticateToken, async (req, res) => {
  const { fromUnit, toUnit, amount, karat, notes } = req.body;
  
  if (!fromUnit || !toUnit || !amount || !karat) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ error: 'Miktar pozitif olmalı' });
  }
  
  try {
    const db = getDatabase();
    const result = await db.query(
      'INSERT INTO transfers (from_unit, to_unit, amount, karat, notes, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [fromUnit, toUnit, amount, karat, notes || '', req.user.id]
    );
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Transfer Oluşturma', `${fromUnit} → ${toUnit}: ${amount}g (${karat}k)`]
    );
    
    global.logger.info(`Transfer oluşturuldu: ${fromUnit} → ${toUnit}: ${amount}g (${karat}k)`);
    res.status(201).json({ 
      message: 'Transfer başarıyla oluşturuldu',
      transferId: result.rows[0].id 
    });
  } catch (error) {
    global.logger.error('Transfer oluşturma hatası:', error);
    res.status(500).json({ error: 'Transfer oluşturulamadı' });
  }
});

// Update transfer
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fromUnit, toUnit, amount, karat, notes } = req.body;
  
  if (!fromUnit || !toUnit || !amount || !karat) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }
  
  if (amount <= 0) {
    return res.status(400).json({ error: 'Miktar pozitif olmalı' });
  }
  
  try {
    const db = getDatabase();
    const result = await db.query(
      'UPDATE transfers SET from_unit = $1, to_unit = $2, amount = $3, karat = $4, notes = $5 WHERE id = $6',
      [fromUnit, toUnit, amount, karat, notes || '', id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transfer bulunamadı' });
    }
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Transfer Güncelleme', `ID: ${id} - ${fromUnit} → ${toUnit}: ${amount}g (${karat}k)`]
    );
    
    global.logger.info(`Transfer güncellendi: ID ${id}`);
    res.json({ message: 'Transfer başarıyla güncellendi' });
  } catch (error) {
    global.logger.error('Transfer güncelleme hatası:', error);
    res.status(500).json({ error: 'Transfer güncellenemedi' });
  }
});

// Delete transfer
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const db = getDatabase();
    
    // First get transfer details for logging
    const transferResult = await db.query('SELECT * FROM transfers WHERE id = $1', [id]);
    
    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer bulunamadı' });
    }
    
    const transfer = transferResult.rows[0];
    
    // Delete transfer
    const deleteResult = await db.query('DELETE FROM transfers WHERE id = $1', [id]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Transfer bulunamadı' });
    }
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [req.user.username, 'Transfer Silme', `${transfer.from_unit} → ${transfer.to_unit}: ${transfer.amount}g (${transfer.karat}k)`]
    );
    
    global.logger.info(`Transfer silindi: ID ${id}`);
    res.json({ message: 'Transfer başarıyla silindi' });
  } catch (error) {
    global.logger.error('Transfer silme hatası:', error);
    res.status(500).json({ error: 'Transfer silinemedi' });
  }
});

// Get transfer statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    const queries = [
      'SELECT COUNT(*) as total FROM transfers',
      'SELECT SUM(amount) as totalAmount FROM transfers',
      'SELECT COUNT(*) as todayCount FROM transfers WHERE DATE(created_at) = CURRENT_DATE',
      'SELECT SUM(amount) as todayAmount FROM transfers WHERE DATE(created_at) = CURRENT_DATE'
    ];
    
    const results = await Promise.all(queries.map(query => db.query(query)));
    
    res.json({
      totalTransfers: parseInt(results[0].rows[0].total),
      totalAmount: parseFloat(results[1].rows[0].totalamount) || 0,
      todayTransfers: parseInt(results[2].rows[0].todaycount),
      todayAmount: parseFloat(results[3].rows[0].todayamount) || 0
    });
  } catch (error) {
    global.logger.error('Transfer istatistik hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
