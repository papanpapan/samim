export type LeafShape = 'OVAL' | 'LANCE' | 'ROUND' | 'THICK';
export type LeafEdge = 'SMOOTH' | 'TOOTHED' | 'WAVY';
export type LeafColor = 'DARK_GREEN' | 'RED_FLUSH' | 'VARIEGATED' | 'PALE_GREEN';

export interface LeafProfile {
  name: string;
  shape: LeafShape;
  edge: LeafEdge;
  color: LeafColor;
  veins: 'PINNATE' | 'THICK';
  note: string;
}

export const LEAF_GUIDE: LeafProfile[] = [
  { name: 'Black Diamond Guava', shape: 'OVAL', edge: 'SMOOTH', color: 'DARK_GREEN', veins: 'PINNATE', note: 'Deep green oval leaf, smooth edge, guava scent when crushed.' },
  { name: 'Red Diamond Guava', shape: 'OVAL', edge: 'SMOOTH', color: 'RED_FLUSH', veins: 'PINNATE', note: 'New leaves carry a red flush, then turn green.' },
  { name: 'Red King Guava', shape: 'LANCE', edge: 'SMOOTH', color: 'RED_FLUSH', veins: 'PINNATE', note: 'Longer leaf than Black Diamond, red young growth.' },
  { name: 'Variegated Guava', shape: 'OVAL', edge: 'SMOOTH', color: 'VARIEGATED', veins: 'PINNATE', note: 'Cream or yellow patches on a green leaf.' },
  { name: 'Thai King Jamun', shape: 'LANCE', edge: 'SMOOTH', color: 'DARK_GREEN', veins: 'PINNATE', note: 'Long glossy leaf, jamun family, not a guava oval.' },
  { name: 'Seedless Jamun', shape: 'LANCE', edge: 'SMOOTH', color: 'PALE_GREEN', veins: 'PINNATE', note: 'Narrow pale-green leaf, jamun habit.' },
  { name: 'Thai Jackfruit', shape: 'OVAL', edge: 'SMOOTH', color: 'DARK_GREEN', veins: 'THICK', note: 'Stiff dark leaf, thick pale midrib.' },
  { name: 'Thai Adenium', shape: 'THICK', edge: 'SMOOTH', color: 'DARK_GREEN', veins: 'THICK', note: 'Fleshy succulent leaf, desert rose.' },
  { name: 'Mulberry', shape: 'OVAL', edge: 'TOOTHED', color: 'PALE_GREEN', veins: 'PINNATE', note: 'Toothed edge, sometimes lobed, soft leaf.' },
  { name: 'Blackberry', shape: 'OVAL', edge: 'TOOTHED', color: 'DARK_GREEN', veins: 'PINNATE', note: 'Toothed compound-looking leaf, cane plant.' },
  { name: 'Blueberry', shape: 'ROUND', edge: 'SMOOTH', color: 'PALE_GREEN', veins: 'PINNATE', note: 'Small oval to round leaf, fine texture.' },
];

export function rankLeaves(traits: { shape: string; edge: string; color: string; veins: string }) {
  const scored = LEAF_GUIDE.map((profile) => {
    let score = 0;
    if (profile.shape === traits.shape) score += 40;
    if (profile.edge === traits.edge) score += 25;
    if (profile.color === traits.color) score += 25;
    if (profile.veins === traits.veins) score += 10;
    return { name: profile.name, note: profile.note, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}
