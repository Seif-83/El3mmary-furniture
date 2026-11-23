import { db, type LocalProductionStage } from "./db";
import { SyncManager } from "./sync";
import { supabase } from "../lib/supabase";
import { isPhoneMatch, extractCleanPhones } from "../utils";

export class CustomerService {
  static async getAll() {
    return db.customers.orderBy("created_at").reverse().toArray();
  }

  static async getClients() {
    return db.clients.toArray();
  }

  static async saveClient(client: {
    id: string;
    name: string;
    phones: string[];
    address?: string;
    governorate?: string;
  }) {
    const cleanPhones = extractCleanPhones(client.phones);
    // Find existing client by phone to avoid duplicate client records
    let existing: any = null;
    if (cleanPhones.length > 0) {
      const allClients = await db.clients.toArray();
      existing = allClients.find((c) => isPhoneMatch(c.phones, cleanPhones[0]));
    }
    const clientId = existing?.id || client.id;
    const mergedPhones = Array.from(
      new Set([...(existing?.phones || []), ...(cleanPhones.length > 0 ? cleanPhones : client.phones)])
    );

    const record = {
      ...(existing || {}),
      ...client,
      id: clientId,
      phones: mergedPhones,
      address: client.address || existing?.address,
      governorate: client.governorate || existing?.governorate,
      created_at: existing?.created_at || new Date().toISOString(),
      last_modified: Date.now(),
    };
    await db.clients.put(record);
    await SyncManager.clearTombstone("clients", clientId);
    await SyncManager.queueOperation(existing ? "UPDATE" : "INSERT", "clients", clientId, {
      id: clientId,
      name: record.name,
      phones: record.phones,
      address: record.address,
      governorate: record.governorate,
      created_at: record.created_at,
    });
    return record;
  }

  static async getClientById(id: string) {
    return db.clients.get(id);
  }

  static async getClientByPhone(phone: string) {
    const clients = await db.clients.toArray();
    return clients.find((c) => isPhoneMatch(c.phones, phone));
  }

  static async insert(customer: any) {
    const record = { ...customer, last_modified: Date.now() };
    await db.customers.put(record);
    await SyncManager.clearTombstone("customers", customer.id, customer.phone);
    await SyncManager.queueOperation(
      "INSERT",
      "customers",
      customer.id,
      customer,
    );
  }

  static async update(id: string, updates: any) {
    const record = await db.customers.get(id);
    const updated = { ...record, ...updates, id, last_modified: Date.now() };
    await db.customers.put(updated);
    await SyncManager.queueOperation("UPDATE", "customers", id, updates);
  }

  static async delete(id: string) {
    await db.customers.delete(id);
    await SyncManager.addTombstone("customers", id);
    await SyncManager.queueOperation("DELETE", "customers", id, null);
  }
}

export class OrderService {
  static async getInspections() {
    return db.inspections.orderBy("created_at").reverse().toArray();
  }

  static async getContracted() {
    return db.contracted_customers.orderBy("finalized_at").reverse().toArray();
  }

  static async getNonContracted() {
    return db.non_contracted_customers
      .orderBy("finalized_at")
      .reverse()
      .toArray();
  }

  static async insertInspection(inspection: any) {
    const record = { ...inspection, last_modified: Date.now() };
    await db.inspections.put(record);
    await SyncManager.clearTombstone("inspections", inspection.id, inspection.phone);
    await SyncManager.queueOperation(
      "INSERT",
      "inspections",
      inspection.id,
      inspection,
    );
  }

  static async updateInspection(id: string, updates: any) {
    const record = await db.inspections.get(id);
    const updatedRecord = { ...record, ...updates, id, last_modified: Date.now() };
    await db.inspections.put(updatedRecord);
    await SyncManager.queueOperation("UPDATE", "inspections", id, updates);
  }

  static async deleteInspection(id: string) {
    await db.inspections.delete(id);
    await SyncManager.addTombstone("inspections", id);
    await SyncManager.queueOperation("DELETE", "inspections", id, null);
  }

