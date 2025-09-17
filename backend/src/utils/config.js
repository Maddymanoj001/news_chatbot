import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  },
  redisUrl: process.env.REDIS_URL,
  redisUsername: process.env.REDIS_USERNAME,
  redisPassword: process.env.REDIS_PASSWORD,
  sessionTTL: parseInt(process.env.SESSION_TTL_SECONDS || '86400', 10),
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL || 'http://localhost:5001'
};
