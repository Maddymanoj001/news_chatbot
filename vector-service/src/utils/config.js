import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  maxArticles: parseInt(process.env.MAX_ARTICLES || '50', 10),
  hf: {
    apiKey: process.env.HF_API_KEY,
    model: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  },
};
