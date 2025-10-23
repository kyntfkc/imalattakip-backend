const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get external vault transactions
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      `SELECT t.*, u.username as user_name 
       FROM external_vault_transactions t 
       LEFT JOIN users u ON t.user_id = u.id 
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
router.post('/transactions', authenticateToken, (req, res) => {
  const { type, amount, karat, notes } = req.body;
  
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
  
  db.run(
    'INSERT INTO external_vault_transactions (type, amount, karat, notes, user_id) VALUES (?, ?, ?, ?, ?)',
    [type, amount, karat, notes || '', req.user.userId],
    function(err) {
      if (err) {
        global.logger.error('Dış kasa işlem oluşturma hatası:', err);
        return res.status(500).json({ error: 'İşlem oluşturulamadı' });
      }
      
      // Update stock
      const stockChange = type === 'deposit' ? amount : -amount;
      
      db.run(
        `INSERT INTO external_vault_stock (karat, amount) 
         VALUES (?, ?) 
         ON CONFLICT(karat) DO UPDATE SET 
         amount = amount + ?, 
         updated_at = CURRENT_TIMESTAMP`,
        [karat, stockChange, stockChange],
        (err) => {
          if (err) {
            global.logger.error('Stok güncelleme hatası:', err);
          }
        }
      );
      
      // Log the action
      db.run(
        'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
        [req.user.username, 'Dış Kasa İşlemi', `${type}: ${amount}g (${karat}k)`]
      );
      
      res.status(201).json({ 
        message: 'İşlem başarıyla oluşturuldu',
        transactionId: this.lastID 
      });
    }
  );
});

// Delete external vault transaction
router.delete('/transactions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  // First get the transaction to update stock
  db.get(
    'SELECT * FROM external_vault_transactions WHERE id = ?',
    [id],
    (err, transaction) => {
      if (err) {
        global.logger.error('Dış kasa işlem getirme hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      if (!transaction) {
        return res.status(404).json({ error: 'İşlem bulunamadı' });
      }
      
      // Delete the transaction
      db.run(
        'DELETE FROM external_vault_transactions WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            global.logger.error('Dış kasa işlem silme hatası:', err);
            return res.status(500).json({ error: 'İşlem silinemedi' });
          }
          
          // Update stock (reverse the transaction)
          const stockChange = transaction.type === 'deposit' ? -transaction.amount : transaction.amount;
          
          db.run(
            `INSERT INTO external_vault_stock (karat, amount) 
             VALUES (?, ?) 
             ON CONFLICT(karat) DO UPDATE SET 
             amount = amount + ?, 
             updated_at = CURRENT_TIMESTAMP`,
            [transaction.karat, stockChange, stockChange],
            (err) => {
              if (err) {
                global.logger.error('Stok güncelleme hatası:', err);
              }
            }
          );
          
          // Log the action
          db.run(
            'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
            [req.user.username, 'Dış Kasa İşlemi Silindi', `${transaction.type}: ${transaction.amount}g (${transaction.karat}k)`]
          );
          
          res.json({ message: 'İşlem başarıyla silindi' });
        }
      );
    }
  );
});

// Sync external vault stock (recalculate from transactions)
router.post('/stock/sync', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  // First, reset all stock to zero
  db.run(
    'UPDATE external_vault_stock SET amount = 0',
    [],
    (err) => {
      if (err) {
        global.logger.error('Stok sıfırlama hatası:', err);
        return res.status(500).json({ error: 'Stok sıfırlanamadı' });
      }
      
      // Then recalculate from all transactions
      db.all(
        'SELECT karat, type, amount FROM external_vault_transactions ORDER BY created_at',
        [],
        (err, transactions) => {
          if (err) {
            global.logger.error('İşlemler getirme hatası:', err);
            return res.status(500).json({ error: 'İşlemler getirilemedi' });
          }
          
          // Process each transaction
          let processed = 0;
          const total = transactions.length;
          
          if (total === 0) {
            return res.json({ message: 'Stok senkronizasyonu tamamlandı', processed: 0 });
          }
          
          transactions.forEach((transaction) => {
            const stockChange = transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
            
            db.run(
              `INSERT INTO external_vault_stock (karat, amount) 
               VALUES (?, ?) 
               ON CONFLICT(karat) DO UPDATE SET 
               amount = amount + ?, 
               updated_at = CURRENT_TIMESTAMP`,
              [transaction.karat, stockChange, stockChange],
              (err) => {
                if (err) {
                  global.logger.error('Stok güncelleme hatası:', err);
                }
                
                processed++;
                if (processed === total) {
                  // Log the action
                  db.run(
                    'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
                    [req.user.username, 'Dış Kasa Stok Senkronizasyonu', `${total} işlem işlendi`]
                  );
                  
                  res.json({ 
                    message: 'Stok senkronizasyonu tamamlandı', 
                    processed: total 
                  });
                }
              }
            );
          });
        }
      );
    }
  );
});

module.exports = router;
