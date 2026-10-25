import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('backend application', function () {
  it('returns a successful health response', async function () {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });

  it('returns a consistent response for unknown routes', async function () {
    const response = await request(createApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    });
  });

  it('returns a client error for malformed JSON', async function () {
    const response = await request(createApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"incomplete":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains malformed JSON.',
      },
    });
  });

  it('handles unexpected errors without exposing internal details', async function () {
    const app = createApp({
      registerRoutes: function (instance) {
        instance.get('/test-error', function () {
          throw new Error('private implementation detail');
        });
      },
    });

    
    const response = await request(app).get('/test-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
      },
    });
    expect(response.text).not.toContain('private implementation detail');
  });
});
