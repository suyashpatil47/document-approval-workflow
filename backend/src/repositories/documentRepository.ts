import type { Document, DocumentStatus } from '../domain/document.js';

export interface DocumentFilter {
  submittedBy?: string;
  status?: DocumentStatus;
}

/**
 * Storage port. The in-memory implementation below is the only one today; a
 * SQL-backed version would implement the same interface without touching the service.
 */
export interface DocumentRepository {
  create(doc: Document): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  list(filter?: DocumentFilter): Promise<Document[]>;
  /**
   * Compare-and-set: persists `doc` only if the stored status still equals
   * `expectedStatus`. Returns null when it has changed (a concurrent review won).
   */
  updateIfStatus(doc: Document, expectedStatus: DocumentStatus): Promise<Document | null>;
}

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly docs = new Map<string, Document>();

  async create(doc: Document): Promise<Document> {
    this.docs.set(doc.id, structuredClone(doc));
    return structuredClone(doc);
  }

  async findById(id: string): Promise<Document | null> {
    const doc = this.docs.get(id);
    return doc ? structuredClone(doc) : null;
  }

  async list(filter: DocumentFilter = {}): Promise<Document[]> {
    return [...this.docs.values()]
      .filter((d) => !filter.submittedBy || d.submittedBy === filter.submittedBy)
      .filter((d) => !filter.status || d.status === filter.status)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      .map((d) => structuredClone(d));
  }

  async updateIfStatus(doc: Document, expectedStatus: DocumentStatus): Promise<Document | null> {
    const current = this.docs.get(doc.id);
    if (!current || current.status !== expectedStatus) return null;
    this.docs.set(doc.id, structuredClone(doc));
    return structuredClone(doc);
  }
}