  static async insertContracted(record: any) {
    const storedRecord = { ...record, last_modified: Date.now() };
    await db.contracted_customers.put(storedRecord);
    await SyncManager.clearTombstone("contracted_customers", record.id, record.phone);
    await SyncManager.queueOperation(
      "INSERT",
      "contracted_customers",
      record.id,
      record,
    );
  }

  static async deleteContracted(id: string) {
    await db.contracted_customers.delete(id);
    await SyncManager.addTombstone("contracted_customers", id);
    await SyncManager.queueOperation(
      "DELETE",
      "contracted_customers",
      id,
      null,
    );
  }

  static async updateContracted(id: string, updates: any) {
    const record = await db.contracted_customers.get(id);
    const updated = { ...record, ...updates, id, last_modified: Date.now() };
    await db.contracted_customers.put(updated);
    await SyncManager.queueOperation(
      "UPDATE",
      "contracted_customers",
      id,
      updates,
    );
  }

  static async insertNonContracted(record: any) {
    const storedRecord = { ...record, last_modified: Date.now() };
    await db.non_contracted_customers.put(storedRecord);
    await SyncManager.clearTombstone("non_contracted_customers", record.id, record.phone);
    await SyncManager.queueOperation(
      "INSERT",
      "non_contracted_customers",
      record.id,
      record,
    );
  }

  static async deleteNonContracted(id: string) {
    await db.non_contracted_customers.delete(id);
    await SyncManager.addTombstone("non_contracted_customers", id);
    await SyncManager.queueOperation(
      "DELETE",
      "non_contracted_customers",
      id,
      null,
    );
  }

  static async updateNonContracted(id: string, updates: any) {
    const record = await db.non_contracted_customers.get(id);
    const updated = { ...record, ...updates, id, last_modified: Date.now() };
    await db.non_contracted_customers.put(updated);
    await SyncManager.queueOperation(
      "UPDATE",
      "non_contracted_customers",
      id,
      updates,
    );
  }
}

export class ProductService {
  static async getCatalogs() {
    return db.catalogs.orderBy("created_at").reverse().toArray();
  }

  static async insert(catalog: any) {
    const record = { ...catalog, last_modified: Date.now() };
    await db.catalogs.put(record);
    await SyncManager.queueOperation("INSERT", "catalogs", catalog.id, {
      id: catalog.id,
      title: catalog.title,
      data: catalog.data,
      created_at: catalog.created_at,
    });
  }

  static async update(id: string, updates: any) {
    const record = await db.catalogs.get(id);
    const updatedRecord = { ...record, ...updates, id, last_modified: Date.now() };
    await db.catalogs.put(updatedRecord);
    await SyncManager.queueOperation("UPDATE", "catalogs", id, updates);
  }

  static async delete(id: string) {
    await db.catalogs.delete(id);
    await SyncManager.addTombstone("catalogs", id);
    await SyncManager.queueOperation("DELETE", "catalogs", id, null);
  }
}

export class InvoiceService {
  private static notifyChange() {
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("payments-updated"));
        localStorage.setItem("el3mmary_payments_updated_at", Date.now().toString());
      } catch {}
    }
  }

  static async getPayments() {
    return db.payments.orderBy("paid_at").reverse().toArray();
  }

  static async insert(payment: any) {
    const record = { ...payment, last_modified: Date.now() };
    await db.payments.put(record);
    await SyncManager.queueOperation("INSERT", "payments", payment.id, payment);
    InvoiceService.notifyChange();
  }

  static async savePayment(payment: any) {
    return this.insert(payment);
  }

  static async update(id: string, updates: any) {
    const record = await db.payments.get(id);
    const updated = { ...record, ...updates, id, last_modified: Date.now() };
    await db.payments.put(updated);
    await SyncManager.queueOperation("UPDATE", "payments", id, updates);
    InvoiceService.notifyChange();
    return updated;
  }

  static async delete(id: string) {
    await db.payments.delete(id);
    await SyncManager.addTombstone("payments", id);
    await SyncManager.queueOperation("DELETE", "payments", id, null);
    InvoiceService.notifyChange();
  }
}

