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
      // Önce rol bazlı varsayılanları kontrol et
      const roleDefaultsResult = await db.query(
        'SELECT settings FROM role_menu_defaults WHERE role = $1',
        [req.user.role === 'normal_user' ? 'user' : req.user.role]
      );
      
      if (roleDefaultsResult.rows.length > 0) {
        // Rol bazlı varsayılanları kullan
        res.json({ settings: roleDefaultsResult.rows[0].settings });
      } else {
        // Kod içi varsayılanları kullan
        const roleDefaults = req.user.role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
        res.json({ settings: roleDefaults });
      }
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
    
    // Önce rol bazlı varsayılanları kontrol et
    const normalizedRole = req.user.role === 'normal_user' ? 'user' : req.user.role;
    const roleDefaultsResult = await db.query(
      'SELECT settings FROM role_menu_defaults WHERE role = $1',
      [normalizedRole]
    );
    
    let settingsToUse;
    if (roleDefaultsResult.rows.length > 0) {
      settingsToUse = roleDefaultsResult.rows[0].settings;
    } else {
      // Kod içi varsayılanları kullan
      settingsToUse = req.user.role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
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
    
    // Eksik roller için kod içi varsayılanları ekle
    if (!defaults['admin']) {
      defaults['admin'] = ADMIN_ROLE_DEFAULTS;
    }
    if (!defaults['user']) {
      defaults['user'] = USER_ROLE_DEFAULTS;
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
      // Kod içi varsayılanları döndür
      const defaults = role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
      res.json({ settings: defaults });
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
