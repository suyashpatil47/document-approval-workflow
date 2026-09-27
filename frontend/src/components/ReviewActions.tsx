import { useState } from 'react';
import { ApiError } from '../api/client';
import { updateStatus } from '../api/documents';
import type { ApprovalDocument, ReviewDecision } from '../api/types';

interface Props {
  doc: ApprovalDocument;
  onReviewed: (doc: ApprovalDocument) => void;
  /** Called when the server says the document changed under us (409), so the list can refresh. */
  onConflict: () => void;
}

export function ReviewActions({ doc, onReviewed, onConflict }: Props) {
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: ReviewDecision) => {
    if (decision === 'rejected' && !comment.trim()) {
      setError('Please give a reason for rejecting');
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      onReviewed(await updateStatus(doc.id, decision, comment.trim() || undefined));
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError && err.status === 409) onConflict();
    } finally {
      setBusy(null);
    }
  };

  const commentId = `reject-reason-${doc.id}`;

  return (
    <div className="review-actions">
      {mode === 'rejecting' && (
        <>
          <label htmlFor={commentId}>Reason for rejection</label>
          <textarea
            id={commentId}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
        </>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="review-actions__buttons">
        {mode === 'idle' ? (
          <>
            <button type="button" className="btn btn--approve" disabled={!!busy} onClick={() => decide('approved')}>
              {busy === 'approved' ? 'Approving…' : 'Approve'}
            </button>
            <button type="button" className="btn btn--reject" disabled={!!busy} onClick={() => setMode('rejecting')}>
              Reject
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--reject" disabled={!!busy} onClick={() => decide('rejected')}>
              {busy === 'rejected' ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!!busy}
              onClick={() => {
                setMode('idle');
                setError(null);
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
