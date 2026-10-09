let currentPrediction = null;

async function loadResults() {
  requireFarmerLogin();
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { showToast('No prediction found.', 'error'); return; }

  const { ok, data } = await apiCall(`/predictions/${id}`);
  if (!ok) { showToast(data.message, 'error'); return; }

  const p = data.prediction;
  currentPrediction = p;
  renderScore(p.soil_health_score);
  renderNutrientChart(p.soil_data, p.soil_status);
  renderSolutions(p.solutions);

  document.getElementById('resultsLoading').classList.add('hidden');
  document.getElementById('resultsContent').classList.remove('hidden');

  const downloadBtn = document.getElementById('downloadReportBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadReportPDF);
}

function renderScore(score) {
  const circle = document.getElementById('scoreCircle');
  const text = document.getElementById('scoreText');
  const circumference = 2 * Math.PI * 70;
  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = circumference;
  let color = score >= 70 ? '#2e7d32' : score >= 40 ? '#f9a825' : '#e53935';
  circle.style.stroke = color;
  setTimeout(() => {
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }, 200);
  text.textContent = `${score}/100`;
}

function renderNutrientChart(soilData, soilStatus) {
  const ctx = document.getElementById('nutrientChart');
  if (!ctx) return;
  const labels = Object.keys(soilData);
  const values = labels.map(k => soilData[k]);
  const colors = labels.map(k => soilStatus[k] === 'normal' ? '#66bb6a' : soilStatus[k] === 'low' ? '#f9a825' : '#e53935');

  new Chart(ctx, {
    type: 'bar',
    data: { labels: labels.map(l => l.toUpperCase()), datasets: [{ label: 'Value', data: values, backgroundColor: colors, borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderSolutions(solutions) {
  const container = document.getElementById('solutionsContainer');
  if (!solutions || solutions.length === 0) {
    container.innerHTML = '<div class="alert alert-success">All nutrients are within the normal range. No corrective action needed right now.</div>';
    return;
  }
  container.innerHTML = solutions.map(s => `
    <div class="card card-farm mb-3 p-3">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <h5 class="mb-1">${s.label} <span class="badge ${s.level === 'low' ? 'badge-low' : 'badge-high'} rounded-pill ms-2">${s.level.toUpperCase()}</span></h5>
        <span class="badge badge-priority-${s.priority.toLowerCase()} rounded-pill">${s.priority} Priority</span>
      </div>
      <p class="text-muted mb-2">${s.reason}</p>
      <div class="row g-2 small">
        <div class="col-md-4"><strong>Fertilizer:</strong> ${s.fertilizer}</div>
        <div class="col-md-4"><strong>Quantity:</strong> ${s.quantity}</div>
        <div class="col-md-4"><strong>Expected Result:</strong> ${s.expected}</div>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadResults);

const NUTRIENT_LABELS_PDF = {
  ph: 'Soil pH', ec: 'Electrical Conductivity', oc: 'Organic Carbon',
  n: 'Nitrogen (N)', p: 'Phosphorus (P)', k: 'Potassium (K)',
  s: 'Sulphur (S)', zn: 'Zinc (Zn)', b: 'Boron (B)',
  fe: 'Iron (Fe)', mn: 'Manganese (Mn)', cu: 'Copper (Cu)'
};

function downloadReportPDF() {
  if (!currentPrediction || !window.jspdf) {
    showToast('Report is still loading, please try again in a moment.', 'error');
    return;
  }
  const p = currentPrediction;
  const farmer = getFarmerData();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(27, 77, 62);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Soil Health Predictor', 14, 15);
  doc.setFontSize(10);
  doc.text('Soil Analysis Report', 14, 23);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  let y = 42;
  doc.text(`Farmer: ${farmer?.fullName || '—'}`, 14, y);
  doc.text(`Village: ${p.village || '—'}`, 110, y);
  y += 7;
  doc.text(`Report date: ${new Date(p.created_at).toLocaleDateString()}`, 14, y);
  doc.text(`Land area: ${p.land_area ? p.land_area + ' acres' : '—'}`, 110, y);
  y += 10;

  doc.setFontSize(13);
  doc.setTextColor(27, 77, 62);
  doc.text(`Soil Health Score: ${p.soil_health_score} / 100`, 14, y);
  y += 8;

  const nutrientRows = Object.keys(p.soil_data).map(key => [
    NUTRIENT_LABELS_PDF[key] || key.toUpperCase(),
    p.soil_data[key],
    (p.soil_status[key] || '—').toUpperCase()
  ]);

  doc.autoTable({
    startY: y,
    head: [['Nutrient', 'Value', 'Status']],
    body: nutrientRows,
    theme: 'striped',
    headStyles: { fillColor: [46, 125, 50] },
    styles: { fontSize: 9 }
  });

  y = doc.lastAutoTable.finalY + 10;

  if (p.solutions && p.solutions.length > 0) {
    doc.setFontSize(13);
    doc.setTextColor(27, 77, 62);
    doc.text('Recommended Fertilizer Actions', 14, y);
    y += 4;

    const solutionRows = p.solutions.map(s => [
      s.label, s.level.toUpperCase(), s.fertilizer, s.quantity, s.priority
    ]);

    doc.autoTable({
      startY: y + 4,
      head: [['Nutrient', 'Status', 'Fertilizer', 'Quantity', 'Priority']],
      body: solutionRows,
      theme: 'striped',
      headStyles: { fillColor: [141, 110, 99] },
      styles: { fontSize: 8.5 }
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('All nutrients are within the normal range. No corrective action needed right now.', 14, y);
    y += 10;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Nutrient ranges follow standard Soil Health Card guidelines. Confirm with your local agriculture office for critical decisions.',
    14, 285
  );

  const fileName = `soil-health-report-${p.village ? p.village.replace(/\s+/g, '_') : p.id}.pdf`;
  doc.save(fileName);
}
