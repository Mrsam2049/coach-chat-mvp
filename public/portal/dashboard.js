import { getSession, logout } from './auth.js';

import {
  fetchConversations,
  createConversation,
  fetchMessages,
  saveMessage,
  updateConversation,
  deleteConversationApi
} from './conversations-api.js';


const messagesArea = document.getElementById('messages-area');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('new-chat-btn');
const chatTitle = document.getElementById('chat-title');
const sendBtn = document.getElementById('send-btn');

const portalApp = document.getElementById('portal-app');
const portalSidebar = document.getElementById('portal-sidebar');
const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');

let currentSession = null;
let currentConversationId = null;

const MAX_TEXTAREA_HEIGHT = 160;
let conversations = [];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSessionWithRetry(retries = 3, delay = 250) {
  for (let i = 0; i < retries; i++) {
    const session = await getSession();
    if (session) return session;
    await wait(delay);
  }
  return null;
}

async function init() {
  try {
    const session = await getSessionWithRetry();

    if (!session) {
      window.location.href = './login.html';
      return;
    }

    currentSession = session;

    const email = session.user.email || 'Sin correo';
    userEmail.textContent = email;
    userAvatar.textContent = email.charAt(0).toUpperCase();

    await loadConversations();
    prepareNewConversation();

    autoResizeTextarea();

    if (isMobileView()) {
      closeSidebar();
    } else {
      if (portalApp) portalApp.classList.remove('sidebar-collapsed');
    }
  } catch (err) {
    console.error('Error inicializando dashboard:', err);
    userEmail.textContent = 'No se pudo cargar la sesión';
  }
}

async function loadConversations() {
  const result = await fetchConversations();

  const all = (result.conversations || []).map(c => ({
    id: c.id,
    title: c.title,
    messages: [],
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }));

  // Eliminar silenciosamente las conversaciones vacías ("Nueva conversación" sin mensajes)
  const emptyOnes = all.filter(c => c.title === 'Nueva conversación');
  const rest      = all.filter(c => c.title !== 'Nueva conversación');

  for (const empty of emptyOnes) {
    try {
      await deleteConversationApi(empty.id);
    } catch (_) { /* ignorar errores de limpieza */ }
  }

  conversations = rest;
}

// Prepara una conversación nueva solo en memoria (sin guardar en BD todavía)
function prepareNewConversation() {
  currentConversationId = null;
  chatTitle.textContent = 'Nueva conversación';

  // Estado de bienvenida visual — no se guarda nada en BD
  messagesArea.innerHTML = `
    <div class="messages-inner">
      <div class="welcome-state">
        <div class="welcome-state-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2>¿En qué puedo ayudarte?</h2>
        <p>Escribe tu primera pregunta para comenzar la conversación.</p>
      </div>
    </div>
  `;

  renderConversationList();
}

// Crea la conversación en BD y devuelve su id (solo cuando se necesita)
async function ensureConversationExists() {
  if (currentConversationId) return currentConversationId;

  const result = await createConversation('Nueva conversación');
  const convo = result.conversation;

  const newConversation = {
    id: convo.id,
    title: convo.title,
    messages: [],
    createdAt: convo.created_at,
    updatedAt: convo.updated_at
  };

  conversations.unshift(newConversation);
  currentConversationId = convo.id;
  renderConversationList();

  return convo.id;
}

async function createConversationAction() {
  prepareNewConversation();
  if (isMobileView()) closeSidebar();
}

async function openConversation(conversationId) {
  currentConversationId = conversationId;

  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  chatTitle.textContent = conversation.title;
  renderConversationList();

  const result = await fetchMessages(conversationId);
  conversation.messages = (result.messages || []).map(m => ({
    id: m.id,
    role: m.role,
    content: m.content
  }));

  if (conversation.messages.length === 0) {
    conversation.messages = [
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '¡Hola! Soy Aurora. ¿Sobre qué te gustaría conversar hoy?'
      }
    ];
  }

  renderMessages(conversation.messages);
}

function getOrCreateInner() {
  let inner = messagesArea.querySelector('.messages-inner');
  if (!inner) {
    messagesArea.innerHTML = '';
    inner = document.createElement('div');
    inner.className = 'messages-inner';
    messagesArea.appendChild(inner);
  }
  return inner;
}

