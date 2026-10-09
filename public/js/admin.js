async function loadAdminDashboard() {
  requireAdminLogin();

  const { ok, data } = await adminApiCall('/admin/stats');
  if (!ok) { if (document.getElementById('adminMain')) showToast(data.message, 'error'); return; }

  animateCounter(document.getElementById('statTotalFarmers'), data.stats.totalFarmers);
  animateCounter(document.getElementById('statTotalPredictions'), data.stats.totalPredictions);
  animateCounter(document.getElementById('statTotalReports'), data.stats.totalReports);
  animateCounter(document.getElementById('statTotalFeedback'), data.stats.totalFeedback);
  document.getElementById('statAvgScore').textContent = data.stats.avgSoilHealthScore + '/100';

  const recentEl = document.getElementById('recentFarmersList');
  if (recentEl) {
    recentEl.innerHTML = data.recentFarmers.length ? data.recentFarmers.map(f => `
      <tr><td>${f.full_name}</td><td>${f.village}</td><td>${new Date(f.created_at).toLocaleDateString()}</td></tr>
    `).join('') : '<tr><td colspan="3" class="text-center text-muted">No farmers registered yet.</td></tr>';
  }
}

async function loadFarmersTable() {
  requireAdminLogin();
  const tbody = document.getElementById('farmersTableBody');
  if (!tbody) return;

  const { ok, data } = await adminApiCall('/admin/farmers');
  if (!ok) { tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${data.message}</td></tr>`; return; }

  if (data.farmers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No farmers registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data.farmers.map(f => `
    <tr>
      <td>${f.id}</td><td>${f.full_name}</td><td>${f.phone}</td><td>${f.email}</td>
      <td>${f.village}</td><td>${f.prediction_count}</td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="deleteFarmer(${f.id})"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

async function deleteFarmer(id) {
  if (!confirm('Delete this farmer and all their data? This cannot be undone.')) return;
  const { ok, data } = await adminApiCall(`/admin/farmers/${id}`, { method: 'DELETE' });
  showToast(data.message, ok ? 'success' : 'error');
  if (ok) loadFarmersTable();
}

async function loadReportsTable() {
  requireAdminLogin();
  const tbody = document.getElementById('reportsTableBody');
  if (!tbody) return;
  const { ok, data } = await adminApiCall('/admin/reports');
  if (!ok) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${data.message}</td></tr>`; return; }
  tbody.innerHTML = data.reports.length ? data.reports.map(r => `
    <tr><td>${r.file_name}</td><td>${r.full_name}</td><td>${r.village}</td><td>${new Date(r.uploaded_at).toLocaleDateString()}</td></tr>
  `).join('') : '<tr><td colspan="4" class="text-center text-muted">No reports uploaded yet.</td></tr>';
}

async function loadFeedbackTable() {
  requireAdminLogin();
  const tbody = document.getElementById('feedbackTableBody');
  if (!tbody) return;
  const { ok, data } = await adminApiCall('/admin/feedback');
  if (!ok) { tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${data.message}</td></tr>`; return; }
  tbody.innerHTML = data.feedback.length ? data.feedback.map(f => `
    <tr><td>${f.name || 'Farmer #' + f.farmer_id}</td><td>${f.message}</td><td>${new Date(f.created_at).toLocaleDateString()}</td></tr>
  `).join('') : '<tr><td colspan="3" class="text-center text-muted">No feedback yet.</td></tr>';
}

async function loadPredictionsHistoryTable() {
  requireAdminLogin();
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  const { ok, data } = await adminApiCall('/admin/predictions');
  if (!ok) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${data.message}</td></tr>`; return; }
  tbody.innerHTML = data.predictions.length ? data.predictions.map(p => `
    <tr>
      <td>${p.full_name}</td><td>${p.village || '—'}</td>
      <td><span class="badge ${p.soil_health_score >= 70 ? 'badge-normal' : p.soil_health_score >= 40 ? 'badge-low' : 'badge-high'} rounded-pill py-2 px-3">${p.soil_health_score}/100</span></td>
      <td>${new Date(p.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="text-center text-muted">No predictions yet.</td></tr>';
}

if (typeof Chart !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') {
  Chart.defaults.color = '#c8d6ce';
  Chart.defaults.borderColor = '#35513f';
}

async function loadAnalytics() {
  requireAdminLogin();
  if (!document.getElementById('deficiencyChart')) return;

  const { ok, data } = await adminApiCall('/admin/analytics');
  if (!ok) { showToast(data.message, 'error'); return; }

  const deficiencyLabels = Object.keys(data.nutrientDeficiency);
  const deficiencyValues = deficiencyLabels.map(k => data.nutrientDeficiency[k]);
  new Chart(document.getElementById('deficiencyChart'), {
    type: 'bar',
    data: {
      labels: deficiencyLabels.map(l => l.toUpperCase()),
      datasets: [{ label: 'Farmers affected', data: deficiencyValues, backgroundColor: '#e53935', borderRadius: 6 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  const trend = data.signupTrend;
  new Chart(document.getElementById('signupChart'), {
    type: 'line',
    data: {
      labels: trend.map(t => t.month),
      datasets: [{ label: 'New farmers', data: trend.map(t => t.count), borderColor: '#2e7d32', backgroundColor: 'rgba(46,125,50,0.15)', fill: true, tension: 0.3 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  const dist = data.scoreDistribution;
  new Chart(document.getElementById('scoreDistChart'), {
    type: 'bar',
    data: {
      labels: ['Good (70-100)', 'Moderate (40-69)', 'Poor (0-39)'],
      datasets: [{ data: [dist.good, dist.moderate, dist.poor], backgroundColor: ['#66bb6a', '#f9a825', '#e53935'], borderRadius: 6 }]
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdminDashboard();
  loadFarmersTable();
  loadPredictionsHistoryTable();
  loadReportsTable();
  loadFeedbackTable();
  loadAnalytics();
});
