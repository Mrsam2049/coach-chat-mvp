import { getAccessToken } from './auth.js';

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Error en la API');
  }

  return data;
}

export async function fetchConversations() {
  return apiFetch('/api/v1/conversations');
}

export async function createConversation(title = 'Nueva conversación') {
  return apiFetch('/api/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({ title })
  });
}

export async function fetchMessages(conversationId) {
  return apiFetch(`/api/v1/conversations/${conversationId}/messages`);
}

export async function saveMessage(conversationId, role, content) {
  return apiFetch(`/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role, content })
  });
}

export async function updateConversation(conversationId, updates) {
  return apiFetch(`/api/v1/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function deleteConversationApi(conversationId) {
  return apiFetch(`/api/v1/conversations/${conversationId}`, {
    method: 'DELETE'
  });
}