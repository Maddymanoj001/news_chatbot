import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import chatRoutes from './routes/chat.js'; // Adjust the import path as needed
import { fetchArticles } from './services/rssIngest.js';
import { embedTexts, embedText } from './services/embedder.js';
import { upsert, query as queryIndex, count as countIndex, reset as resetIndex } from './services/indexStore.js';

const app = express();

import { config } from './utils/config.js';

// CORS configuration
const allowedOrigins = config.corsOrigin
  ? config.corsOrigin.split(',').map(origin => origin.trim())
  : ['http://localhost:5173']; // Default fallback

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowedOrigin => {
      const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
      const normalizedAllowed = allowedOrigin.endsWith('/') ? allowedOrigin.slice(0, -1) : allowedOrigin;
      return normalizedOrigin === normalizedAllowed;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api', chatRoutes);

// Vector service routes
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

// Health check endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Optional auto-ingest on startup
const autoIngest = process.env.AUTO_INGEST === 'true';
if (autoIngest) {
  (async () => {
    try {
      console.log('[Backend] AUTO_INGEST enabled. Fetching and indexing articles...');
      const articles = await fetchArticles(config.maxArticles);
      const texts = articles.map((a) => a.text);
      const vectors = await embedTexts(texts);
      const items = articles.map((a, i) => ({ id: a.id, text: a.text, source: a.source, vector: vectors[i] }));
      const result = upsert(items);
      console.log(`[Backend] AUTO_INGEST completed: indexed ${result.count} items.`);
    } catch (err) {
      console.error('[Backend] AUTO_INGEST failed:', err?.response?.data || err.message || err);
    }
  })();
}

export default app;