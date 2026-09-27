import { useCallback, useState } from 'react';

export const SOLO_KEY = 'sn-solo-mode';

export function readSoloMode(): boolean {
  try {
    return localStorage.getItem(SOLO_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSoloMode(on: boolean) {
  try {
    localStorage.setItem(SOLO_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Solo nursery: one person may run care, mark ready, and counter sales. */
export function useSoloMode() {
  const [solo, setSoloState] = useState(readSoloMode);

  const setSolo = useCallback((on: boolean) => {
    writeSoloMode(on);
    setSoloState(on);
  }, []);

  const toggleSolo = useCallback(() => {
    setSolo(!readSoloMode());
  }, [setSolo]);

  return { solo, setSolo, toggleSolo };
}
