import { z } from 'zod';
import { DOCUMENT_STATUSES, REVIEW_DECISIONS } from '../domain/document.js';
import { validationError } from '../errors.js';

export const TITLE_MAX = 200;
export const CONTENT_MAX = 20_000;

// Multipart fields arrive as strings; empty strings mean "not provided".
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().max(max, `Must be at most ${max} characters`).optional(),
  );

export const submitDocumentSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(TITLE_MAX, `Must be at most ${TITLE_MAX} characters`),
  content: optionalText(CONTENT_MAX),
});

export const listDocumentsQuerySchema = z.object({
  status: z.enum(DOCUMENT_STATUSES, { error: `Must be one of: ${DOCUMENT_STATUSES.join(', ')}` }).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(REVIEW_DECISIONS, { error: `Must be one of: ${REVIEW_DECISIONS.join(', ')}` }),
  comment: optionalText(2_000),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid document id') });

/** Parses `input` or throws a 400 AppError listing every failing field. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  throw validationError(
    'Invalid request',
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  );
}
