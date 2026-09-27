# Document Approval Workflow

A small document approval app. A **submitter** sends in a document (text, a file, or both) and follows its status. A **reviewer** works through the queue and approves or rejects each one.

- **Backend:** Node 20, Express 5, TypeScript, zod, multer
- **Frontend:** React 19, Vite, TypeScript, plain CSS
- **Tests:** Vitest + Supertest (backend), Vitest + React Testing Library (frontend)

> **Video walkthrough:** _TODO: add Loom link_
> **Live demo:** not hosted; run it locally with the steps below.

---

## Quick start

Requirements: Node.js 20+ and npm 10+.

```bash
npm install     # installs both workspaces (backend + frontend)
npm run dev     # API on http://localhost:4000, web app on http://localhost:5173
npm test        # runs every backend and frontend test
```

Open http://localhost:5173 and pick a user with the **Signed in as** switcher in the top right:

| User  | Role      | What you see                                   |
| ----- | --------- | ---------------------------------------------- |
| Alice | submitter | Submit form + her own submissions              |
| Bob   | submitter | Submit form + his own submissions              |
| Rita  | reviewer  | Review queue (defaults to Pending), all documents |

### Running each side on its own

```bash
# Backend
cd backend
npm run dev          # tsx watch, port 4000 (override with PORT)
npm test
npm run build && npm start

# Frontend
cd frontend
npm run dev          # Vite, port 5173; proxies /api -> http://localhost:4000
npm test
npm run build        # static bundle in frontend/dist
```

Environment variables (all optional):

| Variable       | Where    | Default    | Purpose                                                     |
| -------------- | -------- | ---------- | ----------------------------------------------------------- |
| `PORT`         | backend  | `4000`     | API port                                                    |
| `CORS_ORIGIN`  | backend  | allow all  | Comma-separated list of allowed origins                     |
| `VITE_API_URL` | frontend | `''`       | API base URL when the frontend is not served behind `/api`  |

---

## Project structure

```
backend/
  src/
    domain/          Document + User types, status transition map (pure, no I/O)
    repositories/    Storage interfaces + in-memory implementations
    services/        DocumentService: business rules (roles, ownership, transitions)
    http/
      schemas.ts     zod request schemas + parse() helper -> 400 with field details
      presenters.ts  Domain -> JSON response shape
      middleware/    auth (X-User-Id), upload (multer), error handler
      routes/        documents, users
    app.ts           createApp(deps): wires everything; dependencies can be injected
    server.ts        Entry point
  tests/             Unit (domain, service) + API integration (supertest)
frontend/
  src/
    api/             fetch client (ApiError, auth header), typed endpoint functions
    context/         Current (mock) user
    hooks/           useDocuments: loading/error/polling/stale-response handling
    components/      SubmitForm, ReviewActions, DocumentCard, DocumentList, StatusFilter, ...
    views/           SubmitterView, ReviewerView
```

Dependencies only point inward: `http` → `services` → `repositories`/`domain`. The service never touches Express, and the domain never touches storage.

---

## API design

Base path: `/api`. Request and response bodies are JSON, except file upload, which uses `multipart/form-data`.

### Authentication (mocked)

Every `/api/documents` and `/api/me` request must send `X-User-Id: <userId>`. The server looks the id up in the user store and attaches the user to the request. A missing or unknown id returns `401`.

This stands in for real auth. Handlers only ever read `req.user`, so replacing the middleware with JWT or session verification would not touch any other code.

### Error format

All errors share one envelope, so the client can handle them in a single place:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [{ "field": "title", "message": "Title is required" }]
  }
}
```

| Status | `code`               | When                                                         |
| ------ | -------------------- | ------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`   | Bad body, query or id; malformed JSON; bad file type; rejecting with no reason |
| 401    | `UNAUTHENTICATED`    | Missing or unknown `X-User-Id`                               |
| 403    | `FORBIDDEN`          | Wrong role (a reviewer submitting, a submitter reviewing)    |
| 404    | `NOT_FOUND`          | Document missing **or owned by someone else**; unknown route |
| 409    | `INVALID_TRANSITION` | Document already approved or rejected                        |
| 413    | `PAYLOAD_TOO_LARGE`  | File over 5 MB, or JSON body over 100 KB                     |
| 500    | `INTERNAL_ERROR`     | Unexpected error (details logged on the server, not returned) |

### Document resource

```json
{
  "id": "0b6f…-uuid",
  "title": "Q3 vendor contract",
  "content": "Renewal terms…",
  "file": { "name": "contract.pdf", "mimeType": "application/pdf", "size": 48213, "url": "/api/documents/0b6f…/file" },
  "status": "pending",
  "submittedBy": { "id": "alice", "name": "Alice (Submitter)" },
  "submittedAt": "2026-09-27T11:36:42.954Z",
  "updatedAt": "2026-09-27T11:36:42.954Z",
  "review": null
}
```

