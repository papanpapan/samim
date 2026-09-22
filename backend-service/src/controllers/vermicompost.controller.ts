import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';

export const createBedSchema = z.object({
  bedCode: z.string().min(2),
  rawBiomassKg: z.coerce.number().nonnegative(),
  cowDungKg: z.coerce.number().nonnegative(),
  speciesWorms: z.string().default('Eisenia foetida'),
  startDate: z.coerce.date(),
  curingDays: z.coerce.number().int().positive().default(65),
});

export async function listBeds(_req: Request, res: Response): Promise<void> {
  const beds = await prisma.vermicompostBed.findMany({ orderBy: { startDate: 'desc' } });
  const now = Date.now();
  const withStatus = beds.map((b) => ({
    ...b,
    readyForSieving: !b.harvestedDate && b.expectedDate.getTime() <= now,
  }));
  res.json({ success: true, data: withStatus });
}

export async function createBed(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createBedSchema>;
  const expectedDate = new Date(body.startDate);
  expectedDate.setDate(expectedDate.getDate() + body.curingDays);
  const bed = await prisma.vermicompostBed.create({
    data: {
      bedCode: body.bedCode,
      rawBiomassKg: body.rawBiomassKg,
      cowDungKg: body.cowDungKg,
      speciesWorms: body.speciesWorms,
      startDate: body.startDate,
      expectedDate,
      status: 'DECOMPOSING',
    },
  });
  res.status(201).json({ success: true, data: bed });
}

export const harvestSchema = z.object({
  actualYieldKg: z.coerce.number().positive(),
  qualityGrade: z.string().default('Grade A'),
});

export async function harvestBed(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof harvestSchema>;
  const bed = await prisma.vermicompostBed.findUnique({ where: { id: req.params.id } });
  if (!bed) throw ApiError.notFound('Bed not found');
  if (bed.harvestedDate) throw ApiError.conflict('Bed already harvested');
  const updated = await prisma.vermicompostBed.update({
    where: { id: bed.id },
    data: {
      harvestedDate: new Date(),
      actualYieldKg: body.actualYieldKg,
      qualityGrade: body.qualityGrade,
      status: 'HARVESTED',
    },
  });
  res.json({ success: true, data: updated });
}
