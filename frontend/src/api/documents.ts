import { requestBlob, requestJson } from './client';
import type { ApprovalDocument, DocumentStatus, ReviewDecision, User } from './types';

export interface SubmitPayload {
  title: string;
  content?: string;
  file?: File | null;
}

export const listUsers = () => requestJson<{ data: User[] }>('/api/users').then((r) => r.data);

export function listDocuments(status?: DocumentStatus): Promise<ApprovalDocument[]> {
  const query = status ? `?status=${status}` : '';
  return requestJson<{ data: ApprovalDocument[] }>(`/api/documents${query}`).then((r) => r.data);
}

/** Sends JSON for text-only submissions and multipart when a file is attached. */
export function submitDocument({ title, content, file }: SubmitPayload): Promise<ApprovalDocument> {
  if (!file) {
    return requestJson('/api/documents', { method: 'POST', body: JSON.stringify({ title, content }) });
  }
  const form = new FormData();
  form.append('title', title);
  if (content) form.append('content', content);
  form.append('file', file);
  return requestJson('/api/documents', { method: 'POST', body: form });
}

export function updateStatus(id: string, status: ReviewDecision, comment?: string): Promise<ApprovalDocument> {
  return requestJson(`/api/documents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, comment }),
  });
}

export const downloadFile = (url: string) => requestBlob(url);
