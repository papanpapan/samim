import { prisma } from '../config/database';
import { runWithNursery } from './tenantContext';
import { ApiError } from '../utils/apiError';

const CHANNEL_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;

const DEFAULT_ON = new Set(['RETAIL_COUNTER', 'WHOLESALE_ORCHARDIST', 'INDIAMART', 'MEESHO']);

export interface ChannelChoice {
  code: string;
  label: string;
  system: boolean;
  inUse: boolean;
}

export function channelCodeFromLabel(label: string): string {
  const code = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  if (!CHANNEL_CODE.test(code)) {
    throw ApiError.badRequest('Use a name like Facebook or Instagram');
  }
  return code;
}

export async function listChannelCatalog(): Promise<ChannelChoice[]> {
  return runWithNursery(null, async () => {
    const rows = await prisma.channelCatalog.findMany({ orderBy: { sortOrder: 'asc' } });
    const sales = await prisma.sale.groupBy({ by: ['channel'], _count: { _all: true } });
    const used = new Set(sales.map((row) => row.channel));
    return rows.map((row) => ({
      code: row.code,
      label: row.label,
      system: row.system,
      inUse: row.system || used.has(row.code),
    }));
  });
}

export async function defaultChannelRows(): Promise<{ channel: string; enabled: boolean }[]> {
  const rows = await prisma.channelCatalog.findMany({ orderBy: { sortOrder: 'asc' } });
  return rows.map((row) => ({ channel: row.code, enabled: DEFAULT_ON.has(row.code) }));
}

export async function enabledChannels(nurseryId: string): Promise<string[]> {
  const rows = await prisma.nurseryChannel.findMany({ where: { nurseryId }, orderBy: { channel: 'asc' } });
  if (rows.length === 0) return [...DEFAULT_ON];
  const enabled = rows.filter((row) => row.enabled).map((row) => row.channel);
  return enabled.length > 0 ? enabled : ['RETAIL_COUNTER'];
}

export async function enabledChannelChoices(nurseryId: string): Promise<{ code: string; label: string }[]> {
  const [catalog, codes] = await Promise.all([
    prisma.channelCatalog.findMany({ orderBy: { sortOrder: 'asc' } }),
    enabledChannels(nurseryId),
  ]);
  const labels = new Map(catalog.map((row) => [row.code, row.label]));
  const order = new Map(catalog.map((row, index) => [row.code, index]));
  return [...codes]
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .map((code) => ({ code, label: labels.get(code) ?? code.replace(/_/g, ' ') }));
}

export async function addChannel(label: string): Promise<ChannelChoice> {
  const code = channelCodeFromLabel(label);
  const cleanLabel = label.trim();
  return runWithNursery(null, async () => {
    const existing = await prisma.channelCatalog.findUnique({ where: { code } });
    if (existing) throw ApiError.conflict('That channel already exists');
    const last = await prisma.channelCatalog.aggregate({ _max: { sortOrder: true } });
    const nurseries = await prisma.nursery.findMany({ select: { id: true } });
    await prisma.$transaction(async (tx) => {
      await tx.channelCatalog.create({
        data: {
          code,
          label: cleanLabel,
          system: false,
          sortOrder: (last._max.sortOrder ?? 0) + 10,
        },
      });
      if (nurseries.length > 0) {
        await tx.nurseryChannel.createMany({
          data: nurseries.map((nursery) => ({ nurseryId: nursery.id, channel: code, enabled: false })),
          skipDuplicates: true,
        });
      }
    });
    return { code, label: cleanLabel, system: false, inUse: false };
  });
}

export async function removeChannel(code: string): Promise<void> {
  if (!CHANNEL_CODE.test(code)) throw ApiError.badRequest('Unknown channel');
  await runWithNursery(null, async () => {
    const existing = await prisma.channelCatalog.findUnique({ where: { code } });
    if (!existing) throw ApiError.notFound('Channel not found');
    if (existing.system || existing.code === 'RETAIL_COUNTER') {
      throw ApiError.badRequest('The counter channel stays on every nursery');
    }
    const sales = await prisma.sale.count({ where: { channel: code } });
    if (sales > 0) {
      throw ApiError.badRequest('This channel is already on a receipt. Turn it off for the nursery instead');
    }
    const left = await prisma.channelCatalog.count();
    if (left <= 1) throw ApiError.badRequest('A nursery needs at least one sales channel');
    await prisma.$transaction([
      prisma.plantChannelPrice.deleteMany({ where: { channel: code } }),
      prisma.nurseryChannel.deleteMany({ where: { channel: code } }),
      prisma.channelCatalog.delete({ where: { code } }),
    ]);
  });
}
