const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/habit-tracker';

  try {
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Primary MongoDB connection failed: ${error.message}`);
    console.warn('Starting the persistent local database fallback. Data is stored under backend/data/mongodb.');

    try {
      const dbPath = path.join(__dirname, '..', 'data', 'mongodb');
      fs.mkdirSync(dbPath, { recursive: true });
      const memoryServer = await MongoMemoryServer.create({ instance: { dbPath } });
      const conn = await mongoose.connect(memoryServer.getUri(), {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log(`Persistent local MongoDB connected: ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`Persistent MongoDB fallback failed: ${fallbackError.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
