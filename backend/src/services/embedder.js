import axios from 'axios';
import { config } from '../utils/config.js';

function simpleHashEmbed(text, dims = 384) {
  // Fallback deterministic embedding based on hashing tokens
  const vec = new Array(dims).fill(0);
  const tokens = (text || '').toLowerCase().split(/\W+/).filter(Boolean);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const idx = Math.abs(h) % dims;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function averageVectors(matrix) {
  // If matrix is 2D (tokens x dims), average across tokens into a single sentence vector
  if (!Array.isArray(matrix) || matrix.length === 0) return [];
  if (!Array.isArray(matrix[0])) return matrix; // already 1D vector
  const dims = matrix[0].length;
  const out = new Array(dims).fill(0);
  for (const row of matrix) {
    for (let i = 0; i < dims; i++) out[i] += row[i] || 0;
  }
  const n = matrix.length || 1;
  for (let i = 0; i < dims; i++) out[i] /= n;
  // normalize
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

export async function embedTexts(texts) {
  // Prefer Hugging Face if configured
  if (config.hf.apiKey) {
    try {
      const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(config.hf.model)}`;
      const { data } = await axios.post(
        url,
        texts, // HF API accepts an array of strings for batch feature-extraction
        {
          headers: {
            Authorization: `Bearer ${config.hf.apiKey}`,
            'Content-Type': 'application/json'
          },
          params: { wait_for_model: 'true' },
          timeout: 45000
        }
      );
      // data can be: number[] (single), number[][] (single 2D), or number[][][] (batch of 2D)
      // Normalize to array of 1D vectors
      if (Array.isArray(texts) && texts.length === 1 && Array.isArray(data)) {
        // Single input
        const vec = Array.isArray(data[0]) ? averageVectors(data) : data;
        return [vec];
      }
      if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
        // Batch of 2D matrices
        return data.map((m) => averageVectors(m));
      }
      if (Array.isArray(data) && Array.isArray(data[0])) {
        // Batch of 1D vectors
        return data;
      }
      // Unexpected shape
      console.warn('HF embed: unexpected response shape, using fallback');
      return texts.map((t) => simpleHashEmbed(t));
    } catch (e) {
      console.error('HF embed error, using fallback:', e.response?.data || e.message);
      return texts.map((t) => simpleHashEmbed(t));
    }
  }

  // If HF not configured, use deterministic hash fallback for development
  return texts.map((t) => simpleHashEmbed(t));
}

export async function embedText(text) {
  const arr = await embedTexts([text]);
  return arr[0];
}
