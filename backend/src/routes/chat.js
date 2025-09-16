import { Router } from 'express';
import { chat, history } from '../controllers/chatController.js';
import { resetHistory } from '../services/redisClient.js';

const router = Router();

router.post('/chat', chat);
router.get('/history/:sessionId', history);
router.post('/reset/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await resetHistory(sessionId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset error', err);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

export default router;
