const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/postgresql');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'imalattakip-secret-key-2024';

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        global.logger.error('Kullanıcı kontrol hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      if (row) {
        return res.status(400).json({ error: 'Kullanıcı zaten mevcut' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insert user
      db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role],
        function(err) {
          if (err) {
            global.logger.error('Kullanıcı oluşturma hatası:', err);
            return res.status(500).json({ error: 'Kullanıcı oluşturulamadı' });
          }
          
          // Log the action
          db.run(
            'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
            [username, 'Kullanıcı Kaydı', 'Yeni kullanıcı oluşturuldu']
          );
          
          res.status(201).json({ 
            message: 'Kullanıcı başarıyla oluşturuldu',
            userId: this.lastID 
          });
        }
      );
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
    
    db.get(
      'SELECT id, username, password, role FROM users WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          global.logger.error('Login hatası:', err);
          return res.status(500).json({ error: 'Sunucu hatası' });
        }
        
        if (!user) {
          return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }
        
        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
          { 
            userId: user.id, 
            username: user.username, 
            role: user.role 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        // Log the action
        db.run(
          'INSERT INTO system_logs (user, action, details) VALUES (?, ?, ?)',
          [username, 'Giriş', 'Kullanıcı giriş yaptı']
        );
        
        res.json({
          message: 'Giriş başarılı',
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        });
      }
    );
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
router.get('/users', (req, res) => {
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
    
    db.all(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC',
      [],
      (err, users) => {
        if (err) {
          global.logger.error('Kullanıcı listesi hatası:', err);
          return res.status(500).json({ error: 'Sunucu hatası' });
        }
        
        res.json(users);
      }
    );
  } catch (error) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
});

module.exports = router;
