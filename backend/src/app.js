import express from 'express';
import {
  errorHandler,
  malformedJsonHandler,
  notFoundHandler,
} from './middleware/error-handler.js';

export function createApp({ registerRoutes } = {}) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', function (request, response) {
    response.status(200).json({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  if (typeof registerRoutes === 'function') {
    registerRoutes(app);
  }

  app.use(malformedJsonHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
