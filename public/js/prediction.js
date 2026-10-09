// Mirrors server-side utils/soilLogic.js ranges for instant client-side feedback.
// "example" is just a placeholder shown greyed-out inside the box (not a real value).
const NUTRIENT_META = [
  { key: 'ph', label: 'Soil pH', unit: '', low: 6.5, high: 7.5, example: 6.8 },
  { key: 'ec', label: 'Electrical Conductivity', unit: 'dS/m', low: 0.8, high: 1.6, example: 1.1 },
  { key: 'oc', label: 'Organic Carbon', unit: '%', low: 0.5, high: 0.75, example: 0.6 },
  { key: 'n', label: 'Nitrogen (N)', unit: 'kg/ha', low: 280, high: 560, example: 320 },
  { key: 'p', label: 'Phosphorus (P)', unit: 'kg/ha', low: 10, high: 25, example: 18 },
  { key: 'k', label: 'Potassium (K)', unit: 'kg/ha', low: 110, high: 280, example: 180 },
  { key: 's', label: 'Sulphur (S)', unit: 'ppm', low: 10, high: 20, example: 15 },
  { key: 'zn', label: 'Zinc (Zn)', unit: 'ppm', low: 0.6, high: 1.2, example: 0.9 },
  { key: 'b', label: 'Boron (B)', unit: 'ppm', low: 0.5, high: 1.0, example: 0.7 },
  { key: 'fe', label: 'Iron (Fe)', unit: 'ppm', low: 4.5, high: 9.0, example: 6.5 },
  { key: 'mn', label: 'Manganese (Mn)', unit: 'ppm', low: 2.0, high: 5.0, example: 3.5 },
  { key: 'cu', label: 'Copper (Cu)', unit: 'ppm', low: 0.2, high: 0.5, example: 0.35 }
];
const CLIENT_RANGES = Object.fromEntries(NUTRIENT_META.map(n => [n.key, { low: n.low, high: n.high }]));

function buildNutrientRows() {
  const container = document.getElementById('nutrientRows');
  if (!container) return;
  container.innerHTML = `<div class="row g-3">` + NUTRIENT_META.map(n => `
    <div class="col-md-4 col-sm-6">
      <div class="param-box">
        <label class="param-label" for="nutrient_${n.key}">${n.label}${n.unit ? ` (${n.unit})` : ''}</label>
        <input type="number" step="0.01" class="form-control param-input nutrient-input"
               id="nutrient_${n.key}" data-key="${n.key}" placeholder="e.g. ${n.example}" required>
        <div class="param-hint">Normal: ${n.low}–${n.high}${n.unit ? ' ' + n.unit : ''}</div>
        <span class="nutrient-status" id="status_${n.key}">—</span>
      </div>
    </div>
  `).join('') + `</div>`;

  container.querySelectorAll('.nutrient-input').forEach(input => {
    input.addEventListener('input', () => {
      updateNutrientStatus(input);
      togglePredictButton();
    });
  });
}

function updateNutrientStatus(input) {
  const key = input.getAttribute('data-key');
  const statusEl = document.getElementById(`status_${key}`);
  const val = parseFloat(input.value);
  if (isNaN(val)) { statusEl.textContent = '—'; statusEl.className = 'nutrient-status'; return; }
  const r = CLIENT_RANGES[key];
  let level, icon, cls;
  if (val < r.low) { level = 'Low'; icon = '🟡'; cls = 'badge-low'; }
  else if (val > r.high) { level = 'High'; icon = '🔴'; cls = 'badge-high'; }
  else { level = 'Normal'; icon = '🟢'; cls = 'badge-normal'; }
  statusEl.innerHTML = `${icon} ${level}`;
  statusEl.className = `nutrient-status badge ${cls} rounded-pill py-2 mt-2`;
}

function togglePredictButton() {
  const btn = document.getElementById('predictBtn');
  if (!btn) return;
  const requiredFields = document.querySelectorAll('#predictionForm [required]');
  let allFilled = true;
  requiredFields.forEach(f => { if (!f.value || (f.classList.contains('is-invalid-farm'))) allFilled = false; });
  btn.disabled = !allFilled;
}

// ---------- Geolocation ----------
function initGeolocation() {
  const villageInput = document.getElementById('villageInput');
  const latInput = document.getElementById('latInput');
  const lonInput = document.getElementById('lonInput');
  const locStatus = document.getElementById('locationStatus');
  if (!navigator.geolocation) { locStatus.textContent = 'Geolocation not supported by your browser.'; return; }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    latInput.value = latitude.toFixed(6);
    lonInput.value = longitude.toFixed(6);
    locStatus.textContent = `Location detected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

    // Reverse geocode via OpenStreetMap Nominatim (free, no key)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      const village = data.address?.village || data.address?.town || data.address?.suburb || data.address?.county || '';
      if (village && !villageInput.value) villageInput.value = village;
    } catch (e) { /* non-fatal */ }

    fetchWeather(latitude, longitude);
  }, () => {
    locStatus.textContent = 'Location access denied. Please enter your village manually.';
  });
}

async function fetchWeather(lat, lon) {
  const tempInput = document.getElementById('tempInput');
  const humidityInput = document.getElementById('humidityInput');
  const rainfallInput = document.getElementById('rainfallInput');
  const weatherStatus = document.getElementById('weatherStatus');
  weatherStatus.textContent = 'Fetching live weather...';
  try {
    const res = await fetch(`${API_BASE}/weather/current?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (data.success) {
      tempInput.value = data.temperature ?? '';
      humidityInput.value = data.humidity ?? '';
      rainfallInput.value = data.rainfall ?? '';
      weatherStatus.textContent = `${data.temperature}°C, ${data.humidity}% humidity, ${data.rainfall}mm rainfall`;
    } else {
      weatherStatus.textContent = 'Weather unavailable. You can enter it manually.';
    }
  } catch (e) {
    weatherStatus.textContent = 'Weather unavailable. You can enter it manually.';
  }
}

// ---------- Submit prediction ----------
function initPredictionForm() {
  const form = document.getElementById('predictionForm');
  if (!form) return;
  requireFarmerLogin();
  buildNutrientRows();
  initGeolocation();

  document.querySelectorAll('#predictionForm input, #predictionForm select').forEach(el => {
    el.addEventListener('input', togglePredictButton);
    el.addEventListener('change', togglePredictButton);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const soilData = {};
    NUTRIENT_META.forEach(n => {
      const val = document.getElementById(`nutrient_${n.key}`).value;
      if (val) soilData[n.key] = parseFloat(val);
    });

    const payload = {
      village: document.getElementById('villageInput').value.trim(),
      latitude: document.getElementById('latInput').value || null,
      longitude: document.getElementById('lonInput').value || null,
      landArea: document.getElementById('landAreaInput').value || null,
      temperature: document.getElementById('tempInput').value || null,
      humidity: document.getElementById('humidityInput').value || null,
      rainfall: document.getElementById('rainfallInput').value || null,
      soilData,
      source: window.entrySource || 'manual'
    };

    const btn = document.getElementById('predictBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Analyzing...';

    const { ok, data } = await apiCall('/predictions/analyze', { method: 'POST', body: JSON.stringify(payload) });

    if (ok) {
      window.location.href = `/results.html?id=${data.predictionId}`;
    } else {
      showToast(data.message, 'error');
      btn.disabled = false;
      btn.textContent = t('predict_btn') || 'Predict Now';
    }
  });
}

document.addEventListener('DOMContentLoaded', initPredictionForm);
