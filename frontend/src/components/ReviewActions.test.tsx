import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiError, json, makeDoc, mockFetch } from '../test/fetchMock';
import { ReviewActions } from './ReviewActions';

const setup = () => {
  const onReviewed = vi.fn();
  const onConflict = vi.fn();
  render(<ReviewActions doc={makeDoc()} onReviewed={onReviewed} onConflict={onConflict} />);
  return { onReviewed, onConflict };
};

describe('ReviewActions', () => {
  it('approves with a PATCH and reports the updated document', async () => {
    const fetchMock = mockFetch({ 'PATCH /api/documents/d1/status': () => json(makeDoc({ status: 'approved' })) });
    const { onReviewed } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(onReviewed).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ status: 'approved' });
  });

  it('requires a reason before rejecting', async () => {
    const fetchMock = mockFetch({ 'PATCH /api/documents/d1/status': () => json(makeDoc({ status: 'rejected' })) });
    const { onReviewed } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please give a reason for rejecting');
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Reason for rejection'), 'Missing signature');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));

    expect(onReviewed).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      status: 'rejected',
      comment: 'Missing signature',
    });
  });

  it('shows the error and asks for a refresh when the document was already decided', async () => {
    mockFetch({
      'PATCH /api/documents/d1/status': () =>
        apiError(409, 'INVALID_TRANSITION', 'Document is already approved and cannot be moved to approved'),
    });
    const { onReviewed, onConflict } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already approved');
    expect(onConflict).toHaveBeenCalled();
    expect(onReviewed).not.toHaveBeenCalled();
  });
});
