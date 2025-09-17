import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import chatRoutes from './routes/chat.js'; // Adjust the import path as needed

const app = express();

// CORS configuration
const allowedOrigins = [
  'https://ragnewschatbot.netlify.app',
  'http://localhost:5173',
  'http://localhost:4000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowedOrigin => 
      origin === allowedOrigin || 
      origin.replace(/\\/$/, '') === allowedOrigin
    )) {
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

// Health check endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

export default app;