function appendMessageElement(message) {
  const inner = getOrCreateInner();

  const row = document.createElement('div');
  row.className = `msg ${message.role}`;
  row.dataset.messageId = message.id;

  const bubble = document.createElement('div');
  bubble.className = `bubble ${message.role}`;

  if (message.role === 'assistant') {
    if (typeof marked !== 'undefined') {
      bubble.innerHTML = DOMPurify.sanitize(marked.parse(String(message.content || '')));
    } else {
      bubble.textContent = String(message.content || '');
    }
  } else {
    bubble.textContent = String(message.content || '');
  }

  row.appendChild(bubble);
  inner.appendChild(row);

  return { row, bubble };
}

function renderMessages(messages) {
  messagesArea.innerHTML = '';
  const inner = document.createElement('div');
  inner.className = 'messages-inner';
  messagesArea.appendChild(inner);

  messages.forEach(message => {
    appendMessageElement(message);
  });

  requestAnimationFrame(() => {
    scrollMessagesToBottom();
  });
}

function scrollMessagesToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function renderConversationList() {
  conversationList.innerHTML = '';

  conversations.forEach(conversation => {
    const item = document.createElement('div');
    item.className = `conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;

    const title = document.createElement('span');
    title.className = 'conversation-item-title';
    title.textContent = conversation.title;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'conversation-delete-btn';
    deleteBtn.setAttribute('aria-label', 'Eliminar conversación');
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteConversation(conversation.id);
    });

    item.addEventListener('click', async () => {
      await openConversation(conversation.id);
      if (isMobileView()) closeSidebar();
    });

    item.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        await openConversation(conversation.id);
        if (isMobileView()) closeSidebar();
      }
    });

    item.appendChild(title);
    item.appendChild(deleteBtn);
    conversationList.appendChild(item);
  });
}

async function deleteConversation(conversationId) {
  conversations = conversations.filter(c => c.id !== conversationId);

  if (currentConversationId === conversationId) {
    currentConversationId = conversations[0]?.id || null;
  }

  renderConversationList();

  if (currentConversationId) {
    await openConversation(currentConversationId);
  } else {
    messagesArea.innerHTML = '';
    chatTitle.textContent = 'Nueva conversación';
  }

  try {
    await deleteConversationApi(conversationId);
  } catch (err) {
    console.error('Error eliminando conversación:', err);
  }
}


async function updateConversationTitle(conversation, firstUserMessage) {
  if (!conversation || conversation.title !== 'Nueva conversación') return;

  const cleanTitle = firstUserMessage.trim().slice(0, 40) || 'Nueva conversación';

  conversation.title = cleanTitle;
  renderConversationList();

  try {
    await updateConversation(conversation.id, { title: cleanTitle });
  } catch (err) {
    console.error('Error actualizando título de la conversación:', err);
  }
}

function getCurrentConversation() {
  return conversations.find(c => c.id === currentConversationId);
}

async function sendMessage(message) {
  // Si aún no hay conversación en BD, crearla ahora y obtener el objeto actualizado
  if (!currentConversationId) {
    await ensureConversationExists();
  }
  const conversation = getCurrentConversation();
  if (!conversation) return;

  const userMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: message
  };

  conversation.messages.push(userMessage);
await updateConversationTitle(conversation, message);
renderConversationList();

  appendMessageElement(userMessage);
  scrollMessagesToBottom();

  // Crear conversación en BD si es la primera vez que se escribe
  try {
    await ensureConversationExists();
  } catch (err) {
    console.error('Error creando conversación:', err);
  }

  // Guardar mensaje del usuario
  try {
    await saveMessage(conversation.id, 'user', message);
  } catch (err) {
    console.error('Error guardando mensaje del usuario:', err);
  }

  const assistantMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: ''
  };

  conversation.messages.push(assistantMessage);
  const { bubble: assistantBubble } = appendMessageElement(assistantMessage);
  scrollMessagesToBottom();

  let streamedText = '';
  let renderScheduled = false;

  const flushAssistantBubble = () => {
    renderScheduled = false;

    const finalText = assistantMessage.content || streamedText || '';

    if (typeof marked !== 'undefined') {
      assistantBubble.innerHTML = DOMPurify.sanitize(marked.parse(finalText));
    } else {
      assistantBubble.textContent = finalText;
    }

    scrollMessagesToBottom();
  };

  const scheduleAssistantRender = () => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(flushAssistantBubble);
  };

  try {
    assistantBubble.innerHTML = `
      <div class="typing">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    `;

    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({
        message,
        context: {
          pageUrl: window.location.href,
          user: {
            externalId: currentSession.user.id
          }
        }
      })
    });

    if (!response.ok || !response.body) {
      throw new Error('No fue posible iniciar el streaming.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let hasStartedText = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        let eventName = 'message';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.replace('event:', '').trim();
          }
          if (line.startsWith('data:')) {
            data += line.replace('data:', '').trim();
          }
        }

        if (!data) continue;

        const parsed = JSON.parse(data);

        if (eventName === 'status') {
          if (!hasStartedText) {
            assistantBubble.textContent = parsed.text;
            scrollMessagesToBottom();
          }
        }

        if (eventName === 'delta') {
          if (!hasStartedText) {
            hasStartedText = true;
            streamedText = '';
          }

          streamedText += parsed.text;
          assistantMessage.content = streamedText;
          scheduleAssistantRender();
        }

        if (eventName === 'error') {
          throw new Error(parsed.error || 'Error en streaming');
        }
      }
    }

    assistantMessage.content = streamedText || 'No pude generar una respuesta.';
    flushAssistantBubble();

    // Guardar mensaje del asistente
    try {
      await saveMessage(conversation.id, 'assistant', assistantMessage.content);
    } catch (err) {
      console.error('Error guardando mensaje del asistente:', err);
    }
  } catch (err) {
    console.error('Error enviando mensaje:', err);

    assistantMessage.content = 'Ocurrió un error al responder. Intenta de nuevo.';
    assistantBubble.textContent = assistantMessage.content;
    scrollMessagesToBottom();

    try {
      await saveMessage(conversation.id, 'assistant', assistantMessage.content);
    } catch (saveErr) {
      console.error('Error guardando mensaje de error del asistente:', saveErr);
    }
  }
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const value = chatInput.value.trim();
  if (!value) return;

  chatInput.value = '';
  autoResizeTextarea();
  sendBtn.disabled = true;

  await sendMessage(value);

  sendBtn.disabled = false;
  chatInput.focus();
});

chatInput.addEventListener('input', () => {
  autoResizeTextarea();
  sendBtn.disabled = !chatInput.value.trim();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

function autoResizeTextarea() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
}

function isMobileView() {
  return window.innerWidth <= 980;
}

function openSidebar() {
  if (isMobileView()) {
    if (portalSidebar) portalSidebar.classList.add('mobile-open');
    if (mobileSidebarOverlay) mobileSidebarOverlay.classList.add('active');
    document.body.classList.add('sidebar-open');
  } else {
    if (portalApp) portalApp.classList.remove('sidebar-collapsed');
  }
}

function closeSidebar() {
  if (isMobileView()) {
    if (portalSidebar) portalSidebar.classList.remove('mobile-open');
    if (mobileSidebarOverlay) mobileSidebarOverlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  } else {
    if (portalApp) portalApp.classList.add('sidebar-collapsed');
  }
}

function toggleSidebar() {
  if (isMobileView()) {
    const isOpen = portalSidebar?.classList.contains('mobile-open');
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  } else {
    if (portalApp) portalApp.classList.toggle('sidebar-collapsed');
  }
}

newChatBtn.addEventListener('click', async () => {
  await createConversationAction();
  if (isMobileView()) closeSidebar();
});

logoutBtn.addEventListener('click', async () => {
  try {
    await logout();
    window.location.href = './login.html';
  } catch (err) {
    console.error('Error cerrando sesión:', err);
  }
});

mobileMenuBtn?.addEventListener('click', toggleSidebar);
mobileSidebarOverlay?.addEventListener('click', closeSidebar);
mobileSidebarOverlay?.addEventListener('touchend', (e) => {
  e.preventDefault();
  closeSidebar();
});

window.addEventListener('resize', () => {
  if (!isMobileView()) {
    if (portalSidebar) portalSidebar.classList.remove('mobile-open');
    if (mobileSidebarOverlay) mobileSidebarOverlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }
});

init();