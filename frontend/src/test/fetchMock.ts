import { vi } from 'vitest';
import type { ApprovalDocument } from '../api/types';

type Handler = (req: { url: string; init: RequestInit }) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status: number, code: string, message: string, details?: unknown[]) =>
  json({ error: { code, message, details } }, status);

/** Routes fetch calls by "METHOD /path" prefix; unmatched calls fail loudly. */
export function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const key = `${init.method ?? 'GET'} ${url}`;
    const match = Object.keys(routes)
      .filter((k) => key.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) throw new Error(`Unexpected fetch: ${key}`);
    return routes[match]({ url, init });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export const USERS = [
  { id: 'alice', name: 'Alice (Submitter)', role: 'submitter' },
  { id: 'rita', name: 'Rita (Reviewer)', role: 'reviewer' },
];

export function makeDoc(overrides: Partial<ApprovalDocument> = {}): ApprovalDocument {
  return {
    id: 'd1',
    title: 'Vendor contract',
    content: 'Please review',
    file: null,
    status: 'pending',
    submittedBy: { id: 'alice', name: 'Alice (Submitter)' },
    submittedAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
    review: null,
    ...overrides,
  };
}

export const headerOf = (init: RequestInit, name: string) => new Headers(init.headers).get(name);
