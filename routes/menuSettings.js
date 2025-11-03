const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

// Normal kullanıcılar için varsayılan ayarlar (sadece Lazer Kesim, Tezgah, Cila)
const USER_ROLE_DEFAULTS = {
  visibleMenus: {
    dashboard: false,
    'ana-kasa': false,
    'yarimamul': false,
    'lazer-kesim': true,
    'tezgah': true,
    'cila': true,
    'external-vault': false,
    'dokum': false,
    'tedarik': false,
    'satis': false,
    'required-has': false,
    'reports': false,
    'companies': false,
    'logs': false,
    'settings': false,
    'user-management': false,
  }
};

// Admin için varsayılan ayarlar (tüm menüler açık)
const ADMIN_ROLE_DEFAULTS = {
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
  }
};

// Kullanıcı menü ayarlarını getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      'SELECT settings FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length > 0) {
      const settings = result.rows[0].settings;
      res.json({ settings });
    } else {
      // Varsayılan ayarları rolüne göre döndür
      const roleDefaults = req.user.role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
      res.json({ settings: roleDefaults });
    }
  } catch (error) {
    console.error('Menü ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Menü ayarları getirilemedi' });
  }
});

// Kullanıcı menü ayarlarını kaydet/güncelle
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Ayarlar gerekli' });
    }
    
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

// Kullanıcı menü ayarlarını sıfırla (rol varsayılanlarına)
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    const roleDefaults = req.user.role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
    
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0) {
      // Kaydı sil
      await db.query(
        'DELETE FROM menu_settings WHERE user_id = $1',
        [req.user.id]
      );
    }
    
    res.json({ 
      message: 'Menü ayarları sıfırlandı',
      settings: roleDefaults
    });
  } catch (error) {
    console.error('Menü ayarları sıfırlama hatası:', error);
    res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
  }
});

// Rol varsayılanlarını getir (sadece admin)
router.get('/role-defaults/:role', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    const { role } = req.params;
    const db = getDatabase();
    
    const result = await db.query(
      'SELECT settings FROM menu_role_defaults WHERE role = $1',
      [role]
    );
    
    if (result.rows.length > 0) {
      const settings = result.rows[0].settings;
      res.json({ settings });
    } else {
      // Kod içi varsayılanları döndür
      const defaults = role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
      res.json({ settings: defaults });
    }
  } catch (error) {
    console.error('Rol varsayılanları getirme hatası:', error);
    res.status(500).json({ error: 'Rol varsayılanları getirilemedi' });
  }
});

// Rol varsayılanlarını kaydet/güncelle (sadece admin)
router.post('/role-defaults/:role', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    const { role } = req.params;
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Ayarlar gerekli' });
    }
    
    const db = getDatabase();
    
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM menu_role_defaults WHERE role = $1',
      [role]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
        'UPDATE menu_role_defaults SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE role = $2',
        [settings, role]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO menu_role_defaults (role, settings) VALUES ($1, $2)',
        [role, settings]
      );
    }
    
    res.json({ 
      message: 'Rol varsayılanları kaydedildi',
      settings: settings
    });
  } catch (error) {
    console.error('Rol varsayılanları kaydetme hatası:', error);
    res.status(500).json({ error: 'Ayarlar işlenemedi' });
  }
});

module.exports = router;

