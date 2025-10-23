const express = require('express');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'imalattakip-secret-key-2024';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// Get unit statistics
router.get('/stats', verifyToken, (req, res) => {
  const db = getDatabase();
  
  // Get transfers grouped by unit
  db.all(
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
     GROUP BY to_unit`,
    [],
    (err, results) => {
      if (err) {
        global.logger.error('Birim istatistik hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      // Process results to calculate net amounts
      const unitStats = {};
      
      results.forEach(row => {
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
          unitStats[row.unit].totalOut = row.total_out;
          unitStats[row.unit].transferCount += row.transfer_count_out;
        }
        if (row.total_in) {
          unitStats[row.unit].totalIn = row.total_in;
          unitStats[row.unit].transferCount += row.transfer_count_in;
        }
      });
      
      // Calculate net amounts
      Object.values(unitStats).forEach(unit => {
        unit.netAmount = unit.totalIn - unit.totalOut;
      });
      
      res.json(Object.values(unitStats));
    }
  );
});

// Get transfers by unit
router.get('/:unitId/transfers', verifyToken, (req, res) => {
  const { unitId } = req.params;
  const db = getDatabase();
  
  db.all(
    `SELECT t.*, u.username as user_name 
     FROM transfers t 
     LEFT JOIN users u ON t.user_id = u.id 
     WHERE t.from_unit = ? OR t.to_unit = ?
     ORDER BY t.created_at DESC`,
    [unitId, unitId],
    (err, transfers) => {
      if (err) {
        global.logger.error('Birim transfer hatası:', err);
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json(transfers);
    }
  );
});

module.exports = router;
