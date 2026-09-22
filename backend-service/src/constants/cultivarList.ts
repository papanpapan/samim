// Exotic cultivar master list (specification section 2 - Feature Matrix).
export const EXOTIC_CULTIVARS = [
  'Black Diamond Guava',
  'Red Diamond Guava',
  'Red King Guava',
  'Variegated Guava',
  'Thai King Jamun',
  'Seedless Jamun',
  'Thai Jackfruit',
  'Thai Adenium',
  'Mulberry',
  'Blackberry',
  'Blueberry',
] as const;

export type ExoticCultivar = (typeof EXOTIC_CULTIVARS)[number];

export const SOURCE_COUNTRIES = ['Thailand', 'Vietnam', 'Malaysia', 'India'] as const;

export const BAG_SIZES = ['5x7 inch', '8x10 inch', '12 inch Tob'] as const;

export const PLANT_CATEGORIES = ['Fruit', 'Ornamental', 'Indoor'] as const;
