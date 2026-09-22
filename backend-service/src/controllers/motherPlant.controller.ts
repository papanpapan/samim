import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';

export const createMotherPlantSchema = z.object({
  tagNumber: z.string().min(2),
  varietyName: z.string().min(2),
  scientificName: z.string().optional(),
  sourceCountry: z.string().optional(),
  plantingDate: z.coerce.date(),
  plotLocation: z.string().min(1),
  healthStatus: z.string().default('EXCELLENT'),
  notes: z.string().optional(),
});

export async function listMotherPlants(_req: Request, res: Response): Promise<void> {
  const [items, total, scionAgg] = await Promise.all([
    prisma.motherPlant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { propagations: true } } },
    }),
    prisma.motherPlant.count(),
    prisma.motherPlant.aggregate({ _sum: { scionsHarvested: true } }),
  ]);
  res.json({
    success: true,
    data: items,
    meta: { total, totalScionsHarvested: scionAgg._sum.scionsHarvested ?? 0 },
  });
}

export async function getMotherPlant(req: Request, res: Response): Promise<void> {
  const plant = await prisma.motherPlant.findUnique({
    where: { id: req.params.id },
    include: { propagations: true },
  });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  res.json({ success: true, data: plant });
}

export async function createMotherPlant(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createMotherPlantSchema>;
  const plant = await prisma.motherPlant.create({ data: body });
  res.status(201).json({ success: true, data: plant });
}

export const scionSchema = z.object({ quantity: z.coerce.number().int().positive() });

// Logs scion harvest, incrementing the running count (US-MP-01).
export async function logScionHarvest(req: Request, res: Response): Promise<void> {
  const { quantity } = req.body as z.infer<typeof scionSchema>;
  const plant = await prisma.motherPlant.update({
    where: { id: req.params.id },
    data: { scionsHarvested: { increment: quantity } },
  });
  res.json({ success: true, data: plant });
}
