import axios from 'axios';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

export async function chat(sessionId, message, topK = 5) {
  const { data } = await axios.post(`${BASE}/chat`, { sessionId, message, topK });
  return data; // { answer, citations, usedModel }
}

export async function getHistory(sessionId) {
  const { data } = await axios.get(`${BASE}/history/${sessionId}`);
  return data; // { sessionId, messages }
}

export async function resetSession(sessionId) {
  const { data } = await axios.post(`${BASE}/reset/${sessionId}`);
  return data; // { ok: true }
}
