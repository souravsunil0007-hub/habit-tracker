const { app, initializeDatabase } = require('../backend/server');

module.exports = async (request, response) => {
  if (request.url === '/' || request.url === '') {
    return response.status(200).json({ message: 'Habit Tracker API is running', version: '1.0.0' });
  }

  try {
    await initializeDatabase();
    return app(request, response);
  } catch (error) {
    console.error('Vercel API startup error:', error);
    return response.status(500).json({ message: 'API startup failed', error: error.message });
  }
};