export type StorageType = '冷凍' | '冷蔵' | '常温' | 'その他';

export interface Product {
  id: string;
  productCd: string;
  name: string;
  cost: number;
  unit?: string;
  departments: string[];
  supplierName: string;
  supplierCd?: string;
  spec?: string;
  storageType?: StorageType;
  createdAt: string;
  updatedAt: string;
  imageUrls: string[];
}

export type PhotoStatus = 'uncounted' | 'counted' | 'assigned';

export interface PhotoRecord {
  id: string;
  imageUrl: string;
  imageUrls?: string[];
  quantity: number | null;
  quantityFormula?: string;
  unitCost?: number | null;
  unit?: string;
  productName?: string;
  productCd?: string;
  productSupplierName?: string;
  productStorageType?: StorageType;
  status: PhotoStatus;
  productId: string | null;
  takenAt: string;
  department?: string;
  inventoryDate?: string;
}

export interface InventorySession {
  id: string;
  inventoryDate: string;
  monthKey?: string;
  department: string;
  staff1: string;
  staff2: string;
  isLocked?: boolean;
  photoRecords: PhotoRecord[];
}

export interface InventoryReportRow {
  product: Product;
  quantity: number;
  amount: number;
  prevQuantity: number;
  prevAmount: number;
  qtyDiff: number;
  amountDiff: number;
}

export interface MasterData {
  departments: string[];
  staffMembers: string[];
  suppliers: string[];
}
