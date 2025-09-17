import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxArticles: parseInt(process.env.MAX_ARTICLES || '50', 10),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  },
  hf: {
    apiKey: process.env.HF_API_KEY,
    model: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  },
  redisUrl: process.env.REDIS_URL,
  redisUsername: process.env.REDIS_USERNAME,
  redisPassword: process.env.REDIS_PASSWORD,
  sessionTTL: parseInt(process.env.SESSION_TTL_SECONDS || '86400', 10),
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL || 'http://localhost:5001'
};
