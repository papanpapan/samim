import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/apiError';

type Tx = Prisma.TransactionClient;

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
  if (closingQty < 0) {
    throw ApiError.conflict(
      `Insufficient available stock for ${plant.sku}. In stock: ${plant.currentStock}, requested change: ${deltaQty}`,
    );
  }

  const updated = await tx.plantInventory.update({
    where: { id: plantId },
    data: { currentStock: closingQty },
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
