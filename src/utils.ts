// Small pure helper functions used throughout the app: phone number
// normalization, DB<->UI record mapping, JSON parsing helpers, and the
// notification sound player. Extracted from App.tsx - no React/JSX here.

import type { CustomerRecord, Inspection, FurniturePiece, ContractAddition } from "./types";
import { toTimestamp, toSortableDateValue } from "./types";

export const normalizePhone = (p: any) => {
  if (!p) return "";
  const s = String(p);
  return s
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/\D/g, "");
};

export const isTestCustomer = (c: any) => {
  const name = String(c?.name || c?.customerName || "" || "").toLowerCase();
  const phone = String(c?.phone || "" || "").replace(/\D/g, "");
  if (!name && !phone) return false;
  if (phone === "1234567890") return true;
  if (
    name.includes("test authenticated") ||
    (name.includes("test") && name.includes("authenticated"))
  )
    return true;
  if (name.includes("test")) return true;
  return false;
};

export const formatCellValue = (v: any) => {
  if (v === null || v === undefined) return "";

  // Handle Excel Serial Dates (approx range for 1900-2100)
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const date = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
    }
  }

  return String(v);
};

export const formatTime12 = (timeStr?: string, lang: string = "ar"): string => {
  if (!timeStr) return "";
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2).padStart(2, "0");
  if (isNaN(hours)) return timeStr;
  const isPM = hours >= 12;
  const period = isPM
    ? (lang === "ar" ? "م" : "PM")
    : (lang === "ar" ? "ص" : "AM");
  hours = hours % 12 || 12;
  const hoursStr = hours.toString().padStart(2, "0");
  return `${hoursStr}:${minutes} ${period}`;
};

export const mapCustomerFromDB = (dbCust: any): CustomerRecord => ({
  id: dbCust.id,
  name: dbCust.name,
  phone: dbCust.phone,
  governorate: dbCust.governorate,
  address: dbCust.address,
  deliveryAddress: dbCust.delivery_address,
  visitDate: dbCust.visit_date,
  visitTime: dbCust.visit_time || dbCust.visitTime,
  notes: dbCust.notes,
  deliveryDate: dbCust.delivery_date,
  pickupDate: dbCust.pickup_date,
  portfolioDate: dbCust.portfolio_date,
  createdAt: toTimestamp(dbCust.created_at),
});

export function parseMaybeJsonObject<T>(value: any): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

export function parseMaybeJsonArray<T>(value: any): T[] | undefined {
  if (Array.isArray(value)) return value;
  const parsed = parseMaybeJsonObject<T[]>(value);
  return Array.isArray(parsed) ? parsed : undefined;
}

export function parseRecordSource<T>(value: any): Record<string, T> {
  const parsed = parseMaybeJsonObject(value) as Record<string, T>;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    return parsed;
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, T>;
  return {};
}

export const mapInspectionFromDB = (dbInsp: any): Inspection =>
  ({
    id: dbInsp.id,
    customerName: dbInsp.customer_name,
    phone: dbInsp.phone,
    address: dbInsp.address,
    deliveryAddress: dbInsp.delivery_address,
    visitDate: dbInsp.visit_date,
    visitTime: dbInsp.visit_time || dbInsp.visitTime,
    notes: dbInsp.notes,
    governorate: dbInsp.governorate,
    rooms: dbInsp.rooms,
    pieces: parseMaybeJsonArray<FurniturePiece>(dbInsp.pieces) || [],
    totalAmount: Number(dbInsp.total_amount || 0),
    status: dbInsp.status || "pending",
    portfolio: dbInsp.portfolio,
    room_types: parseMaybeJsonArray<string>(dbInsp.room_types) || [],
    room_aro_veneer:
      (parseMaybeJsonObject(dbInsp.room_aro_veneer) as Record<
        string,
        boolean
      >) || {},
    room_aro_veneer_price:
      (parseMaybeJsonObject(dbInsp.room_aro_veneer_price) as Record<
        string,
        number
      >) || {},
    deliveryDate: dbInsp.delivery_date,
    pickupDate: dbInsp.pickup_date,
    portfolioDate: dbInsp.portfolio_date,
    contractDate: dbInsp.contract_date,
    contractUrl: dbInsp.contract_url,
    createdAt: toTimestamp(dbInsp.created_at),
    additions: parseMaybeJsonArray<ContractAddition>(dbInsp.additions) || [],
    ...((dbInsp as any).finalized_at
      ? { finalizedAt: toTimestamp((dbInsp as any).finalized_at) }
      : {}),
  }) as Inspection;

