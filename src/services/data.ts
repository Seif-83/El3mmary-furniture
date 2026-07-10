import { db } from "./db";
import { SyncManager } from "./sync";
import { supabase } from "../lib/supabase";

export class CustomerService {
  static async getAll() {
    return db.customers.orderBy("created_at").reverse().toArray();
  }

  static async getClients() {
    return db.clients.toArray();
  }

  static async saveClient(client: { id: string; name: string; phones: string[]; address?: string; governorate?: string }) {
    const record = { ...client, created_at: new Date().toISOString(), last_modified: Date.now() };
    await db.clients.put(record);
    await SyncManager.queueOperation("INSERT", "clients", client.id, {
      id: client.id,
      name: client.name,
      phones: client.phones,
      address: client.address,
      governorate: client.governorate,
      created_at: record.created_at
    });
  }

  static async getClientById(id: string) {
    return db.clients.get(id);
  }

  static async getClientByPhone(phone: string) {
    return db.clients.filter(c => c.phones.includes(phone)).first();
  }

  static async insert(customer: any) {
    const record = { ...customer, last_modified: Date.now() };
    await db.customers.put(record);
    await SyncManager.queueOperation("INSERT", "customers", customer.id, customer);
  }

  static async update(id: string, updates: any) {
    const record = await db.customers.get(id);
    const updated = { ...record, ...updates, last_modified: Date.now() };
    await db.customers.put(updated);
    await SyncManager.queueOperation("UPDATE", "customers", id, updates);
  }

  static async delete(id: string) {
    await db.customers.delete(id);
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
    return db.non_contracted_customers.orderBy("finalized_at").reverse().toArray();
  }

  static async insertInspection(inspection: any) {
    const record = { ...inspection, last_modified: Date.now() };
    await db.inspections.put(record);
    await SyncManager.queueOperation("INSERT", "inspections", inspection.id, inspection);
  }

  static async updateInspection(id: string, updates: any) {
    const record = await db.inspections.get(id);
    const updatedRecord = { ...record, ...updates, last_modified: Date.now() };
    await db.inspections.put(updatedRecord);
    await SyncManager.queueOperation("UPDATE", "inspections", id, updates);
  }

  static async deleteInspection(id: string) {
    await db.inspections.delete(id);
    await SyncManager.queueOperation("DELETE", "inspections", id, null);
  }

  static async insertContracted(record: any) {
    const storedRecord = { ...record, last_modified: Date.now() };
    await db.contracted_customers.put(storedRecord);
    await SyncManager.queueOperation("INSERT", "contracted_customers", record.id, record);
  }

  static async deleteContracted(id: string) {
    await db.contracted_customers.delete(id);
    await SyncManager.queueOperation("DELETE", "contracted_customers", id, null);
  }

  static async updateContracted(id: string, updates: any) {
    const record = await db.contracted_customers.get(id);
    const updated = { ...record, ...updates, last_modified: Date.now() };
    await db.contracted_customers.put(updated);
    await SyncManager.queueOperation("UPDATE", "contracted_customers", id, updates);
  }

  static async insertNonContracted(record: any) {
    const storedRecord = { ...record, last_modified: Date.now() };
    await db.non_contracted_customers.put(storedRecord);
    await SyncManager.queueOperation("INSERT", "non_contracted_customers", record.id, record);
  }

  static async deleteNonContracted(id: string) {
    await db.non_contracted_customers.delete(id);
    await SyncManager.queueOperation("DELETE", "non_contracted_customers", id, null);
  }

  static async updateNonContracted(id: string, updates: any) {
    const record = await db.non_contracted_customers.get(id);
    const updated = { ...record, ...updates, last_modified: Date.now() };
    await db.non_contracted_customers.put(updated);
    await SyncManager.queueOperation("UPDATE", "non_contracted_customers", id, updates);
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
      created_at: catalog.created_at
    });
  }

  static async update(id: string, updates: any) {
    const record = await db.catalogs.get(id);
    const updatedRecord = { ...record, ...updates, last_modified: Date.now() };
    await db.catalogs.put(updatedRecord);
    await SyncManager.queueOperation("UPDATE", "catalogs", id, updates);
  }

  static async delete(id: string) {
    await db.catalogs.delete(id);
    await SyncManager.queueOperation("DELETE", "catalogs", id, null);
  }
}

export class InvoiceService {
  static async getPayments() {
    return db.payments.orderBy("paid_at").reverse().toArray();
  }

  static async insert(payment: any) {
    const record = { ...payment, last_modified: Date.now() };
    await db.payments.put(record);
    await SyncManager.queueOperation("INSERT", "payments", payment.id, payment);
  }

  static async delete(id: string) {
    await db.payments.delete(id);
    await SyncManager.queueOperation("DELETE", "payments", id, null);
  }
}

export class StageService {
  static async getStages() {
    const stagesList = await db.production_stages.toArray();
    const clientsList = await db.clients.toArray();
    const clientMap = new Map(clientsList.map(c => [c.id, c]));

    // Join stage records with clients phones to mimic Supabase relation result
    return stagesList.map(s => ({
      ...s,
      client: s.client_id ? { phones: clientMap.get(s.client_id)?.phones || [] } : undefined
    }));
  }

  static async insertMultiple(stages: any[]) {
    for (const stage of stages) {
      const record = { ...stage, last_modified: Date.now() };
      await db.production_stages.put(record);
      await SyncManager.queueOperation("INSERT", "production_stages", stage.id, stage);
    }
  }

  static async updateStatus(id: string, status: string) {
    const record = await db.production_stages.get(id);
    if (!record) return;
    const updated = { ...record, status, last_modified: Date.now() };
    await db.production_stages.put(updated);
    await SyncManager.queueOperation("UPDATE", "production_stages", id, { status });
  }
}

export class SettingsService {
  static async getSettings() {
    const settingsList = await db.app_settings.toArray();
    const settingsMap: Record<string, string> = {};
    settingsList.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    return settingsMap;
  }

  static async save(key: string, value: string) {
    const record = { key, value, updated_at: new Date().toISOString(), last_modified: Date.now() };
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