export class StageService {
  static async getStages() {
    const stagesList = await db.production_stages.toArray();
    const clientsList = await db.clients.toArray();
    const clientMap = new Map(clientsList.map((c) => [c.id, c]));

    // Deduplicate stages locally by (client_id || visit_id, stage) to ensure
    // the UI never suffers from stale duplicate entries
    const statusScore = (s: string) => (s === "done" ? 3 : s === "in_progress" ? 2 : 1);
    const stageMap = new Map<string, any>();

    for (const s of stagesList) {
      const ownerKey = s.client_id || s.visit_id || "";
      if (!ownerKey || !s.stage) continue;
      const key = `${ownerKey}::${s.stage}`;
      const existing = stageMap.get(key);
      if (!existing) {
        stageMap.set(key, s);
      } else {
        const scoreExisting = statusScore(existing.status);
        const scoreNew = statusScore(s.status);
        if (scoreNew > scoreExisting) {
          stageMap.set(key, {
            ...s,
            expenses: (s.expenses && s.expenses.length > 0) ? s.expenses : existing.expenses,
            images: (s.images && s.images.length > 0) ? s.images : existing.images,
          });
        } else if (scoreNew === scoreExisting) {
          const compExisting = existing.completed_at ? new Date(existing.completed_at).getTime() : 0;
          const compNew = s.completed_at ? new Date(s.completed_at).getTime() : 0;
          if (compNew > compExisting) {
            stageMap.set(key, {
              ...s,
              expenses: (s.expenses && s.expenses.length > 0) ? s.expenses : existing.expenses,
              images: (s.images && s.images.length > 0) ? s.images : existing.images,
            });
          }
        }
      }
    }

    const deduplicatedStages = Array.from(stageMap.values());

    // Join stage records with clients phones & names to mimic Supabase relation result
    return deduplicatedStages.map((s) => {
      const client = s.client_id ? clientMap.get(s.client_id) : undefined;
      const cleanPhones = client ? extractCleanPhones(client.phones) : [];
      return {
        ...s,
        client: client
          ? {
              id: client.id,
              name: client.name,
              phones: cleanPhones.length > 0 ? cleanPhones : (client.phones || []),
            }
          : undefined,
      };
    });
  }

