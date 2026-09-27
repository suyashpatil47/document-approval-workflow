import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../errors.js';
import { MAX_FILE_BYTES } from './upload.js';

/** Maps anything thrown by a handler to the `{ error: { code, message, details? } }` envelope. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const appError = toAppError(err);
  if (appError.status >= 500) console.error(err);
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
    },
  });
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('PAYLOAD_TOO_LARGE', `File exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB limit`);
    }
    return new AppError('VALIDATION_ERROR', err.message, [{ field: err.field ?? 'file', message: err.message }]);
  }

  // body-parser errors carry a `type` and an HTTP status.
  const bodyErr = err as { type?: string };
  if (bodyErr?.type === 'entity.parse.failed') return new AppError('VALIDATION_ERROR', 'Malformed JSON body');
  if (bodyErr?.type === 'entity.too.large') return new AppError('PAYLOAD_TOO_LARGE', 'Request body too large');

  return new AppError('INTERNAL_ERROR', 'Something went wrong');
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
