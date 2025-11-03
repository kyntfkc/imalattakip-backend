const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');
const { emitRequiredHasCreated, emitRequiredHasUpdated, emitRequiredHasDeleted } = require('../socket');

const router = express.Router();

// Get all required has items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      `SELECT r.*, u.username as user_name 
       FROM required_has_items r 
       LEFT JOIN users u ON r.user_id = u.id 
       ORDER BY r.date DESC, r.created_at DESC`
    );
    
    global.logger.info(`Required Has listesi getirildi: ${result.rows.length} kayıt`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Required Has listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Create new required has item
router.post('/', authenticateToken, async (req, res) => {
  const { date, description, input, output, notes } = req.body;
  
  if (!date || !description) {
    return res.status(400).json({ error: 'Tarih ve açıklama gerekli' });
  }
  
  if (input < 0 || output < 0) {
    return res.status(400).json({ error: 'Giriş ve çıkış değerleri negatif olamaz' });
  }
  
  try {
    const db = getDatabase();
    const result = await db.query(
      'INSERT INTO required_has_items (date, description, input, output, notes, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [date, description, input || 0, output || 0, notes || '', req.user.id]
    );
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, entity_type, entity_name, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.username, 'Gereken Has Ekleme', 'REQUIRED_HAS', description, `Giriş: ${input || 0} TL, Çıkış: ${output || 0} TL`]
    );
    
    global.logger.info(`Required Has oluşturuldu: ${description}`);
    
    // Emit real-time event
    const itemData = {
      ...result.rows[0],
      user_name: req.user.username
    };
    emitRequiredHasCreated(itemData);
    
    res.status(201).json({ 
      message: 'Kayıt başarıyla oluşturuldu',
      id: result.rows[0].id 
    });
  } catch (error) {
    global.logger.error('Required Has oluşturma hatası:', error);
    res.status(500).json({ error: 'Kayıt oluşturulamadı' });
  }
});

// Update required has item
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { date, description, input, output, notes } = req.body;
  
  if (!date || !description) {
    return res.status(400).json({ error: 'Tarih ve açıklama gerekli' });
  }
  
  if (input < 0 || output < 0) {
    return res.status(400).json({ error: 'Giriş ve çıkış değerleri negatif olamaz' });
  }
  
  try {
    const db = getDatabase();
    
    // Check if item exists
    const checkResult = await db.query('SELECT * FROM required_has_items WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Kayıt bulunamadı' });
    }
    
    const result = await db.query(
      'UPDATE required_has_items SET date = $1, description = $2, input = $3, output = $4, notes = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [date, description, input || 0, output || 0, notes || '', id]
    );
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, entity_type, entity_name, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.username, 'Gereken Has Güncelleme', 'REQUIRED_HAS', description, `Giriş: ${input || 0} TL, Çıkış: ${output || 0} TL`]
    );
    
    global.logger.info(`Required Has güncellendi: ${id}`);
    
    // Emit real-time event
    const itemData = {
      ...result.rows[0],
      user_name: req.user.username
    };
    emitRequiredHasUpdated(itemData);
    
    res.json({ 
      message: 'Kayıt başarıyla güncellendi',
      id: result.rows[0].id 
    });
  } catch (error) {
    global.logger.error('Required Has güncelleme hatası:', error);
    res.status(500).json({ error: 'Kayıt güncellenemedi' });
  }
});

// Delete required has item
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const db = getDatabase();
    
    // Check if item exists and get description for logging
    const checkResult = await db.query('SELECT description FROM required_has_items WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Kayıt bulunamadı' });
    }
    
    const description = checkResult.rows[0].description;
    
    await db.query('DELETE FROM required_has_items WHERE id = $1', [id]);
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, entity_type, entity_name, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.username, 'Gereken Has Silme', 'REQUIRED_HAS', description, 'Kayıt silindi']
    );
    
    global.logger.info(`Required Has silindi: ${id}`);
    
    // Emit real-time event
    emitRequiredHasDeleted(parseInt(id));
    
    res.json({ message: 'Kayıt başarıyla silindi' });
  } catch (error) {
    global.logger.error('Required Has silme hatası:', error);
    res.status(500).json({ error: 'Kayıt silinemedi' });
  }
});

module.exports = router;

