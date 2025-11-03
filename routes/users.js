const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Password validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return { valid: false, message: 'Şifre en az 8 karakter olmalı' };
  }
  if (!hasUpperCase) {
    return { valid: false, message: 'Şifre en az bir büyük harf içermeli' };
  }
  if (!hasLowerCase) {
    return { valid: false, message: 'Şifre en az bir küçük harf içermeli' };
  }
  if (!hasNumbers) {
    return { valid: false, message: 'Şifre en az bir rakam içermeli' };
  }
  if (!hasSpecialChar) {
    return { valid: false, message: 'Şifre en az bir özel karakter içermeli' };
  }

  return { valid: true };
};

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
  const { role: rawRole } = req.body;
  
  // 'user' değerini 'normal_user' olarak normalize et
  const role = rawRole === 'user' ? 'normal_user' : rawRole;
  
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
  const userId = parseInt(id);
  
  // Cannot delete self
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
  }
  
  // Cannot delete last admin
  try {
    const db = getDatabase();
    
    // Check if user is admin and count total admins
    const userCheckResult = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    
    if (userCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const userRole = userCheckResult.rows[0].role;
    
    if (userRole === 'admin') {
      const adminCountResult = await db.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['admin']);
      const adminCount = parseInt(adminCountResult.rows[0].count);
      
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'En az bir admin kullanıcı olmalıdır' });
      }
    }
    
    // Get user details for logging
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = userResult.rows[0].username;
    
    // Start transaction - delete related records first, then user
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete user-specific settings and related data
      await client.query('DELETE FROM menu_settings WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM dashboard_settings WHERE user_id = $1', [userId]);
      
      // Optionally delete or anonymize logs (keeping logs for audit, but removing user_id reference)
      // We'll set user_id to NULL in logs instead of deleting them for audit purposes
      await client.query('UPDATE system_logs SET username = NULL WHERE username = $1', [username]);
      
      // Delete transfers (if you want to keep transfers, comment this out)
      // await client.query('DELETE FROM transfers WHERE user_id = $1', [userId]);
      
      // Delete external vault transactions (if you want to keep transactions, comment this out)
      // await client.query('DELETE FROM external_vault_transactions WHERE user_id = $1', [userId]);
      
      // Finally, delete the user
      const deleteResult = await client.query('DELETE FROM users WHERE id = $1', [userId]);
      
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }
      
      // Log the action
      await client.query(
        'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
        [req.user.username, 'Kullanıcı Silme', `Silinen kullanıcı: ${username} (ID: ${userId})`]
      );
      
      await client.query('COMMIT');
      
      global.logger.info(`Kullanıcı silindi: ${username} (ID: ${userId})`);
      res.json({ message: 'Kullanıcı başarıyla silindi' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    global.logger.error('Kullanıcı silme hatası:', error);
    
    // Provide more detailed error message
    let errorMessage = 'Kullanıcı silinemedi';
    if (error.code === '23503') {
      errorMessage = 'Bu kullanıcı başka kayıtlarla ilişkili olduğu için silinemez';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Reset user password (admin only)
router.post('/:id/reset-password', authenticateToken, [
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Şifre en az 8 karakter olmalı')
], async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim. Sadece admin şifre sıfırlayabilir.' });
  }
  
  try {
    // Validation hatalarını kontrol et
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validasyon hatası',
        errors: errors.array() 
      });
    }
    
    const { id } = req.params;
    const { newPassword } = req.body;
    
    // Password policy kontrolü
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }
    
    const db = getDatabase();
    
    // Kullanıcının var olup olmadığını kontrol et
    const userResult = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const user = userResult.rows[0];
    
    // Yeni şifreyi hash'le
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Şifreyi güncelle
    await db.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, entity_type, entity_name, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.username, 'Şifre Sıfırlama', 'USER', user.username, `${user.username} kullanıcısının şifresi admin tarafından sıfırlandı`]
    );
    
    global.logger.info(`Kullanıcı şifresi sıfırlandı: ${user.username} (Admin: ${req.user.username})`);
    res.json({ 
      message: 'Şifre başarıyla sıfırlandı',
      userId: parseInt(id)
    });
  } catch (error) {
    global.logger.error('Şifre sıfırlama hatası:', error);
    res.status(500).json({ 
      error: process.env.NODE_ENV === 'production' 
        ? 'Sunucu hatası' 
        : error.message 
    });
  }
});

module.exports = router;
