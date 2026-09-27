import type { NextFunction, Request, Response } from 'express';
import type { User } from '../../domain/user.js';
import { AppError } from '../../errors.js';
import type { UserRepository } from '../../repositories/userRepository.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const USER_HEADER = 'x-user-id';

/**
 * Mock authentication: trusts the X-User-Id header and resolves it against the
 * user store. A real deployment would verify a session cookie or JWT here instead;
 * nothing downstream would change because handlers only read `req.user`.
 */
export function authenticate(users: UserRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.header(USER_HEADER)?.trim();
    if (!userId) throw new AppError('UNAUTHENTICATED', `Missing ${USER_HEADER} header`);

    const user = await users.findById(userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Unknown user');

    req.user = user;
    next();
  };
}

export function currentUser(req: Request): User {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}
