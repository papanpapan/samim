import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/environment';
import { isFeatureCode } from '../constants/features';
import { activeFeatureKeys, listCatalog } from '../services/catalog.service';
import { assertUserCapacity, isPlanCode, listPackages, uniqueNurseryCode } from '../services/plan.service';
import { writeAudit } from '../services/audit.service';
import { addChannel, defaultChannelRows, listChannelCatalog, removeChannel } from '../services/channelAccess.service';
import { ApiError } from '../utils/apiError';

const featureList = z.array(z.string()).optional();

const placeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(80).optional(),
  address: z.string().min(3),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const onboardSchema = z.object({
  name: z.string().min(2),
  places: z.array(placeSchema).min(1).max(20),
  phone: z.string().optional(),
  onboardedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date'),
  plan: z.enum(['FREE', 'SILVER', 'GOLDEN', 'PLATINUM']),
  planPrice: z.number().nonnegative(),
  currencyCode: z.enum(['BDT', 'INR']).default('BDT'),
  userLimit: z.number().int().nonnegative(),
  plantLimit: z.number().int().nonnegative(),
  features: featureList,
  admin: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

export const nurseryUpdateSchema = onboardSchema.omit({ admin: true });

export const featureSchema = z.object({
  features: z.array(z.object({ feature: z.string(), enabled: z.boolean() })).default([]),
  inherit: z.boolean().optional(),
});

export const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const platformUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CASHIER']).default('STAFF'),
  locationId: z.string().uuid().optional(),
  features: featureList,
});

async function cleanFeatures(input: string[] | undefined, fallbackAll: boolean): Promise<string[]> {
  const keys = await activeFeatureKeys();
  if (!input || input.length === 0) return fallbackAll ? keys : [];
  return keys.filter((key) => input.includes(key));
}

