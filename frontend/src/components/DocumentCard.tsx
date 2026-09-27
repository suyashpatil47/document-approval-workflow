import type { ReactNode } from 'react';
import type { ApprovalDocument } from '../api/types';
import { formatDate } from '../format';
import { FileDownload } from './FileDownload';
import { StatusBadge } from './StatusBadge';

interface Props {
  doc: ApprovalDocument;
  showSubmitter?: boolean;
  actions?: ReactNode;
}

export function DocumentCard({ doc, showSubmitter = false, actions }: Props) {
  return (
    <article className="card doc" aria-labelledby={`doc-${doc.id}`}>
      <header className="doc__header">
        <h3 id={`doc-${doc.id}`}>{doc.title}</h3>
        <StatusBadge status={doc.status} />
      </header>
      <p className="muted doc__meta">
        {showSubmitter && <>{doc.submittedBy.name} · </>}
        Submitted {formatDate(doc.submittedAt)}
      </p>
      {doc.content && <p className="doc__content">{doc.content}</p>}
      {doc.file && <FileDownload file={doc.file} />}
      {doc.review && (
        <div className={`review review--${doc.review.decision}`}>
          <strong>{doc.review.decision === 'approved' ? 'Approved' : 'Rejected'}</strong> by{' '}
          {doc.review.reviewer.name} on {formatDate(doc.review.reviewedAt)}
          {doc.review.comment && <p className="review__comment">“{doc.review.comment}”</p>}
        </div>
      )}
      {actions}
    </article>
  );
}
