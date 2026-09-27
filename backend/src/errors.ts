export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS_BY_CODE[code];
  }
}

export const validationError = (message: string, details?: FieldError[]) =>
  new AppError('VALIDATION_ERROR', message, details);
export const notFound = (message = 'Resource not found') => new AppError('NOT_FOUND', message);
export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', message);