export const sortContractedRecordsByContractDate = (records: Inspection[]) => {
  const sorted = [...records].sort((a, b) => {
    // Prefer records that have contractUrl attached
    if (a.contractUrl && !b.contractUrl) return -1;
    if (!a.contractUrl && b.contractUrl) return 1;

    // Sort by finalizedAt first (most recent finalized/contracted first), fallback to createdAt
    const getTime = (r: Inspection) => {
      const ts = (r as any).finalizedAt || r.createdAt;
      return ts?.toDate?.()?.getTime?.() ?? (typeof ts === "number" ? ts : 0);
    };
    return getTime(b) - getTime(a);
  });

  // Deduplicate by normalized phone number and ID so duplicate customer records never appear in the UI
  const seenPhones = new Set<string>();
  const seenIds = new Set<string>();
  const deduplicated: Inspection[] = [];

  for (const r of sorted) {
    if (r.id && seenIds.has(r.id)) continue;
    const phoneNorm = r.phone ? String(r.phone).replace(/\D/g, "").replace(/^2/, "") : "";
    if (phoneNorm && seenPhones.has(phoneNorm)) continue;

    if (r.id) seenIds.add(r.id);
    if (phoneNorm) seenPhones.add(phoneNorm);
    deduplicated.push(r);
  }

  return deduplicated;
};

export const isMissingRoomTypesColumnError = (error: any) => {
  const raw = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    raw.includes("room_types") &&
    (raw.includes("schema cache") ||
      raw.includes("could not find") ||
      raw.includes("column") ||
      raw.includes("pgrst204"))
  );
};

export const isMissingAroVeneerColumnError = (error: any) => {
  const raw = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    (raw.includes("room_aro_veneer") || raw.includes("aro_veneer")) &&
    (raw.includes("schema cache") ||
      raw.includes("could not find") ||
      raw.includes("column") ||
      raw.includes("pgrst204"))
  );
};

export const withoutRoomTypes = (payload: Record<string, any>) => {
  const { room_types, ...rest } = payload;
  return rest;
};

export const withoutAroVeneer = (payload: Record<string, any>) => {
  const { room_aro_veneer, room_aro_veneer_price, ...rest } = payload;
  return rest;
};

export const withoutRoomTypesAndAroVeneer = (payload: Record<string, any>) => {
  const { room_types, room_aro_veneer, room_aro_veneer_price, ...rest } =
    payload;
  return rest;
};

export const playSound = async (type: "success" | "error" | "delete") => {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    if (ctx.state === "suspended") await ctx.resume();
    const now = ctx.currentTime;

    if (type === "success") {
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, now + i * 0.08);
        g.gain.setValueAtTime(0.01, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.08);
        o.stop(now + i * 0.08 + 0.25);
      });
    } else if (type === "error") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(330, now);
      o.frequency.linearRampToValueAtTime(260, now + 0.12);
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.15, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.3);
    } else if (type === "delete") {
      [523, 440, 349].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.01, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.14, now + i * 0.1 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.2);
      });
    }
  } catch {}
};

export const extractCleanPhones = (phones: any): string[] => {
  if (!phones) return [];
  const arr = Array.isArray(phones) ? phones : [phones];
  return arr
    .flatMap((item) =>
      typeof item === "string" ? item.split(/[,/;\s]+/) : [String(item)],
    )
    .map((p) => p.trim())
    .filter(Boolean);
};

