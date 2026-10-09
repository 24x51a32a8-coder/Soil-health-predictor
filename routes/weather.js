const express = require('express');
const router = express.Router();

// Uses Open-Meteo (https://open-meteo.com) - free, no API key needed.
// Returns real current weather for given coordinates.
router.get('/current', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation&daily=precipitation_sum&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather service unavailable');
    const data = await response.json();

    res.json({
      success: true,
      temperature: data.current?.temperature_2m ?? null,
      humidity: data.current?.relative_humidity_2m ?? null,
      rainfall: data.daily?.precipitation_sum?.[0] ?? data.current?.precipitation ?? 0
    });
  } catch (err) {
    console.error('Weather fetch error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch weather data right now.' });
  }
});

module.exports = router;
