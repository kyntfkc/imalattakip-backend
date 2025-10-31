// Socket.io setup for real-time synchronization
const { Server } = require('socket.io');

let io = null;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('✅ Yeni kullanıcı bağlandı:', socket.id);
    global.logger.info(`Socket bağlantısı: ${socket.id}`);

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

