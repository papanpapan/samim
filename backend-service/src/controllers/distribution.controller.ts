import { Request, Response } from 'express';
import { z } from 'zod';
import { BookingStatus, LeadSource, LeadStatus, ManifestStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { withNursery } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';
import { writeAudit } from '../services/audit.service';

async function nextManifestNo(tx: { transportManifest: { count: (args: { where: { manifestNo: { startsWith: string } } }) => Promise<number> } }): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MAN-${year}-`;
  const count = await tx.transportManifest.count({ where: { manifestNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export const bookingSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  variety: z.string().min(2),
  quantity: z.coerce.number().int().positive(),
  neededBy: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const bookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

export async function listBookings(_req: Request, res: Response): Promise<void> {
  const items = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ success: true, data: items });
}

export async function createBooking(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof bookingSchema>;
  const booking = await prisma.booking.create({ data: withNursery(body) });
  await writeAudit(req.user!.id, 'CREATE', 'Booking', booking.id, { variety: booking.variety });
  res.status(201).json({ success: true, data: booking });
}

export async function updateBookingStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof bookingStatusSchema>;
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Booking not found');
  const booking = await prisma.booking.update({ where: { id: existing.id }, data: { status: body.status } });
  await writeAudit(req.user!.id, 'STATUS', 'Booking', booking.id, { status: body.status });
  res.json({ success: true, data: booking });
}

export const manifestSchema = z.object({
  bookingId: z.string().uuid().optional(),
  destination: z.string().min(2),
  vehicleNo: z.string().optional(),
  driverName: z.string().optional(),
  cargoSummary: z.string().min(2),
});

export const manifestStatusSchema = z.object({
  status: z.nativeEnum(ManifestStatus),
});

export async function listManifests(_req: Request, res: Response): Promise<void> {
  const items = await prisma.transportManifest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { booking: { select: { customerName: true, variety: true } } },
  });
  res.json({ success: true, data: items });
}

export async function createManifest(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof manifestSchema>;
  const manifest = await prisma.$transaction(async (tx) => {
    const manifestNo = await nextManifestNo(tx);
    return tx.transportManifest.create({
      data: withNursery({ ...body, manifestNo }),
    });
  });
  await writeAudit(req.user!.id, 'CREATE', 'TransportManifest', manifest.id, { manifestNo: manifest.manifestNo });
  res.status(201).json({ success: true, data: manifest });
}

export async function updateManifestStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof manifestStatusSchema>;
  const existing = await prisma.transportManifest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Manifest not found');
  const manifest = await prisma.transportManifest.update({
    where: { id: existing.id },
    data: {
      status: body.status,
      dispatchedAt: body.status === 'DISPATCHED' ? new Date() : existing.dispatchedAt,
    },
  });
  await writeAudit(req.user!.id, 'STATUS', 'TransportManifest', manifest.id, { status: body.status });
  res.json({ success: true, data: manifest });
}

export const leadSchema = z.object({
  source: z.nativeEnum(LeadSource),
  contactName: z.string().min(2),
  phone: z.string().optional(),
  productInterest: z.string().min(2),
  quantity: z.coerce.number().int().positive().default(1),
  notes: z.string().optional(),
});

export const leadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

export async function listLeads(_req: Request, res: Response): Promise<void> {
  const items = await prisma.marketplaceLead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ success: true, data: items });
}

export async function createLead(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof leadSchema>;
  const lead = await prisma.marketplaceLead.create({ data: withNursery(body) });
  await writeAudit(req.user!.id, 'CREATE', 'MarketplaceLead', lead.id, { source: lead.source });
  res.status(201).json({ success: true, data: lead });
}

export async function updateLeadStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof leadStatusSchema>;
  const existing = await prisma.marketplaceLead.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Lead not found');
  const lead = await prisma.marketplaceLead.update({ where: { id: existing.id }, data: { status: body.status } });
  await writeAudit(req.user!.id, 'STATUS', 'MarketplaceLead', lead.id, { status: body.status });
  res.json({ success: true, data: lead });
}
