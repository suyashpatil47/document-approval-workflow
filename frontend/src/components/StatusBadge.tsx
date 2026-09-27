import type { DocumentStatus } from '../api/types';

const LABELS: Record<DocumentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <span className={`badge badge--${status}`}>{LABELS[status]}</span>;
}
