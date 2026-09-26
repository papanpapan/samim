import { BatchStage } from '@prisma/client';
import { ApiError } from '../utils/apiError';

// Allowed lifecycle transitions (SOP-02): INITIATED -> MIST_CHAMBER ->
// HARDENING_SHADE -> READY_FOR_SALE -> CLOSED.
const TRANSITIONS: Record<BatchStage, BatchStage[]> = {
  INITIATED: ['MIST_CHAMBER', 'CLOSED'],
  MIST_CHAMBER: ['HARDENING_SHADE', 'CLOSED'],
  HARDENING_SHADE: ['READY_FOR_SALE', 'CLOSED'],
  READY_FOR_SALE: ['CLOSED'],
  CLOSED: [],
};

export function batchRates(initialQuantity: number, currentQuantity: number, mortalityCount: number) {
  if (initialQuantity <= 0) return { successPct: 0, mortalityPct: 0 };
  return {
    successPct: Number(((currentQuantity / initialQuantity) * 100).toFixed(1)),
    mortalityPct: Number(((mortalityCount / initialQuantity) * 100).toFixed(1)),
  };
}

export function assertTransition(from: BatchStage, to: BatchStage): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw ApiError.badRequest(`Invalid stage transition: ${from} -> ${to}`);
  }
}

export interface StageMoveResult {
  currentQuantity: number;
  mortalityDelta: number;
  totalMortality: number;
  mortalityPct: number;
}

// Computes survivors/mortality when moving to the next stage (US-PROP-02).
export function computeStageMove(
  previousQuantity: number,
  survivedCount: number,
  existingMortality: number,
): StageMoveResult {
  if (survivedCount < 0 || survivedCount > previousQuantity) {
    throw ApiError.badRequest(
      `Survived count must be between 0 and current quantity (${previousQuantity})`,
    );
  }
  const mortalityDelta = previousQuantity - survivedCount;
  const totalMortality = existingMortality + mortalityDelta;
  return {
    currentQuantity: survivedCount,
    mortalityDelta,
    totalMortality,
    mortalityPct: previousQuantity === 0 ? 0 : (mortalityDelta / previousQuantity) * 100,
  };
}
