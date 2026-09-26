export interface ChannelChoice {
  code: string;
  label: string;
}

export const FALLBACK_CHANNELS: ChannelChoice[] = [
  { code: 'RETAIL_COUNTER', label: 'Retail Counter' },
  { code: 'WHOLESALE_ORCHARDIST', label: 'Wholesale Orchardist' },
  { code: 'INDIAMART', label: 'IndiaMART' },
  { code: 'MEESHO', label: 'Meesho' },
];

export function readChannelChoices(data: unknown): ChannelChoice[] {
  if (!Array.isArray(data)) return [];
  const rows: ChannelChoice[] = [];
  for (const item of data) {
    if (typeof item === 'string') {
      if (item.length > 0) rows.push({ code: item, label: item });
      continue;
    }
    if (item && typeof item === 'object' && 'code' in item) {
      const code = (item as { code: unknown }).code;
      const label = (item as { label: unknown }).label;
      if (typeof code === 'string' && code.length > 0) {
        rows.push({ code, label: typeof label === 'string' && label.length > 0 ? label : code });
      }
    }
  }
  return rows;
}

export function channelName(
  t: (key: string, options?: { defaultValue?: string }) => string,
  code: string,
  label?: string,
): string {
  const fallback = label && label !== code ? label : code.replace(/_/g, ' ');
  return t(`pos.channels.${code}`, { defaultValue: fallback });
}
