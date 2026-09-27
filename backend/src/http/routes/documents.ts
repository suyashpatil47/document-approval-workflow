import { Router, type Request } from 'express';
import type { UserRepository } from '../../repositories/userRepository.js';
import type { DocumentService } from '../../services/documentService.js';
import { currentUser } from '../middleware/auth.js';
import { decodeFileName, uploadSingleFile } from '../middleware/upload.js';
import { toDocumentDto } from '../presenters.js';
import {
  idParamSchema,
  listDocumentsQuerySchema,
  parse,
  submitDocumentSchema,
  updateStatusSchema,
} from '../schemas.js';
import { notFound } from '../../errors.js';

export function documentsRouter(service: DocumentService, users: UserRepository): Router {
  const router = Router();

  const userLookup = async () => {
    const all = await users.list();
    const byId = new Map(all.map((u) => [u.id, u]));
    return (id: string) => byId.get(id);
  };

  const fileFrom = (req: Request) =>
    req.file
      ? {
          originalName: decodeFileName(req.file.originalname),
          mimeType: req.file.mimetype,
          size: req.file.size,
          data: req.file.buffer,
        }
      : null;

  // Accepts application/json ({ title, content }) or multipart/form-data (title, content?, file?).
  router.post('/', uploadSingleFile, async (req, res) => {
    const user = currentUser(req);
    const body = parse(submitDocumentSchema, req.body);
    const doc = await service.submit(user, { ...body, file: fileFrom(req) });
    res.status(201).location(`/api/documents/${doc.id}`).json(toDocumentDto(doc, await userLookup()));
  });

  router.get('/', async (req, res) => {
    const user = currentUser(req);
    const query = parse(listDocumentsQuerySchema, req.query);
    const docs = await service.list(user, query);
    const lookup = await userLookup();
    res.json({ data: docs.map((d) => toDocumentDto(d, lookup)) });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const doc = await service.get(currentUser(req), id);
    res.json(toDocumentDto(doc, await userLookup()));
  });

  router.get('/:id/file', async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const doc = await service.get(currentUser(req), id);
    if (!doc.file) throw notFound('Document has no attached file');
    res
      .type(doc.file.mimeType)
      .attachment(doc.file.originalName)
      .setHeader('X-Content-Type-Options', 'nosniff');
    res.send(doc.file.data);
  });

  router.patch('/:id/status', async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateStatusSchema, req.body);
    const doc = await service.review(currentUser(req), id, {
      decision: body.status,
      comment: body.comment,
    });
    res.json(toDocumentDto(doc, await userLookup()));
  });

  return router;
}
