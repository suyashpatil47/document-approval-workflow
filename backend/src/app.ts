import cors from 'cors';
import express, { type Express } from 'express';
import { authenticate } from './http/middleware/auth.js';
import { errorHandler, notFoundHandler } from './http/middleware/errorHandler.js';
import { documentsRouter } from './http/routes/documents.js';
import { meRouter, publicUsersRouter } from './http/routes/users.js';
import { InMemoryDocumentRepository, type DocumentRepository } from './repositories/documentRepository.js';
import { InMemoryUserRepository, type UserRepository } from './repositories/userRepository.js';
import { DocumentService } from './services/documentService.js';

export interface AppDeps {
  documents?: DocumentRepository;
  users?: UserRepository;
  corsOrigin?: string | string[];
}

/** Builds the Express app. Dependencies are injectable so tests get a fresh store each time. */
export function createApp({
  documents = new InMemoryDocumentRepository(),
  users = new InMemoryUserRepository(),
  corsOrigin,
}: AppDeps = {}): Express {
  const service = new DocumentService({ documents });
  const app = express();

  app.disable('x-powered-by');
  app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', publicUsersRouter(users));

  const requireUser = authenticate(users);
  app.use('/api/me', requireUser, meRouter());
  app.use('/api/documents', requireUser, documentsRouter(service, users));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
