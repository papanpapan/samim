export type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CASHIER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface MotherPlant {
  id: string;
  tagNumber: string;
  varietyName: string;
  scientificName?: string | null;
  sourceCountry?: string | null;
  plantingDate: string;
  plotLocation: string;
  healthStatus: string;
  scionsHarvested: number;
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
  | 'SEEDLING';

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
  motherPlant?: { tagNumber: string; varietyName: string };
}

export interface PlantInventory {
  id: string;
  sku: string;
  commonName: string;
  variety: string;
  category: string;
  bagSize: string;
  currentStock: number;
  reorderAlert: number;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  qrCodeData?: string | null;
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
  inventoryValuation: { cost: number; retail: number; potentialProfit: number };
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  channel: string;
  customerName: string;
  netTotal: string;
  discountAmount: string;
  paymentMode: string;
  createdAt: string;
}
