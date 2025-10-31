const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../database/postgresql');

const execAsync = promisify(exec);

router.get('/database', authenticateToken, async (req, res) => {
  try {
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL bulunamadı' });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `imalattakip-db-backup-${timestamp}.sql`;

    // pg_dump kullanarak SQL dump oluştur
    // Railway'da pg_dump genellikle yüklüdür
    const pgDumpCommand = `pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges --format=plain`;

    try {
      const { stdout, stderr } = await execAsync(pgDumpCommand);

      if (stderr && !stderr.includes('WARNING') && !stderr.includes('NOTICE')) {
        console.error('pg_dump stderr:', stderr);
      }

      // SQL dump'ı gönder
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(stdout);
      return;

    } catch (pgDumpError) {
      console.warn('pg_dump başarısız, alternatif yöntem kullanılıyor:', pgDumpError.message);
      // pg_dump başarısız olursa, alternatif yöntem kullan
    }

    // Alternatif: Node.js ile manuel SQL oluştur
    const pool = getDatabase();
    const backupSQL = await generateBackupSQL(pool);
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(backupSQL);

  } catch (error) {
    console.error('Database backup error:', error);
    res.status(500).json({ 
      error: 'Veritabanı yedekleme sırasında hata oluştu',
      details: error.message 
    });
  }
});

// Alternatif: pg_dump yoksa Node.js ile SQL oluştur
async function generateBackupSQL(pool) {
  const client = await pool.connect();
  let sql = `-- PostgreSQL Database Backup
-- Generated: ${new Date().toISOString()}
-- Database Backup

BEGIN;

`;

  try {
    // Tüm tabloları al
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    const tables = tablesResult.rows.map(row => row.tablename);

    if (tables.length === 0) {
      sql += '-- No tables found\n';
      return sql;
    }

    // Her tablo için veri export et
    for (const table of tables) {
      sql += `\n-- Table: ${table}\n`;
      
      // Tablo yapısını al
      const tableDefResult = await client.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, [table]);

      // DROP ve CREATE TABLE
      sql += `DROP TABLE IF EXISTS ${table} CASCADE;\nCREATE TABLE ${table} (\n`;
      
      const columns = tableDefResult.rows.map((col, idx) => {
        let colDef = `  ${col.column_name} ${col.data_type.toUpperCase()}`;
        if (col.character_maximum_length) {
          colDef += `(${col.character_maximum_length})`;
        }
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        return colDef;
      }).join(',\n');

      sql += columns + '\n);\n';

      // Verileri al
      const dataResult = await client.query(`SELECT * FROM ${table} ORDER BY id;`);
      
      if (dataResult.rows.length > 0) {
        sql += `\n-- Data for table ${table} (${dataResult.rows.length} rows)\n`;
        
        for (const row of dataResult.rows) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          }).join(', ');
          
          sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
        }
      }
    }

    sql += '\nCOMMIT;\n';
    return sql;

  } finally {
    client.release();
  }
}

module.exports = router;