Once a document has been decided, `review` holds:
`{ "reviewer": { "id", "name" }, "decision": "approved" | "rejected", "comment": string | null, "reviewedAt": ISO }`.

`content` and `file` may each be `null`, but not both. File bytes are never included in the JSON; use `file.url` to download them.

### Endpoints

| Method  | Path                          | Who                 | Description |
| ------- | ----------------------------- | ------------------- | ----------- |
| `GET`   | `/api/health`                 | public              | Liveness check: `{ "status": "ok" }` |
| `GET`   | `/api/users`                  | public              | Demo users for the switcher: `{ "data": User[] }` |
| `GET`   | `/api/me`                     | any                 | The authenticated user |
| `POST`  | `/api/documents`              | submitter           | Create a submission → `201`, `Location` header, Document |
| `GET`   | `/api/documents?status=`      | any                 | List, newest first → `{ "data": Document[] }`. Submitters get only their own; reviewers get all. `status` is optional: `pending`, `approved` or `rejected` |
| `GET`   | `/api/documents/:id`          | owner or reviewer   | Fetch one document |
| `GET`   | `/api/documents/:id/file`     | owner or reviewer   | Download the attached file (`Content-Disposition: attachment`, `nosniff`) |
| `PATCH` | `/api/documents/:id/status`   | reviewer            | Approve or reject → updated Document |

**Create:** `POST /api/documents`

```jsonc
// application/json
{ "title": "Q3 vendor contract", "content": "optional text" }

// or multipart/form-data
title=Q3 vendor contract
content=optional text
file=@contract.pdf     // optional; ≤ 5 MB; pdf, txt, md, png, jpeg, doc, docx
```

Validation: `title` is required, trimmed, 1–200 characters. `content` is at most 20,000 characters. At least one of `content` or `file` must be present.

**Review:** `PATCH /api/documents/:id/status`

```json
{ "status": "rejected", "comment": "Missing signature page" }
```

`status` must be `approved` or `rejected`. `comment` is optional when approving and **required when rejecting**.

### Why the API looks like this

- **`PATCH /documents/:id/status` instead of `/approve` and `/reject` endpoints.** A review changes one field of the resource. Keeping the target status in the body means a new state such as `changes_requested` needs no new route: it is one entry in the transition map plus an enum value.
- **One create endpoint accepting JSON or multipart.** Text-only clients stay simple, and the same resource can carry a file. The frontend sends JSON unless a file is attached.
- **List responses are wrapped in `{ data: [...] }`.** Pagination metadata (`nextCursor`, `total`) can be added later without breaking clients.
- **Visibility is enforced on the server, not with a query flag.** `GET /documents` returns different results depending on who asks, so a submitter cannot list another user's documents by changing a parameter.
- **404 rather than 403 for other people's documents,** so valid ids cannot be discovered by probing.
- **409 for decisions on terminal states** tells the client "your view is stale". The UI shows the message and refreshes the queue.
- **Responses come from a presenter** (`toDocumentDto`), not straight from storage. Internal fields and file bytes never leak, and the storage model can change without changing the API.

---

## Major decisions

### Data model

```
User      { id, name, role: 'submitter' | 'reviewer' }
Document  { id, title, content?, file?, status, submittedBy -> User.id,
            submittedAt, updatedAt, review? }
Review    { reviewerId -> User.id, decision, comment?, reviewedAt }   (embedded in Document)
StoredFile{ originalName, mimeType, size, data: Buffer }             (embedded in Document)
```

`Review` is embedded because this iteration has exactly one review per document. If a later round adds multi-step or multi-reviewer approval, it would become its own collection (an audit log of `ReviewEvent`s), and `status` would be derived from or updated alongside it.

### Status transitions

```
            approve
 pending ───────────▶ approved   (terminal)
    │
    └──────────────▶ rejected    (terminal, comment required)
            reject
```

The rules live in a single map, `backend/src/domain/document.ts`. `canTransition()` is the only check the service makes, so allowing, say, `rejected → pending` for resubmission is a one-line change.

**Concurrency:** two reviewers may act on the same document at once. The repository's `updateIfStatus(doc, expectedStatus)` is a compare-and-set, so only the first write succeeds and the second gets `409`. A test runs two concurrent reviews to cover this. With a SQL database this becomes `UPDATE … WHERE id = ? AND status = 'pending'`.

