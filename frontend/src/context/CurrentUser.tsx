import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setCurrentUserId } from '../api/client';
import { listUsers } from '../api/documents';
import type { User } from '../api/types';

const STORAGE_KEY = 'approvals.currentUserId';

interface CurrentUserState {
  users: User[];
  user: User | null;
  loading: boolean;
  error: string | null;
  selectUser: (id: string) => void;
  retry: () => void;
}

const CurrentUserContext = createContext<CurrentUserState | null>(null);

const readStoredId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeId = (id: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode); the selection just won't persist.
  }
};

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | null>(readStoredId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listUsers()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Fall back to the first user if nothing (or a stale id) was stored.
  const user = users.find((u) => u.id === userId) ?? users[0] ?? null;
  // Set during render (not in an effect) so children's fetch effects, which run
  // before this provider's effects, already send the right user.
  setCurrentUserId(user?.id ?? null);

  const selectUser = useCallback((id: string) => {
    setUserId(id);
    storeId(id);
  }, []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <CurrentUserContext.Provider value={{ users, user, loading, error, selectUser, retry }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserState {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  return ctx;
}
