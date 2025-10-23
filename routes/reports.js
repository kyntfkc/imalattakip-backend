const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get reports data
router.get('/', authenticateToken, async (req, res) => {
  try {
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
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    };
    
    const results = await Promise.all(Object.entries(queries).map(async ([key, query]) => {
      const result = await db.query(query);
      return [key, result.rows];
    }));
    
    const reportData = {};
    results.forEach(([key, data]) => {
      reportData[key] = data;
    });
    
    global.logger.info('Rapor verileri başarıyla getirildi');
    res.json(reportData);
  } catch (error) {
    global.logger.error('Rapor hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
