import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './utils/config.js';
import chatRoutes from './routes/chat.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/api', chatRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
