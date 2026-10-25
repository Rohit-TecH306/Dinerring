import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import app from './app.js';
import { config } from './config/env.js';

export function startServer() {
  const server = createServer(app);
  let hasStarted = false;

  server.on('error', function (error) {
    console.error('HTTP server error:', error.message);
    if (!hasStarted) {
      process.exitCode = 1;
    }
  });

  server.listen(config.port, function () {
    hasStarted = true;
    console.log(`Dinerring backend listening on port ${config.port}`);
  });

  let isShuttingDown = false;
  const shutdown = function (signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Received ${signal}; shutting down.`);

    server.close(function (error) {
      if (error) {
        console.error('Failed to close HTTP server:', error.message);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', function () {
    shutdown('SIGINT');
  });
  process.once('SIGTERM', function () {
    shutdown('SIGTERM');
  });

  return server;
}

let isMainModule = false;

if (process.argv[1]) {
  isMainModule = fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(process.argv[1]));
}

if (isMainModule) {
  try {
    startServer();
  } catch (error) {
    console.error('Failed to start HTTP server:', error.message);
    process.exitCode = 1;
  }
}