### Other decisions and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| In-memory storage behind a `DocumentRepository` interface | Allowed by the brief; no setup; tests get a fresh store per app instance | Data is lost on restart. Swapping in Postgres means one new class; the service and routes stay as they are |
| Files held in memory (multer `memoryStorage`), 5 MB cap, MIME allow-list | Matches the storage choice | Not viable at scale; production would stream to S3 or GCS and store a key |
| Mock auth via `X-User-Id` + seeded users | Makes "tied to their user" and role checks real without spending the time budget on login | Anyone can claim any id. Clearly not production auth |
| Rules in the service, request shape in zod | Shape validation stays at the edge; business rules (reject reason, content-or-file, roles) are testable without HTTP | Two layers to read, but each is small |
| Injected clock and id generator in `DocumentService` | Deterministic unit tests | A little constructor noise |
| Repository returns clones (`structuredClone`) | Callers cannot mutate stored state by accident, which mimics a real DB boundary | Copying cost; irrelevant at this size |
| One page with a role-based view instead of a router | The user switcher decides the view; less code | No deep links. `react-router` would be the next step |
| Submitter list polls every 15 s (only while the tab is visible), plus a Refresh button | Submitters see decisions without reloading | Polling rather than push (SSE/WebSocket) |
| Plain CSS with light/dark tokens | No UI library lock-in; small bundle | Fewer ready-made components |

### Edge cases handled

- Missing, blank, too-long or wrongly typed fields → `400` with per-field details (frontend validates first and shows server errors inline)
- Neither content nor file → `400`
- Malformed JSON → `400`; oversized JSON → `413`
- File too large → `413`; disallowed type → `400`; non-ASCII filenames decoded correctly
- Unknown `status` filter, malformed id → `400`
- A submitter reading another submitter's document → `404`
- A reviewer submitting, a submitter reviewing (including their own document) → `403`
- Re-deciding a decided document, or two reviewers racing → `409`
- Frontend: network down, non-JSON error bodies, retry buttons, empty states, stale responses dropped when the filter or user changes mid-request, per-user state reset when switching users

---

## Tests

```bash
npm test   # from the repo root: backend then frontend
```

- **Backend (60 tests)**
  - `tests/document.test.ts`: the transition map
  - `tests/documentService.test.ts`: business rules, visibility, concurrent reviews, no mutation leaks
  - `tests/api.test.ts`: every endpoint over HTTP: happy paths, validation, auth, file upload, download and limits, 403/404/409
- **Frontend (16 tests)**
  - `api/client.test.ts`: auth header, error envelope parsing, network and non-JSON errors
  - `SubmitForm.test.tsx`: client validation, JSON vs multipart, server field errors, oversized file
  - `ReviewActions.test.tsx`: approve, reject requires a reason, 409 conflict
  - `App.test.tsx`: submitter vs reviewer views, error and retry, unreachable server

The tests have no environment dependencies: they pass with a clean env (`env -i PATH="$PATH" npm test`).

---

## AI tools used

- **Claude Code (Claude Opus)** as a pair programmer in the terminal:
  - **Scoping:** read the brief and proposed options for each open decision (stack, storage, document shape, auth, transition rules). I made each choice; the recommendations and trade-offs are recorded above.
  - **Scaffolding and implementation:** generated the workspace setup, the backend layers and the React components, working in small reviewed steps with a commit per logical unit.
  - **Tests:** wrote the unit, integration and component tests. As a sanity check, a deliberate bug was introduced into the transition map to confirm the tests catch it (three tests failed, as expected).
  - **Manual QA:** drove the running app in Chrome (submit → switch to reviewer → reject with reason) and fixed a UX issue it found: field errors stayed visible after the user started correcting the field.
- I reviewed the generated code and made the design calls: the API shape, 404 vs 403, compare-and-set for concurrent reviews, and where each rule lives.

---

## What I'd add for production

- **Auth:** real identity (OIDC/SSO or email + password with sessions/JWT), with roles in the token or a permissions table. Rate limiting on the auth and write endpoints.
- **Persistence:** Postgres behind the existing repository interface (with migrations); the conditional `UPDATE … WHERE status = 'pending'` for compare-and-set; indexes on `(submitted_by, status, submitted_at)`.
- **Files:** direct-to-S3 uploads with presigned URLs, content sniffing rather than trusting the client MIME type, virus scanning, and signed download URLs instead of proxying bytes.
- **Workflow:** an audit trail (`review_events` table), resubmission after rejection, multi-step or multi-reviewer approval, reviewer assignment, and notifications (email/Slack) on decisions.
- **API:** cursor pagination, search, sorting, an OpenAPI spec generated from the zod schemas, idempotency keys on create, and ETags/`If-Match` for optimistic concurrency on edits.
- **Frontend:** a router with deep links (`/documents/:id`), push updates over SSE instead of polling, toasts, accessibility audit, and E2E tests (Playwright).
- **Operations:** structured logging with request ids, error tracking (Sentry), metrics and health/readiness probes, Helmet security headers, a CI pipeline (lint, typecheck, test, build), Docker images, and hosting (e.g. Render/Fly for the API and Vercel for the frontend).
