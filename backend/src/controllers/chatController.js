import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../utils/config.js';
import { pushMessage, getHistory } from '../services/redisClient.js';
import { querySimilar } from '../services/vectorClient.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel({ model: config.gemini.model });

const buildPrompt = (query, contexts) => {
  const contextText = contexts
    .map((c, idx) => `[#${idx + 1}] ${c.text}\nSource: ${c.source}`)
    .join('\n\n');
  return `You are a helpful news assistant that provides well-structured answers based on the provided context.

Context:
${contextText}

Instructions:
- Answer the user's question using only the provided context
- Structure your response with clear headings and bullet points when appropriate
- Use citations like [#1], [#2] to reference specific sources
- If the context doesn't contain enough information, say so clearly
- Keep your answer concise but informative

Question: ${query}

Please provide a well-structured response:`;
};

export const chat = async (req, res) => {
  try {
    const { sessionId, message, topK = 5 } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    if (!config.gemini.apiKey) {
      const msg = 'GEMINI_API_KEY is not set in backend environment.';
      console.error('[Chat] Config error:', msg);
      return res.status(500).json({ error: msg });
    }

    await pushMessage(sessionId, 'user', message);

    let retrieval;
    let retrievalWarning = undefined;
    try {
      retrieval = await querySimilar({ query: message, k: topK });
    } catch (e) {
      const detail = e?.response?.data || e?.message || String(e);
      console.error('[Chat] Retrieval error (continuing with empty context):', detail);
      retrieval = { hits: [], usedModel: 'none' };
      retrievalWarning = process.env.NODE_ENV === 'development'
        ? `Retrieval failed, used empty context: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
        : 'Retrieval failed, used empty context';
    }

    const prompt = buildPrompt(message, retrieval.hits || []);
    let text;
    try {
      const result = await model.generateContent(prompt);
      text = result.response.text();
    } catch (e) {
      const detail = e?.response?.data || e?.message || String(e);
      console.error('[Chat] Gemini error:', detail);
      const errMsg = process.env.NODE_ENV === 'development'
        ? `Gemini error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
        : 'Failed to generate answer';
      return res.status(502).json({ error: errMsg });
    }

    await pushMessage(sessionId, 'assistant', text);

    return res.json({
      answer: text,
      citations: retrieval.hits?.map((h, i) => ({ index: i + 1, source: h.source })) || [],
      usedModel: retrieval.usedModel,
      retrievalWarning,
    });
  } catch (err) {
    const detail = err?.response?.data || err?.message || String(err);
    console.error('[Chat] Unexpected error:', detail);
    const errMsg = process.env.NODE_ENV === 'development'
      ? `Unexpected error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
      : 'Internal server error';
    return res.status(500).json({ error: errMsg });
  }
};

export const history = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const items = await getHistory(sessionId);
    return res.json({ sessionId, messages: items });
  } catch (err) {
    console.error('History error', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
};
