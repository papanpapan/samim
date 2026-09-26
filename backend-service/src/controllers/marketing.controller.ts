import { randomUUID } from 'crypto';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../config/database';
import { withNursery } from '../services/tenantContext';
import { writeAudit } from '../services/audit.service';
import { ApiError } from '../utils/apiError';

const CATEGORIES = ['FRUIT', 'FLOWER', 'FOLIAGE'] as const;
const uploadDir = path.join(process.cwd(), 'uploads', 'marketing');
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export const marketingCategorySchema = z.enum(CATEGORIES);
export const marketingKindSchema = z.enum(['PHOTO', 'VIDEO']);

function photoExtension(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'image/png' || ext === 'png') return 'png';
  if (file.mimetype === 'image/webp' || ext === 'webp') return 'webp';
  if (file.mimetype === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return '';
}

function videoExtension(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'video/quicktime' || ext === 'mov') return 'mov';
  if (file.mimetype === 'video/webm' || ext === 'webm') return 'webm';
  if (file.mimetype === 'video/mp4' || ext === 'mp4' || ext === 'm4v') return 'mp4';
  return '';
}

const parser = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir)).catch((err: Error) => cb(err, uploadDir));
    },
    filename: (req, file, cb) => {
      const kind = String(req.body.kind || '');
      const ext = kind === 'VIDEO' ? videoExtension(file) : photoExtension(file);
      cb(null, `${randomUUID()}.${ext || 'bin'}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (req, file, cb) => {
    const kind = String(req.body.kind || '');
    const ok = kind === 'VIDEO' ? videoExtension(file) : photoExtension(file);
    if (!ok) {
      cb(new Error(kind === 'VIDEO' ? 'VIDEO_TYPE' : 'PHOTO_TYPE'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function receiveMarketingFile(req: Request, res: Response, next: NextFunction) {
  parser(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
    const message = err instanceof Error ? err.message : '';
    if (code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('That file is too large. Photos stay under 2 MB and videos under 40 MB.'));
      return;
    }
    if (message === 'VIDEO_TYPE') {
      next(ApiError.badRequest('Choose an MP4, WebM, or MOV video.'));
      return;
    }
    if (message === 'PHOTO_TYPE') {
      next(ApiError.badRequest('Choose a JPEG, PNG, or WebP photo.'));
      return;
    }
    next(err);
  });
}

function present(row: { id: string; category: string; kind: string; storedName: string; createdAt: Date }) {
  return {
    id: row.id,
    category: row.category,
    kind: row.kind,
    url: `/api/uploads/marketing/${row.storedName}`,
    createdAt: row.createdAt,
  };
}

export async function listMarketingMedia(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.marketingMedia.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });
  res.json({ success: true, data: rows.map(present) });
}

export async function createMarketingMedia(req: Request, res: Response): Promise<void> {
  const category = marketingCategorySchema.safeParse(req.body.category);
  const kind = marketingKindSchema.safeParse(req.body.kind);
  if (!category.success || !kind.success) throw ApiError.badRequest('Choose fruit, flower, or foliage, and a photo or video.');
  const file = req.file;
  if (!file) throw ApiError.badRequest('Choose a photo or a video.');
  if (kind.data === 'PHOTO' && file.size > MAX_PHOTO_BYTES) {
    await unlink(file.path).catch(() => undefined);
    throw ApiError.badRequest('Each photo must be under 2 MB.');
  }
  const row = await prisma.marketingMedia.create({
    data: withNursery({
      category: category.data,
      kind: kind.data,
      storedName: file.filename,
    }),
  });
  await writeAudit(req.user!.id, 'CREATE', 'MarketingMedia', row.id, { category: row.category, kind: row.kind });
  res.status(201).json({ success: true, data: present(row) });
}

export async function deleteMarketingMedia(req: Request, res: Response): Promise<void> {
  const existing = await prisma.marketingMedia.findFirst({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Media not found');
  await prisma.marketingMedia.delete({ where: { id: existing.id } });
  await unlink(path.join(uploadDir, existing.storedName)).catch(() => undefined);
  await writeAudit(req.user!.id, 'DELETE', 'MarketingMedia', existing.id, { category: existing.category });
  res.json({ success: true, data: { id: existing.id, removed: true } });
}
