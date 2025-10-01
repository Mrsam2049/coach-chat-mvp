const box = document.getElementById('box');
const input = document.getElementById('input');
const btn = document.getElementById('send');
const statusEl = document.getElementById('status');

const url = new URL(window.location.href);
const moduleName = url.searchParams.get('module') || 'general';
const uid = url.searchParams.get('uid') || 'guest';

function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  div.appendChild(bubble);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  addMsg('user', text);
  input.value = '';
  btn.disabled = true;
  statusEl.textContent = 'Pensando…';



  try {
    const res = await fetch('/api/v1/chat', {
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

    // Verificamos si la respuesta HTTP es un error (res.ok es false si el status es 4xx o 5xx)
    if (!res.ok) {
      if (res.status === 429) {
        addMsg('assistant', 'Estamos temporalmente sin cupo de IA. Por favor, intenta de nuevo en unas horas.');
      } else {
        // Muestra el mensaje de error que viene del backend (si existe)
        addMsg('assistant', `Error: ${data?.error || 'No se pudo procesar tu mensaje.'}`);
      }
      return; // Salir de la función si hubo error
    }

    if (data?.answer) addMsg('assistant', data.answer);
    
    if (Array.isArray(data?.recommendations) && data.recommendations.length) {
      const extras = data.recommendations
        .map(r => `• ${r.title}${r.reason ? ` — ${r.reason}` : ''}`)
        .join('\n');
      addMsg('assistant', `Recomendaciones:\n${extras}`);
    }
  } catch (e) {
    addMsg('assistant', 'Hubo un error en la conexión. Por favor, revisa tu red.');
  } finally {
    btn.disabled = false;
    statusEl.textContent = '';
    input.focus();
  }
}

btn.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// saludo inicial
addMsg('assistant', `¡Hola! Estoy lista para ayudarte. Estás en el módulo: ${moduleName}.`);
