const { app, initializeDatabase } = require('../backend/server');

module.exports = async (request, response) => {
  await initializeDatabase();
  return app(request, response);
};