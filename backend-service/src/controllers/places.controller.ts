import { Request, Response } from 'express';

const USER_AGENT = 'SabaNurseryERMS/3.0 (nursery onboarding)';

interface NominatimRow {
  display_name?: string;
  lat?: string;
  lon?: string;
}

async function nominatim(url: string): Promise<NominatimRow[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const body = (await response.json()) as NominatimRow | NominatimRow[];
  return Array.isArray(body) ? body : [body];
}

function place(row: NominatimRow) {
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!row.display_name || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { label: row.display_name, latitude: lat, longitude: lon };
}

export async function searchPlaces(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) {
    res.json({ success: true, data: [] });
    return;
  }
  const rows = await nominatim(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
  );
  res.json({ success: true, data: rows.map(place).filter(Boolean) });
}

export async function placeHere(req: Request, res: Response): Promise<void> {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.json({ success: true, data: null });
    return;
  }
  const rows = await nominatim(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
  );
  res.json({ success: true, data: place(rows[0] ?? {}) });
}
