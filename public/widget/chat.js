const box = document.getElementById('box');
const input = document.getElementById('input');
const btn = document.getElementById('send');
btn.disabled = true;
const statusEl = document.getElementById('status');

const url = new URL(window.location.href);
const moduleName = url.searchParams.get('module') || 'general';
const uid = url.searchParams.get('uid') || 'guest';

let typingEl = null;
const MAX_TEXTAREA_HEIGHT = 160;

function autosizeTextarea() {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
}

input.addEventListener('input', () => {
  autosizeTextarea();
  btn.disabled = !input.value.trim();
});

function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;

  if (role === 'assistant' && typeof marked !== 'undefined') {
    bubble.innerHTML = marked.parse(String(text));
  } else {
    bubble.textContent = String(text);
  }

  div.appendChild(bubble);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showTyping() {
  if (typingEl) return;

  const div = document.createElement('div');
  div.className = 'msg assistant';

  const bubble = document.createElement('div');
  bubble.className = 'bubble assistant';

  bubble.innerHTML = `
    <div class="typing">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  `;

  div.appendChild(bubble);
  box.appendChild(div);
  typingEl = div;
  box.scrollTop = box.scrollHeight;
}

function hideTyping() {
  if (!typingEl) return;
  typingEl.remove();
  typingEl = null;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  if (btn.disabled) return;

  addMsg('user', text);
  input.value = '';
  autosizeTextarea();
  btn.disabled = true;
  statusEl.textContent = '';

  try {
    showTyping();

    const res = await fetch(`${window.location.origin}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        context: {
          module: moduleName,
          pageUrl: window.location.href,
          user: { externalId: uid, goals: [] }
        }
      })
    });

    const data = await res.json();

    // ✅ Manejo de error HTTP dentro del try (res y data existen aquí)
    if (!res.ok) {
      addMsg('assistant', `Error: ${data?.error || 'No se pudo procesar tu mensaje.'}`);
      return;
    }

    if (data?.answer) addMsg('assistant', data.answer);
  } catch (e) {
    addMsg('assistant', 'Error de conexión. Revisa tu red e inténtalo de nuevo.');
  } finally {
    hideTyping();
    btn.disabled = false;
    input.focus();
  }
}

btn.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // evita salto de línea
    sendMessage();
  }
});

// Saludo inicial
addMsg('assistant', `¡Hola! Soy Aurora. Estás en el módulo: ${moduleName}.`);
autosizeTextarea();