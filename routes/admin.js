const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const requireAdminAuth = require('../middleware/adminAuth');

const router = express.Router();

// ---------- ADMIN LOGIN ----------
// Credentials are read from environment variables (.env), never hardcoded here.
// Default values are set in .env.example: phone 8555992154 / password soil@123 / code FARM2026
router.post('/login', (req, res) => {
  const { phone, password, secretCode } = req.body;

  if (!phone || !password || !secretCode) {
    return res.status(400).json({ success: false, message: 'Phone, password and secret code are all required.' });
  }

  const validPhone = phone === process.env.ADMIN_PHONE;
  const validPassword = password === process.env.ADMIN_PASSWORD;
  const validCode = secretCode === process.env.ADMIN_SECRET_CODE;

  if (!validPhone || !validPassword || !validCode) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
  }

  const token = jwt.sign({ role: 'admin', phone }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

  res.json({ success: true, token });
});

// ---------- DASHBOARD STATS ----------
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const [farmers, predictions, reports, feedback] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM farmers'),
      pool.query('SELECT COUNT(*)::int AS count FROM predictions'),
      pool.query('SELECT COUNT(*)::int AS count FROM reports'),
      pool.query('SELECT COUNT(*)::int AS count FROM feedback')
    ]);

    const recentFarmers = await pool.query(
      'SELECT id, full_name, village, created_at FROM farmers ORDER BY created_at DESC LIMIT 5'
    );
    const avgScore = await pool.query('SELECT COALESCE(AVG(soil_health_score),0)::int AS avg FROM predictions');

    res.json({
      success: true,
      stats: {
        totalFarmers: farmers.rows[0].count,
        totalPredictions: predictions.rows[0].count,
        totalReports: reports.rows[0].count,
        totalFeedback: feedback.rows[0].count,
        avgSoilHealthScore: avgScore.rows[0].avg
      },
      recentFarmers: recentFarmers.rows
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching stats.' });
  }
});

// ---------- VIEW ALL FARMERS ----------
router.get('/farmers', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.full_name, f.phone, f.email, f.village, f.created_at,
              COUNT(p.id)::int AS prediction_count
       FROM farmers f
       LEFT JOIN predictions p ON p.farmer_id = f.id
       GROUP BY f.id ORDER BY f.created_at DESC`
    );
    res.json({ success: true, farmers: result.rows });
  } catch (err) {
    console.error('Fetch farmers error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching farmers.' });
  }
});

// ---------- DELETE A FARMER ----------
router.delete('/farmers/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM farmers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Farmer not found.' });
    }
    res.json({ success: true, message: 'Farmer deleted successfully.' });
  } catch (err) {
    console.error('Delete farmer error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting farmer.' });
  }
});

// ---------- VIEW REPORTS ----------
router.get('/reports', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.file_name, r.file_type, r.uploaded_at, f.full_name, f.village
       FROM reports r JOIN farmers f ON f.id = r.farmer_id
       ORDER BY r.uploaded_at DESC`
    );
    res.json({ success: true, reports: result.rows });
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching reports.' });
  }
});

// ---------- VIEW FEEDBACK ----------
router.get('/feedback', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json({ success: true, feedback: result.rows });
  } catch (err) {
    console.error('Fetch feedback error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching feedback.' });
  }
});

// ---------- PREDICTION HISTORY (all farmers) ----------
router.get('/predictions', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.village, p.soil_health_score, p.created_at, f.full_name
       FROM predictions p JOIN farmers f ON f.id = p.farmer_id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ success: true, predictions: result.rows });
  } catch (err) {
    console.error('Fetch predictions error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching predictions.' });
  }
});

// ---------- ANALYTICS (real aggregated data, no fake numbers) ----------
router.get('/analytics', requireAdminAuth, async (req, res) => {
  try {
    const statusRows = await pool.query('SELECT soil_status FROM predictions');
    const deficiency = {};
    for (const row of statusRows.rows) {
      const status = row.soil_status || {};
      for (const [nutrient, level] of Object.entries(status)) {
        if (level !== 'normal') {
          deficiency[nutrient] = (deficiency[nutrient] || 0) + 1;
        }
      }
    }

    const signupTrend = await pool.query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM farmers GROUP BY month ORDER BY month`
    );

    const scoreDistribution = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE soil_health_score >= 70)::int AS good,
         COUNT(*) FILTER (WHERE soil_health_score >= 40 AND soil_health_score < 70)::int AS moderate,
         COUNT(*) FILTER (WHERE soil_health_score < 40)::int AS poor
       FROM predictions`
    );

    res.json({
      success: true,
      nutrientDeficiency: deficiency,
      signupTrend: signupTrend.rows,
      scoreDistribution: scoreDistribution.rows[0]
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching analytics.' });
  }
});

module.exports = router;
