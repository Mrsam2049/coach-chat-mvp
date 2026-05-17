import { activate } from './auth.js';

const form = document.getElementById('activate-form');
const message = document.getElementById('activate-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = 'Activando...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;

  if (password !== password2) {
    message.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  try {
    console.log('👉 Enviando activación:', email);

    const result = await activate(email, password);

    console.log('✅ Activación OK:', result);
    message.textContent = 'Cuenta activada correctamente. Ahora puedes iniciar sesión.';

    setTimeout(() => {
      window.location.href = './login.html';
    }, 1500);
  } catch (err) {
    console.error('❌ ERROR ACTIVACIÓN:', err);
    message.textContent = err.message || 'No fue posible activar la cuenta.';
  }
});