const nurseryInclude = {
  locations: { orderBy: { sortOrder: 'asc' as const } },
  features: true,
  salesChannels: { orderBy: { channel: 'asc' as const } },
  users: {
    where: { isPlatformOwner: false, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      locationId: true,
      featureGrants: { select: { feature: true, enabled: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

export async function listNurseries(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.nursery.findMany({
    orderBy: { createdAt: 'asc' },
    include: nurseryInclude,
  });
  res.json({ success: true, data: rows });
}

export async function onboardNursery(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof onboardSchema>;
  const code = await uniqueNurseryCode(body.name);
  const enabled = new Set(await cleanFeatures(body.features, true));
  const catalogKeys = await activeFeatureKeys();
  const passwordHash = await bcrypt.hash(body.admin.password, env.BCRYPT_SALT_ROUNDS);

  const existingEmail = await prisma.user.findUnique({ where: { email: body.admin.email } });
  if (existingEmail) {
    throw ApiError.conflict('That email is already used. Each person has one login.');
  }

  const channelRows = await defaultChannelRows();
  const places = body.places.map((place, index) => ({
    name: place.name?.trim() || '',
    address: place.address.trim(),
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    sortOrder: index,
  }));
  const primary = places[0];

  const nursery = await prisma.nursery.create({
    data: {
      name: body.name.trim(),
      code,
      address: primary.address,
      latitude: primary.latitude,
      longitude: primary.longitude,
      locations: { create: places },
      plan: body.plan,
      planPrice: body.planPrice,
      currencyCode: body.currencyCode,
      userLimit: body.userLimit,
      plantLimit: body.plantLimit,
      phone: body.phone?.trim() || null,
      onboardedAt: new Date(`${body.onboardedAt}T00:00:00.000Z`),
      features: {
        create: catalogKeys.map((feature) => ({ feature, enabled: enabled.has(feature) })),
      },
      salesChannels: { create: channelRows },
      users: {
        create: {
          name: body.admin.name.trim(),
          email: body.admin.email.trim().toLowerCase(),
          passwordHash,
          role: 'ADMIN',
        },
      },
    },
    include: nurseryInclude,
  });

  const firstPlace = [...nursery.locations].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (firstPlace) {
    await prisma.user.updateMany({
      where: { nurseryId: nursery.id, isPlatformOwner: false },
      data: { locationId: firstPlace.id },
    });
  }

  const created = await prisma.nursery.findUnique({ where: { id: nursery.id }, include: nurseryInclude });
  await writeAudit(req.user!.id, 'CREATE', 'Nursery', nursery.id, { code: nursery.code, name: nursery.name });
  res.status(201).json({ success: true, data: created });
}

export async function updateNursery(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof nurseryUpdateSchema>;
  const nursery = await prisma.nursery.findUnique({ where: { id: req.params.id } });
  if (!nursery) throw ApiError.notFound('Nursery not found');

  const existingPlaces = await prisma.nurseryLocation.findMany({ where: { nurseryId: nursery.id } });
  const owned = new Set(existingPlaces.map((place) => place.id));
  const places = body.places.map((place, index) => ({
    id: place.id && owned.has(place.id) ? place.id : undefined,
    name: place.name?.trim() || '',
    address: place.address.trim(),
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    sortOrder: index,
  }));
  const kept = new Set(places.flatMap((place) => (place.id ? [place.id] : [])));
  const primary = places[0];
  const enabled = new Set(await cleanFeatures(body.features, true));
  const catalogKeys = await activeFeatureKeys();

  await prisma.$transaction(async (tx) => {
    for (const place of places) {
      const data = {
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        sortOrder: place.sortOrder,
      };
      if (place.id) {
        await tx.nurseryLocation.update({ where: { id: place.id }, data });
      } else {
        await tx.nurseryLocation.create({ data: { nurseryId: nursery.id, ...data } });
      }
    }
    const removed = existingPlaces.filter((place) => !kept.has(place.id)).map((place) => place.id);
    if (removed.length > 0) {
      await tx.nurseryLocation.deleteMany({ where: { id: { in: removed } } });
    }
    await tx.nursery.update({
      where: { id: nursery.id },
      data: {
        name: body.name.trim(),
        address: primary.address,
        latitude: primary.latitude,
        longitude: primary.longitude,
        phone: body.phone?.trim() || null,
        onboardedAt: new Date(`${body.onboardedAt}T00:00:00.000Z`),
        plan: body.plan,
        planPrice: body.planPrice,
        currencyCode: body.currencyCode,
        userLimit: body.userLimit,
        plantLimit: body.plantLimit,
      },
    });
    for (const feature of catalogKeys) {
      await tx.nurseryFeature.upsert({
        where: { nurseryId_feature: { nurseryId: nursery.id, feature } },
        update: { enabled: enabled.has(feature) },
        create: { nurseryId: nursery.id, feature, enabled: enabled.has(feature) },
      });
    }
  });

  const updated = await prisma.nursery.findUnique({ where: { id: nursery.id }, include: nurseryInclude });
  await writeAudit(req.user!.id, 'UPDATE', 'Nursery', nursery.id, { name: body.name, plan: body.plan });
  res.json({ success: true, data: updated });
}

export async function updateNurseryFeatures(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof featureSchema>;
  const nursery = await prisma.nursery.findUnique({ where: { id: req.params.id } });
  if (!nursery) throw ApiError.notFound('Nursery not found');

  const allowed = new Set(await activeFeatureKeys());
  await prisma.$transaction(
    body.features.filter((row) => allowed.has(row.feature)).map((row) =>
      prisma.nurseryFeature.upsert({
        where: { nurseryId_feature: { nurseryId: nursery.id, feature: row.feature } },
        update: { enabled: row.enabled },
        create: { nurseryId: nursery.id, feature: row.feature, enabled: row.enabled },
      }),
    ),
  );

  const updated = await prisma.nursery.findUnique({ where: { id: nursery.id }, include: nurseryInclude });
  await writeAudit(req.user!.id, 'UPDATE', 'NurseryFeature', nursery.id, body.features);
  res.json({ success: true, data: updated });
}

export const nurseryChannelSchema = z.object({
  channels: z.array(z.object({
    channel: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
    enabled: z.boolean(),
  })).min(1),
});

export const channelCreateSchema = z.object({
  label: z.string().trim().min(2).max(40),
});

export async function listChannels(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await listChannelCatalog() });
}

export async function createChannel(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof channelCreateSchema>;
  const row = await addChannel(body.label);
  await writeAudit(req.user!.id, 'CREATE', 'ChannelCatalog', row.code, { label: row.label });
  res.status(201).json({ success: true, data: row });
}

export async function deleteChannel(req: Request, res: Response): Promise<void> {
  const code = req.params.code.toUpperCase();
  await removeChannel(code);
  await writeAudit(req.user!.id, 'DELETE', 'ChannelCatalog', code, null);
  res.json({ success: true, data: { code, removed: true } });
}

export async function updateNurseryChannels(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof nurseryChannelSchema>;
  const nursery = await prisma.nursery.findUnique({ where: { id: req.params.id } });
  if (!nursery) throw ApiError.notFound('Nursery not found');
  const catalog = new Set((await listChannelCatalog()).map((row) => row.code));
  const rows = body.channels.filter((row) => catalog.has(row.channel));
  if (!rows.some((row) => row.enabled)) {
    throw ApiError.badRequest('A nursery needs at least one sales channel');
  }
  await prisma.$transaction(
    rows.map((row) => prisma.nurseryChannel.upsert({
      where: { nurseryId_channel: { nurseryId: nursery.id, channel: row.channel } },
      update: { enabled: row.enabled },
      create: { nurseryId: nursery.id, channel: row.channel, enabled: row.enabled },
    })),
  );
  const updated = await prisma.nursery.findUnique({ where: { id: nursery.id }, include: nurseryInclude });
  await writeAudit(req.user!.id, 'UPDATE', 'NurseryChannel', nursery.id, rows);
  res.json({ success: true, data: updated });
}

export async function updateNurseryStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof statusSchema>;
  const nursery = await prisma.nursery.update({
    where: { id: req.params.id },
    data: { status: body.status },
    include: nurseryInclude,
  });
  await writeAudit(req.user!.id, 'UPDATE', 'Nursery', nursery.id, { status: body.status });
  res.json({ success: true, data: nursery });
}

export async function updateUserFeatures(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof featureSchema> & { inherit?: boolean };
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user || user.isPlatformOwner) throw ApiError.notFound('User not found');

  await prisma.userFeature.deleteMany({ where: { userId: user.id } });
  if (!body.inherit) {
    const allowed = new Set(await activeFeatureKeys());
    const rows = body.features.filter((row) => allowed.has(row.feature));
    if (rows.length > 0) {
      await prisma.userFeature.createMany({
        data: rows.map((row) => ({ userId: user.id, feature: row.feature, enabled: row.enabled })),
      });
    }
  }

  await writeAudit(req.user!.id, 'UPDATE', 'UserFeature', user.id, { inherit: !!body.inherit });
  const grants = await prisma.userFeature.findMany({ where: { userId: user.id } });
  res.json({ success: true, data: { id: user.id, featureGrants: grants } });
}

async function placeIdForNursery(nurseryId: string, locationId: string | null | undefined, required: boolean) {
  const places = await prisma.nurseryLocation.findMany({ where: { nurseryId } });
  if (!locationId) {
    if (required && places.length > 0) throw ApiError.badRequest('Choose a place for this person');
    return null;
  }
  const place = places.find((row) => row.id === locationId);
  if (!place) throw ApiError.badRequest('Choose a place in this nursery');
  return place.id;
}

export async function createNurseryUser(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof platformUserSchema>;
  const nursery = await prisma.nursery.findUnique({ where: { id: req.params.id } });
  if (!nursery) throw ApiError.notFound('Nursery not found');
  await assertUserCapacity(nursery.id);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw ApiError.conflict('That email is already used. Each person has one login.');
  const locationId = await placeIdForNursery(nursery.id, body.locationId, true);

  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_SALT_ROUNDS);
  const grants = body.features && body.features.length > 0 ? await cleanFeatures(body.features, false) : null;
  const catalogKeys = await activeFeatureKeys();
  const user = await prisma.user.create({
    data: {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      passwordHash,
      role: body.role,
      nurseryId: nursery.id,
      locationId,
      featureGrants: grants
        ? { create: catalogKeys.map((feature) => ({ feature, enabled: grants.includes(feature) })) }
        : undefined,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, locationId: true, featureGrants: true },
  });
  await writeAudit(req.user!.id, 'CREATE', 'User', user.id, { email: user.email, nursery: nursery.code });
  res.status(201).json({ success: true, data: user });
}

