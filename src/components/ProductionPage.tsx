// Production/workshop tracker page with Phase-Based Timers (3-20 days) & Payment Collection Triggers.
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Wrench,
  X,
  Timer,
  AlertTriangle,
  Clock,
  DollarSign,
  Send,
  Plus,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Inspection } from "../types";
import { STAGE_ORDER } from "../constants";
import { InvoiceService } from "../services/data";

// Helper to determine if a stage key requires / supports the 3-20 day timer
const isTimedStage = (stageKey: string): boolean => {
  return ["carpentry", "painting", "upholstery"].includes(stageKey);
};

// Format remaining time in a human-readable format
const formatRemainingTime = (
  startedAtStr?: string | null,
  daysAllocated: number = 7,
  lang: "en" | "ar" = "ar",
) => {
  if (!startedAtStr) return null;
  const startedAt = new Date(startedAtStr).getTime();
  if (Number.isNaN(startedAt)) return null;

  const totalDurationMs = Math.max(3, Math.min(20, daysAllocated)) * 86400000;
  const targetTime = startedAt + totalDurationMs;
  const now = Date.now();
  const diffMs = targetTime - now;
  const elapsedMs = now - startedAt;
  const progressPct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

  const isOverdue = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const days = Math.floor(absDiffMs / 86400000);
  const hours = Math.floor((absDiffMs % 86400000) / 3600000);

  let text = "";
  if (isOverdue) {
    if (days === 0 && hours === 0) {
      text = lang === "ar" ? "انتهى الوقت المحدد للتو" : "Time just expired";
    } else if (days === 0) {
      text =
        lang === "ar"
          ? `متأخر بـ ${hours} ساعة`
          : `Overdue by ${hours} hrs`;
    } else {
      text =
        lang === "ar"
          ? `متأخر بـ ${days} يوم${hours > 0 ? ` و ${hours} ساعة` : ""}`
          : `Overdue by ${days}d ${hours}h`;
    }
  } else {
    if (days === 0 && hours === 0) {
      text = lang === "ar" ? "متبقي أقل من ساعة" : "Less than 1 hour remaining";
    } else if (days === 0) {
      text =
        lang === "ar"
          ? `متبقي ${hours} ساعة`
          : `${hours} hours remaining`;
    } else {
      text =
        lang === "ar"
          ? `متبقي ${days} يوم${hours > 0 ? ` و ${hours} ساعة` : ""}`
          : `${days}d ${hours}h left`;
    }
  }

  const targetDateFormatted = new Date(targetTime).toLocaleDateString(
    lang === "ar" ? "ar-EG" : "en-US",
    { month: "short", day: "numeric" },
  );

  return {
    isOverdue,
    diffMs,
    days,
    hours,
    text,
    progressPct,
    targetDateFormatted,
    isUrgent: !isOverdue && diffMs < 2 * 86400000, // <= 2 days
  };
};

