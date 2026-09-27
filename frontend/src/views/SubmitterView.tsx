import { useState } from 'react';
import type { User } from '../api/types';
import { DocumentCard } from '../components/DocumentCard';
import { DocumentList } from '../components/DocumentList';
import { StatusFilter, toStatusParam, type StatusFilterValue } from '../components/StatusFilter';
import { SubmitForm } from '../components/SubmitForm';
import { useDocuments } from '../hooks/useDocuments';

const POLL_MS = 15_000;

export function SubmitterView({ user }: { user: User }) {
  const [filter, setFilter] = useState<StatusFilterValue>('all');
  const { documents, loading, error, reload } = useDocuments({
    status: toStatusParam(filter),
    pollMs: POLL_MS,
    key: user.id,
  });

  return (
    <div className="layout layout--split">
      <SubmitForm onSubmitted={() => void reload()} />
      <section aria-labelledby="my-docs">
        <div className="section-header">
          <h2 id="my-docs">My submissions</h2>
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
          emptyMessage={filter === 'all' ? 'You have not submitted anything yet.' : `No ${filter} submissions.`}
          renderItem={(doc) => <DocumentCard doc={doc} />}
        />
      </section>
    </div>
  );
}