export const platformUserUpdateSchema = z.object({
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'CASHIER']),
  password: z.string().min(6).optional().or(z.literal('')),
  locationId: z.string().uuid().nullable().optional(),
});

export async function updateNurseryUser(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof platformUserUpdateSchema>;
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.isPlatformOwner) throw ApiError.notFound('User not found');
  if (!existing.nurseryId) throw ApiError.badRequest('This person is not in a nursery');
  const passwordHash = body.password ? await bcrypt.hash(body.password, env.BCRYPT_SALT_ROUNDS) : undefined;
  const locationId = body.locationId === undefined
    ? undefined
    : await placeIdForNursery(existing.nurseryId, body.locationId, false);
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: body.name.trim(),
      role: body.role,
      ...(locationId !== undefined ? { locationId } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, locationId: true },
  });
  await writeAudit(req.user!.id, 'UPDATE', 'User', user.id, { role: user.role });
  res.json({ success: true, data: user });
}

export async function deleteNurseryUser(req: Request, res: Response): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.isPlatformOwner) throw ApiError.notFound('User not found');
  await prisma.userFeature.deleteMany({ where: { userId: existing.id } });
  const audits = await prisma.auditLog.count({ where: { userId: existing.id } });
  if (audits > 0) {
    await prisma.user.update({ where: { id: existing.id }, data: { isActive: false } });
    await writeAudit(req.user!.id, 'UPDATE', 'User', existing.id, { isActive: false });
    res.json({ success: true, data: { id: existing.id, deactivated: true } });
    return;
  }
  await prisma.user.delete({ where: { id: existing.id } });
  await writeAudit(req.user!.id, 'DELETE', 'User', existing.id, { email: existing.email });
  res.json({ success: true, data: { id: existing.id, removed: true } });
}

