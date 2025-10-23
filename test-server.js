// Minimal test server for Railway debugging
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Test server başlatılıyor...');
console.log('📍 Port:', PORT);
console.log('🌍 Environment:', process.env.NODE_ENV);

// Simple test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Test Server OK',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server ${PORT} portunda çalışıyor`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/api/health`);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
