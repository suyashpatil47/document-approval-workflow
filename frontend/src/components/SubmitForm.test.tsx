import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiError, json, makeDoc, mockFetch } from '../test/fetchMock';
import { MAX_FILE_BYTES, SubmitForm } from './SubmitForm';

describe('SubmitForm', () => {
  it('shows validation errors and does not call the API when empty', async () => {
    const fetchMock = mockFetch({});
    render(<SubmitForm onSubmitted={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText(/add some text, attach a file/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Title'), 'Fixed');
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
    expect(screen.getByText(/add some text, attach a file/i)).toBeInTheDocument();
  });

  it('submits text as JSON, resets and notifies the parent', async () => {
    const fetchMock = mockFetch({ 'POST /api/documents': () => json(makeDoc({ title: 'Budget' }), 201) });
    const onSubmitted = vi.fn();
    render(<SubmitForm onSubmitted={onSubmitted} />);

    await userEvent.type(screen.getByLabelText('Title'), '  Budget ');
    await userEvent.type(screen.getByLabelText(/content/i), 'Q3 numbers');
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('“Budget” submitted for review.');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ title: 'Budget', content: 'Q3 numbers' });
    expect(onSubmitted).toHaveBeenCalledWith(expect.objectContaining({ title: 'Budget' }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('sends multipart form data when a file is attached', async () => {
    const fetchMock = mockFetch({ 'POST /api/documents': () => json(makeDoc(), 201) });
    render(<SubmitForm onSubmitted={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Contract');
    await userEvent.upload(screen.getByLabelText(/^file/i), new File(['pdf'], 'c.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    await screen.findByRole('status');
    const body = fetchMock.mock.calls[0][1]!.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('title')).toBe('Contract');
    expect((body.get('file') as File).name).toBe('c.pdf');
  });

  it('rejects oversized files client-side', async () => {
    const fetchMock = mockFetch({});
    render(<SubmitForm onSubmitted={vi.fn()} />);
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 });

    await userEvent.type(screen.getByLabelText('Title'), 'Big');
    await userEvent.upload(screen.getByLabelText(/^file/i), big);
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(screen.getByText('File must be 5 MB or smaller')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows server-side field and form errors', async () => {
    mockFetch({
      'POST /api/documents': () =>
        apiError(400, 'VALIDATION_ERROR', 'Invalid request', [{ field: 'title', message: 'Title too spicy' }]),
    });
    render(<SubmitForm onSubmitted={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Title'), 'Hot');
    await userEvent.type(screen.getByLabelText(/content/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(await screen.findByText('Title too spicy')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid request');
  });
});
