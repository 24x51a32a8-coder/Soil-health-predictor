// ============================================
// OCR: reads uploaded soil report image (PNG/JPG) using Tesseract.js
// and parses nutrient values via pattern matching, then autofills
// the manual-entry form fields.
// PDFs are accepted for upload/storage but text extraction here
// works on image files; for PDF, we ask the farmer to also confirm
// values manually since client-side PDF-to-text needs an extra library.
// ============================================

const NUTRIENT_PATTERNS = {
  ph: /p\s*h[\s:]*([\d.]+)/i,
  ec: /e\.?c\.?[\s:]*([\d.]+)/i,
  oc: /(?:organic\s*carbon|o\.?c\.?)[\s:]*([\d.]+)/i,
  n: /nitrogen[\s:(nN)]*([\d.]+)/i,
  p: /phosphorus[\s:(pP)]*([\d.]+)/i,
  k: /potassium[\s:(kK)]*([\d.]+)/i,
  s: /sulphur[\s:(sS)]*([\d.]+)/i,
  zn: /zinc[\s:(znZn)]*([\d.]+)/i,
  b: /boron[\s:(bB)]*([\d.]+)/i,
  fe: /iron[\s:(feFe)]*([\d.]+)/i,
  mn: /manganese[\s:(mnMn)]*([\d.]+)/i,
  cu: /copper[\s:(cuCu)]*([\d.]+)/i
};

async function runOCR(file, onProgress) {
  if (!window.Tesseract) {
    throw new Error('OCR engine failed to load. Check your internet connection.');
  }
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: (m) => { if (onProgress && m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); }
  });
  return data.text;
}

function parseNutrientsFromText(text) {
  const results = {};
  for (const [key, regex] of Object.entries(NUTRIENT_PATTERNS)) {
    const match = text.match(regex);
    if (match && match[1]) results[key] = parseFloat(match[1]);
  }
  return results;
}

async function uploadReportFile(file, extractedText) {
  try {
    const formData = new FormData();
    formData.append('report', file);
    if (extractedText) formData.append('extractedText', extractedText);
    const { ok, data } = await apiCall('/predictions/upload-report', { method: 'POST', body: formData });
    if (!ok) console.error('Report upload failed:', data.message);
  } catch (err) {
    console.error('Report upload error:', err);
  }
}

function initOCRUpload() {
  const fileInput = document.getElementById('reportFile');
  const ocrStatus = document.getElementById('ocrStatus');
  const ocrProgressBar = document.getElementById('ocrProgressBar');
  if (!fileInput) return;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      showToast('Only PDF, PNG and JPG files are supported.', 'error');
      fileInput.value = '';
      return;
    }

    window.entrySource = 'ocr';

    if (file.type === 'application/pdf') {
      ocrStatus.textContent = 'PDF uploaded. Automatic text extraction works best with image files — please verify/enter the values below manually.';
      ocrStatus.classList.remove('hidden');
      uploadReportFile(file, null);
      switchToManualTab();
      return;
    }

    ocrStatus.textContent = 'Reading your soil report...';
    ocrStatus.classList.remove('hidden');
    ocrProgressBar.parentElement.classList.remove('hidden');

    try {
      const text = await runOCR(file, (pct) => {
        ocrProgressBar.style.width = pct + '%';
        ocrProgressBar.textContent = pct + '%';
      });
      const values = parseNutrientsFromText(text);
      const filledCount = Object.keys(values).length;

      uploadReportFile(file, text);

      if (filledCount === 0) {
        ocrStatus.textContent = 'Could not automatically detect nutrient values. Please enter them manually below.';
      } else {
        ocrStatus.textContent = `Detected ${filledCount} value(s) automatically. Please review and edit if needed.`;
        for (const [key, val] of Object.entries(values)) {
          const input = document.getElementById(`nutrient_${key}`);
          if (input) {
            input.value = val;
            input.dispatchEvent(new Event('input'));
          }
        }
      }
      switchToManualTab();
    } catch (err) {
      console.error(err);
      ocrStatus.textContent = 'OCR failed: ' + err.message + '. Please enter values manually.';
      uploadReportFile(file, null);
      switchToManualTab();
    }
  });
}

function switchToManualTab() {
  const manualTabBtn = document.getElementById('manual-tab');
  if (manualTabBtn) new bootstrap.Tab(manualTabBtn).show();
}

document.addEventListener('DOMContentLoaded', initOCRUpload);
