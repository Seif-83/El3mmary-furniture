// Production/workshop tracker page. Extracted from App.tsx.
import React, { useState } from "react";
import { Search, Wrench, X } from "lucide-react";
import type { Inspection } from "../types";
import { STAGE_ORDER } from "../constants";

export const ProductionPage: React.FC<{
  contractedCustomers: Inspection[];
  inspections: Inspection[];
  lang: "en" | "ar";
  isAdmin: boolean;
  t: Record<string, string>;
  stages: any[];
  onStageUpdate: (stageId: string, status: string) => void;
  userProfile?: { role: string; permissions: string[] } | null;
}> = ({
  contractedCustomers,
  inspections,
  lang,
  isAdmin,
  t,
  stages,
  onStageUpdate,
  userProfile,
}) => {
  const [govFilter, setGovFilter] = useState<"all" | "القاهرة" | "الاسكندرية">("all");
  const allProductionData = contractedCustomers.filter((order) => {
    if (userProfile?.role === "super_admin") return true;
    const permissions = userProfile?.permissions || [];
    const hasAlexBranch = permissions.includes("production.alexandria");
    const hasCairoBranch = permissions.includes("production.cairo");

    if (hasAlexBranch && !hasCairoBranch) {
      return order.governorate === "الاسكندرية";
    }
    if (hasCairoBranch && !hasAlexBranch) {
      return order.governorate === "القاهرة";
    }
    return true;
  });
  const [searchQuery, setSearchQuery] = useState("");

  const hasAlex = userProfile?.role === "super_admin" || userProfile?.permissions?.includes("production.alexandria");
  const hasCairo = userProfile?.role === "super_admin" || userProfile?.permissions?.includes("production.cairo");
  const showCityFilter = hasAlex && hasCairo;

  // CS accounts (production.view without production.edit) should NOT see prices
  const perms = userProfile?.permissions || [];
  const showPrice =
    userProfile?.role === "super_admin" ||
    perms.includes("production.edit") ||
    perms.includes("reports.view");

  const filteredProductionData = allProductionData.filter((order) => {
    // 1. Governorate filter
    if (govFilter !== "all" && order.governorate !== govFilter) {
      return false;
    }
    // 2. Search query filter
    return (
      !searchQuery ||
      (order.customerName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (order.phone || "").includes(searchQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-light">
            {lang === "ar" ? "الإنتاج والورشة" : "Production Tracker"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "تابع مراحل إنتاج الطلبات المتعاقدة"
              : "Track production stages for contracted orders"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative group w-full sm:w-auto">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-zinc-700 transition-colors pointer-events-none z-10" />
            <input
              type="text"
              placeholder={lang === "ar" ? "بحث..." : "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm pr-9 pl-8 py-3 rounded-2xl text-sm font-medium outline-none w-full sm:w-40 sm:focus:w-52 focus:shadow-md focus:border-zinc-300 transition-all duration-300 placeholder:text-zinc-400 text-zinc-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 -translate-y-1/2 left-2 w-4 h-4 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-500 transition-all"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {showCityFilter ? (
              <>
                <button
                  onClick={() => setGovFilter("all")}
                  className={`filter-chip ${govFilter === "all" ? "filter-chip-active" : "filter-chip-inactive"}`}
                >
                  {lang === "ar" ? "الكل" : "All"}
                </button>
                <button
                  onClick={() => setGovFilter("القاهرة")}
                  className={`filter-chip ${govFilter === "القاهرة" ? "filter-chip-active" : "filter-chip-inactive"}`}
                >
                  {lang === "ar" ? "القاهرة" : "Cairo"}
                </button>
                <button
                  onClick={() => setGovFilter("الاسكندرية")}
                  className={`filter-chip ${govFilter === "الاسكندرية" ? "filter-chip-active" : "filter-chip-inactive"}`}
                >
                  {lang === "ar" ? "الاسكندرية" : "الاسكندرية"}
                </button>
              </>
            ) : (
              <span className="text-xs font-bold text-zinc-400 bg-white/40 px-3 py-1.5 rounded-full border border-white/60">
                {hasAlex ? (lang === "ar" ? "فرع الاسكندرية" : "Alexandria Branch") : (lang === "ar" ? "فرع القاهرة" : "Cairo Branch")}
              </span>
            )}
          </div>
          <div className="glass px-4 py-3 rounded-2xl min-w-[90px]">
            <div className="text-[10px] uppercase font-bold text-zinc-400">
              {lang === "ar" ? "إجمالي الطلبات" : "Total Orders"}
            </div>
            <div className="text-2xl font-semibold">
              {filteredProductionData.length}
            </div>
          </div>
        </div>
      </div>

      {filteredProductionData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProductionData.map((order) => {
            const orderPhone = order.phone;
            const matchingStage = orderPhone
              ? stages.find((s: any) => s.client?.phones?.includes(orderPhone))
              : null;
            const orderClientId = matchingStage?.client_id || null;
            const orderStages = orderClientId
              ? stages.filter((s: any) => s.client_id === orderClientId)
              : [];
            return (
              <div
                key={order.id}
                className="glass rounded-[2.5rem] p-6 shadow-xl border border-white/40"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">
                      {order.customerName}
                    </h3>
                    <p className="text-sm text-zinc-500 font-mono">
                      {order.phone}
                    </p>
                  </div>
                  <div className="bg-accent-tan/10 px-3 py-1 rounded-full text-xs font-bold text-accent-tan">
                    {order.contractDate
                      ? new Date(order.contractDate).toLocaleDateString("ar-EG")
                      : lang === "ar"
                        ? "بدون تاريخ"
                        : "No date"}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      {lang === "ar" ? "الغرف" : "Rooms"}
                    </span>
                    <span className="font-bold">{order.rooms || 0}</span>
                  </div>
                  {showPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      {lang === "ar" ? "القيمة" : "Value"}
                    </span>
                    <span className="font-bold">
                      {order.totalAmount?.toLocaleString() || 0} EGP
                    </span>
                  </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      {lang === "ar" ? "تاريخ التسليم" : "Delivery Date"}
                    </span>
                    <span className="font-bold">
                      {order.deliveryDate ||
                        (lang === "ar" ? "غير محدد" : "Not set")}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase mb-3">
                    {lang === "ar" ? "المراحل" : "Stages"}
                  </div>
                  <div className="flex items-center justify-between">
                    {STAGE_ORDER.map((stageDef, idx) => {
                      const stageRecord = orderStages.find(
                        (s: any) => s.stage === stageDef.key,
                      );
                      const stageStatus = stageRecord?.status || "not_started";
                      const isDone = stageStatus === "done";
                      const isInProgress = stageStatus === "in_progress";
                      const circleColor = isDone
                        ? "bg-emerald-500 text-white"
                        : isInProgress
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-200 text-zinc-500";
                      return (
                        <div
                          key={stageDef.key}
                          className="flex flex-col items-center gap-1 relative group"
                        >
                          <button
                            onClick={() =>
                              stageRecord &&
                              isAdmin &&
                              onStageUpdate(
                                stageRecord.id,
                                isDone ? "not_started" : "done",
                              )
                            }
                            disabled={!isAdmin}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${circleColor} ${isAdmin && stageRecord ? "cursor-pointer hover:scale-110 active:scale-95" : "cursor-default"}`}
                          >
                            {isDone ? "✓" : idx + 1}
                          </button>
                          <span className="text-[9px] text-zinc-500">
                            {lang === "ar" ? stageDef.ar : stageDef.en}
                          </span>
                          {isAdmin && stageRecord && (
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] rounded-xl px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {isDone
                                ? lang === "ar"
                                  ? "إلغاء"
                                  : "Undo"
                                : isInProgress
                                  ? lang === "ar"
                                    ? "إكمال"
                                    : "Complete"
                                  : lang === "ar"
                                    ? "بدء"
                                    : "Start"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-[2rem] py-20 text-center">
          <Wrench className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-400 font-semibold">
            {lang === "ar"
              ? "لا توجد طلبات إنتاج حالياً"
              : "No production orders at the moment"}
          </p>
        </div>
      )}
    </div>
  );
};