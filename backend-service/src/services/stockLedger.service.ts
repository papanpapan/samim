import { ApiError } from '../utils/apiError';

type Tx = {
  plantInventory: {
    findUnique: (args: { where: { id: string } }) => Promise<{ currentStock: number; sku: string; reservedQty: number } | null>;
    update: (args: {
      where: { id: string };
      data: {
        currentStock: number;
        soldQty?: { increment: number };
        mortalityQty?: { increment: number };
      };
    }) => Promise<unknown>;
  };
  stockLedger: {
    create: (args: {
      data: {
        plantId: string;
        deltaQty: number;
        closingQty: number;
        actionType: string;
        referenceNo?: string;
        recordedBy: string;
      };
    }) => Promise<unknown>;
  };
};

export type StockAction =
  | 'SALE'
  | 'PURCHASE'
  | 'PROPAGATION_READY'
  | 'MORTALITY'
  | 'ADJUSTMENT';

interface ApplyDeltaArgs {
  tx: Tx;
  plantId: string;
  deltaQty: number;
  actionType: StockAction;
  recordedBy: string;
  referenceNo?: string;
}

// Atomically adjusts stock and writes an immutable ledger row.
// Must be called inside a prisma.$transaction to guarantee ACID semantics
// and prevent negative / corrupt inventory (NFR-ACID-01).
export async function applyStockDelta({
  tx,
  plantId,
  deltaQty,
  actionType,
  recordedBy,
  referenceNo,
}: ApplyDeltaArgs) {
  const plant = await tx.plantInventory.findUnique({ where: { id: plantId } });
  if (!plant) {
    throw ApiError.notFound(`Plant inventory ${plantId} not found`);
  }

  const closingQty = plant.currentStock + deltaQty;
  if (closingQty < 0 || (actionType === 'SALE' && closingQty < plant.reservedQty)) {
    const available = Math.max(0, plant.currentStock - plant.reservedQty);
    throw ApiError.conflict(
      `Insufficient available stock for ${plant.sku}. Available: ${available}, reserved: ${plant.reservedQty}, requested change: ${deltaQty}`,
    );
  }

  const updated = await tx.plantInventory.update({
    where: { id: plantId },
    data: {
      currentStock: closingQty,
      ...(actionType === 'SALE' && deltaQty < 0 ? { soldQty: { increment: Math.abs(deltaQty) } } : {}),
      ...(actionType === 'MORTALITY' && deltaQty < 0 ? { mortalityQty: { increment: Math.abs(deltaQty) } } : {}),
    },
  });

  await tx.stockLedger.create({
    data: {
      plantId,
      deltaQty,
      closingQty,
      actionType,
      referenceNo,
      recordedBy,
    },
  });

  return updated;
}
