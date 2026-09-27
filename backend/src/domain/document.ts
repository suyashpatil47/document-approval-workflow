export const DOCUMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Statuses a reviewer can move a document into. */
export const REVIEW_DECISIONS = ['approved', 'rejected'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface StoredFile {
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export interface Review {
  reviewerId: string;
  decision: ReviewDecision;
  comment: string | null;
  reviewedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  content: string | null;
  file: StoredFile | null;
  status: DocumentStatus;
  submittedBy: string;
  submittedAt: Date;
  updatedAt: Date;
  review: Review | null;
}

/**
 * Allowed status transitions. Adding a new workflow step (e.g. "changes_requested",
 * or letting a submitter resubmit a rejected document) is a change to this map only.
 */
const TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
