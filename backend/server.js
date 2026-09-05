const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const habitRoutes = require('./routes/habitRoutes');
const completionRoutes = require('./routes/completionRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const yearlyStatisticsRoutes = require('./routes/yearlyStatisticsRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

if (process.env.CLIENT_URL) allowedOrigins.push(process.env.CLIENT_URL);

app.use(cors({
  origin: (origin, callback) => {
    let isLocalDevelopmentOrigin = false;
    if (origin) {
      try {
        const requestOrigin = new URL(origin);
        isLocalDevelopmentOrigin = requestOrigin.protocol === 'http:'
          && ['3000', '5500'].includes(requestOrigin.port);
      } catch (error) {
        isLocalDevelopmentOrigin = false;
      }
    }

    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Habit Tracker API is running',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/completions', completionRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/progress', statisticsRoutes);
app.use('/api/yearly-stats', yearlyStatisticsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

let databaseReady;
const initializeDatabase = () => {
  databaseReady = databaseReady || connectDB();
  return databaseReady;
};

if (require.main === module) {
  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = { app, initializeDatabase };
