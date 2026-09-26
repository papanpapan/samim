import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/environment';
import { ApiError } from '../utils/apiError';
import { writeAudit } from '../services/audit.service';
import { currentNurseryId } from '../services/tenantContext';
import { assertUserCapacity } from '../services/plan.service';
import { enabledChannelChoices } from '../services/channelAccess.service';

const roleEnum = z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CASHIER']);
const ROLES = roleEnum.options;

export const roleFeatureSchema = z.object({
  features: z.array(z.string()),
  inherit: z.boolean().optional(),
});

const personSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  locationId: true,
} as const;

export const placeUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: roleEnum.default('STAFF'),
});

export const personUpdateSchema = z.object({
  name: z.string().min(2),
  role: roleEnum,
  password: z.union([z.string().min(6), z.literal('')]).optional(),
  locationId: z.string().min(1).nullable().optional(),
});

function nurseryIdOrThrow(): string {
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  return nurseryId;
}

async function placeInNursery(locationId: string, nurseryId: string) {
  const place = await prisma.nurseryLocation.findFirst({ where: { id: locationId, nurseryId } });
  if (!place) throw ApiError.notFound('Place not found');
  return place;
}

export async function listMyChannels(_req: Request, res: Response): Promise<void> {
  const channels = await enabledChannelChoices(nurseryIdOrThrow());
  res.json({ success: true, data: channels });
}

export async function getMyNursery(_req: Request, res: Response): Promise<void> {
  const nurseryId = nurseryIdOrThrow();
  const nursery = await prisma.nursery.findUnique({
    where: { id: nurseryId },
    include: {
      locations: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!nursery) throw ApiError.notFound('Nursery not found');
  const roleRows = await prisma.nurseryRoleFeature.findMany({ where: { nurseryId } });
  const enabledFeatures = await enabledNurseryFeatures(nurseryId);
  const people = await prisma.user.findMany({
    where: { nurseryId, isPlatformOwner: false, isActive: true },
    orderBy: { name: 'asc' },
    select: personSelect,
  });
  const locations = nursery.locations.map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    sortOrder: place.sortOrder,
    people: people.filter((person) => person.locationId === place.id),
  }));
  res.json({
    success: true,
    data: {
      id: nursery.id,
      name: nursery.name,
      code: nursery.code,
      phone: nursery.phone,
      address: nursery.address,
      onboardedAt: nursery.onboardedAt,
      plan: nursery.plan,
      currencyCode: nursery.currencyCode === 'INR' ? 'INR' : 'BDT',
      userLimit: nursery.userLimit,
      status: nursery.status,
      locations,
      unassigned: people.filter((person) => !person.locationId),
      features: enabledFeatures,
      roleAccess: ROLES.map((role) => {
        const rows = roleRows.filter((row) => row.role === role && row.enabled && enabledFeatures.includes(row.feature));
        const inherit = roleRows.every((row) => row.role !== role);
        return {
          role,
          inherit,
          features: inherit ? enabledFeatures : rows.map((row) => row.feature),
        };
      }),
    },
  });
}

async function enabledNurseryFeatures(nurseryId: string): Promise<string[]> {
  const rows = await prisma.nurseryFeature.findMany({ where: { nurseryId, enabled: true } });
  return rows.map((row) => row.feature);
}

