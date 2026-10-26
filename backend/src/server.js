import app from './app.js';
import { config } from './config/env.js';

// Start the Express application.
const server = app.listen(config.port, function () {
  console.log(`Dinerring backend listening on port ${config.port}`);
});

// Graceful shutdown — close existing connections before exiting
let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down.`);

  server.close(function (error) {
    if (error) {
      console.error('Failed to close HTTP server:', error.message);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', function () {
  shutdown('SIGINT');
});
process.once('SIGTERM', function () {
  shutdown('SIGTERM');
});

// Handle startup errors, such as when the port is already in use.
server.on('error', function (error) {
  console.error('HTTP server error:', error.message);
  process.exitCode = 1;
});
