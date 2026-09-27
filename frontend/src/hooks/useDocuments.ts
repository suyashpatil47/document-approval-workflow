import { useCallback, useEffect, useRef, useState } from 'react';
import { listDocuments } from '../api/documents';
import type { ApprovalDocument, DocumentStatus } from '../api/types';

interface Options {
  status?: DocumentStatus;
  /** Re-fetch periodically so submitters see decisions without reloading. */
  pollMs?: number;
  /** Changing this key (e.g. the current user) resets and reloads the list. */
  key?: string;
}

export function useDocuments({ status, pollMs, key }: Options = {}) {
  const [documents, setDocuments] = useState<ApprovalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const docs = await listDocuments(status);
        // Drop responses from superseded requests (filter/user changed mid-flight).
        if (id !== requestId.current) return;
        setDocuments(docs);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError((err as Error).message);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [status, key],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    }, pollMs);
    return () => clearInterval(timer);
  }, [load, pollMs]);

  const reload = useCallback(() => load(), [load]);
  return { documents, loading, error, reload };
}
