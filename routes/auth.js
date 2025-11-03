const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/postgresql');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'imalattakip-secret-key-2024';

// Login için özel rate limiting - Brute force koruması
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // 5 deneme
  message: {
    error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Başarılı girişlerde sayacı sıfırla
});

// Password validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return { valid: false, message: 'Şifre en az 8 karakter olmalı' };
  }
  if (!hasUpperCase) {
    return { valid: false, message: 'Şifre en az bir büyük harf içermeli' };
  }
  if (!hasLowerCase) {
    return { valid: false, message: 'Şifre en az bir küçük harf içermeli' };
  }
  if (!hasNumbers) {
    return { valid: false, message: 'Şifre en az bir rakam içermeli' };
  }
  if (!hasSpecialChar) {
    return { valid: false, message: 'Şifre en az bir özel karakter içermeli' };
  }

  return { valid: true };
};

// Register endpoint - Input validation ile
router.post('/register', [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Kullanıcı adı 3-50 karakter arası olmalı')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir')
    .escape(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Şifre en az 8 karakter olmalı'),
  body('role')
    .optional()
    .isIn(['normal_user', 'user', 'admin'])
    .withMessage('Geçersiz rol')
], async (req, res) => {
  try {
    // Validation hatalarını kontrol et
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validasyon hatası',
        errors: errors.array() 
      });
    }

    const { username, password, role: rawRole = 'normal_user' } = req.body;
    
    // 'user' değerini 'normal_user' olarak normalize et
    const role = rawRole === 'user' ? 'normal_user' : rawRole;
    
    // Password policy kontrolü
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }
    
    const db = getDatabase();
    
    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Kullanıcı adı zaten mevcut' });
    }
    
    // Hash password - bcrypt salt rounds
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert user - Parameterized query (SQL injection koruması)
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
    res.status(500).json({ 
      error: process.env.NODE_ENV === 'production' 
        ? 'Sunucu hatası' 
        : error.message 
    });
  }
});

// Login endpoint - Rate limiting ve input validation ile
router.post('/login', loginLimiter, [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Kullanıcı adı 3-50 karakter arası olmalı')
    .escape(),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Şifre gerekli')
], async (req, res) => {
  try {
    // Validation hatalarını kontrol et
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validasyon hatası',
        errors: errors.array() 
      });
    }

    const { username, password } = req.body;
    
    const db = getDatabase();
    
    try {
      // Parameterized query - SQL injection koruması
      const result = await db.query(
        'SELECT id, username, password, role FROM users WHERE username = $1',
        [username]
      );
      
      if (result.rows.length === 0) {
        // Güvenlik: Aynı hata mesajı (timing attack koruması)
        await new Promise(resolve => setTimeout(resolve, 100)); // Timing attack koruması
        return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
      }
      
      const user = result.rows[0];
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        // Güvenlik: Aynı hata mesajı (timing attack koruması)
        await new Promise(resolve => setTimeout(resolve, 100)); // Timing attack koruması
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
      
      // HttpOnly cookie olarak token'ı gönder (XSS koruması)
      const cookieOptions = {
        httpOnly: true, // XSS koruması
        secure: process.env.NODE_ENV === 'production', // HTTPS zorunlu (production)
        sameSite: 'strict', // CSRF koruması
        maxAge: 24 * 60 * 60 * 1000, // 24 saat
        path: '/'
      };
      
      res.cookie('authToken', token, cookieOptions);
      
      // Log the action
      await db.query(
        'INSERT INTO system_logs (username, action, details) VALUES ($1, $2, $3)',
        [username, 'Giriş', 'Kullanıcı giriş yaptı']
      );
      
      global.logger.info(`Kullanıcı giriş yaptı: ${username}`);
<<<<<<< HEAD
      // Rol normalleştirme: 'normal_user' -> 'user'
      const normalizedRole = user.role === 'normal_user' ? 'user' : user.role;
      
=======
      
      // Token'ı hem cookie hem de response body'de gönder (geriye uyumluluk için)
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
      res.json({
        message: 'Giriş başarılı',
        token, // Geriye uyumluluk için
        user: {
          id: user.id,
          username: user.username,
          role: normalizedRole
        }
      });
    } catch (dbError) {
      global.logger.error('Database hatası:', dbError);
      res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
          ? 'Sunucu hatası' 
          : dbError.message 
      });
    }
  } catch (error) {
    global.logger.error('Login hatası:', error);
    res.status(500).json({ 
      error: process.env.NODE_ENV === 'production' 
        ? 'Sunucu hatası' 
        : error.message 
    });
  }
});

// Verify token endpoint - Cookie veya Bearer token desteği
router.get('/verify', (req, res) => {
  // Önce cookie'den token'ı al, yoksa Bearer token'dan
  const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Rol normalleştirme: 'normal_user' -> 'user'
    const normalizedRole = decoded.role === 'normal_user' ? 'user' : decoded.role;
    
    res.json({ 
      valid: true, 
      user: {
<<<<<<< HEAD
        id: decoded.id,
=======
        id: decoded.id || decoded.userId,
>>>>>>> f0fdb47052067edd8932ac8ba845f663bb06da37
        username: decoded.username,
        role: normalizedRole
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token süresi doldu' });
    }
    res.status(401).json({ error: 'Geçersiz token' });
  }
});

// Logout endpoint - Cookie'yi temizle
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ message: 'Çıkış yapıldı' });
});

// Get all users (admin only)
router.get('/users', async (req, res) => {
  const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '');
  
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
