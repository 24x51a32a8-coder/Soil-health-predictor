const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian 10-digit mobile numbers

// ---------- REGISTER ----------
router.post('/register', async (req, res) => {
  try {
    const { fullName, phone, email, village, password, confirmPassword } = req.body;

    if (!fullName || !phone || !email || !village || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (fullName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter a valid full name.' });
    }
    if (!PHONE_RE.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone number.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (village.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter a valid village name.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const existing = await pool.query(
      'SELECT id FROM farmers WHERE phone = $1 OR email = $2',
      [phone, email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this phone or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO farmers (full_name, phone, email, village, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email`,
      [fullName.trim(), phone, email.toLowerCase(), village.trim(), passwordHash]
    );

    const farmer = result.rows[0];

    // Send welcome email (non-blocking failure - registration still succeeds)
    try {
      await sendWelcomeEmail(farmer.email, farmer.full_name);
    } catch (mailErr) {
      console.error('Welcome email failed to send:', mailErr.message);
    }

    res.status(201).json({ success: true, message: 'Registration successful! Please log in.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ---------- LOGIN ----------
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier = phone or email
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Phone/Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT * FROM farmers WHERE phone = $1 OR email = $2',
      [identifier, identifier.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'No account found with these details.' });
    }

    const farmer = result.rows[0];
    const match = await bcrypt.compare(password, farmer.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    const token = jwt.sign(
      { id: farmer.id, role: 'farmer', name: farmer.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      farmer: { id: farmer.id, fullName: farmer.full_name, email: farmer.email, phone: farmer.phone, village: farmer.village }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ---------- FORGOT PASSWORD ----------
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    const result = await pool.query('SELECT id, full_name FROM farmers WHERE email = $1', [email.toLowerCase()]);
    // Always respond success to avoid leaking which emails are registered
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    const farmer = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await pool.query(
      'UPDATE farmers SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [token, expiry, farmer.id]
    );

    const resetLink = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;
    try {
      await sendPasswordResetEmail(email.toLowerCase(), resetLink);
    } catch (mailErr) {
      console.error('Reset email failed to send:', mailErr.message);
    }

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- RESET PASSWORD ----------
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const result = await pool.query(
      'SELECT id FROM farmers WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE farmers SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [passwordHash, result.rows[0].id]
    );

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
