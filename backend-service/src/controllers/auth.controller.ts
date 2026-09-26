import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/environment';
import { ApiError } from '../utils/apiError';
import { writeAudit } from '../services/audit.service';
import { resolveAccess } from '../services/access.service';
import { currentNurseryId } from '../services/tenantContext';
import { assertUserCapacity } from '../services/plan.service';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(user: { id: string; email: string; role: string; name: string }) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  const profile = await resolveAccess(user.id, null);
  res.json({
    success: true,
    data: { token, user: profile },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const profile = await resolveAccess(req.user!.id, req.header('x-nursery-id'));
  res.json({ success: true, data: profile });
}

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CASHIER']).default('STAFF'),
});

export async function createUser(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof registerSchema>;
  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_SALT_ROUNDS);
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  await assertUserCapacity(nurseryId);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      passwordHash,
      role: body.role,
      nurseryId,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  await writeAudit(req.user!.id, 'CREATE', 'User', user.id, { email: user.email, role: user.role });
  res.status(201).json({ success: true, data: user });
}

export const roleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CASHIER']),
  isActive: z.boolean().optional(),
});

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof roleSchema>;
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.isPlatformOwner || existing.nurseryId !== nurseryId) {
    throw ApiError.notFound('User not found');
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { role: body.role, isActive: body.isActive ?? existing.isActive },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  await writeAudit(req.user!.id, 'UPDATE', 'User', user.id, { role: user.role });
  res.json({ success: true, data: user });
}