export const isPhoneMatch = (phoneA: any, phoneB: any): boolean => {
  if (!phoneA || !phoneB) return false;
  const phonesA = extractCleanPhones(phoneA);
  const phonesB = extractCleanPhones(phoneB);

  for (const a of phonesA) {
    const normA = normalizePhone(a);
    if (!normA) continue;
    for (const b of phonesB) {
      const normB = normalizePhone(b);
      if (!normB) continue;
      if (normA === normB) return true;
      // Match Egyptian mobile numbers (last 9 digits, e.g. 1006182278)
      if (normA.length >= 9 && normB.length >= 9) {
        if (normA.slice(-9) === normB.slice(-9)) return true;
      }
      // Substring match for length >= 8 if one ends with the other
      if (normA.length >= 8 && normB.length >= 8) {
        if (normA.endsWith(normB) || normB.endsWith(normA)) return true;
      }
    }
  }
  return false;
};

export const getOrderStages = (order: any, allStages: any[]): any[] => {
  if (!order || !Array.isArray(allStages) || allStages.length === 0) return [];

  let rawMatches: any[] = [];

  // 1. Explicit client ID match
  const targetClientId = order.clientId || order.client_id || null;
  if (targetClientId) {
    const matched = allStages.filter((s: any) => s.client_id === targetClientId);
    if (matched.length > 0) rawMatches.push(...matched);
  }

  // 2. Direct ID / Visit ID match
  if (rawMatches.length === 0 && order.id) {
    const directMatches = allStages.filter(
      (s: any) =>
        (s.client_id && s.client_id === order.id) ||
        (s.visit_id && s.visit_id === order.id),
    );
    if (directMatches.length > 0) rawMatches.push(...directMatches);
  }

  // 3. Match by phone
  if (rawMatches.length === 0 && order.phone) {
    const phoneMatches = allStages.filter((s: any) => {
      const stagePhones = s.client?.phones;
      return isPhoneMatch(order.phone, stagePhones);
    });
    if (phoneMatches.length > 0) rawMatches.push(...phoneMatches);
  }

  // 4. Match by customer name if phone didn't match
  if (rawMatches.length === 0 && order.customerName) {
    const orderNameNorm = order.customerName.trim().toLowerCase();
    const nameMatches = allStages.filter((s: any) => {
      const clientName = s.client?.name?.trim()?.toLowerCase();
      return (
        clientName &&
        (clientName === orderNameNorm ||
          clientName.includes(orderNameNorm) ||
          orderNameNorm.includes(clientName))
      );
    });
    if (nameMatches.length > 0) rawMatches.push(...nameMatches);
  }

  if (rawMatches.length === 0) return [];

  // Deduplicate matched stages by stage key, ensuring the most advanced status
  // always wins (done > in_progress > not_started) so that stale duplicates
  // can never shadow a confirmed or in-progress stage.
  const statusScore = (s: string) => (s === "done" ? 3 : s === "in_progress" ? 2 : 1);
  const stageMap = new Map<string, any>();

  for (const s of rawMatches) {
    if (!s?.stage) continue;
    const existing = stageMap.get(s.stage);
    if (!existing) {
      stageMap.set(s.stage, s);
    } else {
      const existingScore = statusScore(existing.status);
      const newScore = statusScore(s.status);
      if (newScore > existingScore) {
        stageMap.set(s.stage, {
          ...s,
          expenses: (s.expenses && s.expenses.length > 0) ? s.expenses : existing.expenses,
          images: (s.images && s.images.length > 0) ? s.images : existing.images,
        });
      } else if (newScore === existingScore) {
        const timeExisting = existing.completed_at ? new Date(existing.completed_at).getTime() : 0;
        const timeNew = s.completed_at ? new Date(s.completed_at).getTime() : 0;
        if (timeNew > timeExisting) {
          stageMap.set(s.stage, {
            ...s,
            expenses: (s.expenses && s.expenses.length > 0) ? s.expenses : existing.expenses,
            images: (s.images && s.images.length > 0) ? s.images : existing.images,
          });
        }
      }
    }
  }

  return Array.from(stageMap.values());
};