export async function updateRoleFeatures(req: Request, res: Response): Promise<void> {
  const nurseryId = nurseryIdOrThrow();
  const role = roleEnum.safeParse(req.params.role);
  if (!role.success) throw ApiError.badRequest('Unknown role');
  const body = req.body as z.infer<typeof roleFeatureSchema>;
  const callerRole = req.user!.role;
  if (callerRole === 'MANAGER' && role.data !== 'STAFF' && role.data !== 'CASHIER') {
    throw ApiError.forbidden('A manager can change features for staff and cashier');
  }

  const nurseryOn = await enabledNurseryFeatures(nurseryId);
  let ceiling = new Set(nurseryOn);
  if (callerRole === 'MANAGER') {
    const managerRows = await prisma.nurseryRoleFeature.findMany({ where: { nurseryId, role: 'MANAGER' } });
    if (managerRows.length > 0) {
      const managerOn = new Set(managerRows.filter((row) => row.enabled).map((row) => row.feature));
      ceiling = new Set(nurseryOn.filter((feature) => managerOn.has(feature)));
    }
  }

  await prisma.nurseryRoleFeature.deleteMany({ where: { nurseryId, role: role.data } });
  const grantAll = body.inherit && callerRole !== 'MANAGER';
  const chosen = grantAll
    ? []
    : [...new Set(body.inherit ? [...ceiling] : body.features)].filter((feature) => ceiling.has(feature));
  if (!grantAll && chosen.length === 0 && nurseryOn.length > 0) {
    await prisma.nurseryRoleFeature.createMany({
      data: nurseryOn.map((feature) => ({ nurseryId, role: role.data, feature, enabled: false })),
    });
  } else if (!grantAll && chosen.length > 0) {
    await prisma.nurseryRoleFeature.createMany({
      data: chosen.map((feature) => ({ nurseryId, role: role.data, feature, enabled: true })),
    });
  }

  await writeAudit(req.user!.id, 'UPDATE', 'NurseryRoleFeature', nurseryId, { role: role.data, inherit: !!body.inherit, features: chosen });
  res.json({
    success: true,
    data: {
      role: role.data,
      inherit: grantAll,
      features: grantAll ? nurseryOn : chosen,
    },
  });
}

export async function addPlaceUser(req: Request, res: Response): Promise<void> {
  const nurseryId = nurseryIdOrThrow();
  const body = req.body as z.infer<typeof placeUserSchema>;
  await placeInNursery(req.params.locationId, nurseryId);
  await assertUserCapacity(nurseryId);
  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role,
      nurseryId,
      locationId: req.params.locationId,
    },
    select: personSelect,
  });
  await writeAudit(req.user!.id, 'CREATE', 'User', user.id, { email: user.email, role: user.role, locationId: user.locationId });
  res.status(201).json({ success: true, data: user });
}

export async function updatePlaceUser(req: Request, res: Response): Promise<void> {
  const nurseryId = nurseryIdOrThrow();
  const body = req.body as z.infer<typeof personUpdateSchema>;
  const existing = await prisma.user.findFirst({
    where: { id: req.params.id, nurseryId, isPlatformOwner: false, isActive: true },
  });
  if (!existing) throw ApiError.notFound('User not found');
  if (existing.id === req.user!.id && body.role !== 'ADMIN') {
    throw ApiError.forbidden('Keep your own admin role so this nursery still has a sign-in');
  }
  if (body.locationId) await placeInNursery(body.locationId, nurseryId);
  const passwordHash = body.password ? await bcrypt.hash(body.password, env.BCRYPT_SALT_ROUNDS) : undefined;
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: body.name,
      role: body.role,
      locationId: body.locationId === undefined ? existing.locationId : body.locationId,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: personSelect,
  });
  await writeAudit(req.user!.id, 'UPDATE', 'User', user.id, { role: user.role, locationId: user.locationId });
  res.json({ success: true, data: user });
}

export async function removePlaceUser(req: Request, res: Response): Promise<void> {
  const nurseryId = nurseryIdOrThrow();
  const existing = await prisma.user.findFirst({
    where: { id: req.params.id, nurseryId, isPlatformOwner: false, isActive: true },
  });
  if (!existing) throw ApiError.notFound('User not found');
  if (existing.id === req.user!.id) throw ApiError.forbidden('You cannot remove your own sign-in');
  await prisma.user.update({ where: { id: existing.id }, data: { isActive: false } });
  await writeAudit(req.user!.id, 'DELETE', 'User', existing.id, { email: existing.email });
  res.json({ success: true, data: { id: existing.id } });
}