export const catalogCreateSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]{2,31}$/),
  label: z.string().min(2),
  description: z.string().optional(),
});

export const catalogUpdateSchema = z.object({
  label: z.string().min(2).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export async function listFeatureCatalog(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await listCatalog() });
}

export async function createFeature(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof catalogCreateSchema>;
  const key = body.key.trim().toUpperCase();
  if (!isFeatureCode(key)) throw ApiError.badRequest('Use a short code like SOIL_TEST');
  const existing = await prisma.featureCatalog.findUnique({ where: { key } });
  if (existing) throw ApiError.conflict('That feature already exists');
  const last = await prisma.featureCatalog.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.featureCatalog.create({
    data: {
      key,
      label: body.label.trim(),
      description: body.description?.trim() || null,
      system: false,
      active: true,
      sortOrder: (last._max.sortOrder ?? 0) + 10,
    },
  });
  await writeAudit(req.user!.id, 'CREATE', 'FeatureCatalog', row.key, { label: row.label });
  res.status(201).json({ success: true, data: row });
}

export async function updateFeature(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof catalogUpdateSchema>;
  const key = req.params.key;
  const existing = await prisma.featureCatalog.findUnique({ where: { key } });
  if (!existing) throw ApiError.notFound('Feature not found');
  const row = await prisma.featureCatalog.update({
    where: { key },
    data: {
      label: body.label?.trim() || existing.label,
      description: body.description !== undefined ? body.description.trim() || null : existing.description,
      active: body.active ?? existing.active,
    },
  });
  await writeAudit(req.user!.id, 'UPDATE', 'FeatureCatalog', row.key, { label: row.label, active: row.active });
  res.json({ success: true, data: row });
}

export async function deleteFeature(req: Request, res: Response): Promise<void> {
  const key = req.params.key;
  const existing = await prisma.featureCatalog.findUnique({ where: { key } });
  if (!existing) throw ApiError.notFound('Feature not found');
  if (existing.system) {
    await prisma.featureCatalog.update({ where: { key }, data: { active: false } });
    await prisma.nurseryFeature.updateMany({ where: { feature: key }, data: { enabled: false } });
    await writeAudit(req.user!.id, 'UPDATE', 'FeatureCatalog', key, { active: false });
    res.json({ success: true, data: { key, active: false, removed: false } });
    return;
  }
  await prisma.nurseryFeature.deleteMany({ where: { feature: key } });
  await prisma.userFeature.deleteMany({ where: { feature: key } });
  await prisma.featureCatalog.delete({ where: { key } });
  await writeAudit(req.user!.id, 'DELETE', 'FeatureCatalog', key, null);
  res.json({ success: true, data: { key, removed: true } });
}

export const packageSchema = z.object({
  price: z.number().nonnegative(),
  userLimit: z.number().int().positive(),
  plantLimit: z.number().int().nonnegative(),
});

export async function listPackagePlans(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await listPackages() });
}

export async function updatePackagePlan(req: Request, res: Response): Promise<void> {
  const code = req.params.code;
  if (!isPlanCode(code)) throw ApiError.notFound('Package not found');
  const body = req.body as z.infer<typeof packageSchema>;
  const row = await prisma.packagePlan.update({
    where: { code },
    data: { price: body.price, userLimit: body.userLimit, plantLimit: body.plantLimit },
  });
  await writeAudit(req.user!.id, 'UPDATE', 'PackagePlan', row.code, body);
  res.json({
    success: true,
    data: { code: row.code, label: row.label, price: Number(row.price), userLimit: row.userLimit, plantLimit: row.plantLimit },
  });
}
