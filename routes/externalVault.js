const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get external vault transactions
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      `SELECT t.*, c.name as company_name, c.id as company_id,
       u.username as user_name 
       FROM external_vault_transactions t 
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN companies c ON t.company_id = c.id
       ORDER BY t.created_at DESC`
    );
    
    global.logger.info(`Dış kasa işlem listesi: ${result.rows.length} işlem`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Dış kasa işlem hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get external vault stock
router.get('/stock', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM external_vault_stock ORDER BY karat');
    
    global.logger.info(`Dış kasa stok listesi: ${result.rows.length} kayıt`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Dış kasa stok hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Add external vault transaction
router.post('/transactions', authenticateToken, async (req, res) => {
  try {
    const { type, amount, karat, notes, company_id } = req.body;
    
    if (!type || !amount || !karat) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }
    
    if (!['deposit', 'withdrawal'].includes(type)) {
      return res.status(400).json({ error: 'Geçersiz işlem tipi' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Miktar pozitif olmalı' });
    }
    
    const db = getDatabase();
    
    // Insert transaction
    const transactionResult = await db.query(
      `INSERT INTO external_vault_transactions (type, amount, karat, notes, user_id, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [type, amount, karat, notes || '', req.user.id, company_id || null]
    );
    
    const transactionId = transactionResult.rows[0].id;
    
    // Update stock
    const stockChange = type === 'deposit' ? amount : -amount;
    
    await db.query(
      `INSERT INTO external_vault_stock (karat, amount) 
       VALUES ($1, $2) 
       ON CONFLICT(karat) DO UPDATE SET 
       amount = external_vault_stock.amount + $2, 
       updated_at = CURRENT_TIMESTAMP`,
      [karat, stockChange]
    );
    
    // Log the action
    try {
      await db.query(
        'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
        [req.user.username, 'Dış Kasa İşlemi', `${type}: ${amount}g (${karat}k)`]
      );
    } catch (logError) {
      global.logger.warn('Log kaydı yapılamadı:', logError);
      // Log hatası kritik değil
    }
    
    global.logger.info(`Dış kasa işlem oluşturuldu: ${type} ${amount}g (${karat}k)`);
    
    res.status(201).json({ 
      message: 'İşlem başarıyla oluşturuldu',
      transactionId: transactionId
    });
  } catch (error) {
    global.logger.error('Dış kasa işlem oluşturma hatası:', error);
    res.status(500).json({ error: 'İşlem oluşturulamadı', details: error.message });
  }
});

// Delete external vault transaction
router.delete('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // First get the transaction to update stock
    const transactionResult = await db.query(
      'SELECT * FROM external_vault_transactions WHERE id = $1',
      [id]
    );
    
    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'İşlem bulunamadı' });
    }
    
    const transaction = transactionResult.rows[0];
    
    // Delete the transaction
    await db.query(
      'DELETE FROM external_vault_transactions WHERE id = $1',
      [id]
    );
    
    // Update stock (reverse the transaction)
    const stockChange = transaction.type === 'deposit' ? -transaction.amount : transaction.amount;
    
    await db.query(
      `INSERT INTO external_vault_stock (karat, amount) 
       VALUES ($1, $2) 
       ON CONFLICT(karat) DO UPDATE SET 
       amount = external_vault_stock.amount + $2, 
       updated_at = CURRENT_TIMESTAMP`,
      [transaction.karat, stockChange]
    );
    
    // Log the action
    try {
      await db.query(
        'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
        [req.user.username, 'Dış Kasa İşlemi Silindi', `${transaction.type}: ${transaction.amount}g (${transaction.karat}k)`]
      );
    } catch (logError) {
      global.logger.warn('Log kaydı yapılamadı:', logError);
      // Log hatası kritik değil
    }
    
    global.logger.info(`Dış kasa işlem silindi: ID ${id}`);
    
    res.json({ message: 'İşlem başarıyla silindi' });
  } catch (error) {
    global.logger.error('Dış kasa işlem silme hatası:', error);
    res.status(500).json({ error: 'İşlem silinemedi', details: error.message });
  }
});

// Sync external vault stock (recalculate from transactions)
router.post('/stock/sync', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    // First, reset all stock to zero
    await db.query('UPDATE external_vault_stock SET amount = 0');
    
    // Then recalculate from all transactions
    const transactionsResult = await db.query(
      'SELECT karat, type, amount FROM external_vault_transactions ORDER BY created_at'
    );
    
    const transactions = transactionsResult.rows;
    
    if (transactions.length === 0) {
      return res.json({ message: 'Stok senkronizasyonu tamamlandı', processed: 0 });
    }
    
    // Process each transaction
    for (const transaction of transactions) {
      const stockChange = transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
      
      await db.query(
        `INSERT INTO external_vault_stock (karat, amount) 
         VALUES ($1, $2) 
         ON CONFLICT(karat) DO UPDATE SET 
         amount = external_vault_stock.amount + $2, 
         updated_at = CURRENT_TIMESTAMP`,
        [transaction.karat, stockChange]
      );
    }
    
    // Log the action
    try {
      await db.query(
        'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
        [req.user.username, 'Dış Kasa Stok Senkronizasyonu', `${transactions.length} işlem işlendi`]
      );
    } catch (logError) {
      global.logger.warn('Log kaydı yapılamadı:', logError);
      // Log hatası kritik değil
    }
    
    global.logger.info(`Dış kasa stok senkronizasyonu: ${transactions.length} işlem işlendi`);
    
    res.json({ 
      message: 'Stok senkronizasyonu tamamlandı', 
      processed: transactions.length 
    });
  } catch (error) {
    global.logger.error('Stok senkronizasyonu hatası:', error);
    res.status(500).json({ error: 'Stok senkronizasyonu yapılamadı', details: error.message });
  }
});

module.exports = router;
