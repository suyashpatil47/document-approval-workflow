import { ErrorMessage } from './components/ErrorMessage';
import { CurrentUserProvider, useCurrentUser } from './context/CurrentUser';
import { ReviewerView } from './views/ReviewerView';
import { SubmitterView } from './views/SubmitterView';

function Shell() {
  const { users, user, loading, error, selectUser, retry } = useCurrentUser();

  return (
    <>
      <header className="topbar">
        <h1>Document Approvals</h1>
        {user && (
          <label className="user-switcher">
            <span className="muted">Signed in as</span>
            <select value={user.id} onChange={(e) => selectUser(e.target.value)} aria-label="Current user">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <main>
        {loading && <p className="muted" role="status">Loading…</p>}
        {error && <ErrorMessage message={error} onRetry={retry} />}
        {/* key remounts the view so per-user state (forms, filters) never leaks across users */}
        {user?.role === 'submitter' && <SubmitterView key={user.id} user={user} />}
        {user?.role === 'reviewer' && <ReviewerView key={user.id} user={user} />}
      </main>
    </>
  );
}

export function App() {
  return (
    <CurrentUserProvider>
      <Shell />
    </CurrentUserProvider>
  );
}
