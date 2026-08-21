import { db, SyncQueueItem } from "./db";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";

const normalizePhone = (value: any): string => {
  if (!value) return "";
  const digits = String(value)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("2")) return digits.slice(1);
  return digits;
};

const buildPhoneVariants = (phone: string) => {
  const normalized = normalizePhone(phone);
  const variants = new Set<string>();
  if (!normalized) return [];
  variants.add(normalized);
  if (normalized.length === 10) variants.add(`2${normalized}`);
  if (normalized.length === 11 && normalized.startsWith("2")) {
    variants.add(normalized.slice(1));
  }
  return Array.from(variants);
};

// Tables that represent real customer-facing entities. A "test" record
// landing in any of these should never surface in the UI - and instead of
// just hiding it locally, we actively remove it from Supabase too, since
// something outside this app (manual QA against admin@gmail.com, or an
// external script) keeps creating rows like "Test Authenticated" directly
// in the database. This does not stop the source from re-inserting new rows,
// but it guarantees every pull cleans them up immediately rather than
// leaving them sitting on the server and reappearing unpredictably.
const CUSTOMER_FACING_TABLES = new Set([
  "customers",
  "inspections",
  "contracted_customers",
  "non_contracted_customers",
]);

// How long to trust a "synced" local record over an incomplete/stale remote
// pull before treating its absence from the server as a real deletion.
const RECONCILE_GRACE_MS = 120 * 1000;

const isTestRecord = (record: any): boolean => {
  const name = String(record?.name || record?.customer_name || "")
    .toLowerCase()
    .trim();
  const phone = String(record?.phone || "").replace(/\D/g, "");
  if (!name && !phone) return false;
  if (phone === "1234567890") return true;
  if (name.includes("test")) return true;
  return false;
};

export class SyncManager {
  private static isSyncing = false;
  private static onStatusChangeListeners: ((online: boolean) => void)[] = [];
  private static onDataChangeListeners: (() => void)[] = [];
  private static realtimeChannel: any = null;
  private static lastPullTime: Record<string, number> = {};
  private static readonly PULL_CACHE_DURATIONS: Record<string, number> = {
    app_settings: 900000,
    catalogs: 900000,
    clients: 300000,
    production_stages: 120000,
    inspections: 120000,
    customers: 120000,
    contracted_customers: 120000,
    non_contracted_customers: 120000,
    payments: 120000,
  };

  private static initialized = false;

  static subscribeToDataChanges(callback: () => void) {
    if (!this.onDataChangeListeners.includes(callback)) {
      this.onDataChangeListeners.push(callback);
    }
  }

