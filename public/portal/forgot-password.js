import { supabase } from './auth.js';

const form = document.getElementById('forgot-form');
const message = document.getElementById('forgot-message');
const submitBtn = document.getElementById('submit-btn');

// La URL a la que Supabase redirigirá después del click en el correo.
// Debe coincidir exactamente con lo que configures en Supabase > Auth > URL Configuration > Redirect URLs
const RESET_REDIRECT_URL = `${window.location.origin}/portal/reset-password.html`;

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  if (!email) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';
  message.textContent = '';
  message.style.color = '';

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT_URL
    });

    if (error) throw error;

    // Siempre mostrar el mismo mensaje, exista o no el correo.
    // Esto evita que alguien descubra qué correos están registrados (enumeración de usuarios).
    message.style.color = '#a8f0c6';
    message.textContent =
      'Si ese correo está registrado, recibirás un enlace en los próximos minutos. Revisa también tu carpeta de spam.';

    form.reset();
  } catch (err) {
    console.error('Error reset password:', err);
    message.style.color = '#ffd9d9';
    message.textContent = 'Ocurrió un error. Intenta de nuevo en unos momentos.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar enlace';
  }
});