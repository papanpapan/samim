import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { currentNurseryId } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';

export async function listAudit(_req: Request, res: Response): Promise<void> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 200,
    include: { user: { select: { name: true, email: true, role: true } } },
  });
  res.json({ success: true, data: logs });
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  const users = await prisma.user.findMany({
    where: { nurseryId, isPlatformOwner: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
  });
  res.json({ success: true, data: users });
}
