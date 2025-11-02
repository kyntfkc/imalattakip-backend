const jwt = require('jsonwebtoken');

// Auth middleware - Cookie veya Bearer token desteği
const authenticateToken = (req, res, next) => {
  // Önce cookie'den token'ı al, yoksa Bearer token'dan
  const token = req.cookies.authToken || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-jwt-key-2024-imalattakip';

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token süresi doldu' });
      }
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    req.user = user;
    next();
  });
};

module.exports = {
  authenticateToken
};
