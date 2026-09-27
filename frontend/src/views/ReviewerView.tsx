import { useState } from 'react';
import type { User } from '../api/types';
import { DocumentCard } from '../components/DocumentCard';
import { DocumentList } from '../components/DocumentList';
import { ReviewActions } from '../components/ReviewActions';
import { StatusFilter, toStatusParam, type StatusFilterValue } from '../components/StatusFilter';
import { useDocuments } from '../hooks/useDocuments';

export function ReviewerView({ user }: { user: User }) {
  const [filter, setFilter] = useState<StatusFilterValue>('pending');
  const { documents, loading, error, reload } = useDocuments({ status: toStatusParam(filter), key: user.id });

  return (
    <section className="layout" aria-labelledby="queue">
      <div className="section-header">
        <h2 id="queue">Review queue</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => void reload()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <StatusFilter value={filter} onChange={setFilter} />
      <DocumentList
        documents={documents}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage={filter === 'pending' ? 'Nothing waiting for review. 🎉' : 'No documents match this filter.'}
        renderItem={(doc) => (
          <DocumentCard
            doc={doc}
            showSubmitter
            actions={
              doc.status === 'pending' && (
                <ReviewActions doc={doc} onReviewed={() => void reload()} onConflict={() => void reload()} />
              )
            }
          />
        )}
      />
    </section>
  );
}
