export const FEATURES = [
  { key: 'MOTHER_PLANTS', label: 'Mother plants' },
  { key: 'PROPAGATION', label: 'Propagation' },
  { key: 'INVENTORY', label: 'Inventory' },
  { key: 'POS', label: 'Sales counter' },
  { key: 'VERMICOMPOST', label: 'Vermicompost' },
  { key: 'CARE', label: 'Care' },
  { key: 'DISTRIBUTION', label: 'Distribution' },
  { key: 'ACCOUNTS', label: 'Accounts' },
  { key: 'NURSERY_ADMIN', label: 'Nursery user admin' },
  { key: 'CCTV_ALERTS', label: 'Phone danger alerts' },
  { key: 'LIVE_CAMERA', label: 'Live camera' },
  { key: 'VOICE_DESK', label: 'Voice desk' },
  { key: 'PLANT_TREATMENT', label: 'Plant treatment' },
  { key: 'PLANT_ID', label: 'Identify plant' },
] as const;

export type FeatureKey = (typeof FEATURES)[number]['key'];

export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((item) => item.key);

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(value);
}

export function isFeatureCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,31}$/.test(value);
}
