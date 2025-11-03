const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

<<<<<<< HEAD
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
=======
// Varsayılan menü ayarları (admin için)
const defaultMenuSettings = {
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
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
<<<<<<< HEAD
  }
};

// Kullanıcı menü ayarlarını getir
=======
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
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query(
      'SELECT settings FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length > 0) {
<<<<<<< HEAD
      const settings = result.rows[0].settings;
      res.json({ settings });
    } else {
      // Varsayılan ayarları rolüne göre döndür
      const roleDefaults = req.user.role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
      res.json({ settings: roleDefaults });
=======
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
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
    }
  } catch (error) {
    console.error('Menü ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Menü ayarları getirilemedi' });
  }
});

<<<<<<< HEAD
// Kullanıcı menü ayarlarını kaydet/güncelle
=======
// Menü ayarlarını kaydet/güncelle
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ error: 'Ayarlar gerekli' });
    }
    
<<<<<<< HEAD
=======
    // PostgreSQL JSONB için direkt obje gönder
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
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

<<<<<<< HEAD
// Kullanıcı menü ayarlarını sıfırla (rol varsayılanlarına)
=======
// Menü ayarlarını sıfırla
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
<<<<<<< HEAD
    const roleDefaults = req.user.role === 'admin' ? ADMIN_ROLE_DEFAULTS : USER_ROLE_DEFAULTS;
    
=======
    // Rol bazlı varsayılan ayarları kontrol et
    const roleDefaultsResult = await db.query(
      'SELECT settings FROM role_menu_defaults WHERE role = $1',
      [req.user.role]
    );
    
    const settingsToUse = roleDefaultsResult.rows.length > 0 
      ? roleDefaultsResult.rows[0].settings 
      : (req.user.role === 'admin' ? defaultMenuSettings : defaultUserMenuSettings);
    
    // PostgreSQL JSONB için direkt obje gönder
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM menu_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length > 0) {
<<<<<<< HEAD
      // Kaydı sil
      await db.query(
        'DELETE FROM menu_settings WHERE user_id = $1',
        [req.user.id]
=======
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
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
      );
    }
    
    res.json({ 
      message: 'Menü ayarları sıfırlandı',
<<<<<<< HEAD
      settings: roleDefaults
=======
      settings: settingsToUse
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
    });
  } catch (error) {
    console.error('Menü ayarları sıfırlama hatası:', error);
    res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
  }
});

<<<<<<< HEAD
// Rol varsayılanlarını getir (sadece admin)
=======
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
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
router.get('/role-defaults/:role', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
<<<<<<< HEAD
    const { role } = req.params;
    const db = getDatabase();
    
    const result = await db.query(
      'SELECT settings FROM menu_role_defaults WHERE role = $1',
=======
    const db = getDatabase();
    const { role } = req.params;
    
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Geçersiz rol' });
    }
    
    const result = await db.query(
      'SELECT settings FROM role_menu_defaults WHERE role = $1',
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
      [role]
    );
    
    if (result.rows.length > 0) {
<<<<<<< HEAD
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
=======
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
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
router.post('/role-defaults/:role', authenticateToken, async (req, res) => {
  try {
    // Sadece admin erişebilir
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
<<<<<<< HEAD
    const { role } = req.params;
    const { settings } = req.body;
    
=======
    const db = getDatabase();
    const { role } = req.params;
    const { settings } = req.body;
    
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Geçersiz rol' });
    }
    
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
    if (!settings) {
      return res.status(400).json({ error: 'Ayarlar gerekli' });
    }
    
<<<<<<< HEAD
    const db = getDatabase();
    
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM menu_role_defaults WHERE role = $1',
=======
    // Önce mevcut kaydı kontrol et
    const checkResult = await db.query(
      'SELECT id FROM role_menu_defaults WHERE role = $1',
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
      [role]
    );
    
    if (checkResult.rows.length > 0) {
      // Güncelle
      await db.query(
<<<<<<< HEAD
        'UPDATE menu_role_defaults SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE role = $2',
=======
        'UPDATE role_menu_defaults SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE role = $2',
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
        [settings, role]
      );
    } else {
      // Yeni kayıt oluştur
      await db.query(
<<<<<<< HEAD
        'INSERT INTO menu_role_defaults (role, settings) VALUES ($1, $2)',
=======
        'INSERT INTO role_menu_defaults (role, settings) VALUES ($1, $2)',
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
        [role, settings]
      );
    }
    
    res.json({ 
<<<<<<< HEAD
      message: 'Rol varsayılanları kaydedildi',
      settings: settings
    });
  } catch (error) {
    console.error('Rol varsayılanları kaydetme hatası:', error);
=======
      message: 'Rol varsayılan ayarları kaydedildi',
      settings: settings
    });
  } catch (error) {
    console.error('Rol varsayılan ayarları kaydetme hatası:', error);
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
    res.status(500).json({ error: 'Ayarlar işlenemedi' });
  }
});

module.exports = router;

