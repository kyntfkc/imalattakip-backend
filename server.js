const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
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
const menuSettingsRoutes = require('./routes/menuSettings');
const backupRoutes = require('./routes/backup');

// Import database
const { initDatabase, getDatabase, closeDatabase } = require('./database/postgresql');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - Railway ve diğer reverse proxy'ler için gerekli
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Cookie parser - HttpOnly cookies için
app.use(cookieParser());

// Rate limiting - Genel
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration - Güvenli ayarlar
const corsOptions = {
  origin: function (origin, callback) {
    // Development'ta veya origin belirtilmemişse izin ver
    if (process.env.NODE_ENV !== 'production' || !origin) {
      return callback(null, true);
    }
    
    // Production'da sadece belirtilen origin'lere izin ver
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : [];
    
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy tarafından izin verilmedi'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true, // Cookie gönderimi için
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Set-Cookie"],
};

app.use(cors(corsOptions));

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
app.use('/api/menu-settings', menuSettingsRoutes);
app.use('/api/backup', backupRoutes);

// Simple test endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'İmalat Takip Backend API',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    port: PORT,
    database: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
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

// 404 handler - Socket.io path'ini hariç tut (Socket.io HTTP server'a attach edildiği için gerekli değil ama yine de güvenli)
app.use('*', (req, res, next) => {
  // Socket.io path'ini atla - Socket.io HTTP server'a attach edildiği için bu middleware'e gelmemeli
  if (req.path.startsWith('/socket.io/')) {
    return next();
  }
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Import Socket.io
const { initializeSocket } = require('./socket');

// Initialize database and start server
async function startServer() {
  console.log('🚀 Server başlatılıyor...');
  console.log('📍 Port:', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('🗄️ Database URL:', process.env.DATABASE_URL ? 'Configured' : 'Not configured');
  
  try {
    // Create HTTP server explicitly for Socket.io compatibility
    const httpServer = http.createServer(app);
    
    // Initialize Socket.io BEFORE starting the server
    initializeSocket(httpServer);
    
    // Start server - Railway needs 0.0.0.0 binding
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Backend sunucusu ${PORT} portunda çalışıyor`);
      console.log(`📊 Health check: http://0.0.0.0:${PORT}/api/health`);
      console.log(`🌐 Test endpoint: http://0.0.0.0:${PORT}/`);
      console.log(`🔌 Socket.io: http://0.0.0.0:${PORT}/socket.io/`);
      logger.info(`🚀 Backend sunucusu ${PORT} portunda çalışıyor`);
    });
    
    const server = httpServer;
    
    // Server error handling
    server.on('error', (err) => {
      console.error('❌ Server error:', err);
      logger.error('Server error:', err);
    });
    
    // Initialize database in background - don't block server start
    setTimeout(async () => {
      try {
        console.log('🔄 Veritabanı başlatılıyor...');
        await initDatabase();
        console.log('✅ Veritabanı başarıyla başlatıldı');
        logger.info('Veritabanı başarıyla başlatıldı');
      } catch (dbError) {
        console.log('⚠️ Veritabanı başlatma hatası:', dbError.message);
        logger.error('Veritabanı başlatma hatası:', dbError);
        // Don't exit, let server run without DB
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Sunucu başlatılamadı:', error);
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
