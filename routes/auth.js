const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/postgresql');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'imalattakip-secret-key-2024';

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'normal_user' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Kullanıcı adı zaten mevcut' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await db.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
      [username, hashedPassword, role]
    );
    
    // Log the action
    await db.query(
      'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
      [username, 'Kullanıcı Kaydı', 'Yeni kullanıcı oluşturuldu']
    );
    
    global.logger.info(`Yeni kullanıcı kaydedildi: ${username}`);
    res.status(201).json({ 
      message: 'Kullanıcı başarıyla oluşturuldu',
      userId: result.rows[0].id 
    });
  } catch (error) {
    global.logger.error('Register hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    }
    
    const db = getDatabase();
    
    try {
      const result = await db.query(
        'SELECT id, username, password, role FROM users WHERE username = $1',
        [username]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
      }
      
      const user = result.rows[0];
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Log the action
      await db.query(
        'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
        [username, 'Giriş', 'Kullanıcı giriş yaptı']
      );
      
      global.logger.info(`Kullanıcı giriş yaptı: ${username}`);
      res.json({
        message: 'Giriş başarılı',
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (dbError) {
      global.logger.error('Database hatası:', dbError);
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  } catch (error) {
    global.logger.error('Login hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ 
      valid: true, 
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
});

// Get all users (admin only)
router.get('/users', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
    
    const db = getDatabase();
    const result = await db.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    
    global.logger.info(`Kullanıcı listesi getirildi: ${result.rows.length} kullanıcı`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Kullanıcı listesi hatası:', error);
    res.status(401).json({ error: 'Geçersiz token' });
  }
});

module.exports = router;
