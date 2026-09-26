import { AsyncLocalStorage } from 'async_hooks';
import { ApiError } from '../utils/apiError';

const store = new AsyncLocalStorage<{ nurseryId: string | null }>();

export function runWithNursery<T>(nurseryId: string | null, fn: () => T): T {
  return store.run({ nurseryId }, fn);
}

export function enterNursery(nurseryId: string | null): void {
  store.enterWith({ nurseryId });
}

export function currentNurseryId(): string | null {
  return store.getStore()?.nurseryId ?? null;
}

export function withNursery<T extends object>(data: T): T & { nurseryId: string } {
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  return { ...data, nurseryId };
}
