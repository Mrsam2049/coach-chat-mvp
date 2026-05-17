import { supabase } from './auth.js';

// --- Referencias al DOM ---
const stateLoading = document.getElementById('state-loading');
const stateInvalid  = document.getElementById('state-invalid');
const stateForm     = document.getElementById('state-form');
const stateSuccess  = document.getElementById('state-success');

const resetForm    = document.getElementById('reset-form');
const passwordInput = document.getElementById('password');
const password2Input = document.getElementById('password2');
const submitBtn    = document.getElementById('submit-btn');
const resetMessage = document.getElementById('reset-message');
const strengthFill  = document.getElementById('strength-fill');
const strengthLabel = document.getElementById('strength-label');

// --- Mostrar solo un estado a la vez ---
function showState(name) {
  stateLoading.style.display = name === 'loading'  ? '' : 'none';
  stateInvalid.style.display  = name === 'invalid'  ? '' : 'none';
  stateForm.style.display     = name === 'form'     ? '' : 'none';
  stateSuccess.style.display  = name === 'success'  ? '' : 'none';
}

// --- Indicador de fuerza de contraseña ---
const STRENGTH_LEVELS = [
  { label: '',        color: 'transparent', width: '0%'   },
  { label: 'Débil',   color: '#e05252',     width: '33%'  },
  { label: 'Regular', color: '#e09c2f',     width: '66%'  },
  { label: 'Fuerte',  color: '#3db87a',     width: '100%' },
];

function getStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return 1;
  if (score <= 3) return 2;
  return 3;
}

passwordInput.addEventListener('input', () => {
  const level = getStrength(passwordInput.value);
  const s = STRENGTH_LEVELS[level];
  strengthFill.style.width = s.width;
  strengthFill.style.background = s.color;
  strengthLabel.textContent = s.label;
  strengthLabel.style.color = s.color;
});

// --- Detectar el token de Supabase en la URL ---
// Supabase agrega #access_token=...&type=recovery al redirigir
async function init() {
  showState('loading');

  // Supabase SDK detecta automáticamente el fragment de la URL y establece la sesión
  const { data: { session }, error } = await supabase.auth.getSession();

  // También escuchar el evento por si tarda un momento
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showState('form');
    }
  });

  if (error || !session) {
    // Puede que el token todavía esté procesándose, esperar brevemente
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          showState('form');
        } else {
          showState('invalid');
        }
      });
    }, 1200);
    return;
  }

  // Si ya hay sesión activa con tipo recovery, mostrar el form
  showState('form');
}

// --- Envío del formulario ---
resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password  = passwordInput.value;
  const password2 = password2Input.value;

  resetMessage.textContent = '';
  resetMessage.style.color = '';

  // Validaciones del lado cliente
  if (password.length < 8) {
    resetMessage.style.color = '#ffd9d9';
    resetMessage.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    return;
  }

  if (password !== password2) {
    resetMessage.style.color = '#ffd9d9';
    resetMessage.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  try {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) throw error;

    // Cerrar sesión para que tenga que entrar con la nueva contraseña
    await supabase.auth.signOut();

    showState('success');
  } catch (err) {
    console.error('Error actualizando contraseña:', err);
    resetMessage.style.color = '#ffd9d9';

    if (err.message?.includes('same password')) {
      resetMessage.textContent = 'La nueva contraseña debe ser diferente a la anterior.';
    } else if (err.message?.includes('session')) {
      resetMessage.textContent = 'El enlace ha expirado. Solicita uno nuevo.';
      setTimeout(() => showState('invalid'), 2500);
    } else {
      resetMessage.textContent = 'No se pudo actualizar la contraseña. Intenta de nuevo.';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar contraseña';
  }
});

init();