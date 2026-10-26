import express from 'express';
import {
  errorHandler,
  malformedJsonHandler,
  notFoundHandler,
} from './middleware/error-handler.js';

const app = express();

// Parse incoming JSON request bodies (up to 100kb)
app.use(express.json({ limit: '100kb' }));

// Health-check endpoint
app.get('/health', function (request, response) {
  response.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});

// Error-handling middleware — must come after all routes
app.use(malformedJsonHandler);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
