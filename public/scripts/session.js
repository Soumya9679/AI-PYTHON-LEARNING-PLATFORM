const SESSION_TOKEN_KEY = "pulsepy-dev-session";

function safeAccess(action, fallback = null) {
  try {
    return action();
  } catch (error) {
    console.warn("Session storage unavailable", error);
    return fallback;
  }
}

export function persistSessionToken(token) {
  if (!token) return;
  safeAccess(() => localStorage.setItem(SESSION_TOKEN_KEY, token));
}

export function clearSessionToken() {
  safeAccess(() => localStorage.removeItem(SESSION_TOKEN_KEY));
}

export function readSessionToken() {
  return safeAccess(() => localStorage.getItem(SESSION_TOKEN_KEY));
}

export function applyAuthHeaders(headers = {}) {
  const token = readSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