  static notifyDataChangeListeners() {
    this.onDataChangeListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("Error in data change listener:", err);
      }
    });
  }

  static init(onStatusChange: (online: boolean) => void) {
    if (!this.onStatusChangeListeners.includes(onStatusChange)) {
      this.onStatusChangeListeners.push(onStatusChange);
    }
    
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener("online", () => this.handleNetworkChange(true));
    window.addEventListener("offline", () => this.handleNetworkChange(false));
    
    // Initial sync check
    if (navigator.onLine) {
      void this.triggerSync();
    }
  }

  private static handleNetworkChange(online: boolean) {
    this.onStatusChangeListeners.forEach(listener => listener(online));
    if (online) {
      this.triggerSync({ force: true });
    }
  }

  // Record that (tableName, recordId) was deleted locally. Must be called
  // BEFORE/alongside queuing the DELETE operation, and checked by any code
  // path that writes remote data back into IndexedDB, so a record can never
  // be resurrected by a stale/racing remote read while its deletion is still
  // in flight (or was missed due to network issues).
  static async addTombstone(tableName: string, recordId: string) {
    await db.tombstones.put({
      id: `${tableName}:${recordId}`,
      tableName,
      recordId,
      deletedAt: Date.now(),
    });
  }

  static async isTombstoned(tableName: string, recordId: string) {
    const t = await db.tombstones.get(`${tableName}:${recordId}`);
    return !!t;
  }

  static async clearTombstone(tableName: string, recordId: string, phone?: string | null) {
    await db.tombstones.delete(`${tableName}:${recordId}`);
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) {
        await db.tombstones.delete(`${tableName}:phone:${normalizedPhone}`);
      }
    }
  }

  static async queueOperation(
    operation: "INSERT" | "UPDATE" | "DELETE" | "DELETE_BY_PHONE",
    tableName: string,
    recordId: string,
    payload: any
  ) {
    const queueItem: SyncQueueItem = {
      operation,
      tableName,
      recordId,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };
    await db.sync_queue.add(queueItem);
    if (SUPABASE_CONFIGURED && navigator.onLine) {
      this.triggerSync();
    }
  }

  static async triggerSync(options?: { force?: boolean }) {
    if (!SUPABASE_CONFIGURED) {
      console.warn("Sync skipped: Supabase is not configured.");
      return;
    }
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      // Reset any stuck "syncing" items back to "pending" to retry them
      await db.sync_queue
        .where("status").equals("syncing")
        .modify({ status: "pending" })
        .catch((err) => console.warn("Failed to reset stuck syncing items", err));

      await this.processQueue();
      await this.pullRemoteData(options?.force);
    } finally {
      this.isSyncing = false;
    }
  }

  static async pullRemoteData(force?: boolean) {
    if (!SUPABASE_CONFIGURED) {
      console.warn("Pull remote data skipped: Supabase is not configured.");
      return;
    }
    if (!navigator.onLine) return;

    const tablesToSync = [
      "inspections",
      "customers",
      "contracted_customers",
      "non_contracted_customers",
      "catalogs",
      "payments",
      "production_stages",
      "clients",
      "app_settings",
    ];

    const tablesToPull = tablesToSync.filter((tableName) => {
      if (force) return true;
      const lastPulled = this.lastPullTime[tableName] || 0;
      const cacheDuration = this.PULL_CACHE_DURATIONS[tableName] || 0;
      return Date.now() - lastPulled >= cacheDuration;
    });

    if (tablesToPull.length === 0) {
      return;
    }

    // Shared, server-side record of every deletion, so this device knows
    // about deletions performed on OTHER devices too (see fetchRemoteTombstones).
    const remoteTombstones = await this.fetchRemoteTombstones();

    const TABLE_COLUMNS: Record<string, string> = {
      inspections: "id, customer_name, phone, address, delivery_address, visit_date, visit_date_to, notes, status, portfolio, delivery_date, pickup_date, portfolio_date, contract_date, governorate, room_types, contract_url, rooms, pieces, total_amount, room_aro_veneer, room_aro_veneer_price, created_at",
      customers: "id, name, phone, address, delivery_address, visit_date, visit_date_to, notes, delivery_date, pickup_date, portfolio_date, governorate, created_at",
      contracted_customers: "id, customer_name, phone, address, delivery_address, visit_date, visit_date_to, notes, status, portfolio, delivery_date, pickup_date, portfolio_date, contract_date, governorate, room_types, contract_url, rooms, pieces, total_amount, room_aro_veneer, room_aro_veneer_price, created_at, finalized_at",
      non_contracted_customers: "id, customer_name, phone, address, delivery_address, visit_date, visit_date_to, notes, status, portfolio, delivery_date, pickup_date, portfolio_date, contract_date, governorate, room_types, contract_url, rooms, pieces, total_amount, room_aro_veneer, room_aro_veneer_price, created_at, finalized_at",
      catalogs: "id, title, data, created_at",
      payments: "id, client_id, visit_id, amount, paid_at, installment, note, created_at",
      production_stages: "id, client_id, visit_id, stage, status, completed_at, created_at",
      clients: "id, name, phones, address, governorate, created_at",
      app_settings: "key, value, updated_at",
    };

    // Parallel processing across all tables to pull
    await Promise.all(
      tablesToPull.map(async (tableName) => {
        const pkColumn = tableName === "app_settings" ? "key" : "id";
        const columns = TABLE_COLUMNS[tableName] || "*";
        const { data, error } = await supabase.from(tableName).select(columns);
        if (error || !Array.isArray(data)) {
          if (error) {
            console.warn(`Failed to pull remote data for ${tableName}:`, error.message || error);
          }
          return;
        }

        this.lastPullTime[tableName] = Date.now();

        // Batch pre-fetch table state to avoid thousands of individual async Dexie calls
        const [localRecords, tableTombstones, pendingSyncItems] = await Promise.all([
          db.table(tableName).toArray(),
          db.tombstones.where("tableName").equals(tableName).toArray(),
          db.sync_queue.where("tableName").equals(tableName).toArray(),
        ]);

        const localRecordsMap = new Map<string, any>();
        for (const rec of localRecords) {
          const k = String(rec[pkColumn] ?? "").trim();
          if (k) localRecordsMap.set(k, rec);
        }

        const localTombIds = new Set<string>();
        const localTombPhones = new Set<string>();
        for (const tomb of tableTombstones) {
          if (tomb.recordId.startsWith("phone:")) {
            localTombPhones.add(tomb.recordId.replace(/^phone:/, ""));
          } else {
            localTombIds.add(tomb.recordId);
          }
        }

        const pendingOpRecordIds = new Set<string>();
        const pendingPhoneDeletes = new Set<string>();
        for (const item of pendingSyncItems) {
          if (item.operation === "DELETE_BY_PHONE" && item.payload?.phone) {
            pendingPhoneDeletes.add(normalizePhone(item.payload.phone));
          } else if (item.recordId) {
            pendingOpRecordIds.add(item.recordId);
          }
        }

        const tombIds = remoteTombstones.byId.get(tableName);
        const tombPhones = remoteTombstones.byPhone.get(tableName);

        const remoteIds = new Set<string>();
        const recordsToPut: any[] = [];
        const recordsToDeleteLocally = new Set<string>();
        const tombstonesToAddLocally: any[] = [];
        const operationsToQueue: SyncQueueItem[] = [];

        for (const remoteRecord of data) {
          const remoteKey = String(remoteRecord?.[pkColumn] ?? "").trim();
          if (!remoteKey) continue;
          const recordPhone = normalizePhone((remoteRecord as any).phone);

          // 1. Check if test record
          if (CUSTOMER_FACING_TABLES.has(tableName) && isTestRecord(remoteRecord)) {
            recordsToDeleteLocally.add(remoteKey);
            if (recordPhone) {
              tombstonesToAddLocally.push({
                id: `${tableName}:phone:${recordPhone}`,
                tableName,
                recordId: `phone:${recordPhone}`,
                deletedAt: Date.now(),
              });
              if (!pendingPhoneDeletes.has(recordPhone)) {
                pendingPhoneDeletes.add(recordPhone);
                operationsToQueue.push({
                  operation: "DELETE_BY_PHONE",
                  tableName,
                  recordId: recordPhone,
                  payload: { phone: recordPhone },
                  createdAt: Date.now(),
                  retryCount: 0,
                  status: "pending",
                });
              }
            }
            if (!pendingOpRecordIds.has(remoteKey)) {
              pendingOpRecordIds.add(remoteKey);
              operationsToQueue.push({
                operation: "DELETE",
                tableName,
                recordId: remoteKey,
                payload: null,
                createdAt: Date.now(),
                retryCount: 0,
                status: "pending",
              });
            }
            continue;
          }

          // 2. Check if remotely deleted
          const isRemotelyDeleted =
            (tombIds && tombIds.has(remoteKey)) ||
            Boolean(recordPhone && tombPhones && tombPhones.has(recordPhone));

          if (isRemotelyDeleted) {
            recordsToDeleteLocally.add(remoteKey);
            tombstonesToAddLocally.push({
              id: `${tableName}:${remoteKey}`,
              tableName,
              recordId: remoteKey,
              deletedAt: Date.now(),
            });
            if (recordPhone) {
              tombstonesToAddLocally.push({
                id: `${tableName}:phone:${recordPhone}`,
                tableName,
                recordId: `phone:${recordPhone}`,
                deletedAt: Date.now(),
              });
            }
            if (!pendingOpRecordIds.has(remoteKey)) {
              pendingOpRecordIds.add(remoteKey);
              operationsToQueue.push({
                operation: "DELETE",
                tableName,
                recordId: remoteKey,
                payload: null,
                createdAt: Date.now(),
                retryCount: 0,
                status: "pending",
              });
            }
            continue;
          }

          remoteIds.add(remoteKey);

          // 3. Check if locally tombstoned
          const tombstonedById = localTombIds.has(remoteKey);
          const tombstonedByPhone = Boolean(recordPhone && localTombPhones.has(recordPhone));

          if (tombstonedById || tombstonedByPhone) {
            recordsToDeleteLocally.add(remoteKey);
            if (!pendingOpRecordIds.has(remoteKey)) {
              pendingOpRecordIds.add(remoteKey);
              operationsToQueue.push({
                operation: "DELETE",
                tableName,
                recordId: remoteKey,
                payload: null,
                createdAt: Date.now(),
                retryCount: 0,
                status: "pending",
              });
            }
            if (recordPhone && !pendingPhoneDeletes.has(recordPhone)) {
              pendingPhoneDeletes.add(recordPhone);
              operationsToQueue.push({
                operation: "DELETE_BY_PHONE",
                tableName,
                recordId: recordPhone,
                payload: { phone: recordPhone },
                createdAt: Date.now(),
                retryCount: 0,
                status: "pending",
              });
            }
            continue;
          }

          // 4. Check pending sync queue
          if (pendingOpRecordIds.has(remoteKey)) {
            continue;
          }

          // 5. Conflict resolution via timestamp comparison
          const localRecord = localRecordsMap.get(remoteKey);
          if (localRecord) {
            const localTime = localRecord.last_modified || 0;
            const remoteTime = remoteRecord.updated_at
              ? new Date(remoteRecord.updated_at).getTime()
              : remoteRecord.created_at
              ? new Date(remoteRecord.created_at).getTime()
              : remoteRecord.finalized_at
              ? new Date(remoteRecord.finalized_at).getTime()
              : 0;

            if (localTime > remoteTime) {
              continue;
            }
          }

          recordsToPut.push({
            ...remoteRecord,
            last_modified: Date.now(),
            synced: true,
          });
        }

        // Self-healing / reconciliation sync
        for (const localRecord of localRecords) {
          const localKey = String(localRecord[pkColumn] ?? "").trim();
          if (!localKey) continue;

          if (!remoteIds.has(localKey)) {
            if (pendingOpRecordIds.has(localKey)) continue;

            const localPhone = normalizePhone((localRecord as any).phone);
            const isKnownDeleted =
              localTombIds.has(localKey) ||
              Boolean(localPhone && localTombPhones.has(localPhone)) ||
              Boolean(tombIds && tombIds.has(localKey)) ||
              Boolean(localPhone && tombPhones && tombPhones.has(localPhone));

            const recentlyModified =
              ((localRecord as any).last_modified || 0) > Date.now() - RECONCILE_GRACE_MS;

            if (isKnownDeleted) {
              recordsToDeleteLocally.add(localKey);
            } else if ((localRecord as any).synced) {
              if (!recentlyModified) {
                recordsToDeleteLocally.add(localKey);
              }
            } else {
              pendingOpRecordIds.add(localKey);
              operationsToQueue.push({
                operation: "INSERT",
                tableName,
                recordId: localKey,
                payload: localRecord,
                createdAt: Date.now(),
                retryCount: 0,
                status: "pending",
              });
            }
          }
        }

        // Execute bulk Dexie operations for high performance
        if (recordsToDeleteLocally.size > 0) {
          await db.table(tableName).bulkDelete(Array.from(recordsToDeleteLocally)).catch(() => {});
        }
        if (recordsToPut.length > 0) {
          await db.table(tableName).bulkPut(recordsToPut).catch(() => {});
        }
        if (tombstonesToAddLocally.length > 0) {
          await db.tombstones.bulkPut(tombstonesToAddLocally).catch(() => {});
        }
        if (operationsToQueue.length > 0) {
          await db.sync_queue.bulkAdd(operationsToQueue).catch(() => {});
        }

        // Tombstone cleanup
        const tombstonesToDelete: string[] = [];
        for (const tomb of tableTombstones) {
          if (tomb.recordId.startsWith("phone:")) {
            const phone = tomb.recordId.replace(/^phone:/, "");
            const anyMatch = data.some(
              (remoteRecord: any) => normalizePhone(remoteRecord.phone) === phone,
            );
            if (!anyMatch) tombstonesToDelete.push(tomb.id);
          } else if (!remoteIds.has(tomb.recordId)) {
            tombstonesToDelete.push(tomb.id);
          }
        }
        if (tombstonesToDelete.length > 0) {
          await db.tombstones.bulkDelete(tombstonesToDelete).catch(() => {});
        }
      })
    );

    // Prune old shared tombstones so `deleted_records` doesn't grow forever.
    try {
      const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("deleted_records").delete().lt("deleted_at", cutoff);
    } catch (e) {
      console.warn("Failed to prune old remote tombstones", e);
    }

    this.notifyDataChangeListeners();
  }
  static async deleteLocalRecordsByPhone(tableName: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return;

    const localRecords = await db.table(tableName).toArray();
    for (const record of localRecords) {
      const recordPhone = normalizePhone(record?.phone);
      if (!recordPhone || recordPhone !== normalizedPhone) continue;

      const pk = String(record?.id ?? record?.key ?? "").trim();
      if (!pk) continue;

      await this.addTombstone(tableName, pk);
      await db.table(tableName).delete(pk);
      await this.queueOperation("DELETE", tableName, pk, null);
    }
  }

  static async queueDeleteByPhone(tableName: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return;

    await this.deleteLocalRecordsByPhone(tableName, normalizedPhone);

    const queueItem: SyncQueueItem = {
      operation: "DELETE_BY_PHONE",
      tableName,
      recordId: normalizedPhone,
      payload: { phone: normalizedPhone },
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };
    await db.sync_queue.add(queueItem);
    await this.addPhoneTombstone(tableName, normalizedPhone);
    if (SUPABASE_CONFIGURED && navigator.onLine) {
      this.triggerSync();
    }
  }

  static async addPhoneTombstone(tableName: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return;
    const id = `${tableName}:phone:${normalizedPhone}`;
    await db.tombstones.put({
      id,
      tableName,
      recordId: `phone:${normalizedPhone}`,
      deletedAt: Date.now(),
    });
  }

  static async isPhoneTombstoned(tableName: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return false;
    const t = await db.tombstones.get(`${tableName}:phone:${normalizedPhone}`);
    return !!t;
  }

  // Local tombstones (db.tombstones) only exist on the device that performed
  // the delete - they live in that device's IndexedDB and are never shared.
  // That means a second device with a stale/unsynced local copy of the same
  // record has no way of knowing it was deleted elsewhere, and can end up
  // pushing it right back to Supabase. `deleted_records` is a small shared
  // table on Supabase that every device reads on every pull, so a deletion
  // performed anywhere is visible everywhere - regardless of each device's
  // local tombstone/sync state.
  static async fetchRemoteTombstones(): Promise<{
    byId: Map<string, Set<string>>;
    byPhone: Map<string, Set<string>>;
  }> {
    const byId = new Map<string, Set<string>>();
    const byPhone = new Map<string, Set<string>>();
    if (!SUPABASE_CONFIGURED) return { byId, byPhone };

    const { data, error } = await supabase
      .from("deleted_records")
      .select("table_name, record_id, phone");
    if (error) {
      console.warn("Failed to pull remote tombstones:", error.message || error);
      return { byId, byPhone };
    }
    if (!Array.isArray(data)) return { byId, byPhone };

    for (const row of data as any[]) {
      const tableName = row?.table_name;
      if (!tableName) continue;
      const recordId = row?.record_id ? String(row.record_id).trim() : "";
      if (recordId) {
        if (!byId.has(tableName)) byId.set(tableName, new Set());
        byId.get(tableName)!.add(recordId);
      }
      const phone = normalizePhone(row?.phone);
      if (phone) {
        if (!byPhone.has(tableName)) byPhone.set(tableName, new Set());
        byPhone.get(tableName)!.add(phone);
      }
    }
    return { byId, byPhone };
  }

  // Record a deletion on Supabase itself, so every other device can see it
  // on its next pull, even if it never learns about the local tombstone.
  // Best-effort: if this fails, the local tombstone + retrying DELETE still
  // protect this device, and the next successful pull will retry the push.
  static async pushRemoteTombstone(
    tableName: string,
    recordId: string | null,
    phone: string | null,
  ) {
    if (!SUPABASE_CONFIGURED) return;
    try {
      await supabase.from("deleted_records").insert({
        table_name: tableName,
        record_id: recordId,
        phone: phone ? normalizePhone(phone) : null,
      });
    } catch (e) {
      console.warn("Failed to push remote tombstone", tableName, recordId, phone, e);
    }
  }

  private static async processQueue() {
    if (!SUPABASE_CONFIGURED) {
      console.warn("Process queue skipped: Supabase is not configured.");
      return;
    }

    while (navigator.onLine) {
      const item = await db.sync_queue
        .orderBy("createdAt")
        .filter(x => x.status === "pending" || x.status === "failed")
        .first();

      if (!item) break;

      try {
        await db.sync_queue.update(item.id!, { status: "syncing" });
        await this.syncItem(item);

        if (item.operation === "INSERT" || item.operation === "UPDATE") {
          try {
            const localRecord = await db.table(item.tableName).get(item.recordId);
            if (localRecord) {
              await db.table(item.tableName).update(item.recordId, {
                synced: true,
                last_modified: Date.now(),
              });
            }
          } catch (e) {
            console.warn(`Failed to update synced status for ${item.tableName}:${item.recordId}`, e);
          }
        }

        await db.sync_queue.delete(item.id!);
      } catch (error: any) {
        console.error("Sync failed for item:", item, error);
        
        const isConnectionError = !navigator.onLine || 
          error?.message?.includes("Failed to fetch") || 
          error?.status === 0;

        if (isConnectionError) {
          await db.sync_queue.update(item.id!, { status: "failed", errorMessage: error?.message });
          break; // Stop processing queue on connection failure
        } else {
          // Permanent failure (e.g. database constraints, validation)
          // To prevent blocking the queue forever, we increment retry count and mark as failed
          const retryCount = (item.retryCount || 0) + 1;
          if (retryCount >= 5) {
            console.error("Discarding persistently failing sync item after 5 retries:", item);
            await db.sync_queue.delete(item.id!);
          } else {
            await db.sync_queue.update(item.id!, { 
              status: "failed", 
              retryCount,
              errorMessage: error?.message 
            });
          }
        }
      }
    }
  }

  private static async syncItem(item: SyncQueueItem) {
    const { tableName, operation, recordId, payload } = item;
    const pkColumn = tableName === "app_settings" ? "key" : "id";

    // Clean payload of local-only columns that do not exist in the Supabase schema
    let cleanedPayload = payload;
    if (payload && typeof payload === "object") {
      cleanedPayload = { ...payload };
      delete cleanedPayload.last_modified;
      delete cleanedPayload.synced;
      delete cleanedPayload.location_url;
      if (tableName === "production_stages") {
        delete cleanedPayload.client;
        delete cleanedPayload.timer_days;
        delete cleanedPayload.timer_started_at;
        delete cleanedPayload.payment_requested;
        delete cleanedPayload.payment_requested_at;
      }
    }

    switch (operation) {
      case "INSERT": {
        const { error } = await supabase.from(tableName).insert(cleanedPayload);
        if (error && !error.message?.includes("duplicate key")) throw error;

        // Clear remote tombstone on Supabase by ID and Phone if insertion succeeded
        try {
          const phone = normalizePhone(payload?.phone);
          let query = supabase.from("deleted_records").delete().eq("table_name", tableName);
          if (phone) {
            query = query.or(`record_id.eq.${recordId},phone.eq.${phone}`);
          } else {
            query = query.eq("record_id", recordId);
          }
          await query;
        } catch (e) {
          console.warn("Failed to clear remote tombstone on INSERT:", e);
        }
        break;
      }
      case "UPDATE": {
        const { error } = await supabase.from(tableName).update(cleanedPayload).eq(pkColumn, recordId);
        if (error) throw error;

        // Clear remote tombstone on Supabase by ID and Phone if update succeeded
        try {
          const phone = normalizePhone(payload?.phone);
          let query = supabase.from("deleted_records").delete().eq("table_name", tableName);
          if (phone) {
            query = query.or(`record_id.eq.${recordId},phone.eq.${phone}`);
          } else {
            query = query.eq("record_id", recordId);
          }
          await query;
        } catch (e) {
          console.warn("Failed to clear remote tombstone on UPDATE:", e);
        }
        break;
      }
      case "DELETE": {
        const { error } = await supabase.from(tableName).delete().eq(pkColumn, recordId);
        if (error) throw error;
        await this.pushRemoteTombstone(tableName, recordId, null);
        break;
      }
      case "DELETE_BY_PHONE": {
        const phone = payload?.phone;
        if (!phone) throw new Error("Missing phone for DELETE_BY_PHONE operation");
        const phoneVariants = buildPhoneVariants(phone);
        let query = supabase.from(tableName).delete();
        if (phoneVariants.length === 1) {
          query = query.eq("phone", phoneVariants[0]);
        } else {
          query = query.or(
            phoneVariants.map((p) => `phone.eq.${p}`).join(","),
          );
        }
        const { error } = await query;
        if (error) throw error;
        await this.pushRemoteTombstone(tableName, null, phone);
        break;
      }
    }
  }

  // Handle local vs remote conflicts safely using timestamps
  static async resolveConflict(tableName: string, remoteRecord: any): Promise<boolean> {
    const pkColumn = tableName === "app_settings" ? "key" : "id";
    const pkValue = remoteRecord[pkColumn];

    // -1. Known test/QA record (e.g. "Test Authenticated") landed on a
    // customer-facing table. Actively remove it - locally and on the server -
    // instead of silently hiding it, so it can't keep reappearing.
    if (CUSTOMER_FACING_TABLES.has(tableName) && isTestRecord(remoteRecord)) {
      await db.table(tableName).delete(pkValue).catch(() => {});
      const phone = normalizePhone(remoteRecord.phone);
      if (phone) {
        await this.addPhoneTombstone(tableName, phone);
        const pendingPhoneDelete = await db.sync_queue
          .where("tableName").equals(tableName)
          .and((x) => x.operation === "DELETE_BY_PHONE" && x.recordId === phone)
          .first();
        if (!pendingPhoneDelete) {
          await this.queueDeleteByPhone(tableName, phone);
        }
      }
      const pendingDelete = await db.sync_queue
        .where("tableName").equals(tableName)
        .and((x) => x.recordId === pkValue && x.operation === "DELETE")
        .first();
      if (!pendingDelete) {
        await this.queueOperation("DELETE", tableName, pkValue, null);
      }
      return false;
    }

    const phone = normalizePhone(remoteRecord.phone);
    const tombstonedById = await this.isTombstoned(tableName, pkValue);
    const tombstonedByPhone = phone && (await this.isPhoneTombstoned(tableName, phone));
    if (tombstonedById || tombstonedByPhone) {
      const pendingDelete = await db.sync_queue
        .where("tableName").equals(tableName)
        .and((x) => x.recordId === pkValue && x.operation === "DELETE")
        .first();
      if (!pendingDelete) {
        await this.queueOperation("DELETE", tableName, pkValue, null);
      }
      if (phone) {
        const pendingPhoneDelete = await db.sync_queue
          .where("tableName").equals(tableName)
          .and((x) => x.operation === "DELETE_BY_PHONE" && x.recordId === phone)
          .first();
        if (!pendingPhoneDelete) {
          await this.queueDeleteByPhone(tableName, phone);
        }
      }
      await db.table(tableName).delete(pkValue).catch(() => {});
      return false;
    }

    // 1. Check if record has pending sync operations
    const pending = await db.sync_queue
      .where("tableName").equals(tableName)
      .and(x => x.recordId === pkValue)
      .first();
    
    if (pending) {
      // Local changes are pending, do not overwrite local database with stale remote data
      return false;
    }

    const localRecord = await db.table(tableName).get(pkValue);
    if (localRecord) {
      const localTime = localRecord.last_modified || 0;
      const remoteTime = remoteRecord.updated_at 
        ? new Date(remoteRecord.updated_at).getTime()
        : remoteRecord.created_at
        ? new Date(remoteRecord.created_at).getTime()
        : remoteRecord.finalized_at
        ? new Date(remoteRecord.finalized_at).getTime()
        : 0;

      if (localTime > remoteTime) {
        // Local database is newer, preserve it
        return false;
      }
    }

    // Insert or update remote record locally
    const recordToStore = {
      ...remoteRecord,
      last_modified: Date.now(),
      synced: true
    };
    await db.table(tableName).put(recordToStore);
    return true;
  }
}