(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const API_BASE = window.AuroraConfig?.apiUrl || window.location.origin;
  const url        = new URL(window.location.href);
  const moduleName = window.AuroraConfig?.module || url.searchParams.get('module') || 'general';
  const uid        = url.searchParams.get('uid') || 'guest';

  // ─── Crear UI del widget dinámicamente ───────────────────────────────────
  // Así el script no depende de que existan elementos en el DOM de Kajabi
  const WIDGET_HTML = `
    <div id="aurora-launcher" title="Habla con Aurora" aria-label="Abrir Aurora">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </div>

    <div id="aurora-widget" role="dialog" aria-label="Aurora chat" hidden>
      <div id="aurora-header">
        <span id="aurora-title">Aurora</span>
        <button id="aurora-close" aria-label="Cerrar">✕</button>
      </div>
      <div id="aurora-box" aria-live="polite"></div>
      <div id="aurora-status" aria-live="polite"></div>
      <div id="aurora-composer">
        <textarea id="aurora-input" rows="1"
          placeholder="Escribe un mensaje..."
          aria-label="Mensaje para Aurora"></textarea>
        <button id="aurora-send" aria-label="Enviar" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12L19 12M19 12L13 6M19 12L13 18"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const WIDGET_CSS = `
    #aurora-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #2563EB;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(37,99,235,0.45);
      z-index: 999998;
      border: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #aurora-launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(37,99,235,0.55);
    }
    #aurora-widget {
      position: fixed;
      bottom: 88px;
      right: 24px;
      width: 360px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #0A0A0B;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      z-index: 999997;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
      overflow: hidden;
    }
    #aurora-widget[hidden] { display: none !important; }
    #aurora-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: #111113;
    }
    #aurora-title {
      font-size: 14px;
      font-weight: 600;
      color: #FAFAFA;
      letter-spacing: -0.02em;
    }
    #aurora-close {
      background: none;
      border: none;
      color: rgba(250,250,250,0.45);
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 6px;
      line-height: 1;
      transition: color 0.15s ease;
    }
    #aurora-close:hover { color: #FAFAFA; }
    #aurora-box {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    #aurora-status {
      padding: 0 16px 4px;
      font-size: 11px;
      color: rgba(250,250,250,0.35);
      min-height: 18px;
    }
    #aurora-composer {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: #111113;
    }
    #aurora-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #FAFAFA;
      font: inherit;
      font-size: 13px;
      padding: 8px 12px;
      resize: none;
      outline: none;
      max-height: 120px;
      overflow-y: auto;
      scrollbar-width: none;
      line-height: 1.5;
    }
    #aurora-input::placeholder { color: rgba(250,250,250,0.3); }
    #aurora-input:focus { border-color: rgba(37,99,235,0.5); }
    #aurora-send {
      width: 34px;
      min-width: 34px;
      height: 34px;
      border-radius: 8px;
      border: none;
      background: #2563EB;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
      flex-shrink: 0;
    }
    #aurora-send:hover:not(:disabled) { background: #3B82F6; }
    #aurora-send:active { transform: scale(0.96); }
    #aurora-send:disabled { opacity: 0.35; cursor: not-allowed; }
    .aurora-msg { display: flex; }
    .aurora-msg.user { justify-content: flex-end; }
    .aurora-msg.assistant { justify-content: flex-start; }
    .aurora-bubble {
      max-width: 85%;
      font-size: 13px;
      line-height: 1.6;
      border-radius: 12px;
      padding: 9px 13px;
    }
    .aurora-bubble.user {
      background: rgba(37,99,235,0.25);
      border: 1px solid rgba(37,99,235,0.3);
      color: #FAFAFA;
      border-radius: 12px 12px 3px 12px;
    }
    .aurora-bubble.assistant {
      color: rgba(250,250,250,0.88);
      padding: 4px 0;
    }
    .aurora-bubble.assistant p { margin: 6px 0; }
    .aurora-bubble.assistant p:first-child { margin-top: 0; }
    .aurora-bubble.assistant p:last-child { margin-bottom: 0; }
    .aurora-bubble.assistant ul, .aurora-bubble.assistant ol {
      padding-left: 18px; margin: 6px 0;
    }
    .aurora-bubble.assistant strong { font-weight: 600; color: #FAFAFA; }
    .aurora-typing { display: flex; gap: 4px; padding: 6px 0; align-items: center; }
    .aurora-dot {
      width: 5px; height: 5px;
      background: rgba(250,250,250,0.35);
      border-radius: 50%;
      animation: auroraBounce 1.4s infinite ease-in-out;
    }
    .aurora-dot:nth-child(2) { animation-delay: 0.16s; }
    .aurora-dot:nth-child(3) { animation-delay: 0.32s; }
    @keyframes auroraBounce {
      0%, 80%, 100% { transform: scale(0.5); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
    @media (max-width: 480px) {
      #aurora-widget {
        bottom: 0; right: 0;
        width: 100vw;
        max-width: 100vw;
        height: 70vh;
        border-radius: 16px 16px 0 0;
      }
      #aurora-launcher { bottom: 16px; right: 16px; }
    }
  `;

  // ─── Inyectar CSS ─────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  document.head.appendChild(style);

  // ─── Inyectar HTML ────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'aurora-container';
  container.innerHTML = WIDGET_HTML;
  document.body.appendChild(container);

  // ─── Referencias (ahora sí existen en el DOM) ─────────────────────────────
  const launcher  = document.getElementById('aurora-launcher');
  const widget    = document.getElementById('aurora-widget');
  const closeBtn  = document.getElementById('aurora-close');
  const box       = document.getElementById('aurora-box');
  const statusEl  = document.getElementById('aurora-status');
  const inputEl   = document.getElementById('aurora-input');
  const sendBtn   = document.getElementById('aurora-send');

  // ─── Abrir / cerrar ───────────────────────────────────────────────────────
  let isOpen = false;

  function openWidget() {
    isOpen = true;
    widget.removeAttribute('hidden');
    launcher.style.display = 'none';
    inputEl.focus();
  }

  function closeWidget() {
    isOpen = false;
    widget.setAttribute('hidden', '');
    launcher.style.display = 'flex';
  }

  launcher.addEventListener('click', openWidget);
  closeBtn.addEventListener('click', closeWidget);

  // ─── Autosize textarea ────────────────────────────────────────────────────
  function autosizeInput() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }

  inputEl.addEventListener('input', () => {
    autosizeInput();
    sendBtn.disabled = !inputEl.value.trim();
  });

  // ─── Renderizar mensaje ───────────────────────────────────────────────────
  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(html);
    // Fallback si DOMPurify no cargó
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      return sanitize(marked.parse(String(text)));
    }
    return sanitize(String(text));
  }

  function addMsg(role, text) {
    const row    = document.createElement('div');
    row.className = `aurora-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = `aurora-bubble ${role}`;

    if (role === 'assistant') {
      bubble.innerHTML = renderMarkdown(text);
    } else {
      bubble.textContent = String(text);
    }

    row.appendChild(bubble);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    return bubble;
  }

  // ─── Enviar mensaje ───────────────────────────────────────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    addMsg('user', text);
    inputEl.value = '';
    autosizeInput();
    sendBtn.disabled = true;
    statusEl.textContent = '';

    // Burbuja del asistente con typing indicator
    const row    = document.createElement('div');
    row.className = 'aurora-msg assistant';
    const bubble = document.createElement('div');
    bubble.className = 'aurora-bubble assistant';
    bubble.innerHTML = `<div class="aurora-typing">
      <div class="aurora-dot"></div>
      <div class="aurora-dot"></div>
      <div class="aurora-dot"></div>
    </div>`;
    row.appendChild(bubble);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;

    let streamed = '';
    let started  = false;
    let scheduled = false;

    const flush = () => {
      scheduled = false;
      bubble.innerHTML = renderMarkdown(streamed);
      box.scrollTop = box.scrollHeight;
    };

    const scheduleRender = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(flush);
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/chat/widget-stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            module:  moduleName,
            pageUrl: window.location.href,
            user:    { externalId: uid, goals: [] }
          }
        })
      });

      if (!res.ok || !res.body) throw new Error('No se pudo iniciar la respuesta.');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

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

          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }

          if (eventName === 'status' && !started) {
            statusEl.textContent = parsed.text ?? '';
          }
          if (eventName === 'delta') {
            if (!started) { started = true; streamed = ''; statusEl.textContent = ''; }
            streamed += parsed.text ?? '';
            scheduleRender();
          }
          if (eventName === 'error') {
            throw new Error(parsed.error || 'Error en la respuesta');
          }
        }
      }

      bubble.innerHTML = renderMarkdown(streamed || 'No pude generar una respuesta.');
      box.scrollTop = box.scrollHeight;

    } catch (e) {
      bubble.textContent = 'Error de conexión. Inténtalo de nuevo.';
      box.scrollTop = box.scrollHeight;
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ─── Saludo inicial ───────────────────────────────────────────────────────
  addMsg('assistant', '¡Hola! Soy Aurora. ¿En qué puedo ayudarte hoy?');

})();