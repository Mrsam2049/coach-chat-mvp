import { login, getSession } from './auth.js';

const form = document.getElementById('login-form');
const message = document.getElementById('login-message');

async function init() {
  try {
    const existingSession = await getSession();

    if (existingSession) {
      window.location.href = './dashboard.html';
      return;
    }
  } catch (err) {
    console.error('Error verificando sesión en login:', err);
    // No redirigir ni romper la pantalla
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = 'Iniciando sesión...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await login(email, password);
    window.location.href = './dashboard.html';
  } catch (err) {
    console.error('Error login:', err);
    message.textContent = err.message || 'No fue posible iniciar sesión.';
  }
});

init();