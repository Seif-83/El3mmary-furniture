import Dexie, { Table } from "dexie";

export interface LocalCatalog {
  id: string;
  title: string;
  data: any;
  created_at: string;
  last_modified: number;
}

export interface LocalCustomer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  delivery_address?: string;
  visit_date?: string;
  visit_date_to?: string;
  notes?: string;
  delivery_date?: string;
  pickup_date?: string;
  portfolio_date?: string;
  created_at: string;
  last_modified: number;
}

export interface LocalInspection {
  id: string;
  customer_name: string;
  phone: string;
  address?: string;
  delivery_address?: string;
  visit_date?: string;
  visit_date_to?: string;
  notes?: string;
  rooms: number;
  pieces: any;
  total_amount: number;
  status: string;
  portfolio?: string;
  delivery_date?: string;
  pickup_date?: string;
  portfolio_date?: string;
  contract_date?: string;
  created_at: string;
  room_types?: string[];
  room_aro_veneer?: boolean;
  room_aro_veneer_price?: number;
  last_modified: number;
}

export interface LocalContractedCustomer {
  id: string;
  customer_name: string;
  phone: string;
  address?: string;
  delivery_address?: string;
  visit_date?: string;
  visit_date_to?: string;
  notes?: string;
  rooms: number;
  pieces: any;
  total_amount: number;
  status: string;
  portfolio?: string;
  delivery_date?: string;
  pickup_date?: string;
  portfolio_date?: string;
  contract_date?: string;
  finalized_at: string;
  room_types?: string[];
  room_aro_veneer?: boolean;
  room_aro_veneer_price?: number;
  last_modified: number;
}

export interface LocalNonContractedCustomer {
  id: string;
  customer_name: string;
  phone: string;
  address?: string;
  delivery_address?: string;
  visit_date?: string;
  visit_date_to?: string;
  notes?: string;
  rooms: number;
  pieces: any;
  total_amount: number;
  status: string;
  portfolio?: string;
  delivery_date?: string;
  pickup_date?: string;
  portfolio_date?: string;
  contract_date?: string;
  finalized_at: string;
  room_types?: string[];
  room_aro_veneer?: boolean;
  room_aro_veneer_price?: number;
  last_modified: number;
}

export interface LocalPayment {
  id: string;
  client_id?: string;
  visit_id?: string;
  amount: number;
  paid_at: string;
  installment?: string;
  note?: string;
  created_at: string;
  last_modified: number;
}

export interface LocalProductionStage {
  id: string;
  client_id?: string;
  visit_id?: string;
  stage: string;
  status: string;
  completed_at?: string;
  created_at: string;
  client?: { phones: string[] }; // locally cached relation details
  last_modified: number;
}

export interface LocalClient {
  id: string;
  name: string;
  phones: string[];
  address?: string;
  governorate?: string;
  created_at: string;
  last_modified: number;
}

export interface LocalActivityLog {
  id: string;
  client_id?: string;
  visit_id?: string;
  type: string;
  message: string;
  success: boolean;
  details?: any;
  created_at: string;
  last_modified: number;
}

export interface LocalAppSetting {
  key: string;
  value: string;
  updated_at: string;
  last_modified: number;
}

export interface SyncQueueItem {
  id?: number;
  operation: "INSERT" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  status: "pending" | "failed" | "syncing";
  errorMessage?: string;
}

// A tombstone marks a record as "deleted locally, waiting for (or confirming)
// remote deletion". While a tombstone exists for a (tableName, recordId) pair,
// resolveConflict() must never resurrect that record locally, even if a stale
// remote read still returns it (e.g. a background refresh racing the pending
// DELETE sync). See SyncManager.resolveConflict / pullRemoteData.
export interface LocalTombstone {
  id: string; // `${tableName}:${recordId}`
  tableName: string;
  recordId: string;
  deletedAt: number;
}

export class FurnitureDB extends Dexie {
  catalogs!: Table<LocalCatalog>;
  customers!: Table<LocalCustomer>;
  inspections!: Table<LocalInspection>;
  contracted_customers!: Table<LocalContractedCustomer>;
  non_contracted_customers!: Table<LocalNonContractedCustomer>;
  payments!: Table<LocalPayment>;
  production_stages!: Table<LocalProductionStage>;
  clients!: Table<LocalClient>;
  activity_logs!: Table<LocalActivityLog>;
  app_settings!: Table<LocalAppSetting>;
  sync_queue!: Table<SyncQueueItem>;
  tombstones!: Table<LocalTombstone>;

  constructor() {
    super("FurnitureDB");
    this.version(1).stores({
      catalogs: "id, created_at, last_modified",
      customers: "id, created_at, last_modified",
      inspections: "id, created_at, last_modified",
      contracted_customers: "id, finalized_at, last_modified",
      non_contracted_customers: "id, finalized_at, last_modified",
      payments: "id, paid_at, created_at, last_modified",
      production_stages: "id, stage, status, client_id, last_modified",
      clients: "id, name, created_at, last_modified",
      activity_logs: "id, created_at, last_modified",
      app_settings: "key, updated_at, last_modified",
      sync_queue: "++id, operation, tableName, recordId, status, createdAt",
    });
    // v2: add tombstones table to fix deleted records reappearing due to a
    // race between the DELETE sync and refreshAllData()'s direct remote read.
    this.version(2).stores({
      tombstones: "id, tableName, recordId, deletedAt",
    });
  }
}

export const db = new FurnitureDB();
