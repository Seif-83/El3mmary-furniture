// Small pure helper functions used throughout the app: phone number
// normalization, DB<->UI record mapping, JSON parsing helpers, and the
// notification sound player. Extracted from App.tsx - no React/JSX here.

import type { CustomerRecord, Inspection, FurniturePiece } from "./types";
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

export const mapCustomerFromDB = (dbCust: any): CustomerRecord => ({
  id: dbCust.id,
  name: dbCust.name,
  phone: dbCust.phone,
  governorate: dbCust.governorate,
  address: dbCust.address,
  deliveryAddress: dbCust.delivery_address,
  visitDate: dbCust.visit_date,
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
    ...((dbInsp as any).finalized_at
      ? { finalizedAt: toTimestamp((dbInsp as any).finalized_at) }
      : {}),
  }) as Inspection;

export const sortContractedRecordsByContractDate = (records: Inspection[]) => {
  return [...records].sort((a, b) => {
    // Sort by finalizedAt first (most recent finalized/contracted first), fallback to createdAt
    const getTime = (r: Inspection) => {
      const ts = (r as any).finalizedAt || r.createdAt;
      return ts?.toDate?.()?.getTime?.() ?? (typeof ts === "number" ? ts : 0);
    };
    return getTime(b) - getTime(a);
  });
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