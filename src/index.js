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

/* ---------------------- PORT (IMPORTANT FOR EB) ---------------------- */
const PORT = process.env.PORT;

/* ---------------------- SECURITY & PERFORMANCE ---------------------- */
app.set('trust proxy', 1);
app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ---------------------- CORS CONFIG ---------------------- */
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL || 'https://careerstart.com'
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
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
}));

app.use('/api/auth/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
}));

/* ---------------------- WEBHOOK ---------------------- */
app.post(
  '/api/applications/paystack-webhook',
  express.raw({ type: 'application/json' }),
  paystackWebhookHandler
);

/* ---------------------- ROUTES ---------------------- */
/* Root path for ELB health check */
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

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

/* ---------------------- START SERVER ---------------------- */
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected");

    if (process.env.NODE_ENV === 'development') {
      initializeScheduler();
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
};

startServer();