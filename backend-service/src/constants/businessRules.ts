// Central business rules (specification sections 4-6).

// Wholesale tiered discount for commercial orchardists (US-POS-03 / FR-POS-01).
export const WHOLESALE_TIERS = [
  { minQty: 500, discountPct: 20 },
  { minQty: 100, discountPct: 10 },
  { minQty: 0, discountPct: 0 },
];

// Input rates used to estimate vermicompost cost per kilogram after sieving.
export const COMPOST_INPUT_RATES = {
  cowDungPerKg: 2,
  biomassPerKg: 1,
};

export function compostCostPerKg(cowDungKg: number, biomassKg: number, yieldKg: number): number {
  if (yieldKg <= 0) return 0;
  const cost = cowDungKg * COMPOST_INPUT_RATES.cowDungPerKg + biomassKg * COMPOST_INPUT_RATES.biomassPerKg;
  return Number((cost / yieldKg).toFixed(2));
}

// Display-only UPI id for the counter QR. Replace with the nursery VPA in production.
export const NURSERY_UPI_VPA = 'sabanursery@upi';

export function wholesaleDiscountPct(totalQty: number): number {
  const tier = WHOLESALE_TIERS.find((t) => totalQty >= t.minQty);
  return tier ? tier.discountPct : 0;
}

// Short cultivar codes used inside batch codes / SKUs (e.g. BDG = Black Diamond Guava).
export function cultivarCode(varietyName: string): string {
  const cleaned = varietyName.replace(/[^a-zA-Z ]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GEN';
  const code = words
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return code.slice(0, 4);
}
