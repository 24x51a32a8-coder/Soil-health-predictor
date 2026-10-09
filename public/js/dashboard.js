async function loadDashboard() {
  requireFarmerLogin();
  const farmer = getFarmerData();
  if (!farmer) return;

  const nameEl = document.getElementById('farmerName');
  if (nameEl) nameEl.textContent = farmer.fullName;

  const { ok, data } = await apiCall('/predictions/history');
  const listEl = document.getElementById('historyList');
  const countEl = document.getElementById('historyCount');
  const avgEl = document.getElementById('avgScore');

  if (!ok) { listEl.innerHTML = '<p class="text-muted">Could not load history.</p>'; return; }

  const history = data.history;
  animateCounter(countEl, history.length);
  const avg = history.length ? Math.round(history.reduce((a, h) => a + h.soil_health_score, 0) / history.length) : 0;
  animateCounter(avgEl, avg);

  if (history.length === 0) {
    listEl.innerHTML = `<div class="text-center py-5">
      <i class="fa-solid fa-seedling fa-3x text-muted mb-3"></i>
      <p class="text-muted">No predictions yet. Start your first soil analysis!</p>
      <a href="/new-prediction.html" class="btn btn-farm">New Prediction</a>
    </div>`;
    return;
  }

  renderTrendChart(history);

  listEl.innerHTML = history.map(h => `
    <a href="/results.html?id=${h.id}" class="card card-farm mb-2 p-3 text-decoration-none text-dark d-flex flex-row justify-content-between align-items-center">
      <div>
        <strong>${h.village || 'Unknown location'}</strong>
        <div class="text-muted small">${new Date(h.created_at).toLocaleDateString()} · ${h.source === 'ocr' ? 'OCR Upload' : 'Manual Entry'}</div>
      </div>
      <span class="badge ${h.soil_health_score >= 70 ? 'badge-normal' : h.soil_health_score >= 40 ? 'badge-low' : 'badge-high'} rounded-pill py-2 px-3">
        ${h.soil_health_score}/100
      </span>
    </a>
  `).join('');
}

function renderTrendChart(history) {
  const canvas = document.getElementById('trendChart');
  const wrapper = document.getElementById('trendChartWrapper');
  if (!canvas || history.length < 2) return;
  wrapper.classList.remove('hidden');

  if (typeof Chart !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') {
    Chart.defaults.color = '#c8d6ce';
    Chart.defaults.borderColor = '#35513f';
  }

  const chronological = [...history].reverse();
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: chronological.map(h => new Date(h.created_at).toLocaleDateString()),
      datasets: [{
        label: 'Soil Health Score',
        data: chronological.map(h => h.soil_health_score),
        borderColor: '#2e7d32',
        backgroundColor: 'rgba(46,125,50,0.15)',
        fill: true, tension: 0.3
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
  });
}

document.addEventListener('DOMContentLoaded', loadDashboard);
