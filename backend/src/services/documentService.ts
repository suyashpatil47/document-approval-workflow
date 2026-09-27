import { randomUUID } from 'node:crypto';
import {
  canTransition,
  type Document,
  type DocumentStatus,
  type ReviewDecision,
  type StoredFile,
} from '../domain/document.js';
import type { User } from '../domain/user.js';
import { AppError, forbidden, notFound, validationError } from '../errors.js';
import type { DocumentRepository } from '../repositories/documentRepository.js';

export interface SubmitInput {
  title: string;
  content?: string | null;
  file?: StoredFile | null;
}

export interface ReviewInput {
  decision: ReviewDecision;
  comment?: string | null;
}

export interface ListOptions {
  status?: DocumentStatus;
}

export interface DocumentServiceDeps {
  documents: DocumentRepository;
  now?: () => Date;
  generateId?: () => string;
}

/**
 * Business rules for the approval workflow. Transport-agnostic: takes an
 * authenticated user plus already-shape-validated input, and throws AppError.
 */
export class DocumentService {
  private readonly documents: DocumentRepository;
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor({ documents, now = () => new Date(), generateId = randomUUID }: DocumentServiceDeps) {
    this.documents = documents;
    this.now = now;
    this.generateId = generateId;
  }

  async submit(user: User, input: SubmitInput): Promise<Document> {
    if (user.role !== 'submitter') throw forbidden('Only submitters can submit documents');

    const content = input.content?.trim() || null;
    const file = input.file ?? null;
    if (!content && !file) {
      throw validationError('Provide text content, a file, or both', [
        { field: 'content', message: 'Either content or file is required' },
      ]);
    }

    const timestamp = this.now();
    return this.documents.create({
      id: this.generateId(),
      title: input.title.trim(),
      content,
      file,
      status: 'pending',
      submittedBy: user.id,
      submittedAt: timestamp,
      updatedAt: timestamp,
      review: null,
    });
  }

  /** Reviewers see every document; submitters only see their own. */
  async list(user: User, options: ListOptions = {}): Promise<Document[]> {
    const submittedBy = user.role === 'reviewer' ? undefined : user.id;
    return this.documents.list({ submittedBy, status: options.status });
  }

  async get(user: User, id: string): Promise<Document> {
    const doc = await this.documents.findById(id);
    // Same 404 for "missing" and "someone else's" so ids can't be probed.
    if (!doc || !this.canView(user, doc)) throw notFound('Document not found');
    return doc;
  }

  async review(user: User, id: string, input: ReviewInput): Promise<Document> {
    if (user.role !== 'reviewer') throw forbidden('Only reviewers can approve or reject documents');

    const doc = await this.get(user, id);
    if (!canTransition(doc.status, input.decision)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Document is already ${doc.status} and cannot be moved to ${input.decision}`,
      );
    }

    const comment = input.comment?.trim() || null;
    if (input.decision === 'rejected' && !comment) {
      throw validationError('A reason is required when rejecting a document', [
        { field: 'comment', message: 'Required when rejecting' },
      ]);
    }

    const timestamp = this.now();
    const updated = await this.documents.updateIfStatus(
      {
        ...doc,
        status: input.decision,
        updatedAt: timestamp,
        review: { reviewerId: user.id, decision: input.decision, comment, reviewedAt: timestamp },
      },
      doc.status,
    );
    if (!updated) {
      throw new AppError('INVALID_TRANSITION', 'Document was reviewed by someone else in the meantime');
    }
    return updated;
  }

  private canView(user: User, doc: Document): boolean {
    return user.role === 'reviewer' || doc.submittedBy === user.id;
  }
}
