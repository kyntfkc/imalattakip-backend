const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

// Varsayılan menü ayarları
const defaultMenuSettings = {
  visibleMenus: {
    dashboard: true,
    'ana-kasa': true,
    'yarimamul': true,
    'lazer-kesim': true,
    'tezgah': true,
    'cila': true,
    'external-vault': true,
    'dokum': true,
    'tedarik': true,
    'satis': true,
    'required-has': true,
    'reports': true,
    'companies': true,
    'logs': true,
    'settings': true,
    'user-management': true,
  },
};

// Menü ayarlarını getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      'SELECT settings FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length > 0) {
      // PostgreSQL JSONB otomatik olarak parse edilir
      const settings = result.rows[0].settings;
      res.json({ settings });
    } else {
      // Varsayılan ayarları döndür
      res.json({ settings: defaultMenuSettings });
    }
  } catch (error) {
    console.error('Menü ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Menü ayarları getirilemedi' });
  }
});

// Menü ayarlarını kaydet/güncelle
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Ayarlar gerekli' });
    }
    
    // PostgreSQL JSONB için direkt obje gönder
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
        'UPDATE menu_settings SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [settings, req.user.id]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO menu_settings (user_id, settings) VALUES ($1, $2)',
        [req.user.id, settings]
      );
    }
    
    res.json({ 
      message: 'Menü ayarları kaydedildi',
      settings: settings
    });
  } catch (error) {
    console.error('Menü ayarları kaydetme hatası:', error);
    res.status(500).json({ error: 'Ayarlar işlenemedi' });
  }
});

// Menü ayarlarını sıfırla
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    // PostgreSQL JSONB için direkt obje gönder
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
        'UPDATE menu_settings SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [defaultMenuSettings, req.user.id]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO menu_settings (user_id, settings) VALUES ($1, $2)',
        [req.user.id, defaultMenuSettings]
      );
    }
    
    res.json({ 
      message: 'Menü ayarları sıfırlandı',
      settings: defaultMenuSettings
    });
  } catch (error) {
    console.error('Menü ayarları sıfırlama hatası:', error);
    res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
  }
});

module.exports = router;

