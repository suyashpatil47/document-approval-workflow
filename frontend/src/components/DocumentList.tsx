import type { ReactNode } from 'react';
import type { ApprovalDocument } from '../api/types';
import { ErrorMessage } from './ErrorMessage';

interface Props {
  documents: ApprovalDocument[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  emptyMessage: string;
  renderItem: (doc: ApprovalDocument) => ReactNode;
}

/** Shared loading / error / empty handling for document lists. */
export function DocumentList({ documents, loading, error, onRetry, emptyMessage, renderItem }: Props) {
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
  if (loading && documents.length === 0) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }
  if (documents.length === 0) return <p className="empty">{emptyMessage}</p>;
  return (
    <ul className="doc-list" aria-busy={loading}>
      {documents.map((doc) => (
        <li key={doc.id}>{renderItem(doc)}</li>
      ))}
    </ul>
  );
}
