import { prisma } from '../config/database';

export async function writeAudit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  payload?: unknown,
): Promise<void> {
  const raw = payload === undefined ? null : JSON.stringify(payload);
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      payload: raw ? raw.slice(0, 2000) : null,
    },
  });
}
