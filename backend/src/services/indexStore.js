// Vector store with optional FAISS (faiss-node) backend.
// Falls back to an in-memory cosine-similarity store when FAISS is not available.

let vectors = []; // number[][] (normalized)
let metas = [];   // { id, text, source }
let dim = null;
let faiss = null;
let faissIndex = null; // IndexFlatIP when available

function l2norm(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // since vectors are normalized
}

async function ensureFaiss() {
  if (faiss !== null) return !!faissIndex; // already attempted
  try {
    faiss = await import('faiss-node');
  } catch (_) {
    faiss = undefined;
  }
  return false;
}

export function reset() {
  vectors = [];
  metas = [];
  dim = null;
  faissIndex = null;
}

export function upsert(items) {
  if (!items?.length) return { count: 0 };
  if (!dim) dim = items[0].vector.length;

  // Normalize vectors for cosine similarity (IP on unit vectors == cosine)
  const normalized = items
    .filter((it) => Array.isArray(it.vector))
    .map((it) => ({ ...it, vector: l2norm(it.vector) }));

  // Try FAISS path if available
  const useFaiss = !!faiss && faissIndex !== null;
  if (useFaiss) {
    try {
      const flat = new Float32Array(normalized.length * dim);
      for (let i = 0; i < normalized.length; i++) {
        flat.set(normalized[i].vector, i * dim);
      }
      faissIndex.add(flat);
      for (const it of normalized) metas.push({ id: it.id, text: it.text, source: it.source });
      return { count: normalized.length, dim, backend: 'faiss' };
    } catch (e) {
      // If FAISS fails, drop to memory store for this batch
      console.warn('FAISS add failed. Falling back to memory store.', e.message || e);
    }
  }

  // Memory fallback
  for (const it of normalized) {
    vectors.push(it.vector);
    metas.push({ id: it.id, text: it.text, source: it.source });
  }
  return { count: normalized.length, dim, backend: 'memory' };
}

export function count() {
  return metas.length;
}

export function query(vec, k = 5) {
  if (!metas.length) return [];
  const q = l2norm(vec);
  if (faissIndex) {
    try {
      const qArr = new Float32Array(q);
      const res = faissIndex.search(qArr, k);
      const out = [];
      for (let i = 0; i < res.labels.length; i++) {
        const idx = res.labels[i];
        if (idx < 0 || idx >= metas.length) continue;
        out.push({ ...metas[idx], score: res.distances[i] });
      }
      return out;
    } catch (e) {
      console.warn('FAISS search failed, using memory store.', e.message || e);
    }
  }

  // Memory search
  const scores = vectors.map((v, idx) => ({ idx, score: cosine(q, v) }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k).map(({ idx, score }) => ({ ...metas[idx], score }));
}

// Initialize FAISS index lazily based on first dimension and env
(async () => {
  try {
    await ensureFaiss();
    if (faiss && dim) {
      faissIndex = new faiss.IndexFlatIP(dim);
    }
  } catch (_) {
    // ignore
  }
})();
