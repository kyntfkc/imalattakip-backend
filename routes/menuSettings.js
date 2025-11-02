const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

// Varsayılan menü ayarları (admin için)
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

// User rolü için varsayılan ayarlar
const defaultUserMenuSettings = {
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
    'logs': false,
    'settings': true,
    'user-management': false,
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
      // Rol bazlı varsayılan ayarları kontrol et
      const roleDefaultsResult = await db.query(
        'SELECT settings FROM role_menu_defaults WHERE role = $1',
        [req.user.role]
      );
      
      if (roleDefaultsResult.rows.length > 0) {
        // Rol bazlı varsayılanları kullan
        res.json({ settings: roleDefaultsResult.rows[0].settings });
      } else {
        // Sistem varsayılanlarını kullan (rol bazlı)
        const defaultForRole = req.user.role === 'admin' 
          ? defaultMenuSettings 
          : defaultUserMenuSettings;
        res.json({ settings: defaultForRole });
      }
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
    
    // Rol bazlı varsayılan ayarları kontrol et
    const roleDefaultsResult = await db.query(
      'SELECT settings FROM role_menu_defaults WHERE role = $1',
      [req.user.role]
    );
    
    const settingsToUse = roleDefaultsResult.rows.length > 0 
      ? roleDefaultsResult.rows[0].settings 
      : (req.user.role === 'admin' ? defaultMenuSettings : defaultUserMenuSettings);
    
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
        [settingsToUse, req.user.id]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO menu_settings (user_id, settings) VALUES ($1, $2)',
        [req.user.id, settingsToUse]
      );
    }
    
    res.json({ 
      message: 'Menü ayarları sıfırlandı',
      settings: settingsToUse
    });
  } catch (error) {
    console.error('Menü ayarları sıfırlama hatası:', error);
    res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
  }
});

// Tüm rol varsayılanlarını getir (admin only) - Önce tanımlanmalı (parametreli route'tan önce)
router.get('/role-defaults', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    const db = getDatabase();
    const result = await db.query(
      'SELECT role, settings FROM role_menu_defaults'
    );
    
    const defaults = {};
    result.rows.forEach(row => {
      defaults[row.role] = row.settings;
    });
    
    // Eksik roller için sistem varsayılanlarını ekle
    if (!defaults['admin']) {
      defaults['admin'] = defaultMenuSettings;
    }
    if (!defaults['user']) {
      defaults['user'] = defaultUserMenuSettings;
    }
    
    res.json({ defaults });
  } catch (error) {
    console.error('Rol varsayılan ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Rol varsayılan ayarları getirilemedi' });
  }
});

// Rol bazlı varsayılan ayarları getir (admin only) - Parametreli route daha sonra
router.get('/role-defaults/:role', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    const db = getDatabase();
    const { role } = req.params;
    
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Geçersiz rol' });
    }
    
    const result = await db.query(
      'SELECT settings FROM role_menu_defaults WHERE role = $1',
      [role]
    );
    
    if (result.rows.length > 0) {
      res.json({ settings: result.rows[0].settings });
    } else {
      // Sistem varsayılanlarını döndür (rol bazlı)
      const defaultForRole = role === 'admin' 
        ? defaultMenuSettings 
        : defaultUserMenuSettings;
      res.json({ settings: defaultForRole });
    }
  } catch (error) {
    console.error('Rol varsayılan ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Rol varsayılan ayarları getirilemedi' });
  }
});

// Rol bazlı varsayılan ayarları kaydet (admin only)
router.post('/role-defaults/:role', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    const db = getDatabase();
    const { role } = req.params;
    const { settings } = req.body;
    
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Geçersiz rol' });
    }
    
    if (!settings) {
      return res.status(400).json({ error: 'Ayarlar gerekli' });
    }
    
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM role_menu_defaults WHERE role = $1',
      [role]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
        'UPDATE role_menu_defaults SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE role = $2',
        [settings, role]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
        'INSERT INTO role_menu_defaults (role, settings) VALUES ($1, $2)',
        [role, settings]
      );
    }
    
    res.json({ 
      message: 'Rol varsayılan ayarları kaydedildi',
      settings: settings
    });
  } catch (error) {
    console.error('Rol varsayılan ayarları kaydetme hatası:', error);
    res.status(500).json({ error: 'Ayarlar işlenemedi' });
  }
});

module.exports = router;

