import type { Document } from '../domain/document.js';
import type { User } from '../domain/user.js';

export interface UserSummary {
  id: string;
  name: string;
}

export interface DocumentDto {
  id: string;
  title: string;
  content: string | null;
  file: { name: string; mimeType: string; size: number; url: string } | null;
  status: Document['status'];
  submittedBy: UserSummary;
  submittedAt: string;
  updatedAt: string;
  review: {
    reviewer: UserSummary;
    decision: 'approved' | 'rejected';
    comment: string | null;
    reviewedAt: string;
  } | null;
}

type UserLookup = (id: string) => User | undefined;

const summarize = (id: string, lookup: UserLookup): UserSummary => ({
  id,
  name: lookup(id)?.name ?? id,
});

/** Public shape of a document: resolves user names and never leaks raw file bytes. */
export function toDocumentDto(doc: Document, lookup: UserLookup): DocumentDto {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    file: doc.file && {
      name: doc.file.originalName,
      mimeType: doc.file.mimeType,
      size: doc.file.size,
      url: `/api/documents/${doc.id}/file`,
    },
    status: doc.status,
    submittedBy: summarize(doc.submittedBy, lookup),
    submittedAt: doc.submittedAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    review: doc.review && {
      reviewer: summarize(doc.review.reviewerId, lookup),
      decision: doc.review.decision,
      comment: doc.review.comment,
      reviewedAt: doc.review.reviewedAt.toISOString(),
    },
  };
}
