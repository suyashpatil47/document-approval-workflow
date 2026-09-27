import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../src/domain/user.js';
import { AppError } from '../src/errors.js';
import { InMemoryDocumentRepository } from '../src/repositories/documentRepository.js';
import { DocumentService } from '../src/services/documentService.js';

const alice: User = { id: 'alice', name: 'Alice', role: 'submitter' };
const bob: User = { id: 'bob', name: 'Bob', role: 'submitter' };
const rita: User = { id: 'rita', name: 'Rita', role: 'reviewer' };
const ron: User = { id: 'ron', name: 'Ron', role: 'reviewer' };

const expectAppError = async (promise: Promise<unknown>, code: AppError['code']) => {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
};

describe('DocumentService', () => {
  let repo: InMemoryDocumentRepository;
  let service: DocumentService;
  let clock: number;
  let seq: number;

  beforeEach(() => {
    repo = new InMemoryDocumentRepository();
    clock = Date.UTC(2026, 0, 1);
    seq = 0;
    service = new DocumentService({
      documents: repo,
      now: () => new Date((clock += 1000)),
      generateId: () => `doc-${++seq}`,
    });
  });

  describe('submit', () => {
    it('creates a pending document owned by the submitter, trimming input', async () => {
      const doc = await service.submit(alice, { title: '  Budget  ', content: '  Q3 numbers ' });
      expect(doc).toMatchObject({
        id: 'doc-1',
        title: 'Budget',
        content: 'Q3 numbers',
        status: 'pending',
        submittedBy: 'alice',
        review: null,
      });
    });

    it('accepts a file without text content', async () => {
      const file = { originalName: 'a.pdf', mimeType: 'application/pdf', size: 3, data: Buffer.from('abc') };
      const doc = await service.submit(alice, { title: 'Contract', file });
      expect(doc.content).toBeNull();
      expect(doc.file?.originalName).toBe('a.pdf');
    });

    it('rejects a submission with neither content nor file', async () => {
      await expectAppError(service.submit(alice, { title: 'Empty', content: '   ' }), 'VALIDATION_ERROR');
    });

    it('forbids reviewers from submitting', async () => {
      await expectAppError(service.submit(rita, { title: 'x', content: 'y' }), 'FORBIDDEN');
    });
  });

  describe('list and get', () => {
    beforeEach(async () => {
      await service.submit(alice, { title: 'A1', content: 'a' });
      await service.submit(bob, { title: 'B1', content: 'b' });
      await service.submit(alice, { title: 'A2', content: 'a' });
    });

    it('shows submitters only their own documents, newest first', async () => {
      const docs = await service.list(alice);
      expect(docs.map((d) => d.title)).toEqual(['A2', 'A1']);
    });

    it('shows reviewers every document', async () => {
      expect(await service.list(rita)).toHaveLength(3);
    });

    it('filters by status', async () => {
      await service.review(rita, 'doc-1', { decision: 'approved' });
      expect((await service.list(rita, { status: 'pending' })).map((d) => d.id)).toEqual(['doc-3', 'doc-2']);
      expect((await service.list(alice, { status: 'approved' })).map((d) => d.id)).toEqual(['doc-1']);
    });

    it("returns NOT_FOUND for another submitter's document", async () => {
      await expectAppError(service.get(bob, 'doc-1'), 'NOT_FOUND');
    });

    it('returns NOT_FOUND for a missing id', async () => {
      await expectAppError(service.get(rita, 'nope'), 'NOT_FOUND');
    });
  });

  describe('review', () => {
    beforeEach(async () => {
      await service.submit(alice, { title: 'A1', content: 'a' });
    });

    it('approves a pending document and records the review', async () => {
      const doc = await service.review(rita, 'doc-1', { decision: 'approved', comment: ' looks good ' });
      expect(doc.status).toBe('approved');
      expect(doc.review).toMatchObject({ reviewerId: 'rita', decision: 'approved', comment: 'looks good' });
      expect(doc.updatedAt.getTime()).toBeGreaterThan(doc.submittedAt.getTime());
      expect((await service.get(alice, 'doc-1')).status).toBe('approved');
    });

    it('approves without a comment', async () => {
      const doc = await service.review(rita, 'doc-1', { decision: 'approved' });
      expect(doc.review?.comment).toBeNull();
    });

    it('rejects with a reason', async () => {
      const doc = await service.review(rita, 'doc-1', { decision: 'rejected', comment: 'Missing signature' });
      expect(doc.status).toBe('rejected');
      expect(doc.review?.comment).toBe('Missing signature');
    });

    it('requires a reason to reject', async () => {
      await expectAppError(service.review(rita, 'doc-1', { decision: 'rejected', comment: '  ' }), 'VALIDATION_ERROR');
      expect((await service.get(rita, 'doc-1')).status).toBe('pending');
    });

    it('forbids submitters from reviewing, even their own document', async () => {
      await expectAppError(service.review(alice, 'doc-1', { decision: 'approved' }), 'FORBIDDEN');
    });

    it('refuses to re-review a decided document', async () => {
      await service.review(rita, 'doc-1', { decision: 'approved' });
      await expectAppError(service.review(rita, 'doc-1', { decision: 'rejected', comment: 'x' }), 'INVALID_TRANSITION');
      await expectAppError(service.review(rita, 'doc-1', { decision: 'approved' }), 'INVALID_TRANSITION');
    });

    it('lets only one of two concurrent reviews win', async () => {
      const results = await Promise.allSettled([
        service.review(rita, 'doc-1', { decision: 'approved' }),
        service.review(ron, 'doc-1', { decision: 'rejected', comment: 'no' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((failure.reason as AppError).code).toBe('INVALID_TRANSITION');
    });

    it('returns NOT_FOUND for a missing document', async () => {
      await expectAppError(service.review(rita, 'missing', { decision: 'approved' }), 'NOT_FOUND');
    });
  });

  it('does not let callers mutate stored documents through returned objects', async () => {
    const doc = await service.submit(alice, { title: 'A1', content: 'a' });
    doc.status = 'approved';
    expect((await service.get(alice, 'doc-1')).status).toBe('pending');
  });
});
