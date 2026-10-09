// ============================================
// Language handling: first-visit modal + live translation
// Elements needing translation should have data-i18n="key" (text content)
// or data-i18n-placeholder="key" (for input placeholders).
// ============================================

const SUPPORTED_LANGS = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी' };
let translations = {};

async function loadLanguage(lang) {
  try {
    const res = await fetch(`/js/i18n/${lang}.json`);
    translations = await res.json();
    localStorage.setItem('shp_lang', lang);
    applyTranslations();
  } catch (err) {
    console.error('Failed to load language file', err);
  }
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key]) el.textContent = translations[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) el.setAttribute('placeholder', translations[key]);
  });
}

function t(key) {
  return translations[key] || key;
}

function initLanguage() {
  const saved = localStorage.getItem('shp_lang');
  if (saved && SUPPORTED_LANGS[saved]) {
    loadLanguage(saved);
    return;
  }
  // Show language selection modal on first visit
  const modalEl = document.getElementById('langModal');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modal.show();
    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.getAttribute('data-lang');
        loadLanguage(lang);
        modal.hide();
      });
    });
  } else {
    loadLanguage('en');
  }
}

function switchLanguage(lang) {
  loadLanguage(lang);
}

document.addEventListener('DOMContentLoaded', initLanguage);
