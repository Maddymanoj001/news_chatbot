import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './utils/config.js';
import { fetchArticles } from './services/rssIngest.js';
import { embedTexts, embedText } from './services/embedder.js';
import { upsert, query as queryIndex, count as countIndex, reset as resetIndex } from './services/indexStore.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/ingest', async (req, res) => {
  try {
    const { max } = req.body || {};
    const articles = await fetchArticles(max || config.maxArticles);
    const texts = articles.map((a) => a.text);
    const vectors = await embedTexts(texts);
    const items = articles.map((a, i) => ({ id: a.id, text: a.text, source: a.source, vector: vectors[i] }));
    const result = upsert(items);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Ingest error', e);
    res.status(500).json({ error: 'Failed to ingest' });
  }
});

app.post('/query', async (req, res) => {
  try {
    const { query, k = 5 } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });
    const qVec = await embedText(query);
    const hits = queryIndex(qVec, k);
    res.json({ hits, usedModel: config.hf.apiKey ? config.hf.model : 'hash-fallback' });
  } catch (e) {
    console.error('Query error', e);
    res.status(500).json({ error: 'Failed to query' });
  }
});

app.post('/reset', async (_req, res) => {
  resetIndex();
  res.json({ ok: true });
});

app.get('/stats', (_req, res) => {
  res.json({ count: countIndex() });
});

app.listen(config.port, () => {
  console.log(`Vector service listening on http://localhost:${config.port}`);
});

// Optional auto-ingest on startup
const autoIngest = process.env.AUTO_INGEST === 'true';
if (autoIngest) {
  (async () => {
    try {
      console.log('[Vector Service] AUTO_INGEST enabled. Fetching and indexing articles...');
      const articles = await fetchArticles(config.maxArticles);
      const texts = articles.map((a) => a.text);
      const vectors = await embedTexts(texts);
      const items = articles.map((a, i) => ({ id: a.id, text: a.text, source: a.source, vector: vectors[i] }));
      const result = upsert(items);
      console.log(`[Vector Service] AUTO_INGEST completed: indexed ${result.count} items.`);
    } catch (err) {
      console.error('[Vector Service] AUTO_INGEST failed:', err?.response?.data || err.message || err);
    }
  })();
}
