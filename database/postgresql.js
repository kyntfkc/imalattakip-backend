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
    
    // Check if cinsi column exists in transfers
    try {
      const checkCinsiResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transfers' 
        AND column_name = 'cinsi'
      `);
      
      if (checkCinsiResult.rows.length === 0) {
        console.log('🔄 cinsi kolonu ekleniyor...');
        await client.query(`
          ALTER TABLE transfers 
          ADD COLUMN cinsi VARCHAR(100) NULL
        `);
        console.log('✅ cinsi kolonu eklendi');
      } else {
        console.log('ℹ️ cinsi kolonu zaten mevcut');
      }
    } catch (error) {
      console.error('❌ cinsi migration hatası:', error.message);
      // Devam et
    }
    
    // Check if menu_settings table exists
    try {
      const checkMenuSettingsResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'menu_settings'
      `);
      
      if (checkMenuSettingsResult.rows.length === 0) {
        console.log('🔄 menu_settings tablosu oluşturuluyor...');
        await client.query(`
          CREATE TABLE menu_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            settings JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id)
          )
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_menu_settings_user_id ON menu_settings(user_id)
        `);
        console.log('✅ menu_settings tablosu oluşturuldu');
      } else {
        console.log('ℹ️ menu_settings tablosu zaten mevcut');
      }
    } catch (error) {
      console.error('❌ menu_settings migration hatası:', error.message);
      // Devam et
    }
    
    // Check if role_menu_defaults table exists
    try {
      const checkRoleDefaultsResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'role_menu_defaults'
      `);
      
      if (checkRoleDefaultsResult.rows.length === 0) {
        console.log('🔄 role_menu_defaults tablosu oluşturuluyor...');
        await client.query(`
          CREATE TABLE role_menu_defaults (
            id SERIAL PRIMARY KEY,
            role VARCHAR(20) UNIQUE NOT NULL,
            settings JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_role_menu_defaults_role ON role_menu_defaults(role)
        `);
        console.log('✅ role_menu_defaults tablosu oluşturuldu');
      } else {
        console.log('ℹ️ role_menu_defaults tablosu zaten mevcut');
      }
    } catch (error) {
      console.error('❌ role_menu_defaults migration hatası:', error.message);
      // Devam et
    }
    
    // Add ON DELETE CASCADE to existing foreign keys (migration)
    try {
      // Check and update dashboard_settings foreign key
      const checkDashboardFK = await client.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'dashboard_settings' 
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
      `);
      
      if (checkDashboardFK.rows.length > 0) {
        const fkName = checkDashboardFK.rows[0].constraint_name;
        // Drop and recreate with CASCADE
        try {
          await client.query(`ALTER TABLE dashboard_settings DROP CONSTRAINT IF EXISTS ${fkName}`);
          await client.query(`
            ALTER TABLE dashboard_settings 
            ADD CONSTRAINT dashboard_settings_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          `);
          console.log('✅ dashboard_settings foreign key güncellendi (ON DELETE CASCADE)');
        } catch (error) {
          // Foreign key might already have CASCADE, or error is expected
          console.log('ℹ️ dashboard_settings foreign key güncellemesi:', error.message);
        }
      } else {
        console.log('ℹ️ dashboard_settings foreign key bulunamadı (muhtemelen zaten CASCADE veya tablo yok)');
      }
    } catch (error) {
      console.error('❌ dashboard_settings foreign key migration hatası:', error.message);
    }
    
    try {
      // Check and update menu_settings foreign key
      const checkMenuFK = await client.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'menu_settings' 
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id'
      `);
      
      if (checkMenuFK.rows.length > 0) {
        const fkName = checkMenuFK.rows[0].constraint_name;
        // Drop and recreate with CASCADE
        try {
          await client.query(`ALTER TABLE menu_settings DROP CONSTRAINT IF EXISTS ${fkName}`);
          await client.query(`
            ALTER TABLE menu_settings 
            ADD CONSTRAINT menu_settings_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          `);
          console.log('✅ menu_settings foreign key güncellendi (ON DELETE CASCADE)');
        } catch (error) {
          // Foreign key might already have CASCADE, or error is expected
          console.log('ℹ️ menu_settings foreign key güncellemesi:', error.message);
        }
      } else {
        console.log('ℹ️ menu_settings foreign key bulunamadı (muhtemelen zaten CASCADE veya tablo yok)');
      }
    } catch (error) {
      console.error('❌ menu_settings foreign key migration hatası:', error.message);
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
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Menu settings (user-specific)
    `CREATE TABLE IF NOT EXISTS menu_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )`,
    
    // Role-based menu defaults (system-wide)
    `CREATE TABLE IF NOT EXISTS role_menu_defaults (
      id SERIAL PRIMARY KEY,
      role VARCHAR(20) UNIQUE NOT NULL,
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
    'CREATE INDEX IF NOT EXISTS idx_system_logs_username ON system_logs(username)',
    'CREATE INDEX IF NOT EXISTS idx_menu_settings_user_id ON menu_settings(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dashboard_settings_user_id ON dashboard_settings(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_role_menu_defaults_role ON role_menu_defaults(role)'
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
