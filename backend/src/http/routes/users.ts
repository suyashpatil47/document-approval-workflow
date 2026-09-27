import { Router } from 'express';
import type { UserRepository } from '../../repositories/userRepository.js';
import { currentUser } from '../middleware/auth.js';

/** `GET /users` is public so the demo UI can offer a user switcher; `GET /me` requires auth (mounted at /api/me). */
export function publicUsersRouter(users: UserRepository): Router {
  const router = Router();
  router.get('/users', async (_req, res) => {
    res.json({ data: await users.list() });
  });
  return router;
}

export function meRouter(): Router {
  const router = Router();
  router.get('/', (req, res) => {
    res.json(currentUser(req));
  });
  return router;
}
