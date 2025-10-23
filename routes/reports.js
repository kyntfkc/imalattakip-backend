const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get reports data
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  // Get comprehensive report data
  const queries = {
    unitStats: `
      SELECT 
        from_unit as unit,
        SUM(amount) as total_out
      FROM transfers 
      GROUP BY from_unit
      UNION ALL
      SELECT 
        to_unit as unit,
        SUM(amount) as total_in
      FROM transfers 
      GROUP BY to_unit
    `,
    karatStats: `
      SELECT 
        karat,
        SUM(amount) as total_amount,
        COUNT(*) as transfer_count
      FROM transfers 
      GROUP BY karat
      ORDER BY karat
    `,
    recentTransfers: `
      SELECT t.*, u.username as user_name 
      FROM transfers t 
      LEFT JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC 
      LIMIT 50
    `,
    dailyStats: `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transfer_count,
        SUM(amount) as total_amount
      FROM transfers 
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
  };
  
  Promise.all(Object.entries(queries).map(([key, query]) => 
    new Promise((resolve, reject) => {
      db.all(query, [], (err, results) => {
        if (err) reject(err);
        else resolve([key, results]);
      });
    })
  )).then(results => {
    const reportData = {};
    results.forEach(([key, data]) => {
      reportData[key] = data;
    });
    
    res.json(reportData);
  }).catch(err => {
    global.logger.error('Rapor hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  });
});

module.exports = router;
