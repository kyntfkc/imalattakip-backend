const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

// Dashboard ayarlarını getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      'SELECT settings FROM dashboard_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length > 0) {
      // PostgreSQL JSONB otomatik olarak parse edilir
      const settings = result.rows[0].settings;
      res.json({ settings });
    } else {
      // Varsayılan ayarları döndür
      const defaultSettings = {
        unitOrder: ['ana-kasa', 'yarimamul', 'lazer-kesim', 'tezgah', 'cila', 'dokum', 'tedarik', 'satis', 'dis-kasa'],
        hiddenUnits: [],
        showFire: true,
        showHas: true,
        showLastUpdate: true
      };
      res.json({ settings: defaultSettings });
    }
  } catch (error) {
    console.error('Dashboard ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Dashboard ayarları getirilemedi' });
  }
});

// Dashboard ayarlarını kaydet/güncelle
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
      'SELECT id FROM dashboard_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
        'UPDATE dashboard_settings SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [settings, req.user.id]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO dashboard_settings (user_id, settings) VALUES ($1, $2)',
        [req.user.id, settings]
      );
    }
    
    res.json({ 
      message: 'Dashboard ayarları kaydedildi',
      settings: settings
    });
  } catch (error) {
    console.error('Dashboard ayarları kaydetme hatası:', error);
    res.status(500).json({ error: 'Ayarlar işlenemedi' });
  }
});

// Dashboard ayarlarını sıfırla
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    const defaultSettings = {
      unitOrder: ['ana-kasa', 'yarimamul', 'lazer-kesim', 'tezgah', 'cila', 'dokum', 'tedarik', 'satis', 'dis-kasa'],
      hiddenUnits: [],
      showFire: true,
      showHas: true,
      showLastUpdate: true
    };
    
    // PostgreSQL JSONB için direkt obje gönder
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM dashboard_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
        'UPDATE dashboard_settings SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [defaultSettings, req.user.id]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO dashboard_settings (user_id, settings) VALUES ($1, $2)',
        [req.user.id, defaultSettings]
      );
    }
    
    res.json({ 
      message: 'Dashboard ayarları sıfırlandı',
      settings: defaultSettings
    });
  } catch (error) {
    console.error('Dashboard ayarları sıfırlama hatası:', error);
    res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
  }
});

module.exports = router;
