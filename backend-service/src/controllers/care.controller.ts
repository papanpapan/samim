import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { withNursery } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';
import { writeAudit } from '../services/audit.service';

const TASKS = ['WATERING', 'NPK_SPRAY', 'FUNGICIDE', 'INSECTICIDE', 'PRUNING'] as const;
const FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'BI_WEEKLY'] as const;

export const createCareSchema = z.object({
  plantId: z.string().uuid(),
  taskType: z.enum(TASKS),
  frequency: z.enum(FREQUENCIES).default('DAILY'),
  scheduledOn: z.coerce.date(),
  staffNotes: z.string().optional(),
});

function addFrequency(from: Date, frequency: string): Date | null {
  const next = new Date(from);
  if (frequency === 'DAILY') next.setDate(next.getDate() + 1);
  else if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (frequency === 'BI_WEEKLY') next.setDate(next.getDate() + 14);
  else return null;
  return next;
}

export async function listCare(_req: Request, res: Response): Promise<void> {
  const [tasks, diseases] = await Promise.all([
    prisma.careSchedule.findMany({
      orderBy: { scheduledOn: 'asc' },
      include: { plant: { select: { id: true, sku: true, commonName: true } } },
      take: 200,
    }),
    prisma.diseaseLog.findMany({ orderBy: { observedOn: 'desc' }, take: 100 }),
  ]);
  res.json({ success: true, data: { tasks, diseases } });
}

export async function createCare(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createCareSchema>;
  const plant = await prisma.plantInventory.findUnique({ where: { id: body.plantId } });
  if (!plant) throw ApiError.notFound('Plant not found');
  const task = await prisma.careSchedule.create({
    data: withNursery({
      plantId: body.plantId,
      taskType: body.taskType,
      frequency: body.frequency,
      scheduledOn: body.scheduledOn,
      staffNotes: body.staffNotes,
      status: 'PENDING',
    }),
    include: { plant: { select: { id: true, sku: true, commonName: true } } },
  });
  await writeAudit(req.user!.id, 'CREATE', 'CareSchedule', task.id, { taskType: task.taskType });
  res.status(201).json({ success: true, data: task });
}

export const completeCareSchema = z.object({
  staffNotes: z.string().optional(),
});

export async function completeCare(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof completeCareSchema>;
  const existing = await prisma.careSchedule.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Care task not found');
  if (existing.status === 'DONE') throw ApiError.conflict('Task already completed');

  const task = await prisma.careSchedule.update({
    where: { id: existing.id },
    data: {
      status: 'DONE',
      completedOn: new Date(),
      staffNotes: body.staffNotes ?? existing.staffNotes,
    },
  });

  const nextOn = addFrequency(existing.scheduledOn, existing.frequency);
  if (nextOn) {
    await prisma.careSchedule.create({
      data: withNursery({
        plantId: existing.plantId,
        taskType: existing.taskType,
        frequency: existing.frequency,
        scheduledOn: nextOn,
        status: 'PENDING',
      }),
    });
  }

  await writeAudit(req.user!.id, 'COMPLETE', 'CareSchedule', task.id, { taskType: task.taskType });
  res.json({ success: true, data: task });
}

export const diseaseSchema = z.object({
  subject: z.string().min(2),
  plantId: z.string().uuid().optional(),
  diagnosis: z.string().min(2),
  treatment: z.string().optional(),
  observedOn: z.coerce.date().optional(),
  staffNotes: z.string().optional(),
});

export async function createDisease(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof diseaseSchema>;
  const log = await prisma.diseaseLog.create({
    data: withNursery({
      subject: body.subject,
      plantId: body.plantId,
      diagnosis: body.diagnosis,
      treatment: body.treatment,
      observedOn: body.observedOn ?? new Date(),
      staffNotes: body.staffNotes,
      status: 'OPEN',
    }),
  });
  await writeAudit(req.user!.id, 'CREATE', 'DiseaseLog', log.id, { subject: log.subject });
  res.status(201).json({ success: true, data: log });
}

export const resolveDiseaseSchema = z.object({
  treatment: z.string().optional(),
  staffNotes: z.string().optional(),
});

export async function resolveDisease(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof resolveDiseaseSchema>;
  const existing = await prisma.diseaseLog.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Disease log not found');
  const log = await prisma.diseaseLog.update({
    where: { id: existing.id },
    data: {
      status: 'RESOLVED',
      resolvedOn: new Date(),
      treatment: body.treatment ?? existing.treatment,
      staffNotes: body.staffNotes ?? existing.staffNotes,
    },
  });
  await writeAudit(req.user!.id, 'RESOLVE', 'DiseaseLog', log.id);
  res.json({ success: true, data: log });
}
