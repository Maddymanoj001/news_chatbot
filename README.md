# RAG-Powered News Chatbot (Node.js)

A full-stack RAG chatbot that answers questions about recent news using RSS ingestion, vector search, and Gemini for generation.

- News ingestion: Reuters, BBC via RSS
- Embeddings: Jina Embeddings API (with hash-based fallback)
- Vector store: FAISS via `faiss-node` (optional) with in-memory cosine fallback
- Backend: Node.js/Express
- Session storage: Redis with TTL
- Frontend: React + SCSS (Vite)
- Deployment: Backend on Render, Frontend on Vercel

## Project Structure

```
rag-news-chatbot/
├─ backend/
│  ├─ .env.example
│  ├─ package.json
│  └─ src/
│     ├─ app.js
│     ├─ controllers/
│     │  └─ chatController.js
│     ├─ routes/
│     │  └─ chat.js
│     ├─ services/
│     │  ├─ redisClient.js
│     │  └─ vectorClient.js
│     └─ utils/
│        └─ config.js
├─ vector-service/
│  ├─ .env.example
│  ├─ package.json
│  └─ src/
│     ├─ app.js
│     ├─ services/
│     │  ├─ embedder.js
│     │  ├─ indexStore.js
│     │  └─ rssIngest.js
│     └─ utils/
│        └─ config.js
└─ frontend/
   ├─ .env.example
   ├─ index.html
   ├─ package.json
   ├─ vite.config.js
   └─ src/
      ├─ App.jsx
      ├─ main.jsx
      ├─ services/
      │  └─ api.js
      └─ styles/
         └─ main.scss
```

## Environment Variables

Copy each `.env.example` to `.env` and fill in values.

- Backend `backend/.env`:
```
PORT=4000
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
REDIS_URL=redis://localhost:6379
SESSION_TTL_SECONDS=86400
VECTOR_SERVICE_URL=http://localhost:5001
```

- Vector Service `vector-service/.env`:
```
PORT=5001
JINA_API_KEY=your_jina_api_key_here
JINA_EMBEDDING_MODEL=jina-embeddings-v2-base-en
MAX_ARTICLES=50
AUTO_INGEST=false
```

- Frontend `frontend/.env`:
```
VITE_BACKEND_URL=http://localhost:4000/api
```

Notes:
- If `JINA_API_KEY` is not set, a deterministic hash-based embedding is used (suitable for testing, lower quality).
- If `AUTO_INGEST=true`, vector-service will fetch and index news on startup.

## Install & Run (Local)

Run each in separate terminals:

1) Vector Service
- Install deps: `npm install`
- Ingest on-demand: `POST http://localhost:5001/ingest`

2) Backend API
- Install deps: `npm install`

3) Frontend
- Install deps: `npm install`

Example commands:
```
# Vector service
cd rag-news-chatbot/vector-service
npm install
npm run dev
# then in another terminal, ingest ~50 articles
curl -X POST http://localhost:5001/ingest -H "Content-Type: application/json" -d '{"max":50}'

# Backend
cd rag-news-chatbot/backend
npm install
npm run dev

# Frontend
cd rag-news-chatbot/frontend
npm install
npm run dev
```

Open the UI at http://localhost:5173.

## API Design

Base path: `http://localhost:4000/api`

- POST `/chat`
Request:
```json
{
  "sessionId": "uuid-string",
  "message": "What happened in markets today?",
  "topK": 5
}
```
Response:
```json
{
  "answer": "Markets rallied today... [#1] [#2]",
  "citations": [
    { "index": 1, "source": "https://www.reuters.com/..." },
    { "index": 2, "source": "https://www.bbc.com/..." }
  ],
  "usedModel": "jina-embeddings-v2-base-en"
}
```

- GET `/history/:sessionId`
Response:
```json
{
  "sessionId": "uuid-string",
  "messages": [
    { "role": "user", "content": "...", "ts": 1710000000000 },
    { "role": "assistant", "content": "...", "ts": 1710000001000 }
  ]
}
```

- POST `/reset/:sessionId`
Response:
```json
{ "ok": true }
```

Vector Service (internal): `http://localhost:5001`
- POST `/ingest` { "max": 50 } → fetch RSS, embed, index
- POST `/query` { "query": "text", "k": 5 } → return top-k hits
- POST `/reset` → clear index
- GET `/stats` → { count }

## End-to-End Flow

1. Ingestion
- `vector-service/src/services/rssIngest.js` fetches ~50 items from Reuters/BBC RSS feeds.
- Each item is converted to a textual blob of `title + snippet + link`.

2. Embedding
- `vector-service/src/services/embedder.js` calls Jina Embeddings API (or hash fallback) to embed each article.

3. Indexing
- `vector-service/src/services/indexStore.js` stores vectors.
- If `faiss-node` is available, uses FAISS `IndexFlatIP` for cosine search. Otherwise, uses in-memory cosine search.

4. Retrieval
- Backend `/chat` uses `vectorClient.js` to call `vector-service` `/query` for top-k passages.

5. Generation
- Backend `chatController.js` builds a prompt with citations and calls Gemini via `@google/generative-ai` to generate the response.

6. Session History
- Stored in Redis with TTL (see `backend/src/services/redisClient.js`). `/history/:sessionId` returns messages; `/reset/:sessionId` clears them.

7. Frontend UI
- `frontend/src/App.jsx` renders chat interface with typed-out bot responses and Reset button.

## Optional: FAISS Setup

`vector-service/package.json` lists `faiss-node` as an optional dependency. If your system supports it:

```
cd rag-news-chatbot/vector-service
npm install faiss-node
```

On first upsert, the service normalizes vectors and will use FAISS for faster search. If FAISS operations fail, the code falls back to in-memory search gracefully.

## Deployment Notes

- Backend (Render)
  - Node 18+ runtime.
  - Start command: `npm start`
  - Env vars: copy from `backend/.env.example`.
  - Allow outbound HTTP requests to `vector-service` if self-hosted.

- Vector Service (Render/another host)
  - Node 18+ runtime.
  - Start command: `npm start`
  - Env vars: copy from `vector-service/.env.example`.
  - For periodic refresh, consider `AUTO_INGEST=true` and a cron job for `/ingest`.

- Frontend (Vercel)
  - Build command: `npm run build`
  - Output: Vite default
  - Env `VITE_BACKEND_URL` pointing to your deployed backend `/api`

## Troubleshooting

- No results returned: ensure you've run ingestion (`/ingest`) or enabled `AUTO_INGEST`.
- 500 on `/chat`: verify `GEMINI_API_KEY` is set and valid.
- Redis errors: check `REDIS_URL` and that your Redis instance is running.
- CORS: set `CORS_ORIGIN` in backend `.env` to your frontend origin.
