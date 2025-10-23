const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/postgresql');

// Cinsi ayarlarını getir
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM cinsi_settings ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Cinsi ayarları getirme hatası:', error);
    res.status(500).json({ error: 'Cinsi ayarları getirilemedi' });
  }
});

// Yeni cinsi ekle
router.post('/', async (req, res) => {
  try {
    const { value, label } = req.body;
    
    if (!value || !label) {
      return res.status(400).json({ error: 'Value ve label gerekli' });
    }

    const db = getDatabase();
    const result = await db.query(
      'INSERT INTO cinsi_settings (value, label) VALUES ($1, $2) RETURNING *',
      [value.toLowerCase().replace(/\s+/g, '-'), label.trim()]
    );

    global.logger.info(`Yeni cinsi eklendi: ${label} (${value})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    global.logger.error('Cinsi ekleme hatası:', error);
    res.status(500).json({ error: 'Cinsi eklenemedi' });
  }
});

// Cinsi güncelle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { value, label } = req.body;
    
    if (!value || !label) {
      return res.status(400).json({ error: 'Value ve label gerekli' });
    }

    await db.run(
      'UPDATE cinsi_settings SET value = ?, label = ? WHERE id = ?',
      [value.toLowerCase().replace(/\s+/g, '-'), label.trim(), id]
    );

    const updatedCinsi = await db.get(
      'SELECT * FROM cinsi_settings WHERE id = ?',
      [id]
    );

    if (!updatedCinsi) {
      return res.status(404).json({ error: 'Cinsi bulunamadı' });
    }

    global.logger.info(`Cinsi güncellendi: ${label} (${value})`);
    res.json(updatedCinsi);
  } catch (error) {
    global.logger.error('Cinsi güncelleme hatası:', error);
    res.status(500).json({ error: 'Cinsi güncellenemedi' });
  }
});

// Cinsi sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const cinsi = await db.get('SELECT * FROM cinsi_settings WHERE id = ?', [id]);
    if (!cinsi) {
      return res.status(404).json({ error: 'Cinsi bulunamadı' });
    }

    await db.run('DELETE FROM cinsi_settings WHERE id = ?', [id]);
    
    global.logger.info(`Cinsi silindi: ${cinsi.label} (${cinsi.value})`);
    res.json({ message: 'Cinsi başarıyla silindi' });
  } catch (error) {
    global.logger.error('Cinsi silme hatası:', error);
    res.status(500).json({ error: 'Cinsi silinemedi' });
  }
});

// Varsayılan ayarlara dön
router.post('/reset', async (req, res) => {
  try {
    // Mevcut cinsi'leri sil
    await db.run('DELETE FROM cinsi_settings');
    
    // Varsayılan cinsi'leri ekle
    const defaultCinsi = [
      { value: 'bilezik', label: 'Bilezik' },
      { value: 'kolye', label: 'Kolye' },
      { value: 'yuzuk', label: 'Yüzük' },
      { value: 'kupeler', label: 'Küpeler' },
      { value: 'saat', label: 'Saat' },
      { value: 'ham', label: 'Ham Altın' },
      { value: 'diger', label: 'Diğer' }
    ];

    for (const cinsi of defaultCinsi) {
      await db.run(
        'INSERT INTO cinsi_settings (value, label) VALUES (?, ?)',
        [cinsi.value, cinsi.label]
      );
    }

    global.logger.info('Cinsi ayarları varsayılan değerlere sıfırlandı');
    res.json({ message: 'Cinsi ayarları varsayılan değerlere sıfırlandı' });
  } catch (error) {
    global.logger.error('Cinsi sıfırlama hatası:', error);
    res.status(500).json({ error: 'Cinsi ayarları sıfırlanamadı' });
  }
});

module.exports = router;
