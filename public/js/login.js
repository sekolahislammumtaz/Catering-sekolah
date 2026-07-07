document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const passwordEyeIcon = document.getElementById('password-eye-icon');
  const alertBox = document.getElementById('alert-box');
  const alertMessage = document.getElementById('alert-message');
  const submitBtn = document.getElementById('login-submit-btn');

  // Check if already logged in, redirect to dashboard
  fetch('/api/auth/me')
    .then(response => {
      if (response.ok) {
        window.location.href = '/';
      }
    })
    .catch(err => console.log('Belum login:', err));

  // Toggle password visibility
  togglePasswordBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      passwordEyeIcon.classList.remove('fa-eye');
      passwordEyeIcon.classList.add('fa-eye-slash');
      togglePasswordBtn.setAttribute('aria-label', 'Sembunyikan password');
    } else {
      passwordInput.type = 'password';
      passwordEyeIcon.classList.remove('fa-eye-slash');
      passwordEyeIcon.classList.add('fa-eye');
      togglePasswordBtn.setAttribute('aria-label', 'Tampilkan password');
    }
  });

  // Handle Form Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showAlert('Username dan password harus diisi');
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = `
      <span>Memproses...</span>
      <i class="fa-solid fa-circle-notch fa-spin"></i>
    `;
    hideAlert();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to dashboard
        window.location.href = '/';
      } else {
        showAlert(data.message || 'Username atau password salah');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    } catch (err) {
      console.error('Login error:', err);
      showAlert('Terjadi kesalahan koneksi server');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Helper functions
  function showAlert(msg) {
    alertMessage.textContent = msg;
    alertBox.classList.remove('hidden');
    // Simple shake animation on alert
    alertBox.style.animation = 'none';
    setTimeout(() => {
      alertBox.style.animation = 'slideIn 0.3s ease, shake 0.3s ease';
    }, 10);
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }
});

// Add CSS keyframe shake dynamic inline style for fancy UI
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);
