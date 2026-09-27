import type { Role } from '../types';
import { readSoloMode } from '../hooks/useSoloMode';

export function hasRole(role: Role | undefined, allowed: readonly Role[]) {
  return !!role && allowed.includes(role);
}

/** Counter sale. STAFF included for small-nursery testing (one person does field + till). */
export const POS_ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] as const satisfies readonly Role[];

/** Nursery floor: mother-plant care, batches, stock counts, compost. */
export const FIELD_ROLES = ['ADMIN', 'MANAGER', 'STAFF'] as const satisfies readonly Role[];

/** Solo mode expands floor + till to every on-site role (including cashier). */
export const SOLO_FLOOR_ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'CASHIER'] as const satisfies readonly Role[];

/** Pricing, new mother plants, and releasing a batch into sellable stock. */
export const MANAGER_ROLES = ['ADMIN', 'MANAGER'] as const satisfies readonly Role[];

/** Audit trail (staff accounts live on My nursery). */
export const ADMIN_ROLES = ['ADMIN'] as const satisfies readonly Role[];

/** Nursery details, places, people, and which features each role may use. */
export const SITE_ROLES = ['ADMIN', 'MANAGER'] as const satisfies readonly Role[];

/** Field / ready-for-sale when solo nursery toggle is on. */
export function canFieldFloor(role: Role | undefined): boolean {
  if (readSoloMode()) return hasRole(role, SOLO_FLOOR_ROLES);
  return hasRole(role, FIELD_ROLES);
}

/** POS when solo — any floor role may settle cash/UPI. */
export function canRunPos(role: Role | undefined): boolean {
  if (readSoloMode()) return hasRole(role, SOLO_FLOOR_ROLES);
  return hasRole(role, POS_ROLES);
}
