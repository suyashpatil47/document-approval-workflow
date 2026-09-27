import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { MAX_FILE_BYTES } from '../src/http/middleware/upload.js';

const as = (userId: string) => ({ 'X-User-Id': userId });
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('HTTP API', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
  });

  const submit = (userId = 'alice', body: Record<string, unknown> = { title: 'Budget', content: 'Q3' }) =>
    request(app).post('/api/documents').set(as(userId)).send(body);

  describe('auth', () => {
    it('lists demo users without auth', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body.data.map((u: { id: string }) => u.id)).toEqual(['alice', 'bob', 'rita']);
    });

    it('returns the current user from /api/me', async () => {
      const res = await request(app).get('/api/me').set(as('rita'));
      expect(res.body).toEqual({ id: 'rita', name: 'Rita (Reviewer)', role: 'reviewer' });
    });

    it('401s without the user header', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('401s for an unknown user', async () => {
      const res = await request(app).get('/api/documents').set(as('mallory'));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/documents', () => {
    it('creates a pending document from JSON', async () => {
      const res = await submit();
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/api/documents/${res.body.id}`);
      expect(res.body).toMatchObject({
        title: 'Budget',
        content: 'Q3',
        file: null,
        status: 'pending',
        submittedBy: { id: 'alice', name: 'Alice (Submitter)' },
        review: null,
      });
    });

    it('creates a document with a file via multipart and serves it back', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set(as('alice'))
        .field('title', 'Contract')
        .attach('file', Buffer.from('hello pdf'), { filename: 'contract.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBeNull();
      expect(res.body.file).toEqual({
        name: 'contract.pdf',
        mimeType: 'application/pdf',
        size: 9,
        url: `/api/documents/${res.body.id}/file`,
      });

      const download = await request(app).get(res.body.file.url).set(as('rita')).buffer(true);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('application/pdf');
      expect(download.headers['content-disposition']).toContain('contract.pdf');
      expect(Buffer.from(download.body).toString()).toBe('hello pdf');
    });

    it.each([
      [{ content: 'no title' }, 'title'],
      [{ title: '   ', content: 'blank title' }, 'title'],
      [{ title: 'x'.repeat(201), content: 'long title' }, 'title'],
      [{ title: 'ok', content: 'x'.repeat(20_001) }, 'content'],
      [{ title: 123, content: 'wrong type' }, 'title'],
    ])('400s on invalid payload %j', async (body, field) => {
      const res = await submit('alice', body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('400s when neither content nor file is provided', async () => {
      const res = await submit('alice', { title: 'Empty' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('content');
    });

    it('400s on malformed JSON', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set({ ...as('alice'), 'Content-Type': 'application/json' })
        .send('{"title":');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Malformed JSON body');
    });

    it('400s on a disallowed file type', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set(as('alice'))
        .field('title', 'Script')
        .attach('file', Buffer.from('echo hi'), { filename: 'x.sh', contentType: 'application/x-sh' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('file');
    });

    it('413s on a file over the size limit', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set(as('alice'))
        .field('title', 'Huge')
        .attach('file', Buffer.alloc(MAX_FILE_BYTES + 1), { filename: 'big.txt', contentType: 'text/plain' });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('403s when a reviewer tries to submit', async () => {
      const res = await submit('rita');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      await submit('alice', { title: 'A1', content: 'a' });
      await submit('bob', { title: 'B1', content: 'b' });
    });

    it('scopes submitters to their own documents', async () => {
      const res = await request(app).get('/api/documents').set(as('alice'));
      expect(res.status).toBe(200);
      expect(res.body.data.map((d: { title: string }) => d.title)).toEqual(['A1']);
    });

    it('shows reviewers all documents and filters by status', async () => {
      const all = await request(app).get('/api/documents').set(as('rita'));
      expect(all.body.data).toHaveLength(2);

      const pending = await request(app).get('/api/documents?status=pending').set(as('rita'));
      expect(pending.body.data).toHaveLength(2);

      const approved = await request(app).get('/api/documents?status=approved').set(as('rita'));
      expect(approved.body.data).toEqual([]);
    });

    it('400s on an unknown status filter', async () => {
      const res = await request(app).get('/api/documents?status=archived').set(as('rita'));
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('status');
    });
  });

  describe('GET /api/documents/:id', () => {
    it('returns the document to its owner and to reviewers', async () => {
      const { body: created } = await submit();
      expect((await request(app).get(`/api/documents/${created.id}`).set(as('alice'))).status).toBe(200);
      expect((await request(app).get(`/api/documents/${created.id}`).set(as('rita'))).status).toBe(200);
    });

    it("404s for another submitter's document", async () => {
      const { body: created } = await submit();
      const res = await request(app).get(`/api/documents/${created.id}`).set(as('bob'));
      expect(res.status).toBe(404);
    });

    it('400s on a malformed id and 404s on a missing one', async () => {
      expect((await request(app).get('/api/documents/not-a-uuid').set(as('rita'))).status).toBe(400);
      expect((await request(app).get(`/api/documents/${MISSING_ID}`).set(as('rita'))).status).toBe(404);
    });

    it('404s when downloading the file of a text-only document', async () => {
      const { body: created } = await submit();
      const res = await request(app).get(`/api/documents/${created.id}/file`).set(as('alice'));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/documents/:id/status', () => {
    const decide = (id: string, body: Record<string, unknown>, userId = 'rita') =>
      request(app).patch(`/api/documents/${id}/status`).set(as(userId)).send(body);

    it('approves, and the submitter sees the new status and review', async () => {
      const { body: created } = await submit();
      const res = await decide(created.id, { status: 'approved', comment: 'LGTM' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.review).toMatchObject({
        reviewer: { id: 'rita', name: 'Rita (Reviewer)' },
        decision: 'approved',
        comment: 'LGTM',
      });

      const seen = await request(app).get(`/api/documents/${created.id}`).set(as('alice'));
      expect(seen.body.status).toBe('approved');
    });

    it('rejects with a reason', async () => {
      const { body: created } = await submit();
      const res = await decide(created.id, { status: 'rejected', comment: 'Missing signature' });
      expect(res.status).toBe(200);
      expect(res.body.review.comment).toBe('Missing signature');
    });

    it('400s when rejecting without a reason', async () => {
      const { body: created } = await submit();
      const res = await decide(created.id, { status: 'rejected' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('comment');
    });

    it.each([{}, { status: 'pending' }, { status: 'APPROVED' }, { status: 42 }])(
      '400s on invalid status payload %j',
      async (body) => {
        const { body: created } = await submit();
        const res = await decide(created.id, body);
        expect(res.status).toBe(400);
        expect(res.body.error.details[0].field).toBe('status');
      },
    );

    it('409s when the document was already decided', async () => {
      const { body: created } = await submit();
      await decide(created.id, { status: 'approved' });
      const res = await decide(created.id, { status: 'rejected', comment: 'changed my mind' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('403s for submitters', async () => {
      const { body: created } = await submit();
      const res = await decide(created.id, { status: 'approved' }, 'alice');
      expect(res.status).toBe(403);
    });

    it('404s for a missing document', async () => {
      const res = await decide(MISSING_ID, { status: 'approved' });
      expect(res.status).toBe(404);
    });
  });

  it('404s on unknown routes with the error envelope', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
