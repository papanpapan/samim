/** Parse nursery gstSlabs text into unique sorted percentages 0–100. */
export function parseGstSlabs(raw: string | null | undefined): number[] {
  const parts = String(raw ?? '0,5,12,18')
    .split(/[,;\s]+/)
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  const unique = [...new Set(parts.map((n) => Math.round(n * 100) / 100))];
  if (!unique.includes(0)) unique.unshift(0);
  return unique.sort((a, b) => a - b);
}

export function formatGstSlabs(slabs: number[]): string {
  return parseGstSlabs(slabs.join(',')).join(',');
}
