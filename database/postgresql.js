const { Pool } = require('pg');
const path = require('path');

// PostgreSQL connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL veritabanına bağlandı');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL bağlantı hatası:', err);
});

// Initialize database tables
async function initDatabase() {
  try {
    console.log('🔄 PostgreSQL veritabanı tabloları oluşturuluyor...');
    
    const client = await pool.connect();
    
    try {
      // Create tables
      await createTables(client);
      console.log('✅ PostgreSQL veritabanı tabloları oluşturuldu');
      
      // Add company_id column if it doesn't exist (migration)
      await migrateDatabase(client);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Veritabanı başlatma hatası:', error);
    throw error;
  }
}

async function migrateDatabase(client) {
  try {
    console.log('🔄 Migration başlatılıyor...');
    
    // Check if company_id column exists in external_vault_transactions
    try {
      const checkCompanyIdResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'external_vault_transactions' 
        AND column_name = 'company_id'
      `);
      
      if (checkCompanyIdResult.rows.length === 0) {
        console.log('🔄 company_id kolonu ekleniyor...');
        await client.query(`
          ALTER TABLE external_vault_transactions 
          ADD COLUMN company_id INTEGER REFERENCES companies(id)
        `);
        console.log('✅ company_id kolonu eklendi');
      } else {
        console.log('ℹ️ company_id kolonu zaten mevcut');
      }
    } catch (error) {
      console.error('❌ company_id migration hatası:', error.message);
      // Devam et
    }
    
    // Check if entity_type column exists in system_logs
    try {
      const checkEntityTypeResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'system_logs' 
        AND column_name = 'entity_type'
      `);
      
      if (checkEntityTypeResult.rows.length === 0) {
        console.log('🔄 entity_type kolonu ekleniyor...');
        await client.query(`
          ALTER TABLE system_logs 
          ADD COLUMN entity_type VARCHAR(100) DEFAULT ''
        `);
        console.log('✅ entity_type kolonu eklendi');
      } else {
        console.log('ℹ️ entity_type kolonu zaten mevcut');
      }
    } catch (error) {
      console.error('❌ entity_type migration hatası:', error.message);
      // Devam et
    }
    
    // Check if entity_name column exists in system_logs
    try {
      const checkEntityNameResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'system_logs' 
        AND column_name = 'entity_name'
      `);
      
      if (checkEntityNameResult.rows.length === 0) {
        console.log('🔄 entity_name kolonu ekleniyor...');
        await client.query(`
          ALTER TABLE system_logs 
          ADD COLUMN entity_name VARCHAR(255) DEFAULT ''
        `);
        console.log('✅ entity_name kolonu eklendi');
      } else {
        console.log('ℹ️ entity_name kolonu zaten mevcut');
      }
    } catch (error) {
      console.error('❌ entity_name migration hatası:', error.message);
      // Devam et
    }
    
    console.log('✅ Migration tamamlandı');
  } catch (error) {
    console.error('❌ Migration genel hatası:', error.message);
    console.error('❌ Migration stack:', error.stack);
    // Migration hataları kritik değil, devam et
  }
}

async function createTables(client) {
  const tables = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'normal_user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Transfers table
    `CREATE TABLE IF NOT EXISTS transfers (
      id SERIAL PRIMARY KEY,
      from_unit VARCHAR(50) NOT NULL,
      to_unit VARCHAR(50) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      karat INTEGER NOT NULL,
      cinsi VARCHAR(100),
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // External vault transactions
    `CREATE TABLE IF NOT EXISTS external_vault_transactions (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
      amount DECIMAL(10,2) NOT NULL,
      karat INTEGER NOT NULL,
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      company_id INTEGER REFERENCES companies(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // External vault stock
    `CREATE TABLE IF NOT EXISTS external_vault_stock (
      id SERIAL PRIMARY KEY,
      karat INTEGER UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Companies table
    `CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('company', 'person')),
      contact VARCHAR(255),
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Company settings
    `CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Cinsi settings
    `CREATE TABLE IF NOT EXISTS cinsi_settings (
      id SERIAL PRIMARY KEY,
      value VARCHAR(100) UNIQUE NOT NULL,
      label VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Dashboard settings
    `CREATE TABLE IF NOT EXISTS dashboard_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      settings JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // System logs
    `CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100),
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(100) DEFAULT '',
      entity_name VARCHAR(255) DEFAULT '',
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    await client.query(sql);
  }
  
  // Create indexes for better performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_transfers_from_unit ON transfers(from_unit)',
    'CREATE INDEX IF NOT EXISTS idx_transfers_to_unit ON transfers(to_unit)',
    'CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_external_vault_transactions_type ON external_vault_transactions(type)',
    'CREATE INDEX IF NOT EXISTS idx_external_vault_transactions_karat ON external_vault_transactions(karat)',
    'CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_system_logs_username ON system_logs(username)'
  ];
  
  for (const sql of indexes) {
    await client.query(sql);
  }
  
  // Create default admin user
  await createDefaultUser(client);
}

// Create default admin user
async function createDefaultUser(client) {
  try {
    const bcrypt = require('bcryptjs');
    
    // Check if admin user already exists
    const result = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (result.rows.length === 0) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await client.query(
        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
        ['admin', hashedPassword, 'admin']
      );
      
      console.log('✅ Varsayılan admin kullanıcısı oluşturuldu (admin/admin123)');
    } else {
      console.log('ℹ️ Admin kullanıcısı zaten mevcut');
    }
  } catch (error) {
    console.error('❌ Varsayılan kullanıcı oluşturma hatası:', error);
  }
}

// Get database connection
function getDatabase() {
  return pool;
}

// Close database connection
async function closeDatabase() {
  try {
    await pool.end();
    console.log('✅ PostgreSQL bağlantısı kapatıldı');
  } catch (error) {
    console.error('❌ PostgreSQL kapatma hatası:', error);
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  pool
};
