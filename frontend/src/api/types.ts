export type Role = 'submitter' | 'reviewer';
export type DocumentStatus = 'pending' | 'approved' | 'rejected';
export type ReviewDecision = Exclude<DocumentStatus, 'pending'>;

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface UserSummary {
  id: string;
  name: string;
}

export interface DocumentFile {
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Review {
  reviewer: UserSummary;
  decision: ReviewDecision;
  comment: string | null;
  reviewedAt: string;
}

export interface ApprovalDocument {
  id: string;
  title: string;
  content: string | null;
  file: DocumentFile | null;
  status: DocumentStatus;
  submittedBy: UserSummary;
  submittedAt: string;
  updatedAt: string;
  review: Review | null;
}

export interface FieldError {
  field: string;
  message: string;
}
