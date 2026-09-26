import type { Role } from '../types';

export function hasRole(role: Role | undefined, allowed: readonly Role[]) {
  return !!role && allowed.includes(role);
}

/** Counter sale. STAFF included for small-nursery testing (one person does field + till). */
export const POS_ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] as const satisfies readonly Role[];

/** Nursery floor: mother-plant care, batches, stock counts, compost. */
export const FIELD_ROLES = ['ADMIN', 'MANAGER', 'STAFF'] as const satisfies readonly Role[];

/** Pricing, new mother plants, and releasing a batch into sellable stock. */
export const MANAGER_ROLES = ['ADMIN', 'MANAGER'] as const satisfies readonly Role[];

/** Audit trail (staff accounts live on My nursery). */
export const ADMIN_ROLES = ['ADMIN'] as const satisfies readonly Role[];

/** Nursery details, places, people, and which features each role may use. */
export const SITE_ROLES = ['ADMIN', 'MANAGER'] as const satisfies readonly Role[];
