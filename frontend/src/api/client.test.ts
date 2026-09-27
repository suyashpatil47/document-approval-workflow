import { describe, expect, it } from 'vitest';
import { apiError, headerOf, json, mockFetch } from '../test/fetchMock';
import { ApiError, requestJson, setCurrentUserId } from './client';

describe('api client', () => {
  it('sends the current user header and JSON content type', async () => {
    const fetchMock = mockFetch({ 'POST /api/x': () => json({ ok: true }) });
    setCurrentUserId('alice');
    await expect(requestJson('/api/x', { method: 'POST', body: '{}' })).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1]!;
    expect(headerOf(init, 'X-User-Id')).toBe('alice');
    expect(headerOf(init, 'Content-Type')).toBe('application/json');
  });

  it('turns the error envelope into an ApiError with field errors', async () => {
    mockFetch({
      'GET /api/x': () => apiError(400, 'VALIDATION_ERROR', 'Invalid request', [{ field: 'title', message: 'Required' }]),
    });
    const err = (await requestJson('/api/x').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request' });
    expect(err.fieldErrors()).toEqual({ title: 'Required' });
  });

  it('handles non-JSON error bodies', async () => {
    mockFetch({ 'GET /api/x': () => new Response('Bad gateway', { status: 502 }) });
    await expect(requestJson('/api/x')).rejects.toMatchObject({ status: 502, message: 'Request failed (502)' });
  });

  it('reports network failures clearly', async () => {
    mockFetch({
      'GET /api/x': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(requestJson('/api/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
