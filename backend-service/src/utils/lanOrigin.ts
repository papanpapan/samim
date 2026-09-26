import os from 'os';

export function safeOrigin(value: unknown) {
  if (typeof value !== 'string' || value.length > 200) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

function lanIPv4() {
  const ranked: { address: string; score: number }[] = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    const virtual = /vethernet|virtual|wsl|hyper-v|docker|vbox|vmware|loopback/i.test(name);
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      let score = virtual ? 0 : 50;
      if (entry.address.startsWith('192.168.')) score += 30;
      else if (entry.address.startsWith('10.')) score += 20;
      else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(entry.address)) score += 10;
      ranked.push({ address: entry.address, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.address ?? '';
}

export function phoneOrigin(requested: string) {
  const fallbackPort = '5173';
  const ip = lanIPv4();
  if (!requested) return ip ? `http://${ip}:${fallbackPort}` : '';
  const url = new URL(requested);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === '[::1]';
  if (!local || !ip) return url.origin;
  url.hostname = ip;
  return url.origin;
}
