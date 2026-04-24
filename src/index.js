import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import { connectDB } from './config/db.js';
import { initializeScheduler } from './utils/scheduler.js';

import authRoutes from './routes/auth.js';
import opportunityRoutes from './routes/opportunities.js';
import applicationRoutes, { paystackWebhookHandler } from './routes/applications.js';
import profileRoutes from './routes/profile.js';
import dashboardRoutes from './routes/dashboard.js';
import messageRoutes from './routes/messages.js';

import { notFound, errorHandler } from './middleware/error.js';

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------------- SECURITY & PERFORMANCE ---------------------- */

// Trust AWS load balancer
app.set('trust proxy', 1);

// Compression (VERY important for speed)
app.use(compression());

// Body limits (prevents crashes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ---------------------- CORS CONFIG ---------------------- */

const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

/* ---------------------- RATE LIMITING ---------------------- */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

/* ---------------------- WEBHOOK (RAW BODY MUST COME FIRST) ---------------------- */

app.post(
  '/api/applications/paystack-webhook',
  express.raw({ type: 'application/json' }),
  paystackWebhookHandler
);

/* ---------------------- ROUTES ---------------------- */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messageRoutes);

/* ---------------------- ERROR HANDLING ---------------------- */

app.use(notFound);
app.use(errorHandler);

/* ---------------------- DB + SERVER START ---------------------- */

const startServer = async () => {
  try {
    await connectDB();

    // IMPORTANT: avoid duplicate scheduler runs in AWS scaling
    if (process.env.NODE_ENV !== 'production') {
      initializeScheduler();
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
};

startServer();