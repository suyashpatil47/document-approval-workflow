import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { submitDocument } from '../api/documents';
import type { ApprovalDocument } from '../api/types';

// Mirrors the server's limits so users get instant feedback; the server stays authoritative.
export const TITLE_MAX = 200;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = '.pdf,.txt,.md,.png,.jpg,.jpeg,.doc,.docx';

type Errors = Partial<Record<'title' | 'content' | 'file' | 'form', string>>;

function validate(title: string, content: string, file: File | null): Errors {
  const errors: Errors = {};
  if (!title.trim()) errors.title = 'Title is required';
  else if (title.trim().length > TITLE_MAX) errors.title = `Must be at most ${TITLE_MAX} characters`;
  if (!content.trim() && !file) errors.content = 'Add some text, attach a file, or both';
  if (file && file.size > MAX_FILE_BYTES) errors.file = 'File must be 5 MB or smaller';
  return errors;
}

export function SubmitForm({ onSubmitted }: { onSubmitted: (doc: ApprovalDocument) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Editing a field clears its error (and the "content or file" error, which either field can fix).
  const clearError = (...fields: (keyof Errors)[]) =>
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of fields) delete next[f];
      return next;
    });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    const found = validate(title, content, file);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const doc = await submitDocument({ title: title.trim(), content: content.trim() || undefined, file });
      setTitle('');
      setContent('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setSuccess(`“${doc.title}” submitted for review.`);
      onSubmitted(doc);
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors(), form: err.message });
      else setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>Submit a document</h2>

      <label htmlFor="title">Title</label>
      <input
        id="title"
        value={title}
        maxLength={TITLE_MAX + 50}
        onChange={(e) => {
          setTitle(e.target.value);
          clearError('title');
        }}
        aria-invalid={!!errors.title}
        aria-describedby={errors.title ? 'title-error' : undefined}
        placeholder="e.g. Q3 vendor contract"
      />
      {errors.title && <p id="title-error" className="field-error">{errors.title}</p>}

      <label htmlFor="content">Content <span className="muted">(optional if you attach a file)</span></label>
      <textarea
        id="content"
        rows={5}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          clearError('content');
        }}
        aria-invalid={!!errors.content}
        aria-describedby={errors.content ? 'content-error' : undefined}
      />
      {errors.content && <p id="content-error" className="field-error">{errors.content}</p>}

      <label htmlFor="file">File <span className="muted">(PDF, text, image or Word · max 5 MB)</span></label>
      <input
        id="file"
        ref={fileInput}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          clearError('file', 'content');
        }}
        aria-invalid={!!errors.file}
        aria-describedby={errors.file ? 'file-error' : undefined}
      />
      {errors.file && <p id="file-error" className="field-error">{errors.file}</p>}

      {errors.form && <div className="alert alert--error" role="alert">{errors.form}</div>}
      {success && <div className="alert alert--success" role="status">{success}</div>}

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  );
}
