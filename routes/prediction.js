const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const requireFarmerAuth = require('../middleware/auth');
const { analyzeSoil } = require('../utils/soilLogic');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, PNG and JPG files are allowed.'));
  }
});

// ---------- SUBMIT PREDICTION (manual entry or after OCR autofill) ----------
router.post('/analyze', requireFarmerAuth, async (req, res) => {
  try {
    const {
      village, latitude, longitude, landArea, waterAvailability,
      temperature, humidity, rainfall, soilData, source
    } = req.body;

    if (!soilData || typeof soilData !== 'object') {
      return res.status(400).json({ success: false, message: 'Soil data is required.' });
    }

    const { status, solutions, score } = analyzeSoil(soilData);

    const result = await pool.query(
      `INSERT INTO predictions
        (farmer_id, source, village, latitude, longitude, land_area, water_availability,
         temperature, humidity, rainfall, soil_data, soil_status, soil_health_score, solutions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, created_at`,
      [
        req.farmer.id, source || 'manual', village || null,
        latitude || null, longitude || null, landArea || null, waterAvailability || null,
        temperature || null, humidity || null, rainfall || null,
        JSON.stringify(soilData), JSON.stringify(status), score,
        JSON.stringify(solutions)
      ]
    );

    res.status(201).json({
      success: true,
      predictionId: result.rows[0].id,
      soilStatus: status,
      soilHealthScore: score,
      solutions
    });
  } catch (err) {
    console.error('Prediction analyze error:', err);
    res.status(500).json({ success: false, message: 'Server error running prediction.' });
  }
});

// ---------- UPLOAD SOIL REPORT (file only; OCR text extraction happens client-side via Tesseract.js) ----------
router.post('/upload-report', requireFarmerAuth, upload.single('report'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const { extractedText } = req.body;

    const result = await pool.query(
      `INSERT INTO reports (farmer_id, file_name, file_type, extracted_text)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.farmer.id, req.file.originalname, req.file.mimetype, extractedText || null]
    );

    res.status(201).json({ success: true, reportId: result.rows[0].id, fileName: req.file.originalname });
  } catch (err) {
    console.error('Upload report error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error uploading report.' });
  }
});

// ---------- MY PREDICTION HISTORY ----------
router.get('/history', requireFarmerAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, source, village, soil_health_score, created_at
       FROM predictions WHERE farmer_id = $1 ORDER BY created_at DESC`,
      [req.farmer.id]
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching history.' });
  }
});

// ---------- GET ONE PREDICTION IN FULL ----------
router.get('/:id', requireFarmerAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM predictions WHERE id = $1 AND farmer_id = $2',
      [req.params.id, req.farmer.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Prediction not found.' });
    }
    res.json({ success: true, prediction: result.rows[0] });
  } catch (err) {
    console.error('Get prediction error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- SUBMIT FEEDBACK ----------
router.post('/feedback/submit', requireFarmerAuth, async (req, res) => {
  try {
    const { message, rating } = req.body;
    if (!message || message.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please enter feedback message.' });
    }
    await pool.query(
      'INSERT INTO feedback (farmer_id, message, rating) VALUES ($1, $2, $3)',
      [req.farmer.id, message.trim(), rating || null]
    );
    res.status(201).json({ success: true, message: 'Thank you for your feedback!' });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting feedback.' });
  }
});

module.exports = router;
