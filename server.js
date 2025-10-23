const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');
const winston = require('winston');

// Import routes
const authRoutes = require('./routes/auth');
const transferRoutes = require('./routes/transfers');
const unitRoutes = require('./routes/units');
const reportRoutes = require('./routes/reports');
const externalVaultRoutes = require('./routes/externalVault');
const userRoutes = require('./routes/users');
const cinsiRoutes = require('./routes/cinsi');
const companiesRoutes = require('./routes/companies');
const logsRoutes = require('./routes/logs');
const dashboardSettingsRoutes = require('./routes/dashboardSettings');

// Import database
const { initDatabase, getDatabase, closeDatabase } = require('./database/postgresql');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'imalattakip-backend' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Make logger available globally
global.logger = logger;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/external-vault', externalVaultRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cinsi', cinsiRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/dashboard-settings', dashboardSettingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    database: process.env.DATABASE_URL ? 'Connected' : 'Not configured'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Sunucu hatası', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Bir hata oluştu'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Start server first
    app.listen(PORT, () => {
      logger.info(`🚀 Backend sunucusu ${PORT} portunda çalışıyor`);
      logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`\n🎯 İmalat Takip Backend Başlatıldı!`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📁 Dropbox Konumu: ${__dirname}`);
      console.log(`\n✨ Otomatik yedekleme aktif!`);
    });
    
    // Initialize database in background
    try {
      await initDatabase();
      logger.info('Veritabanı başarıyla başlatıldı');
    } catch (dbError) {
      logger.error('Veritabanı başlatma hatası:', dbError);
      // Don't exit, let server run without DB
    }
  } catch (error) {
    logger.error('Sunucu başlatılamadı:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM sinyali alındı, sunucu kapatılıyor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT sinyali alındı, sunucu kapatılıyor...');
  process.exit(0);
});

startServer();
