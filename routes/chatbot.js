const express = require('express');
const pool = require('../config/db');
const requireFarmerAuth = require('../middleware/auth');

const router = express.Router();

const SYSTEM_CONTEXT = `You are AgriBot, the AI assistant for Soil Health Predictor, a soil-analysis
platform for Indian farmers. Answer clearly and simply, focusing on soil health, nutrient
deficiencies, fertilizers and irrigation. Keep answers concise
(under 150 words) unless the farmer asks for detail. If asked something outside agriculture, politely
redirect back to farming topics.`;

// Chat is available without login too (public floating widget), but logs are attributed if logged in.
router.post('/ask', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length < 1) {
      return res.status(400).json({ success: false, message: 'Please enter a message.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(503).json({
        success: false,
        message: 'AI chatbot is not configured yet. Add your GEMINI_API_KEY in the .env file to enable AgriBot (get a free key at https://aistudio.google.com/app/apikey).'
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_CONTEXT}\n\nFarmer's question: ${message}` }] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ success: false, message: 'AgriBot is temporarily unavailable. Please try again.' });
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response. Please try rephrasing your question.';

    // Log the conversation (best-effort; ignore if no auth)
    try {
      let farmerId = null;
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'farmer') farmerId = decoded.id;
      }
      await pool.query(
        'INSERT INTO chat_logs (farmer_id, question, answer) VALUES ($1, $2, $3)',
        [farmerId, message.trim(), answer]
      );
    } catch (logErr) {
      // Non-fatal; chat still works without logging
    }

    res.json({ success: true, answer });
  } catch (err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ success: false, message: 'Server error contacting AgriBot.' });
  }
});

module.exports = router;
