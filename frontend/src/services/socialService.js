import { API_BASE } from '../lib/api.js';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.detail ?? `Erro ${res.status}` };
  }
  return res.json();
}

// ── Ranking ──────────────────────────────────────────────────
export const fetchGlobalRanking  = () => apiFetch('/social/ranking/global');
export const fetchFriendsRanking = () => apiFetch('/social/ranking/friends');
export const fetchRankingVisibility = () => apiFetch('/social/ranking/visibility');
export const setRankingVisibility = (visible) => apiFetch('/social/ranking/visibility', {
  method: 'POST',
  body: JSON.stringify({ visible })
});

// ── Busca de usuários ─────────────────────────────────────────
export const searchUsers = (q) => apiFetch(`/social/search?q=${encodeURIComponent(q)}`);

// ── Amigos ────────────────────────────────────────────────────
export const fetchFriends        = () => apiFetch('/social/friends');
export const fetchFriendRequests = () => apiFetch('/social/friends/requests');

export const sendFriendRequest = (username) =>
  apiFetch('/social/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });

export const acceptFriendRequest = (friendshipId) =>
  apiFetch(`/social/friends/accept/${friendshipId}`, { method: 'POST' });

export const removeFriend = (friendshipId) =>
  apiFetch(`/social/friends/${friendshipId}`, { method: 'DELETE' });

