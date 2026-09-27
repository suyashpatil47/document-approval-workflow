import type { FieldError } from './types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages keyed by field name, for inline form errors. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

let currentUserId: string | null = null;

/** Mock auth: every request carries the selected demo user's id. */
export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (currentUserId) headers.set('X-User-Id', currentUserId);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = body?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
    );
  }
  return res;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  return res.json() as Promise<T>;
}

export async function requestBlob(path: string): Promise<Blob> {
  const res = await send(path);
  return res.blob();
}
