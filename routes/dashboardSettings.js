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
      try {
        const settings = JSON.parse(result.rows[0].settings);
        res.json({ settings });
      } catch (parseError) {
        console.error('Settings parse hatası:', parseError);
        res.status(500).json({ error: 'Ayarlar parse edilemedi' });
      }
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
router.post('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { settings } = req.body;
  
  if (!settings) {
    return res.status(400).json({ error: 'Ayarlar gerekli' });
  }
  
  try {
    const settingsJson = JSON.stringify(settings);
    
    // Önce mevcut kaydı kontrol et
    db.get(
      'SELECT id FROM dashboard_settings WHERE user_id = ?',
      [req.user.id],
      (err, row) => {
        if (err) {
          console.error('Dashboard ayarları kontrol hatası:', err);
          return res.status(500).json({ error: 'Ayarlar kontrol edilemedi' });
        }
        
        if (row) {
          // Güncelle
          db.run(
            'UPDATE dashboard_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [settingsJson, req.user.id],
            function(err) {
              if (err) {
                console.error('Dashboard ayarları güncelleme hatası:', err);
                return res.status(500).json({ error: 'Ayarlar güncellenemedi' });
              }
              res.json({ 
                message: 'Dashboard ayarları güncellendi',
                settings: settings
              });
            }
          );
        } else {
          // Yeni kayıt oluştur
          db.run(
            'INSERT INTO dashboard_settings (user_id, settings) VALUES (?, ?)',
            [req.user.id, settingsJson],
            function(err) {
              if (err) {
                console.error('Dashboard ayarları kaydetme hatası:', err);
                return res.status(500).json({ error: 'Ayarlar kaydedilemedi' });
              }
              res.json({ 
                message: 'Dashboard ayarları kaydedildi',
                settings: settings
              });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error('Settings JSON hatası:', error);
    res.status(500).json({ error: 'Ayarlar işlenemedi' });
  }
});

// Dashboard ayarlarını sıfırla
router.post('/reset', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const defaultSettings = {
    unitOrder: ['ana-kasa', 'yarimamul', 'lazer-kesim', 'tezgah', 'cila', 'dokum', 'tedarik', 'satis', 'dis-kasa'],
    hiddenUnits: [],
    showFire: true,
    showHas: true,
    showLastUpdate: true
  };
  
  const settingsJson = JSON.stringify(defaultSettings);
  
  // Önce mevcut kaydı kontrol et
  db.get(
    'SELECT id FROM dashboard_settings WHERE user_id = ?',
    [req.user.id],
    (err, row) => {
      if (err) {
        console.error('Dashboard ayarları kontrol hatası:', err);
        return res.status(500).json({ error: 'Ayarlar kontrol edilemedi' });
      }
      
      if (row) {
        // Güncelle
        db.run(
          'UPDATE dashboard_settings SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [settingsJson, req.user.id],
          function(err) {
            if (err) {
              console.error('Dashboard ayarları sıfırlama hatası:', err);
              return res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
            }
            res.json({ 
              message: 'Dashboard ayarları sıfırlandı',
              settings: defaultSettings
            });
          }
        );
      } else {
        // Yeni kayıt oluştur
        db.run(
          'INSERT INTO dashboard_settings (user_id, settings) VALUES (?, ?)',
          [req.user.id, settingsJson],
          function(err) {
            if (err) {
              console.error('Dashboard ayarları sıfırlama hatası:', err);
              return res.status(500).json({ error: 'Ayarlar sıfırlanamadı' });
            }
            res.json({ 
              message: 'Dashboard ayarları sıfırlandı',
              settings: defaultSettings
            });
          }
        );
      }
    }
  );
});

module.exports = router;
