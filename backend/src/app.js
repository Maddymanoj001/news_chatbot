import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './utils/config.js';
import chatRoutes from './routes/chat.js';

const app = express();
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://ragnewschatbot.netlify.app',
      'http://localhost:5173',
      'http://localhost:4000'
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/api', chatRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
