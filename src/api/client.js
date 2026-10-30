const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

/**
 * Standard utility to parse the APIResponse envelope.
 * Throws an error on non-ok statuses or if success = false.
 */
async function handleResponse(res) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.detail || `Server error: ${res.status}`);
  }
  const envelope = await res.json();
  if (envelope && envelope.success === false) {
    throw new Error(envelope.error?.message || "Unknown API Error");
  }
  return envelope.data;
}

async function fetchAllPages(endpoint, pageSize) {
  const items = [];
  let page = 1;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const res = await fetch(`${API_BASE}${endpoint}${separator}page=${page}&page_size=${pageSize}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.detail || `Server error: ${res.status}`);
    }
    const envelope = await res.json();
    if (envelope.success === false) {
      throw new Error(envelope.error?.message || "Unknown API Error");
    }
    items.push(...(envelope.data || []));
    if (!envelope.meta || page >= envelope.meta.total_pages) return items;
    page += 1;
  }
}

export async function getModels() {
  const res = await fetch(`${API_BASE}/models/`);
  const data = await handleResponse(res);
  // Return the original format {"ollama": [...], "llama_cpp": [...]}
  return data.models_by_provider || {};
}

/**
 * Sends a chat or RAG request and returns an async generator that yields
 * parsed SSE events ({ token, done, error, status }).
 */
export async function sendChatStream(prompt, model, mode, conversationId, signal, images = null) {
  const endpoint = mode === "rag" ? "/rag/" : "/chat/";

  const body = {
    "query": prompt,
    "model": model,
    "conversation_id": conversationId,
    "images": images || []
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.detail || `Server error: ${res.status}`);
  }

  return res;
}

/**
 * Parses an SSE response body and yields parsed event objects.
 * Each yielded object can contain: { token, done, error, status }
 */
export async function* parseSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6); // Remove "data: " prefix
        try {
          const parsed = JSON.parse(jsonStr);
          yield parsed;
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          yield JSON.parse(trimmed.slice(6));
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function uploadFile(file, signal) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
    signal: signal,
  });
  return await handleResponse(res);
}

export async function fetchConversation() {
  return fetchAllPages("/conversations", 100);
}

export async function fetchMessages(conversationId) {
  return fetchAllPages(`/messages/${conversationId}`, 200);
}

export async function deleteMessage(messageId, conversationId = null) {
  const endpoint = conversationId
    ? `/conversations/${conversationId}/messages/${messageId}`
    : `/messages/${messageId}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.detail || `Server error: ${res.status}`);
  }
}

export async function createNewConversation() {
  const endpoint = "/conversations";
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "New Chat" }),
  });
  return await handleResponse(res);
}

export async function updateConversationTitle(conversationId, conversationTitle) {
  const endpoint = `/conversations/${conversationId}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: conversationTitle }),
  });
  return await handleResponse(res);
}

export async function deleteConversation(conversationId) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.detail || `Server error: ${res.status}`);
  }
}

export async function rollbackConversation(conversationId) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/rollback`, {
    method: "POST",
  });
  return await handleResponse(res);
}

export async function rollbackToMessage(conversationId, messageId) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/rollback-to/${messageId}`, {
    method: "POST",
  });
  return await handleResponse(res);
}

export async function clearAllConversations() {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "DELETE",
  });
  return await handleResponse(res);
}

export async function generateImage(prompt, model, conversationId) {
  const isGemini = (model || "").toLowerCase().includes("gemini") || (model || "").toLowerCase().includes("argon");
  const effectiveModel = isGemini ? model : "x/flux2-klein";
  const res = await fetch(`${API_BASE}/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model: effectiveModel, conversation_id: conversationId }),
  });
  return await handleResponse(res);
}
