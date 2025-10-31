// Socket.io setup for real-time synchronization
const { Server } = require('socket.io');

let io = null;

function initializeSocket(server) {
  const jwt = require('jsonwebtoken');
  
  io = new Server(server, {
    cors: {
      origin: "*", // Tüm origin'lere izin ver (Railway için)
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'], // WebSocket ve polling
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
    // path varsayılan olarak '/socket.io/' - belirtmeyebiliriz
  });
  
  console.log('🔌 Socket.io sunucusu başlatıldı');
  global.logger.info('Socket.io sunucusu başlatıldı');

  // Authentication middleware for Socket.io - Geçici olarak devre dışı (Railway test için)
  // Production'da tekrar açılabilir
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
                   socket.handshake.headers?.authorization?.split(' ')[1] ||
                   socket.handshake.query?.token;
      
      // Geçici olarak token zorunluluğunu kaldır (test için)
      if (!token) {
        console.warn('Socket bağlantısı token olmadan bağlanıyor (development mode)');
        socket.user = { id: 0, username: 'guest', role: 'user' };
        return next();
      }

      const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-jwt-key-2024-imalattakip';
      const decoded = jwt.verify(token, JWT_SECRET);
      
      socket.user = decoded;
      next();
    } catch (error) {
      console.warn('Socket auth hatası (devam ediliyor):', error.message);
      // Geçici olarak auth hatası durumunda da devam et (test için)
      socket.user = { id: 0, username: 'guest', role: 'user' };
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log('✅ Yeni kullanıcı bağlandı:', socket.id, socket.user?.username);
    global.logger.info(`Socket bağlantısı: ${socket.id} - ${socket.user?.username}`);
    
    // Railway test için bağlantı mesajı
    socket.emit('hello', 'Railway Socket.io çalışıyor!');

    socket.on('disconnect', () => {
      console.log('❌ Kullanıcı bağlantısı kesildi:', socket.id);
      global.logger.info(`Socket bağlantısı kesildi: ${socket.id}`);
    });

    // Test event
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  });

  // Make io available globally
  global.io = io;

  console.log('🔌 Socket.io başlatıldı');
  global.logger.info('Socket.io başlatıldı');

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io başlatılmadı. Önce initializeSocket() çağrılmalı.');
  }
  return io;
}

// Event emitters for real-time updates
function emitTransferCreated(transferData) {
  if (io) {
    io.emit('transfer:created', transferData);
    console.log('📡 Transfer oluşturuldu eventi gönderildi:', transferData.id);
  }
}

function emitTransferUpdated(transferData) {
  if (io) {
    io.emit('transfer:updated', transferData);
    console.log('📡 Transfer güncellendi eventi gönderildi:', transferData.id);
  }
}

function emitTransferDeleted(transferId) {
  if (io) {
    io.emit('transfer:deleted', { id: transferId });
    console.log('📡 Transfer silindi eventi gönderildi:', transferId);
  }
}

function emitCompanyCreated(companyData) {
  if (io) {
    io.emit('company:created', companyData);
    console.log('📡 Firma oluşturuldu eventi gönderildi:', companyData.id);
  }
}

function emitCompanyUpdated(companyData) {
  if (io) {
    io.emit('company:updated', companyData);
    console.log('📡 Firma güncellendi eventi gönderildi:', companyData.id);
  }
}

function emitCompanyDeleted(companyId) {
  if (io) {
    io.emit('company:deleted', { id: companyId });
    console.log('📡 Firma silindi eventi gönderildi:', companyId);
  }
}

function emitExternalVaultTransactionCreated(transactionData) {
  if (io) {
    io.emit('externalVault:transaction:created', transactionData);
    console.log('📡 Dış kasa işlemi oluşturuldu eventi gönderildi:', transactionData.id);
  }
}

function emitExternalVaultTransactionDeleted(transactionId) {
  if (io) {
    io.emit('externalVault:transaction:deleted', { id: transactionId });
    console.log('📡 Dış kasa işlemi silindi eventi gönderildi:', transactionId);
  }
}

function emitExternalVaultStockUpdated(stockData) {
  if (io) {
    io.emit('externalVault:stock:updated', stockData);
    console.log('📡 Dış kasa stoku güncellendi eventi gönderildi');
  }
}

function emitCinsiCreated(cinsiData) {
  if (io) {
    io.emit('cinsi:created', cinsiData);
    console.log('📡 Cinsi oluşturuldu eventi gönderildi:', cinsiData.id);
  }
}

function emitCinsiUpdated(cinsiData) {
  if (io) {
    io.emit('cinsi:updated', cinsiData);
    console.log('📡 Cinsi güncellendi eventi gönderildi:', cinsiData.id);
  }
}

function emitCinsiDeleted(cinsiId) {
  if (io) {
    io.emit('cinsi:deleted', { id: cinsiId });
    console.log('📡 Cinsi silindi eventi gönderildi:', cinsiId);
  }
}

module.exports = {
  initializeSocket,
  getIO,
  emitTransferCreated,
  emitTransferUpdated,
  emitTransferDeleted,
  emitCompanyCreated,
  emitCompanyUpdated,
  emitCompanyDeleted,
  emitExternalVaultTransactionCreated,
  emitExternalVaultTransactionDeleted,
  emitExternalVaultStockUpdated,
  emitCinsiCreated,
  emitCinsiUpdated,
  emitCinsiDeleted
};

