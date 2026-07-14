// Shared domain types used across the app (extracted from App.tsx to keep
// it manageable). Nothing here has any React/UI code - pure type/data shape
// definitions and small date-formatting helpers used by those types.

export interface FakeTimestamp {
  toDate: () => Date;
}
export const toTimestamp = (isoString: string | null | undefined): FakeTimestamp => {
  const d = isoString ? new Date(isoString) : new Date();
  return {
    toDate: () => d,
  };
};

export const toSortableDateValue = (value?: string | null): number => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export type Timestamp = FakeTimestamp;

export interface CatalogSheet {
  id: string;
  title: string;
  data: any[];
  createdAt: Timestamp;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  createdAt: Timestamp;
  governorate?: string;
  // Extra fields saved at Step 1
  address?: string;
  deliveryAddress?: string;
  visitDate?: string;
  visitDateTo?: string;
  notes?: string;
  deliveryDate?: string;
  pickupDate?: string;
  portfolioDate?: string;
  status?: string;
  raw?: any;
}

export interface FurniturePiece {
  name: string;
  price: number;
  quantity: number;
  details?: string;
  room_type?: string;
  room_instance_id?: string;
  aro_veneer_addon?: boolean;
  aro_surcharge?: number;
}

export interface Inspection {
  id: string;
  customerName: string;
  phone: string;
  address?: string;
  deliveryAddress?: string;
  governorate?: string;
  visitDate: string;
  visitDateTo?: string;
  notes: string;
  rooms: number;
  pieces: FurniturePiece[];
  totalAmount: number;
  status: "pending" | "contracted" | "refused";
  createdAt: Timestamp;
  // Contracting details
  portfolio?: string;
  room_types?: string[];
  room_aro_veneer?: Record<string, boolean>;
  room_aro_veneer_price?: Record<string, number>;
  deliveryDate?: string;
  pickupDate?: string;
  portfolioDate?: string;
  portfolio_date?: string;
  contractDate?: string;
  contractUrl?: string;
  payments?: { amount: number; date: string; stage: string }[];
}

export type RoomDraftItem = {
  item_name: string;
  custom_item: boolean;
  quantity: number;
  dimensions: string;
  price: number;
  notes: string;
  aro_veneer_addon: boolean;
  aro_surcharge: number;
};

export type RoomDraft = {
  id?: string;
  room_type: string;
  aro_veneer: boolean;
  aro_veneer_price?: number;
  items: RoomDraftItem[];
  customLabel?: string | null;
};