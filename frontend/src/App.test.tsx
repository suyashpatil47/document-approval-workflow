import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { headerOf, json, makeDoc, mockFetch, USERS } from './test/fetchMock';

describe('App', () => {
  it('shows a submitter their documents with status and reviewer feedback', async () => {
    const fetchMock = mockFetch({
      'GET /api/users': () => json({ data: USERS }),
      'GET /api/documents': () =>
        json({
          data: [
            makeDoc({
              status: 'rejected',
              review: {
                reviewer: { id: 'rita', name: 'Rita (Reviewer)' },
                decision: 'rejected',
                comment: 'Missing signature',
                reviewedAt: '2026-09-27T11:00:00.000Z',
              },
            }),
          ],
        }),
    });
    render(<App />);

    const card = await screen.findByRole('article', { name: 'Vendor contract' });
    expect(within(card).getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(within(card).getByText('“Missing signature”')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Submit a document' })).toBeInTheDocument();

    const listCall = fetchMock.mock.calls.find(([url]) => String(url).startsWith('/api/documents'))!;
    expect(headerOf(listCall[1]!, 'X-User-Id')).toBe('alice');
  });

  it('switches to the reviewer queue, filtered to pending by default', async () => {
    const fetchMock = mockFetch({
      'GET /api/users': () => json({ data: USERS }),
      'GET /api/documents?status=pending': () => json({ data: [makeDoc()] }),
      'GET /api/documents': () => json({ data: [] }),
    });
    render(<App />);
    await screen.findByText('You have not submitted anything yet.');

    await userEvent.selectOptions(screen.getByLabelText('Current user'), 'rita');

    const card = await screen.findByRole('article', { name: 'Vendor contract' });
    expect(within(card).getByText(/Alice \(Submitter\)/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Submit a document' })).not.toBeInTheDocument();

    const reviewerCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/documents?status=pending')!;
    expect(headerOf(reviewerCall[1]!, 'X-User-Id')).toBe('rita');
  });

  it('shows an error with retry when the list fails to load', async () => {
    let fail = true;
    mockFetch({
      'GET /api/users': () => json({ data: USERS }),
      'GET /api/documents': () =>
        fail ? json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, 500) : json({ data: [] }),
    });
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('You have not submitted anything yet.')).toBeInTheDocument();
  });

  it('shows an error when the server is unreachable', async () => {
    mockFetch({
      'GET /api/users': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
