import multer from 'multer';
import { validationError } from '../../errors.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Parses an optional single `file` field from multipart requests. JSON requests
 * pass through untouched. Files are held in memory to match the in-memory store.
 */
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(
      validationError('Unsupported file type', [
        { field: 'file', message: `Type ${file.mimetype} is not allowed` },
      ]),
    );
  },
}).single('file');

/** Busboy reports non-ASCII filenames as latin1; recover the UTF-8 name. */
export function decodeFileName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}
