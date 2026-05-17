const box = document.getElementById('box');
const input = document.getElementById('input');
const btn = document.getElementById('send');
btn.disabled = true;
const statusEl = document.getElementById('status');

const url = new URL(window.location.href);
const moduleName = url.searchParams.get('module') || 'general';
const uid = url.searchParams.get('uid') || 'guest';

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

  if (role === 'assistant' && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    bubble.innerHTML = DOMPurify.sanitize(marked.parse(String(text)));
  } else {
    bubble.textContent = String(text);
  }

  div.appendChild(bubble);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function renderAssistant(bubble, text) {
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    bubble.innerHTML = DOMPurify.sanitize(marked.parse(String(text)));
  } else {
    bubble.textContent = String(text);
  }
  box.scrollTop = box.scrollHeight;
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

  // Burbuja del asistente que se irá rellenando con el streaming
  const div = document.createElement('div');
  div.className = 'msg assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble assistant';
  bubble.innerHTML = `<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  div.appendChild(bubble);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;

  let streamed = '';
  let started = false;
  let renderScheduled = false;

  const flush = () => {
    renderScheduled = false;
    renderAssistant(bubble, streamed);
  };
  const scheduleRender = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(flush);
  };

  try {
    const res = await fetch(`${window.location.origin}/api/v1/chat/widget-stream`, {
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

    if (!res.ok || !res.body) {
      throw new Error('No se pudo iniciar la respuesta.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        let eventName = 'message';
        let data = '';
        for (const line of part.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:'))  data += line.slice(5).trim();
        }
        if (!data) continue;

        const parsed = JSON.parse(data);

        if (eventName === 'status' && !started) {
          bubble.textContent = parsed.text;
          box.scrollTop = box.scrollHeight;
        }
        if (eventName === 'delta') {
          if (!started) { started = true; streamed = ''; }
          streamed += parsed.text;
          scheduleRender();
        }
        if (eventName === 'error') {
          throw new Error(parsed.error || 'Error en la respuesta');
        }
      }
    }

    renderAssistant(bubble, streamed || 'No pude generar una respuesta.');
  } catch (e) {
    bubble.textContent = 'Error de conexión. Revisa tu red e inténtalo de nuevo.';
    box.scrollTop = box.scrollHeight;
  } finally {
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