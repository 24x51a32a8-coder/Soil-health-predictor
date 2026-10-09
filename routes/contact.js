const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Public contact form on the home page (no login required)
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message || message.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields.' });
    }
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    await pool.query(
      'INSERT INTO feedback (name, email, message) VALUES ($1, $2, $3)',
      [name.trim(), email.toLowerCase(), message.trim()]
    );
    res.status(201).json({ success: true, message: 'Thanks for reaching out! We will get back to you soon.' });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting your message.' });
  }
});

module.exports = router;