export const ProductionPage: React.FC<{
  contractedCustomers: Inspection[];
  inspections: Inspection[];
  lang: "en" | "ar";
  isAdmin: boolean;
  t: Record<string, string>;
  stages: any[];
  payments?: any[];
  onStageUpdate: (stageId: string, status: string, timerDays?: number) => void;
  onSendWhatsApp?: (phone: string, msg: string) => void;
  onRefresh?: () => Promise<void>;
  userProfile?: { username?: string; role: string; permissions: string[] } | null;
  productionFilter: "all" | "completed";
  onProductionFilterChange: (filter: "all" | "completed") => void;
}> = ({
  contractedCustomers,
  inspections,
  lang,
  isAdmin,
  t,
  stages,
  payments = [],
  onStageUpdate,
  onSendWhatsApp,
  onRefresh,
  userProfile,
  productionFilter,
  onProductionFilterChange,
}) => {
  const [govFilter, setGovFilter] = useState<"all" | "القاهرة" | "الاسكندرية">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setNowTick] = useState(Date.now());

  // Update timer ticks every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Timer Configuration Modal State
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [timerStageData, setTimerStageData] = useState<{
    stageRecord: any;
    stageDef: (typeof STAGE_ORDER)[number];
    order: Inspection;
    initialDays: number;
    isEditOnly?: boolean;
  } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(7);

  // Payment Collection Trigger Modal State
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionData, setCollectionData] = useState<{
    order: Inspection;
    stageDef: (typeof STAGE_ORDER)[number];
    stageRecord: any;
    installmentName: string;
  } | null>(null);

  // Direct Payment Recording Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetOrder, setPaymentTargetOrder] = useState<Inspection | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentStage, setPaymentStage] = useState<string>("عند التعاقد");
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const paymentStages = [
    "عند التعاقد",
    "عند انتهاء النجارة واختيار اللون",
    "قبل الاستلام بـ 48 ساعة",
    "عند استلام الغرفة",
  ];

  const getCustomerPayments = (customerId: string) =>
    payments.filter((p) => p.note?.startsWith(`cc:${customerId}:`));

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

  const hasAlex =
    userProfile?.role === "super_admin" ||
    userProfile?.permissions?.includes("production.alexandria");
  const hasCairo =
    userProfile?.role === "super_admin" ||
    userProfile?.permissions?.includes("production.cairo");
  const showCityFilter = hasAlex && hasCairo;

  const isOrderCompleted = (order: Inspection) => {
    const orderPhone = order.phone;
    const matchingStage = orderPhone
      ? stages.find((s: any) => s.client?.phones?.includes(orderPhone))
      : null;
    const orderClientId = matchingStage?.client_id || null;
    const orderStages = orderClientId
      ? stages.filter((s: any) => s.client_id === orderClientId)
      : [];

    return STAGE_ORDER.every((stageDef) => {
      const stageRecord = orderStages.find((s: any) => s.stage === stageDef.key);
      return stageRecord?.status === "done";
    });
  };

  // CS accounts (production.view without production.edit) should NOT see prices
  const perms = userProfile?.permissions || [];
  const showPrice =
    userProfile?.role === "super_admin" ||
    perms.includes("production.edit") ||
    perms.includes("reports.view");

  const canEditStages =
    isAdmin ||
    userProfile?.role === "super_admin" ||
    userProfile?.username === "alex_store" ||
    userProfile?.username === "cairo_store" ||
    perms.includes("production.alexandria") ||
    perms.includes("production.cairo");

  const isStoreUser =
    (userProfile?.username === "alex_store" ||
      userProfile?.username === "cairo_store" ||
      perms.includes("production.alexandria") ||
      perms.includes("production.cairo")) &&
    !isAdmin &&
    userProfile?.role !== "super_admin";

  const filteredProductionData = allProductionData.filter((order) => {
    if (govFilter !== "all" && order.governorate !== govFilter) {
      return false;
    }
    if (productionFilter === "completed" && !isOrderCompleted(order)) {
      return false;
    }
    return (
      !searchQuery ||
      (order.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.phone || "").includes(searchQuery)
    );
  });

  // Open Timer Duration Selection Modal (3 to 20 days)
  const handleOpenTimerModal = (
    stageRecord: any,
    stageDef: (typeof STAGE_ORDER)[number],
    order: Inspection,
    isEditOnly: boolean = false,
  ) => {
    const existingDays = stageRecord?.timer_days || 7;
    setSelectedDuration(Math.max(3, Math.min(20, existingDays)));
    setTimerStageData({
      stageRecord,
      stageDef,
      order,
      initialDays: existingDays,
      isEditOnly,
    });
    setTimerModalOpen(true);
  };

  // Confirm Timer duration & trigger stage transition to "in_progress"
  const handleConfirmTimer = () => {
    if (!timerStageData) return;
    const days = Math.max(3, Math.min(20, Math.round(selectedDuration)));
    onStageUpdate(timerStageData.stageRecord.id, "in_progress", days);
    setTimerModalOpen(false);
    toast.success(
      lang === "ar"
        ? `تم تفعيل مؤقت ${days} أيام لمرحلة ${timerStageData.stageDef.ar}`
        : `Timer activated for ${days} days for ${timerStageData.stageDef.en}`,
    );
  };

  // Check stage click behavior
  const handleStageClick = (
    stageRecord: any,
    stageDef: (typeof STAGE_ORDER)[number],
    order: Inspection,
  ) => {
    if (!canEditStages || !stageRecord) return;
    const isDone = stageRecord.status === "done";
    const isInProgress = stageRecord.status === "in_progress";
    const isTimed = isTimedStage(stageDef.key);

    if (isAdmin) {
      if (isDone) {
        // Admin untoggles: done -> not_started
        onStageUpdate(stageRecord.id, "not_started");
      } else {
        // Marking as DONE: trigger payment collection if completing carpentry, painting, or delivery
        onStageUpdate(stageRecord.id, "done");

        if (["carpentry", "painting", "upholstery", "delivery"].includes(stageDef.key)) {
          let installmentName = "عند التعاقد";
          if (stageDef.key === "carpentry") installmentName = "عند انتهاء النجارة واختيار اللون";
          else if (stageDef.key === "painting") installmentName = "قبل الاستلام بـ 48 ساعة";
          else if (stageDef.key === "delivery" || stageDef.key === "upholstery")
            installmentName = "عند استلام الغرفة";

          const totalPaid = getCustomerPayments(order.id).reduce(
            (sum, p) => sum + (Number(p.amount) || 0),
            0,
          );
          const remaining = (order.totalAmount || 0) - totalPaid;

          if (remaining > 0) {
            setCollectionData({
              order,
              stageDef,
              stageRecord,
              installmentName,
            });
            setCollectionModalOpen(true);
          }
        }
      }
    } else {
      // Store user flow
      if (isInProgress) {
        // Click while in progress: can adjust timer duration or mark not_started
        if (isTimed) {
          handleOpenTimerModal(stageRecord, stageDef, order, true);
        } else {
          onStageUpdate(stageRecord.id, "not_started");
        }
      } else if (!isDone) {
        // Transition to in_progress
        if (isTimed) {
          handleOpenTimerModal(stageRecord, stageDef, order, false);
        } else {
          onStageUpdate(stageRecord.id, "in_progress");
        }
      }
    }
  };

  // WhatsApp Collection Reminder Dispatcher
  const handleSendCollectionWhatsApp = (
    order: Inspection,
    stageKey: string,
    installmentName: string,
  ) => {
    if (!order.phone || !onSendWhatsApp) return;

    const totalPaid = getCustomerPayments(order.id).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );
    const remaining = (order.totalAmount || 0) - totalPaid;

    let msg = "";
    if (stageKey === "carpentry") {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بانتهاء مرحلة النجارة لطلبكم في مصنع العماري للأثاث.\nنرجو التكرم بسداد دفعة المرحلة واختيار الألوان للبدء في مرحلة الدهانات.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لثقتكم واختياركم لنا!`
          : `Hello ${order.customerName || ""},\nWe are pleased to inform you that the Carpentry phase for your order at El-Amary Furniture is completed.\nPlease proceed with the installment payment and color selection to begin the Painting phase.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else if (stageKey === "painting") {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بانتهاء مرحلة الدهانات لطلبكم في مصنع العماري للأثاث.\nيرجى التكرم بسداد دفعة المرحلة لمتابعة تجهيز الطلب للتسليم النهائي.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لتعاملكم معنا!`
          : `Hello ${order.customerName || ""},\nWe are pleased to inform you that the Painting phase for your order at El-Amary Furniture is completed.\nPlease settle the phase payment to continue with final delivery preparation.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nنود إعلامكم بأن طلبكم في مصنع العماري للأثاث جاهز بالكامل للتسليم.\nيرجى سداد المبلغ المتبقي (${remaining.toLocaleString()} ج.م) لتأكيد وترتيب موعد الشحن والتسليم.\nشكراً لثقتكم الغالية!`
          : `Hello ${order.customerName || ""},\nYour order at El-Amary Furniture is now fully ready for delivery.\nPlease settle the remaining balance (${remaining.toLocaleString()} EGP) to confirm shipment.\nThank you for choosing us!`;
    }

    onSendWhatsApp(order.phone, msg);
    toast.success(
      lang === "ar"
        ? "تم فتح رسالة الواتساب للمطالبة"
        : "WhatsApp collection request opened",
    );
  };

  // Open Direct Add Payment Modal
  const handleOpenDirectPayment = (order: Inspection, defaultStage?: string) => {
    setPaymentTargetOrder(order);
    setPaymentAmount("");
    setPaymentStage(defaultStage || paymentStages[0]);
    setPaymentModalOpen(true);
  };

  // Submit Direct Payment
  const handleSaveDirectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetOrder || !paymentAmount) return;
    setIsSavingPayment(true);

    try {
      const customerPayments = getCustomerPayments(paymentTargetOrder.id);
      const totalPaid = customerPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0,
      );
      const remaining =
        (paymentTargetOrder.totalAmount || 0) - totalPaid - Number(paymentAmount);

      const newPayment = {
        id: crypto.randomUUID(),
        client_id: null,
        visit_id: null,
        amount: Number(paymentAmount),
        paid_at: new Date().toISOString(),
        installment: paymentStage,
        note: `cc:${paymentTargetOrder.id}:${paymentTargetOrder.customerName}`,
        created_at: new Date().toISOString(),
      };

      await InvoiceService.insert(newPayment);
      if (onRefresh) await onRefresh();

      if (paymentTargetOrder.phone && onSendWhatsApp) {
        const msg =
          lang === "ar"
            ? `مرحباً ${paymentTargetOrder.customerName || ""},\nتم استلام دفعة بقيمة ${paymentAmount} جنيه (مرحلة: ${paymentStage}).\nالمتبقي من إجمالي الحساب: ${remaining} جنيه.\nشكراً لك!`
            : `Hello ${paymentTargetOrder.customerName || ""},\nA payment of ${paymentAmount} EGP has been received (Stage: ${paymentStage}).\nRemaining balance: ${remaining} EGP.\nThank you!`;
        onSendWhatsApp(paymentTargetOrder.phone, msg);
      }

      toast.success(
        lang === "ar" ? "تم تسجيل الدفعة بنجاح" : "Payment recorded successfully",
      );
      setPaymentModalOpen(false);
      setCollectionModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error saving payment");
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Detect pending payment collection milestone for an order
  const getOrderCollectionMilestone = (order: Inspection, orderStages: any[]) => {
    const totalPaid = getCustomerPayments(order.id).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );
    const remaining = (order.totalAmount || 0) - totalPaid;
    if (remaining <= 0) return null;

    const deliveryStage = orderStages.find((s) => s.stage === "delivery");
    const paintingStage = orderStages.find((s) => s.stage === "painting");
    const carpentryStage = orderStages.find((s) => s.stage === "carpentry");

    if (deliveryStage?.status === "done") {
      return {
        key: "delivery",
        stageName: lang === "ar" ? "التسليم النهائي" : "Final Delivery",
        installmentName: "عند استلام الغرفة",
        remaining,
      };
    }
    if (paintingStage?.status === "done") {
      return {
        key: "painting",
        stageName: lang === "ar" ? "انتهاء الدهانات" : "Painting Completed",
        installmentName: "قبل الاستلام بـ 48 ساعة",
        remaining,
      };
    }
    if (carpentryStage?.status === "done") {
      return {
        key: "carpentry",
        stageName: lang === "ar" ? "انتهاء النجارة" : "Carpentry Completed",
        installmentName: "عند انتهاء النجارة واختيار اللون",
        remaining,
      };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-light">
              {lang === "ar" ? "الإنتاج والورشة" : "Production Tracker"}
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full text-xs font-bold">
              <Timer className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
              {lang === "ar" ? "مؤقتات المراحل (3-20 يوم)" : "Phase Timers (3-20d)"}
            </span>
          </div>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "تابع مراحل الإنتاج ومؤقتات النجارة والدهانات والتنجيد ومطالبات الدفعات"
              : "Track production stages, countdown timers, and payment collection milestones"}
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => onProductionFilterChange("all")}
                className={`filter-chip ${productionFilter === "all" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                {lang === "ar" ? "الكل" : "All"}
              </button>
              <button
                onClick={() => onProductionFilterChange("completed")}
                className={`filter-chip ${productionFilter === "completed" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                {lang === "ar" ? "الطلبات الجاهزة والمكتملة" : "Ready & Completed Orders"}
              </button>
            </div>
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
                  {lang === "ar" ? "الاسكندرية" : "Alexandria"}
                </button>
              </>
            ) : (
              <span className="text-xs font-bold text-zinc-400 bg-white/40 px-3 py-1.5 rounded-full border border-white/60">
                {hasAlex
                  ? lang === "ar"
                    ? "فرع الاسكندرية"
                    : "Alexandria Branch"
                  : lang === "ar"
                    ? "فرع القاهرة"
                    : "Cairo Branch"}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProductionData.map((order) => {
            const orderPhone = order.phone;
            const matchingStage = orderPhone
              ? stages.find((s: any) => s.client?.phones?.includes(orderPhone))
              : null;
            const orderClientId = matchingStage?.client_id || null;
            const orderStages = orderClientId
              ? stages.filter((s: any) => s.client_id === orderClientId)
              : [];

            // Find currently active in-progress stage
            const activeInProgressStage = orderStages.find(
              (s: any) => s.status === "in_progress",
            );
            const activeStageDef = activeInProgressStage
              ? STAGE_ORDER.find((s) => s.key === activeInProgressStage.stage)
              : null;

            // Timer calculation
            const timerInfo = activeInProgressStage?.timer_started_at
              ? formatRemainingTime(
                  activeInProgressStage.timer_started_at,
                  activeInProgressStage.timer_days || 7,
                  lang,
                )
              : null;

            // Collection Milestone
            const collectionMilestone = getOrderCollectionMilestone(order, orderStages);

            const isStoreOnly = canEditStages && !isAdmin;

            return (
              <div
                key={order.id}
                className="glass rounded-[2.5rem] p-6 shadow-xl border border-white/40 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl relative overflow-hidden"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                        {order.customerName}
                      </h3>
                      {!isStoreUser && (
                        <p className="text-sm text-zinc-500 font-mono">
                          {order.phone}
                        </p>
                      )}
                    </div>
                    <div className="bg-accent-tan/10 px-3 py-1 rounded-full text-xs font-bold text-accent-tan">
                      {order.contractDate
                        ? new Date(order.contractDate).toLocaleDateString("ar-EG")
                        : lang === "ar"
                          ? "بدون تاريخ"
                          : "No date"}
                    </div>
                  </div>

                  {/* Order Financial & Room Details */}
                  <div className="space-y-2.5 mb-4">
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

                  {/* ACTIVE TIMER WIDGET (Carpentry / Painting / Upholstery in progress) */}
                  {activeInProgressStage && activeStageDef && timerInfo && (
                    <div
                      onClick={() =>
                        canEditStages &&
                        isTimedStage(activeStageDef.key) &&
                        handleOpenTimerModal(activeInProgressStage, activeStageDef, order, true)
                      }
                      className={`mb-4 p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                        timerInfo.isOverdue
                          ? "bg-rose-50/80 border-rose-200 hover:bg-rose-100/80"
                          : timerInfo.isUrgent
                            ? "bg-amber-50/80 border-amber-200 hover:bg-amber-100/80"
                            : "bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100/80"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {timerInfo.isOverdue ? (
                            <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                          ) : (
                            <Clock className="w-4 h-4 text-indigo-600 group-hover:rotate-45 transition-transform" />
                          )}
                          <span
                            className={`text-xs font-bold ${
                              timerInfo.isOverdue
                                ? "text-rose-700"
                                : timerInfo.isUrgent
                                  ? "text-amber-700"
                                  : "text-indigo-700"
                            }`}
                          >
                            {lang === "ar"
                              ? `مؤقت مرحلة ${activeStageDef.ar} (${activeInProgressStage.timer_days || 7} أيام)`
                              : `${activeStageDef.en} Timer (${activeInProgressStage.timer_days || 7}d)`}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                            timerInfo.isOverdue
                              ? "bg-rose-200/80 text-rose-800"
                              : timerInfo.isUrgent
                                ? "bg-amber-200/80 text-amber-900"
                                : "bg-indigo-200/80 text-indigo-900"
                          }`}
                        >
                          {timerInfo.text}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            timerInfo.isOverdue
                              ? "bg-rose-600"
                              : timerInfo.isUrgent
                                ? "bg-amber-500"
                                : "bg-indigo-600"
                          }`}
                          style={{ width: `${timerInfo.progressPct}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-medium">
                        <span>
                          {lang === "ar"
                            ? `الموعد المحدد: ${timerInfo.targetDateFormatted}`
                            : `Target: ${timerInfo.targetDateFormatted}`}
                        </span>
                        {canEditStages && isTimedStage(activeStageDef.key) && (
                          <span className="text-zinc-400 group-hover:text-zinc-700 underline">
                            {lang === "ar" ? "تعديل المدة (3-20 يوم)" : "Edit duration (3-20d)"}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PAYMENT COLLECTION TRIGGER MILESTONE BANNER */}
                  {collectionMilestone && (
                    <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-500/30">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-zinc-900">
                            {lang === "ar"
                              ? `طلب دفعة تحصيل: ${collectionMilestone.stageName}`
                              : `Collection Request: ${collectionMilestone.stageName}`}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-rose-600 font-mono">
                          {collectionMilestone.remaining.toLocaleString()} EGP
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {onSendWhatsApp && order.phone && (
                          <button
                            onClick={() =>
                              handleSendCollectionWhatsApp(
                                order,
                                collectionMilestone.key,
                                collectionMilestone.installmentName,
                              )
                            }
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Send className="w-3 h-3" />
                            {lang === "ar" ? "مطالبة واتساب" : "WhatsApp"}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() =>
                              handleOpenDirectPayment(
                                order,
                                collectionMilestone.installmentName,
                              )
                            }
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Plus className="w-3 h-3" />
                            {lang === "ar" ? "تسجيل دفعة" : "Pay"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stages Timeline Row */}
                <div className="pt-4 border-t border-zinc-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">
                      {lang === "ar" ? "مراحل الإنتاج" : "Production Stages"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {lang === "ar" ? "اضغط لتحديث المرحلة والمؤقت" : "Click to update stage"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    {STAGE_ORDER.map((stageDef, idx) => {
                      const stageRecord = orderStages.find(
                        (s: any) => s.stage === stageDef.key,
                      );
                      const stageStatus = stageRecord?.status || "not_started";
                      const isDone = stageStatus === "done";
                      const isInProgress = stageStatus === "in_progress";
                      const isTimed = isTimedStage(stageDef.key);

                      const clickable =
                        canEditStages &&
                        !!stageRecord &&
                        (isAdmin || !isDone);

                      const circleColor = isDone
                        ? "bg-emerald-500 text-white"
                        : isInProgress
                          ? isTimed
                            ? "bg-indigo-600 text-white ring-2 ring-indigo-300 animate-pulse"
                            : "bg-amber-500 text-white"
                          : "bg-zinc-200 text-zinc-500";

                      const tooltipText = isAdmin
                        ? isDone
                          ? lang === "ar"
                            ? "إلغاء التأكيد"
                            : "Undo confirm"
                          : isTimed && isInProgress
                            ? lang === "ar"
                              ? "تأكيد الإنهاء (طلب دفعة تحصيل) ✓"
                              : "Confirm Done (Trigger Payment) ✓"
                            : lang === "ar"
                              ? "تأكيد وإرسال للعميل ✓"
                              : "Confirm & notify ✓"
                        : isInProgress
                          ? isTimed
                            ? lang === "ar"
                              ? "تعديل مدة المؤقت (3-20 يوم) ⏱️"
                              : "Edit Timer Duration ⏱️"
                            : lang === "ar"
                              ? "إلغاء (لم تنته بعد)"
                              : "Mark not ready"
                          : isDone
                            ? lang === "ar"
                              ? "تم التأكيد من المسؤول"
                              : "Confirmed by admin"
                            : isTimed
                              ? lang === "ar"
                                ? "بدء وتحديد المؤقت (3-20 يوم) ⏱️"
                                : "Start & Set Timer ⏱️"
                              : lang === "ar"
                                ? "جاهز في المصنع 🟡"
                                : "Ready in factory 🟡";

                      return (
                        <div
                          key={stageDef.key}
                          className="flex flex-col items-center gap-1 relative group"
                        >
                          <button
                            onClick={() =>
                              handleStageClick(stageRecord, stageDef, order)
                            }
                            disabled={!clickable}
                            title={
                              isStoreOnly && isDone
                                ? lang === "ar"
                                  ? "تم التأكيد من المسؤول"
                                  : "Confirmed by admin"
                                : undefined
                            }
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${circleColor} ${
                              clickable
                                ? "cursor-pointer hover:scale-110 active:scale-95 shadow-sm"
                                : "cursor-default opacity-80"
                            }`}
                          >
                            {isDone ? "✓" : isInProgress ? (isTimed ? "⏱" : "●") : idx + 1}
                          </button>
                          <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                            {lang === "ar" ? stageDef.ar : stageDef.en}
                            {isTimed && <span className="text-[7px] text-indigo-500 font-bold">⏱</span>}
                          </span>
                          {canEditStages && stageRecord && (
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] rounded-xl px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg text-center max-w-[120px] leading-tight">
                              {tooltipText}
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

      {/* ===================== TIMER DURATION CONFIGURATION MODAL (3 - 20 DAYS) ===================== */}
      <AnimatePresence>
        {timerModalOpen && timerStageData && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTimerModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-[#f6f2ec] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-white/60"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setTimerModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto p-2 bg-white/60 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Timer className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {lang === "ar"
                      ? `مؤقت مرحلة: ${timerStageData.stageDef.ar}`
                      : `Stage Timer: ${timerStageData.stageDef.en}`}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {timerStageData.order.customerName}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white/70 rounded-2xl border border-white/80 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase">
                    {lang === "ar" ? "المدة المحددة (بالأيام)" : "Duration (Days)"}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {lang === "ar" ? "الحد المسموح: 3 - 20 يوماً" : "Allowed: 3 - 20 days"}
                  </span>
                </div>

                {/* Stepper / Input */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDuration((prev) => Math.max(3, prev - 1))
                    }
                    className="w-12 h-12 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xl font-bold flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="3"
                    max="20"
                    value={selectedDuration}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        setSelectedDuration(Math.max(3, Math.min(20, val)));
                      }
                    }}
                    className="flex-1 text-center py-3 text-2xl font-bold bg-white rounded-2xl border border-zinc-200 outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDuration((prev) => Math.min(20, prev + 1))
                    }
                    className="w-12 h-12 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xl font-bold flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-400">
                    {lang === "ar" ? "خيارات سريعة:" : "Quick presets:"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[3, 5, 7, 10, 14, 20].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSelectedDuration(days)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          selectedDuration === days
                            ? "bg-indigo-600 text-white shadow-md scale-105"
                            : "bg-white/80 text-zinc-600 hover:bg-white border border-zinc-200"
                        }`}
                      >
                        {days} {lang === "ar" ? "أيام" : "days"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target Calculation Preview */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl mb-6">
                <div className="flex justify-between items-center text-xs text-indigo-900">
                  <span className="font-medium">
                    {lang === "ar" ? "تاريخ البدء:" : "Start Date:"}
                  </span>
                  <span className="font-bold">
                    {new Date().toLocaleDateString(
                      lang === "ar" ? "ar-EG" : "en-US",
                      { weekday: "short", month: "short", day: "numeric" },
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-indigo-900 mt-1.5 pt-1.5 border-t border-indigo-100">
                  <span className="font-medium">
                    {lang === "ar" ? "تاريخ الانتهاء المتوقع:" : "Expected Target Date:"}
                  </span>
                  <span className="font-bold text-sm text-indigo-700">
                    {new Date(
                      Date.now() + selectedDuration * 86400000,
                    ).toLocaleDateString(
                      lang === "ar" ? "ar-EG" : "en-US",
                      { weekday: "short", month: "short", day: "numeric", year: "numeric" },
                    )}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTimerModalOpen(false)}
                  className="flex-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 py-3.5 rounded-2xl font-bold transition-all"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTimer}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Timer className="w-4 h-4" />
                  {timerStageData.isEditOnly
                    ? lang === "ar"
                      ? "تحديث المؤقت"
                      : "Update Timer"
                    : lang === "ar"
                      ? "بدء المرحلة والمؤقت"
                      : "Start Phase & Timer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== PAYMENT COLLECTION TRIGGER MODAL ===================== */}
      <AnimatePresence>
        {collectionModalOpen && collectionData && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCollectionModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-[#f6f2ec] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-white/60"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setCollectionModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto p-2 bg-white/60 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800">
                      {lang === "ar" ? "مستحق للتحصيل" : "Payment Due"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900 mt-0.5">
                    {lang === "ar" ? "طلب دفعة تحصيل" : "Payment Collection Request"}
                  </h2>
                </div>
              </div>

              <div className="p-5 bg-white/70 rounded-2xl border border-white/80 mb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-bold">
                    {lang === "ar" ? "العميل:" : "Customer:"}
                  </span>
                  <span className="font-bold text-zinc-900">
                    {collectionData.order.customerName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-bold">
                    {lang === "ar" ? "المرحلة المكتملة:" : "Completed Stage:"}
                  </span>
                  <span className="font-bold text-emerald-600">
                    {lang === "ar"
                      ? collectionData.stageDef.ar
                      : collectionData.stageDef.en}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-bold">
                    {lang === "ar" ? "الدفعة المستحقة:" : "Due Installment:"}
                  </span>
                  <span className="font-bold text-indigo-600">
                    {collectionData.installmentName}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-xs text-zinc-500 font-bold">
                    {lang === "ar" ? "المتبقي من الحساب:" : "Remaining Balance:"}
                  </span>
                  <span className="text-lg font-bold text-rose-600 font-mono">
                    {(
                      (collectionData.order.totalAmount || 0) -
                      getCustomerPayments(collectionData.order.id).reduce(
                        (sum, p) => sum + (Number(p.amount) || 0),
                        0,
                      )
                    ).toLocaleString()}{" "}
                    EGP
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {onSendWhatsApp && collectionData.order.phone && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSendCollectionWhatsApp(
                        collectionData.order,
                        collectionData.stageDef.key,
                        collectionData.installmentName,
                      )
                    }
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {lang === "ar"
                      ? "إرسال رسالة مطالبة واتساب للعميل"
                      : "Send WhatsApp Collection Request"}
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenDirectPayment(
                        collectionData.order,
                        collectionData.installmentName,
                      );
                    }}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-3.5 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {lang === "ar" ? "تسجيل الدفعة الآن" : "Record Payment Now"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCollectionModalOpen(false)}
                  className="w-full bg-zinc-200/80 hover:bg-zinc-200 text-zinc-700 py-3 rounded-2xl text-xs font-bold transition-all"
                >
                  {lang === "ar" ? "إغلاق ومتابعة" : "Close & Continue"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== DIRECT RECORD PAYMENT MODAL ===================== */}
      <AnimatePresence>
        {paymentModalOpen && paymentTargetOrder && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPaymentModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#f2eee8] rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-white/50"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto p-2 bg-white/50 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <h2 className="text-2xl font-bold mb-6 text-zinc-900">
                {lang === "ar" ? "إضافة دفعة تحصيل" : "Record Collection Payment"}
              </h2>

              <div className="mb-6 p-4 bg-white/60 rounded-2xl">
                <p className="font-bold">{paymentTargetOrder.customerName}</p>
                <p className="text-sm text-zinc-500">
                  {lang === "ar" ? "المتبقي:" : "Remaining:"}{" "}
                  {(
                    (paymentTargetOrder.totalAmount || 0) -
                    getCustomerPayments(paymentTargetOrder.id).reduce(
                      (sum, p) => sum + (Number(p.amount) || 0),
                      0,
                    )
                  ).toLocaleString()}{" "}
                  EGP
                </p>
              </div>

              <form onSubmit={handleSaveDirectPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "المبلغ" : "Amount"}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(Number(e.target.value) || "")
                    }
                    className="w-full px-5 py-4 bg-white/80 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-accent-tan transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "المرحلة" : "Stage"}
                  </label>
                  <select
                    value={paymentStage}
                    onChange={(e) => setPaymentStage(e.target.value)}
                    className="w-full px-5 py-4 bg-white/80 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-accent-tan transition-all"
                  >
                    {paymentStages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSavingPayment}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50 mt-4"
                >
                  {isSavingPayment
                    ? lang === "ar"
                      ? "جاري الحفظ..."
                      : "Saving..."
                    : lang === "ar"
                      ? "تأكيد وحفظ الدفعة"
                      : "Confirm & Save Payment"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};