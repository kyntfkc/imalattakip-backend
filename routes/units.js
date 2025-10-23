const express = require('express');
const { getDatabase } = require('../database/postgresql');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get unit statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get transfers grouped by unit
    const result = await db.query(
      `SELECT 
         from_unit as unit,
         SUM(amount) as total_out,
         COUNT(*) as transfer_count_out
       FROM transfers 
       GROUP BY from_unit
       UNION ALL
       SELECT 
         to_unit as unit,
         SUM(amount) as total_in,
         COUNT(*) as transfer_count_in
       FROM transfers 
       GROUP BY to_unit`
    );
    
    // Process results to calculate net amounts
    const unitStats = {};
    
    result.rows.forEach(row => {
      if (!unitStats[row.unit]) {
        unitStats[row.unit] = {
          unit: row.unit,
          totalIn: 0,
          totalOut: 0,
          netAmount: 0,
          transferCount: 0
        };
      }
      
      if (row.total_out) {
        unitStats[row.unit].totalOut = parseFloat(row.total_out);
        unitStats[row.unit].transferCount += parseInt(row.transfer_count_out);
      }
      if (row.total_in) {
        unitStats[row.unit].totalIn = parseFloat(row.total_in);
        unitStats[row.unit].transferCount += parseInt(row.transfer_count_in);
      }
    });
    
    // Calculate net amounts
    Object.values(unitStats).forEach(unit => {
      unit.netAmount = unit.totalIn - unit.totalOut;
    });
    
    global.logger.info(`Birim istatistikleri: ${Object.keys(unitStats).length} birim`);
    res.json(Object.values(unitStats));
  } catch (error) {
    global.logger.error('Birim istatistik hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get transfers by unit
router.get('/:unitId/transfers', authenticateToken, async (req, res) => {
  try {
    const { unitId } = req.params;
    const db = getDatabase();
    
    const result = await db.query(
      `SELECT t.*, u.username as user_name 
       FROM transfers t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE t.from_unit = $1 OR t.to_unit = $1
       ORDER BY t.created_at DESC`,
      [unitId]
    );
    
    global.logger.info(`Birim transfer listesi: ${result.rows.length} transfer (${unitId})`);
    res.json(result.rows);
  } catch (error) {
    global.logger.error('Birim transfer hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
