const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

// ---------- REGISTER ----------
function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const fullName = document.getElementById('fullName');
  const phone = document.getElementById('phone');
  const email = document.getElementById('email');
  const village = document.getElementById('village');
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');

  function validate() {
    let valid = true;
    if (fullName.value.trim().length < 2) { showFieldError(fullName, 'Enter a valid full name'); valid = false; } else clearFieldError(fullName);
    if (!PHONE_RE.test(phone.value.trim())) { showFieldError(phone, 'Enter a valid 10-digit phone number'); valid = false; } else clearFieldError(phone);
    if (!EMAIL_RE.test(email.value.trim())) { showFieldError(email, 'Enter a valid email address'); valid = false; } else clearFieldError(email);
    if (village.value.trim().length < 2) { showFieldError(village, 'Enter a valid village name'); valid = false; } else clearFieldError(village);
    if (password.value.length < 6) { showFieldError(password, 'Password must be at least 6 characters'); valid = false; } else clearFieldError(password);
    if (confirmPassword.value !== password.value || !confirmPassword.value) { showFieldError(confirmPassword, 'Passwords do not match'); valid = false; } else clearFieldError(confirmPassword);
    return valid;
  }

  [fullName, phone, email, village, password, confirmPassword].forEach(el => el.addEventListener('input', validate));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registering...';

    const { ok, data } = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName.value.trim(), phone: phone.value.trim(), email: email.value.trim(),
        village: village.value.trim(), password: password.value, confirmPassword: confirmPassword.value
      })
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';

    if (ok) {
      showToast(data.message, 'success');
      setTimeout(() => window.location.href = '/login.html', 1200);
    } else {
      showToast(data.message, 'error');
    }
  });
}

// ---------- LOGIN ----------
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!identifier || !password) { showToast('Please fill in all fields.', 'error'); return; }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Logging in...';

    const { ok, data } = await apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';

    if (ok) {
      localStorage.setItem('shp_token', data.token);
      localStorage.setItem('shp_farmer', JSON.stringify(data.farmer));
      window.location.href = '/dashboard.html';
    } else {
      showToast(data.message, 'error');
    }
  });
}

// ---------- FORGOT PASSWORD ----------
function initForgotForm() {
  const form = document.getElementById('forgotForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const { ok, data } = await apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    showToast(data.message, ok ? 'success' : 'error');
    if (ok) form.reset();
  });
}

// ---------- RESET PASSWORD ----------
function initResetForm() {
  const form = document.getElementById('resetForm');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) { showToast('Invalid or missing reset link.', 'error'); }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }

    const { ok, data } = await apiCall('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, password, confirmPassword })
    });
    showToast(data.message, ok ? 'success' : 'error');
    if (ok) setTimeout(() => window.location.href = '/login.html', 1200);
  });
}

// ---------- ADMIN LOGIN ----------
function initAdminLoginForm() {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('adminPhone').value.trim();
    const password = document.getElementById('adminPassword').value;
    const secretCode = document.getElementById('adminSecretCode').value.trim();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verifying...';

    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, secretCode })
    });
    const data = await res.json();

    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';

    if (res.ok) {
      localStorage.setItem('shp_admin_token', data.token);
      window.location.href = '/admin-dashboard.html';
    } else {
      showToast(data.message, 'error');
    }
  });
}

// ---------- Auth guards ----------
function requireFarmerLogin() {
  if (!getFarmerToken()) window.location.href = '/login.html';
}
function requireAdminLogin() {
  if (!getAdminToken()) window.location.href = '/admin-login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  initRegisterForm();
  initLoginForm();
  initForgotForm();
  initResetForm();
  initAdminLoginForm();
});
