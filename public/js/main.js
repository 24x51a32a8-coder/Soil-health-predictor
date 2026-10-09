const API_BASE = '/api';

function getFarmerToken() { return localStorage.getItem('shp_token'); }
function getFarmerData() { try { return JSON.parse(localStorage.getItem('shp_farmer')); } catch { return null; } }
function getAdminToken() { return localStorage.getItem('shp_admin_token'); }

function logoutFarmer() {
  localStorage.removeItem('shp_token');
  localStorage.removeItem('shp_farmer');
  window.location.href = '/login.html';
}
function logoutAdmin() {
  localStorage.removeItem('shp_admin_token');
  window.location.href = '/admin-login.html';
}

async function apiCall(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = getFarmerToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));
  return { ok: res.ok, status: res.status, data };
}

async function adminApiCall(path, options = {}) {
  const headers = options.headers || { 'Content-Type': 'application/json' };
  const token = getAdminToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));
  return { ok: res.ok, status: res.status, data };
}

function updateNavbarAuthState() {
  const farmer = getFarmerData();
  const loginLink = document.getElementById('navLoginLink');
  const registerLink = document.getElementById('navRegisterLink');
  const dashLink = document.getElementById('navDashboardLink');
  const logoutLink = document.getElementById('navLogoutLink');
  if (farmer && loginLink && registerLink && dashLink && logoutLink) {
    loginLink.classList.add('hidden');
    registerLink.classList.add('hidden');
    dashLink.classList.remove('hidden');
    logoutLink.classList.remove('hidden');
  }
}

function showFieldError(inputEl, message) {
  inputEl.classList.add('is-invalid-farm');
  const err = inputEl.parentElement.querySelector('.error-text');
  if (err) { err.textContent = message; err.style.display = 'block'; }
}
function clearFieldError(inputEl) {
  inputEl.classList.remove('is-invalid-farm');
  const err = inputEl.parentElement.querySelector('.error-text');
  if (err) { err.style.display = 'none'; }
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2000;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `alert alert-${type === 'success' ? 'success' : 'danger'} shadow`;
  toast.style.cssText = 'min-width:280px;border-radius:12px;';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---------- Contact form (home page) ----------
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    const { ok, data } = await apiCall('/contact', { method: 'POST', body: JSON.stringify({ name, email, message }) });
    showToast(data.message, ok ? 'success' : 'error');
    if (ok) form.reset();
  });
}

// ---------- Floating chatbot widget ----------
function injectChatbotWidget() {
  if (document.getElementById('chatbotToggleBtn')) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button id="chatbotToggleBtn" class="chatbot-toggle"><i class="fa-solid fa-comment-dots"></i></button>
    <div id="chatbotWindow" class="chatbot-window">
      <div class="chatbot-header d-flex justify-content-between align-items-center">
        <span><i class="fa-solid fa-robot me-2"></i><span data-i18n="chatbot_title">AgriBot - Ask Anything</span></span>
        <button id="chatbotCloseBtn" class="btn-close btn-close-white btn-sm"></button>
      </div>
      <div id="chatbotBody" class="chatbot-body">
        <div class="chatbot-msg bot">🌱 Hi! I'm AgriBot. Ask me anything about soil health or fertilizers.</div>
      </div>
      <div class="chatbot-input">
        <input type="text" id="chatbotInput" data-i18n-placeholder="chatbot_placeholder" placeholder="Type your farming question...">
        <button id="chatbotSendBtn"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const toggleBtn = document.getElementById('chatbotToggleBtn');
  const windowEl = document.getElementById('chatbotWindow');
  const closeBtn = document.getElementById('chatbotCloseBtn');
  const sendBtn = document.getElementById('chatbotSendBtn');
  const input = document.getElementById('chatbotInput');
  const body = document.getElementById('chatbotBody');

  toggleBtn.addEventListener('click', () => windowEl.classList.toggle('open'));
  closeBtn.addEventListener('click', () => windowEl.classList.remove('open'));

  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;
    body.insertAdjacentHTML('beforeend', `<div class="chatbot-msg user">${escapeHtml(msg)}</div>`);
    input.value = '';
    body.scrollTop = body.scrollHeight;
    body.insertAdjacentHTML('beforeend', `<div class="chatbot-msg bot" id="typingIndicator">Typing...</div>`);
    body.scrollTop = body.scrollHeight;

    const { data } = await apiCall('/chatbot/ask', { method: 'POST', body: JSON.stringify({ message: msg }) });
    document.getElementById('typingIndicator')?.remove();
    body.insertAdjacentHTML('beforeend', `<div class="chatbot-msg bot">${escapeHtml(data.answer || data.message)}</div>`);
    body.scrollTop = body.scrollHeight;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Dark mode toggle (site-wide) ----------
// ---------- Scroll-reveal animation (elements fade/slide in as they enter view) ----------
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal-on-scroll');
  if (targets.length === 0) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('revealed'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(el => observer.observe(el));
}

// ---------- Animated number counter (e.g. for stat cards) ----------
function animateCounter(el, endValue, duration = 900) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (endValue - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = endValue;
  }
  requestAnimationFrame(tick);
}

function initThemeToggle() {
  const saved = localStorage.getItem('shp_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  injectThemeToggleButton();
}

function injectThemeToggleButton() {
  if (document.getElementById('themeToggleBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'themeToggleBtn';
  btn.className = 'theme-toggle-btn';
  btn.title = 'Toggle dark mode';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';

  btn.addEventListener('click', () => {
    const nowDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (nowDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('shp_theme', 'light');
      btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shp_theme', 'dark');
      btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
  });

  document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavbarAuthState();
  initContactForm();
  injectChatbotWidget();
  initThemeToggle();
  initScrollReveal();
});
