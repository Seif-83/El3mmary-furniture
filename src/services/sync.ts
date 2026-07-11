import { db, SyncQueueItem } from "./db";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";

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

  static init(onStatusChange: (online: boolean) => void) {
    this.onStatusChangeListeners.push(onStatusChange);
    
    window.addEventListener("online", () => this.handleNetworkChange(true));
    window.addEventListener("offline", () => this.handleNetworkChange(false));
    
    // Initial sync check
    if (navigator.onLine) {
      this.triggerSync();
    }
  }

  private static handleNetworkChange(online: boolean) {
    this.onStatusChangeListeners.forEach(listener => listener(online));
    if (online) {
      this.triggerSync();
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

  static async clearTombstone(tableName: string, recordId: string) {
    await db.tombstones.delete(`${tableName}:${recordId}`);
  }

  static async queueOperation(
    operation: "INSERT" | "UPDATE" | "DELETE",
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

  static async triggerSync() {
    if (!SUPABASE_CONFIGURED) {
      console.warn("Sync skipped: Supabase is not configured.");
      return;
    }
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      await this.processQueue();
      await this.pullRemoteData();
      // Process any self-healed queue items immediately
      await this.processQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  static async pullRemoteData() {
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

    for (const tableName of tablesToSync) {
      const pkColumn = tableName === "app_settings" ? "key" : "id";
      const { data, error } = await supabase.from(tableName).select("*");
      if (error) {
        console.warn(`Failed to pull remote data for ${tableName}:`, error.message || error);
        continue;
      }
      if (!Array.isArray(data)) continue;

      const remoteIds = new Set<string>();
      for (const remoteRecord of data) {
        const remoteKey = String(remoteRecord?.[pkColumn] ?? "").trim();
        if (!remoteKey) continue;
        remoteIds.add(remoteKey);
        await this.resolveConflict(tableName, remoteRecord);
      }

      // Self-healing sync: find local records that are missing on the remote database
      const localRecords = await db.table(tableName).toArray();
      for (const localRecord of localRecords) {
        const localKey = String(localRecord[pkColumn] ?? "").trim();
        if (!localKey) continue;

        if (!remoteIds.has(localKey)) {
          // Check if this record is already in the sync queue
          const inQueue = await db.sync_queue
            .where("tableName").equals(tableName)
            .and(x => x.recordId === localKey)
            .first();

          if (!inQueue) {
            console.log(`Healing sync: local record ${localKey} in ${tableName} is missing from Supabase. Queuing INSERT.`);
            await this.queueOperation("INSERT", tableName, localKey, localRecord);
          }
        }
      }

      // Do not automatically delete local records when a remote row is missing.
      // Remote reads can be incomplete due to permissions, row-level security, or
      // eventual sync latency, and deleting local rows here can remove newly
      // created records before they are confirmed on the server.

      // Tombstone cleanup: once the remote table confirms a previously-deleted
      // record is actually gone, we no longer need to guard against it, so
      // drop the tombstone to keep the table small.
      const tableTombstones = await db.tombstones
        .where("tableName").equals(tableName)
        .toArray();
      for (const tomb of tableTombstones) {
        if (!remoteIds.has(tomb.recordId)) {
          await db.tombstones.delete(tomb.id);
        }
      }
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
      if (tableName === "production_stages") {
        delete cleanedPayload.client;
      }
    }

    switch (operation) {
      case "INSERT": {
        const { error } = await supabase.from(tableName).insert(cleanedPayload);
        if (error && !error.message?.includes("duplicate key")) throw error;
        break;
      }
      case "UPDATE": {
        const { error } = await supabase.from(tableName).update(cleanedPayload).eq(pkColumn, recordId);
        if (error) throw error;
        break;
      }
      case "DELETE": {
        const { error } = await supabase.from(tableName).delete().eq(pkColumn, recordId);
        if (error) throw error;
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
      await this.addTombstone(tableName, pkValue);
      const pendingDelete = await db.sync_queue
        .where("tableName").equals(tableName)
        .and(x => x.recordId === pkValue && x.operation === "DELETE")
        .first();
      if (!pendingDelete) {
        await this.queueOperation("DELETE", tableName, pkValue, null);
      }
      return false;
    }

    // 0. Record was deleted locally (tombstoned). Never let a stale/racing
    // remote read (e.g. refreshAllData's direct Supabase fetch, which can run
    // concurrently with the DELETE that's still syncing) resurrect it. If the
    // remote still has this row, make sure a DELETE is (re)queued so it gets
    // cleaned up on the server too, instead of silently skipping forever.
    if (await this.isTombstoned(tableName, pkValue)) {
      const pendingDelete = await db.sync_queue
        .where("tableName").equals(tableName)
        .and(x => x.recordId === pkValue && x.operation === "DELETE")
        .first();
      if (!pendingDelete) {
        await this.queueOperation("DELETE", tableName, pkValue, null);
      }
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
      last_modified: Date.now()
    };
    await db.table(tableName).put(recordToStore);
    return true;
  }
}
