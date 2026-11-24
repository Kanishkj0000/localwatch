require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const issuesRoutes = require('./routes/issues.routes');

const app = express();
const PORT = process.env.PORT || 5001;

// Production security & request parsing
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
// 10MB payload limit so data URI previews work smoothly, but individual photos are checked <= 1MB in route
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root health check for deployment platforms (Railway / Render / Vercel)
app.get('/', (req, res) => {
  res.json({ status: 'healthy', message: 'LocalWatch API is running' });
});

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as current_time, PostGIS_Version() as postgis_version;');
    res.json({
      status: 'healthy',
      database: 'connected',
      postgis: result.rows[0].postgis_version,
      serverTime: result.rows[0].current_time,
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      message: err.message,
    });
  }
});

// Production API Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issuesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Start Server & verify database connection
const server = app.listen(PORT, async () => {
  console.log(`[LocalWatch API] Server listening on port ${PORT}`);
  try {
    const test = await db.query('SELECT current_database(), current_user, PostGIS_Version();');
    console.log(`[LocalWatch DB] Connected to Supabase PostgreSQL: ${test.rows[0].current_database} as ${test.rows[0].current_user}`);
    console.log(`[LocalWatch DB] PostGIS Version: ${test.rows[0].postgis_version}`);
  } catch (err) {
    console.error('[LocalWatch DB] Database connection failed:', err.message);
  }
});

module.exports = app;