  static async cleanupDuplicateStages() {
    try {
      const allStages = await db.production_stages.toArray();
      const statusScore = (s: string) => (s === "done" ? 3 : s === "in_progress" ? 2 : 1);
      const byKey = new Map<string, any[]>();
      for (const s of allStages) {
        const owner = s.client_id || s.visit_id || "";
        if (!owner || !s.stage) continue;
        const key = `${owner}::${s.stage}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(s);
      }

      const toDelete: string[] = [];
      for (const [, list] of byKey.entries()) {
        if (list.length <= 1) continue;
        list.sort((a, b) => {
          const scoreA = statusScore(a.status);
          const scoreB = statusScore(b.status);
          if (scoreA !== scoreB) return scoreB - scoreA;
          const compA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const compB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          if (compA !== compB) return compB - compA;
          const crA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const crB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return crB - crA;
        });

        // Keep winner list[0], purge all inferior duplicate records
        for (let i = 1; i < list.length; i++) {
          toDelete.push(list[i].id);
        }
      }

      if (toDelete.length > 0) {
        await db.production_stages.bulkDelete(toDelete);
      }
    } catch (e) {
      console.warn("Failed to cleanup local duplicate stages:", e);
    }
  }

  static async ensureStagesForClient(
    clientId: string,
    visitId?: string | null,
    stageOrderKeys: readonly string[] = [
      "received",
      "inventory",
      "carpentry",
      "painting",
      "fittings",
      "delivery",
    ],
  ) {
    if (!clientId) return [];

    const existingStages = await db.production_stages
      .where("client_id")
      .equals(clientId)
      .toArray();

    const existingByKey = new Map<string, any>();
    for (const s of existingStages) {
      if (!existingByKey.has(s.stage)) {
        existingByKey.set(s.stage, s);
      }
    }

    const resultStages: any[] = [];
    const stagesToInsert: any[] = [];

    for (const stageKey of stageOrderKeys) {
      let stageRecord = existingByKey.get(stageKey);
      if (stageRecord) {
        if (visitId && !stageRecord.visit_id) {
          stageRecord.visit_id = visitId;
          stageRecord.last_modified = Date.now();
          await db.production_stages.put(stageRecord);
          await SyncManager.queueOperation("UPDATE", "production_stages", stageRecord.id, {
            visit_id: visitId,
          });
        }
        resultStages.push(stageRecord);
      } else {
        const newStage = {
          id: crypto.randomUUID(),
          client_id: clientId,
          visit_id: visitId || null,
          stage: stageKey,
          status: "not_started",
          completed_at: null,
          created_at: new Date().toISOString(),
          last_modified: Date.now(),
        };
        resultStages.push(newStage);
        stagesToInsert.push(newStage);
      }
    }

    if (stagesToInsert.length > 0) {
      await this.insertMultiple(stagesToInsert);
    }

    return resultStages;
  }

  static async insertMultiple(stages: any[]) {
    for (const stage of stages) {
      const record = { ...stage, last_modified: Date.now() };
      await db.production_stages.put(record);
      await SyncManager.queueOperation(
        "INSERT",
        "production_stages",
        stage.id,
        stage,
      );
    }
  }

  static async updateStatus(
    id: string,
    status: string,
    extraUpdates?: {
      completed_at?: string | null;
      timer_days?: number | null;
      customer_days?: number | null;
      timer_started_at?: string | null;
      payment_requested?: boolean;
      payment_requested_at?: string | null;
      storage_warning_dismissed_at?: string | null;
      images?: string[] | null;
      expenses?: { destination: string; amount: number }[] | null;
    },
  ) {
    const record = await db.production_stages.get(id);
    if (!record) return;
    const updated = {
      ...record,
      status,
      ...(extraUpdates || {}),
      last_modified: Date.now(),
    };
    await db.production_stages.put(updated as any);
    const syncPayload: any = {
      status,
      completed_at: updated.completed_at,
    };
    if (updated.expenses) {
      syncPayload.expenses = updated.expenses;
    }
    await SyncManager.queueOperation("UPDATE", "production_stages", id, syncPayload);
  }

  static async updateStageExpenses(id: string, expenses: { destination: string; amount: number }[]) {
    const record = await db.production_stages.get(id);
    if (!record) return;
    const updated = {
      ...record,
      expenses,
      last_modified: Date.now(),
    };
    await db.production_stages.put(updated as any);
    await SyncManager.queueOperation("UPDATE", "production_stages", id, {
      status: updated.status,
      completed_at: updated.completed_at,
      expenses,
    });
  }

  static async updateStage(id: string, updates: Partial<LocalProductionStage>) {
    const record = await db.production_stages.get(id);
    if (!record) return;
    const updated = { ...record, ...updates, last_modified: Date.now() };
    await db.production_stages.put(updated as any);
    await SyncManager.queueOperation("UPDATE", "production_stages", id, {
      status: updated.status,
      completed_at: updated.completed_at,
    });
  }
}

export class SettingsService {
  static async getSettings() {
    const settingsList = await db.app_settings.toArray();
    const settingsMap: Record<string, string> = {};
    settingsList.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return settingsMap;
  }

  static async save(key: string, value: string) {
    const record = {
      key,
      value,
      updated_at: new Date().toISOString(),
      last_modified: Date.now(),
    };
    await db.app_settings.put(record);
    await SyncManager.queueOperation("INSERT", "app_settings", key, record);
  }
}

export class ActivityLogService {
  static async getLogs() {
    return db.activity_logs.orderBy("created_at").reverse().toArray();
  }

  static async insert(log: any) {
    const record = { ...log, last_modified: Date.now() };
    await db.activity_logs.put(record);
    await SyncManager.queueOperation("INSERT", "activity_logs", log.id, log);
  }
}

export class CustomerServiceLogsService {
  private static STORAGE_KEY = "el3mmary_cs_logs_backup";

  private static getLocalBackup(): any[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static setLocalBackup(logs: any[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error("Local storage error:", e);
    }
  }

  static async getAll() {
    try {
      if (db.customer_service_logs) {
        const records = await db.customer_service_logs.orderBy("created_at").reverse().toArray();
        if (records && records.length > 0) {
          this.setLocalBackup(records);
          return records.map((r) => ({
            id: r.id,
            customerName: r.customer_name,
            phone: r.phone,
            notes: r.notes,
            createdAt: r.created_at,
            createdBy: r.created_by,
            reply: r.reply,
            repliedAt: r.replied_at,
            repliedBy: r.replied_by,
            status: (r.status as "pending" | "resolved") || (r.reply ? "resolved" : "pending"),
            last_modified: r.last_modified,
          }));
        }
      }
    } catch (err) {
      console.warn("Dexie CS logs read error, falling back to storage:", err);
    }
    const backup = this.getLocalBackup();
    return backup.map((r) => ({
      id: r.id,
      customerName: r.customer_name || r.customerName,
      phone: r.phone,
      notes: r.notes,
      createdAt: r.created_at || r.createdAt,
      createdBy: r.created_by || r.createdBy,
      reply: r.reply,
      repliedAt: r.replied_at || r.repliedAt,
      repliedBy: r.replied_by || r.repliedBy,
      status: (r.status as "pending" | "resolved") || (r.reply ? "resolved" : "pending"),
      last_modified: r.last_modified,
    }));
  }

  static async insert(item: {
    id: string;
    customerName: string;
    phone: string;
    notes: string;
    createdAt: string;
    createdBy?: string;
    reply?: string;
    repliedAt?: string;
    repliedBy?: string;
    status?: "pending" | "resolved";
  }) {
    const record = {
      id: item.id,
      customer_name: item.customerName,
      phone: item.phone,
      notes: item.notes,
      created_at: item.createdAt,
      created_by: item.createdBy,
      reply: item.reply || null,
      replied_at: item.repliedAt || null,
      replied_by: item.repliedBy || null,
      status: item.status || "pending",
      last_modified: Date.now(),
    };

    // Update localStorage backup
    const backup = this.getLocalBackup();
    const existingIdx = backup.findIndex((b) => b.id === item.id);
    if (existingIdx >= 0) {
      backup[existingIdx] = record;
    } else {
      backup.unshift(record);
    }
    this.setLocalBackup(backup);

    // Save in Dexie
    try {
      if (db.customer_service_logs) {
        await db.customer_service_logs.put(record);
      }
    } catch (err) {
      console.warn("Dexie CS logs write error:", err);
    }

    // Also queue sync / activity log
    try {
      await SyncManager.queueOperation("INSERT", "activity_logs", item.id, {
        id: item.id,
        type: "customer_service",
        message: `ملاحظة خدمة عملاء: ${item.customerName} - ${item.phone}`,
        details: record,
        created_at: item.createdAt,
      });
    } catch (e) {
      console.error("Queue sync error for CS log:", e);
    }
  }

  static async saveReply(id: string, reply: string, repliedBy: string) {
    const nowIso = new Date().toISOString();
    // Update local backup
    const backup = this.getLocalBackup();
    const item = backup.find((b) => b.id === id);
    if (item) {
      item.reply = reply;
      item.replied_at = nowIso;
      item.replied_by = repliedBy;
      item.status = "resolved";
      item.last_modified = Date.now();
      this.setLocalBackup(backup);
    }

    // Update Dexie
    try {
      if (db.customer_service_logs) {
        const record = await db.customer_service_logs.get(id);
        if (record) {
          const updated = {
            ...record,
            reply,
            replied_at: nowIso,
            replied_by: repliedBy,
            status: "resolved",
            last_modified: Date.now(),
          };
          await db.customer_service_logs.put(updated);
        }
      }
    } catch (err) {
      console.warn("Dexie CS logs reply save error:", err);
    }
  }

  static async delete(id: string) {
    const backup = this.getLocalBackup().filter((b) => b.id !== id);
    this.setLocalBackup(backup);
    try {
      if (db.customer_service_logs) {
        await db.customer_service_logs.delete(id);
      }
    } catch (err) {
      console.warn("Dexie CS log delete error:", err);
    }
  }
}