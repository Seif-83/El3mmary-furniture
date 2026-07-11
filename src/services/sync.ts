import { db, SyncQueueItem } from "./db";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";

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

      // Do not automatically delete local records when a remote row is missing.
      // Remote reads can be incomplete due to permissions, row-level security, or
      // eventual sync latency, and deleting local rows here can remove newly
      // created records before they are confirmed on the server.
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

    switch (operation) {
      case "INSERT": {
        const { error } = await supabase.from(tableName).insert(payload);
        if (error && !error.message?.includes("duplicate key")) throw error;
        break;
      }
      case "UPDATE": {
        const { error } = await supabase.from(tableName).update(payload).eq(pkColumn, recordId);
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
