export function malformedJsonHandler(error, request, response, next) {
  if (error && error.type === 'entity.parse.failed') {
    return response.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains malformed JSON.',
      },
    });
  }
  return next(error);
}

export function notFoundHandler(request, response) {
  response.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found.',
    },
  });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  let statusCode = 500;

  if (error && Number.isInteger(error.statusCode) && error.statusCode >= 400) {
    statusCode = error.statusCode;
  }

  const isClientError = statusCode < 500;
  let errorCode = 'INTERNAL_ERROR';
  let errorMessage = 'Internal server error.';

  if (isClientError) {
    errorCode = error.code || 'REQUEST_ERROR';
    errorMessage = error.message || 'Request could not be completed.';
  }

  return response.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
    },
  });
}
