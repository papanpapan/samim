export type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CASHIER';

export type FeatureKey =
  | 'MOTHER_PLANTS'
  | 'PROPAGATION'
  | 'INVENTORY'
  | 'POS'
  | 'VERMICOMPOST'
  | 'CARE'
  | 'DISTRIBUTION'
  | 'ACCOUNTS'
  | 'NURSERY_ADMIN'
  | 'CCTV_ALERTS'
  | 'LIVE_CAMERA'
  | 'VOICE_DESK'
  | 'PLANT_TREATMENT'
  | 'PLANT_ID';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isPlatformOwner?: boolean;
  features?: string[];
  nursery?: { id: string; name: string; code: string; status: string; currencyCode?: string } | null;
}

export interface MotherPlant {
  id: string;
  tagNumber: string;
  category?: string;
  plantName?: string;
  varietyName: string;
  scientificName?: string | null;
  sourceCountry?: string | null;
  sourceVendor?: string | null;
  plantingDate: string;
  plotLocation: string;
  plantCount?: number;
  locationId?: string | null;
  propagationMethods?: string[];
  healthStatus: string;
  seasonCapacity?: number | null;
  listPrice?: number | null;
  videoUrl?: string | null;
  shareCode?: string;
  scionsHarvested: number;
  notes?: string | null;
  description?: string | null;
  photos?: { id: string; kind: string; url: string }[];
  _count?: { propagations: number };
}

export type BatchStage =
  | 'INITIATED'
  | 'MIST_CHAMBER'
  | 'HARDENING_SHADE'
  | 'READY_FOR_SALE'
  | 'CLOSED';

export type PropagationMethod =
  | 'AIR_LAYERING'
  | 'SOFTWOOD_GRAFTING'
  | 'CLEFT_GRAFTING'
  | 'PATCH_BUDDING'
  | 'CUTTING'
  | 'SEEDLING'
  | 'GRAFTING_SCION'
  | 'TISSUE_CULTURE';

export interface PropagationBatch {
  id: string;
  batchCode: string;
  motherPlantId: string;
  method: PropagationMethod;
  initialQuantity: number;
  currentQuantity: number;
  mortalityCount: number;
  stage: BatchStage;
  startDate: string;
  shareCode?: string | null;
  motherPlant?: {
    tagNumber: string;
    plantName?: string;
    varietyName: string;
    plotLocation?: string;
    plantCount?: number;
    category?: string;
    listPrice?: number | null;
    propagationMethods?: string[];
  };
}

export type UnitStatus = 'GROWING' | 'LOST' | 'READY';

export interface BatchLabel {
  serialNo: number;
  serial: string;
  code: string;
  status: UnitStatus;
  publicUrl: string;
  qrDataUrl: string;
}

export interface PlantInventory {
  id: string;
  sku: string;
  commonName: string;
  variety: string;
  category: string;
  bagSize: string;
  plantHeight?: string | null;
  plantAge?: string | null;
  zoneLabel?: string | null;
  currentStock: number;
  reservedQty?: number;
  soldQty?: number;
  mortalityQty?: number;
  reorderAlert: number;
  costPrice: string | number;
  retailPrice: string | number;
  wholesalePrice: string | number;
  channelPrices?: { channel: string; price: number }[];
  qrCodeData?: string | null;
  shareCode?: string | null;
  createdAt?: string;
  videoUrl?: string | null;
  photos?: { id: string; url: string }[];
}

export interface DashboardData {
  motherPlants: number;
  activeBatches: number;
  skuCount: number;
  totalStockUnits: number;
  lowStockCount: number;
  totalSalesValue: number;
  salesCount: number;
  vermicompostYieldKg: number;
  pendingCare: number;
  bedsReady: number;
  openBookings: number;
  newLeads: number;
  openDangerAlerts: number;
  attentionBatches: number;
  unhealthyMothers: number;
  operatingExpenses: number;
  inventoryValuation: { cost: number; retail: number; potentialProfit: number };
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  channel: string;
  customerName: string;
  netTotal: string;
  discountAmount: string;
  taxPct?: string | number;
  taxAmount?: string | number;
  paymentMode: string;
  createdAt: string;
}
