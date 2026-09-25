// Production/workshop tracker page with Phase-Based Timers (3-20 days) & Payment Collection Triggers.
import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Camera,
  Image as ImageIcon,
  Trash2,
  Upload,
  Eye,
  Coins,
  CheckCircle2,
  WalletCards,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Inspection } from "../types";
import { STAGE_ORDER } from "../constants";
import { InvoiceService, StageService } from "../services/data";
import {
  exportExpensesToExcel,
  exportElementToImage,
  exportElementToPdf,
} from "../exportExpenses";

// Helper to determine if a stage key requires / supports the duration timer
const isTimedStage = (stageKey: string): boolean => {
  return ["carpentry", "painting", "fittings"].includes(stageKey);
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

  const totalDurationMs = Math.max(1, Math.min(60, daysAllocated)) * 86400000;
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

// Calculate Storage Overdue Warning (Exceeding 7 days, repeating every 7 days unless dismissed by admin)
const getStorageOverdueInfo = (order: Inspection, orderStages: any[]) => {
  const deliveryStage = orderStages.find((s: any) => s.stage === "delivery");
  if (deliveryStage?.status === "done") return null;

  const inventoryStage = orderStages.find((s: any) => s.stage === "inventory");
  const fittingsStage = orderStages.find((s: any) => s.stage === "fittings");

  // If inventory stage exists or fittings completed waiting for delivery
  const isStored =
    inventoryStage?.status === "in_progress" ||
    inventoryStage?.status === "done" ||
    (fittingsStage?.status === "done" && deliveryStage?.status !== "done");

  if (!isStored && !inventoryStage) return null;

  const startRef =
    inventoryStage?.timer_started_at ||
    inventoryStage?.created_at ||
    fittingsStage?.completed_at ||
    order.contractDate;

  if (!startRef) return null;

  const startMs = new Date(startRef).getTime();
  if (Number.isNaN(startMs)) return null;

  const now = Date.now();
  const daysInStorage = Math.floor((now - startMs) / 86400000);

  if (daysInStorage >= 7) {
    const dismissedAt = inventoryStage?.storage_warning_dismissed_at;
    if (dismissedAt) {
      const dismissedMs = new Date(dismissedAt).getTime();
      if (!Number.isNaN(dismissedMs)) {
        const daysSinceDismissal = Math.floor((now - dismissedMs) / 86400000);
        if (daysSinceDismissal < 7) {
          return null; // Dismissed within last 7 days
        }
      }
    }
    return {
      isOverdue: true,
      daysInStorage,
      stageRecord: inventoryStage || fittingsStage,
      lastDismissedAt: dismissedAt,
    };
  }

  return null;
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
  productionFilter: "all" | "waiting_list" | "in_production" | "completed";
  onProductionFilterChange: (filter: "all" | "waiting_list" | "in_production" | "completed") => void;
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
  const [timeFilter, setTimeFilter] = useState<"all" | "overdue" | "urgent" | "active" | "storage">("all");
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
  const [paymentStage, setPaymentStage] = useState<string>("التعاقد");
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Stage Photos Modal State (Carpentry & Painting photos)
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoStageData, setPhotoStageData] = useState<{
    stageRecord: any;
    stageDef: (typeof STAGE_ORDER)[number];
    order: Inspection;
  } | null>(null);
  const [stageImages, setStageImages] = useState<string[]>([]);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Stage Expenses Modal State (2 horizontal columns, 15 rows: جهة الصرف والمبلغ)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseStageData, setExpenseStageData] = useState<{
    stageRecord: any;
    stageDef: (typeof STAGE_ORDER)[number];
    order: Inspection;
  } | null>(null);
  const [stageExpenses, setStageExpenses] = useState<{ destination: string; amount: number | "" }[]>(() =>
    Array.from({ length: 15 }, () => ({ destination: "", amount: "" }))
  );
  const [isSavingExpenses, setIsSavingExpenses] = useState(false);

  const handleOpenExpenseModal = (
    stageRecord: any,
    stageDef: (typeof STAGE_ORDER)[number],
    order: Inspection,
  ) => {
    setExpenseStageData({ stageRecord, stageDef, order });
    const existing: { destination: string; amount: number }[] = stageRecord?.expenses || [];
    const initial: { destination: string; amount: number | "" }[] = Array.from({ length: 15 }, (_, i) => ({
      destination: existing[i]?.destination || "",
      amount: existing[i]?.amount !== undefined ? existing[i].amount : "",
    }));
    setStageExpenses(initial);
    setExpenseModalOpen(true);
  };

  const handleSaveStageExpenses = async () => {
    if (!expenseStageData?.stageRecord?.id) return;
    setIsSavingExpenses(true);
    try {
      const cleaned = stageExpenses
        .filter((e) => e.destination.trim() !== "" || (typeof e.amount === "number" && e.amount > 0))
        .map((e) => ({
          destination: e.destination.trim(),
          amount: Number(e.amount) || 0,
        }));

      await StageService.updateStageExpenses(expenseStageData.stageRecord.id, cleaned);
      if (onRefresh) await onRefresh();
      toast.success(
        lang === "ar"
          ? "تم حفظ مصروفات المرحلة بنجاح"
          : "Stage expenses saved successfully"
      );
      setExpenseModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save expenses");
    } finally {
      setIsSavingExpenses(false);
    }
  };

  const handleOpenPhotoModal = (
    stageRecord: any,
    stageDef: (typeof STAGE_ORDER)[number],
    order: Inspection,
  ) => {
    setPhotoStageData({ stageRecord, stageDef, order });
    setStageImages(stageRecord?.images || []);
    setPhotoModalOpen(true);
  };

  const handleUploadPhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setStageImages((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    setStageImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveStagePhotos = async () => {
    if (!photoStageData?.stageRecord?.id) return;
    setIsSavingPhotos(true);
    try {
      await StageService.updateStatus(
        photoStageData.stageRecord.id,
        photoStageData.stageRecord.status || "in_progress",
        {
          images: stageImages,
        },
      );
      if (onRefresh) await onRefresh();
      toast.success(
        lang === "ar"
          ? "تم حفظ صور المرحلة بنجاح وتظهر للعميل في بوابته"
          : "Stage photos saved successfully and are now visible to customer",
      );
      setPhotoModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save photos");
    } finally {
      setIsSavingPhotos(false);
    }
  };

  const paymentStages = [
    "التعاقد",
    "الاستلام",
    "النجارة",
    "الدهانات",
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

    if (orderStages.length === 0) return false;

    // Delivery is the final stage
    const deliveryStage = orderStages.find((s: any) => s.stage === "delivery");
    if (deliveryStage && deliveryStage.status === "done") {
      return true;
    }

    // Check if all existing stages for this client are marked done
    return orderStages.every((s: any) => s.status === "done");
  };

  const isOrderReceived = (order: Inspection) => {
    const orderPhone = order.phone;
    const matchingStage = orderPhone
      ? stages.find((s: any) => s.client?.phones?.includes(orderPhone))
      : null;
    const orderClientId = matchingStage?.client_id || null;
    const orderStages = orderClientId
      ? stages.filter((s: any) => s.client_id === orderClientId)
      : [];
    const receivedStage = orderStages.find((s: any) => s.stage === "received");
    return receivedStage?.status === "done";
  };

  const isFactorySupervisor =
    userProfile?.role === "factory_supervisor" ||
    userProfile?.role === "production_alexandria" ||
    userProfile?.role === "production_cairo" ||
    (!isAdmin &&
      userProfile?.role !== "super_admin" &&
      !userProfile?.permissions?.includes("contracts.upload") &&
      !userProfile?.permissions?.includes("contracts.edit"));

  const waitingCount = allProductionData.filter((o) => !isOrderReceived(o) && !isOrderCompleted(o)).length;
  const inProductionCount = allProductionData.filter((o) => isOrderReceived(o) && !isOrderCompleted(o)).length;
  const completedCount = allProductionData.filter((o) => isOrderCompleted(o)).length;

  // CS accounts and factory supervisors should NOT see contract prices
  const perms = userProfile?.permissions || [];
  const showPrice =
    !isFactorySupervisor &&
    (userProfile?.role === "super_admin" ||
      perms.includes("production.edit") ||
      perms.includes("reports.view"));

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
    const isCompleted = isOrderCompleted(order);
    const isReceived = isOrderReceived(order);

    if (govFilter !== "all" && order.governorate !== govFilter) {
      return false;
    }
    if (productionFilter === "completed" && !isCompleted) {
      return false;
    }
    if (productionFilter === "waiting_list" && (isReceived || isCompleted)) {
      return false;
    }
    if (productionFilter === "in_production" && (!isReceived || isCompleted)) {
      return false;
    }

    const orderPhone = order.phone;
    const matchingStage = orderPhone
      ? stages.find((s: any) => s.client?.phones?.includes(orderPhone))
      : null;
    const orderClientId = matchingStage?.client_id || null;
    const orderStages = orderClientId
      ? stages.filter((s: any) => s.client_id === orderClientId)
      : [];

    if (timeFilter !== "all") {
      if (timeFilter === "storage") {
        const storageInfo = getStorageOverdueInfo(order, orderStages);
        if (!storageInfo || !storageInfo.isOverdue) return false;
      } else {
        const activeInProgressStage = orderStages.find(
          (s: any) => s.status === "in_progress",
        );
        const timerInfo = activeInProgressStage?.timer_started_at
          ? formatRemainingTime(
              activeInProgressStage.timer_started_at,
              activeInProgressStage.timer_days || 7,
              lang,
            )
          : null;

        if (timeFilter === "overdue") {
          if (!timerInfo || !timerInfo.isOverdue) return false;
        } else if (timeFilter === "urgent") {
          if (!timerInfo || timerInfo.isOverdue || !timerInfo.isUrgent) return false;
        } else if (timeFilter === "active") {
          if (!timerInfo || timerInfo.isOverdue) return false;
        }
      }
    }

    return (
      !searchQuery ||
      (order.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.phone || "").includes(searchQuery)
    );
  });

  // ===================== PHASE EXPENSES SUMMARY & EXPORTS =====================
  const [isExpenseDetailsOpen, setIsExpenseDetailsOpen] = useState(false);
  const [stageExpenseFilter, setStageExpenseFilter] = useState<string>("all");
  const phaseExpensesStatementRef = useRef<HTMLDivElement>(null);
  const stageExpensesModalRef = useRef<HTMLDivElement>(null);
  const singleStageStatementRef = useRef<HTMLDivElement>(null);

  const phaseExpensesSummary = useMemo(() => {
    const items: Array<{
      id: string;
      orderId: string;
      customerName: string;
      phone: string;
      stageKey: string;
      stageName: string;
      destination: string;
      amount: number;
    }> = [];

    const stageTotals: Record<string, { count: number; total: number; label: string }> = {};
    STAGE_ORDER.forEach((st) => {
      stageTotals[st.key] = {
        count: 0,
        total: 0,
        label: lang === "ar" ? st.ar : st.en,
      };
    });

    // Process all stages directly to ensure no expenses are missed
    stages.forEach((stRec: any) => {
      const exps = (stRec.expenses || []) as { destination: string; amount: number }[];
      if (!Array.isArray(exps) || exps.length === 0) return;

      // Find matching order in allProductionData
      const matchingOrder = allProductionData.find((o) => {
        if (!o.phone) return false;
        if (stRec.client?.phones?.includes(o.phone)) return true;
        const normO = o.phone.replace(/\D/g, "");
        if (!normO) return false;
        return (stRec.client?.phones || []).some((p: string) => {
          const normP = p.replace(/\D/g, "");
          return normP === normO || normP.endsWith(normO) || normO.endsWith(normP);
        });
      });

      const customerName = matchingOrder?.customerName || (lang === "ar" ? "طلب إنتاج" : "Production Order");
      const phone = matchingOrder?.phone || stRec.client?.phones?.[0] || "";
      const orderId = matchingOrder?.id || stRec.client_id || stRec.id;

      const stDef = STAGE_ORDER.find((def) => def.key === stRec.stage);
      const stageName = stDef ? (lang === "ar" ? stDef.ar : stDef.en) : stRec.stage;

      exps.forEach((exp, idx) => {
        const amt = Number(exp.amount) || 0;
        if (amt > 0 || (exp.destination && exp.destination.trim() !== "")) {
          items.push({
            id: `${stRec.id}-${idx}`,
            orderId,
            customerName,
            phone,
            stageKey: stRec.stage,
            stageName,
            destination: exp.destination || (lang === "ar" ? "بند مصروف" : "Expense item"),
            amount: amt,
          });

          if (!stageTotals[stRec.stage]) {
            stageTotals[stRec.stage] = {
              count: 0,
              total: 0,
              label: stageName,
            };
          }
          stageTotals[stRec.stage].total += amt;
          stageTotals[stRec.stage].count += 1;
        }
      });
    });

    const grandTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const uniqueOrders = new Set(items.map((i) => i.orderId)).size;

    return {
      items,
      stageTotals,
      grandTotal,
      uniqueOrders,
    };
  }, [allProductionData, stages, lang]);

  const filteredExpenseItems = useMemo(() => {
    if (stageExpenseFilter === "all") return phaseExpensesSummary.items;
    return phaseExpensesSummary.items.filter((i) => i.stageKey === stageExpenseFilter);
  }, [phaseExpensesSummary.items, stageExpenseFilter]);

  const handleExportAllExpensesExcel = () => {
    const filename = `مصروفات_مراحل_الإنتاج_${new Date().toISOString().slice(0, 10)}`;
    exportExpensesToExcel(
      lang === "ar" ? "مصروفات المراحل" : "Phase Expenses",
      phaseExpensesSummary.items,
      phaseExpensesSummary.grandTotal,
      filename,
      lang,
    );
  };

  const handleExportAllExpensesPdf = async () => {
    if (!phaseExpensesStatementRef.current) return;
    const filename = `كشف_مصروفات_المراحل_${new Date().toISOString().slice(0, 10)}`;
    await exportElementToPdf(phaseExpensesStatementRef.current, filename, lang);
  };

  const handleExportAllExpensesImage = async () => {
    if (!phaseExpensesStatementRef.current) return;
    const filename = `كشف_مصروفات_المراحل_${new Date().toISOString().slice(0, 10)}`;
    await exportElementToImage(phaseExpensesStatementRef.current, filename, lang);
  };

  // Open Timer Duration Selection Modal (1 to 60 days)
  const handleOpenTimerModal = (
    stageRecord: any,
    stageDef: (typeof STAGE_ORDER)[number],
    order: Inspection,
    isEditOnly: boolean = false,
  ) => {
    const existingDays = stageRecord?.timer_days || (stageDef.key === "carpentry" ? 10 : 7);
    setSelectedDuration(Math.max(1, Math.min(60, existingDays)));
    setTimerStageData({
      stageRecord,
      stageDef,
      order,
      initialDays: existingDays,
      isEditOnly,
    });
    setTimerModalOpen(true);
  };

  // Helper to generate stage start WhatsApp message with +5 buffer days
  const getStageStartWhatsAppMessage = (
    customerName: string,
    stageKey: string,
    customerDays: number,
  ) => {
    if (stageKey === "carpentry") {
      return lang === "ar"
        ? `مرحباً ${customerName}،\nيسعدنا إبلاغكم ببدء أعمال النجارة لطلبكم في مصنع العماري للأثاث.\nالمدة المقدرة للانتهاء: ${customerDays} يوم.\nشكراً لثقتكم واختياركم لنا!`
        : `Hello ${customerName},\nWe are pleased to inform you that the Carpentry work has started for your order at El-Amary Furniture.\nEstimated completion: ${customerDays} days.\nThank you!`;
    }
    if (stageKey === "painting") {
      return lang === "ar"
        ? `مرحباً ${customerName}،\nيسعدنا إبلاغكم ببدء مرحلة الدهانات واختيار الألوان لطلبكم في مصنع العماري للأثاث.\nالمدة المقدرة للانتهاء: ${customerDays} يوم.\nشكراً لثقتكم واختياركم لنا!`
        : `Hello ${customerName},\nWe are pleased to inform you that the Painting phase has started for your order at El-Amary Furniture.\nEstimated completion: ${customerDays} days.\nThank you!`;
    }
    if (stageKey === "fittings") {
      return lang === "ar"
        ? `مرحباً ${customerName}،\nيسعدنا إبلاغكم ببدء مرحلة التجهيزات والتشطيب النهائي لطلبكم في مصنع العماري للأثاث.\nالمدة المقدرة للانتهاء: ${customerDays} يوم.\nشكراً لثقتكم واختياركم لنا!`
        : `Hello ${customerName},\nWe are pleased to inform you that the Fittings and Final Finishing phase has started for your order at El-Amary Furniture.\nEstimated completion: ${customerDays} days.\nThank you!`;
    }
    return lang === "ar"
      ? `مرحباً ${customerName}،\nيسعدنا إبلاغكم ببدء مرحلة العمل لطلبكم في مصنع العماري للأثاث.\nالمدة المقدرة للانتهاء: ${customerDays} يوم.\nشكراً لثقتكم واختياركم لنا!`
      : `Hello ${customerName},\nWe are pleased to inform you that production has started for your order.\nEstimated completion: ${customerDays} days.\nThank you!`;
  };

  // Confirm Timer duration & trigger stage transition to "in_progress"
  const handleConfirmTimer = () => {
    if (!timerStageData) return;
    const technicianDays = Math.max(1, Math.min(60, Math.round(selectedDuration)));
    const customerDays = technicianDays + 5; // Automatic +5 days buffer for customer message

    onStageUpdate(timerStageData.stageRecord.id, "in_progress", technicianDays);

    // Send WhatsApp start message if starting stage fresh
    if (!timerStageData.isEditOnly && timerStageData.order.phone && onSendWhatsApp) {
      const msg = getStageStartWhatsAppMessage(
        timerStageData.order.customerName || "",
        timerStageData.stageDef.key,
        customerDays,
      );
      onSendWhatsApp(timerStageData.order.phone, msg);
    }

    setTimerModalOpen(false);
    toast.success(
      lang === "ar"
        ? `تم تفعيل مؤقت ${technicianDays} أيام (وإرسال ${customerDays} أيام للعميل)`
        : `Timer activated for ${technicianDays}d (${customerDays}d sent to customer)`,
    );
  };

  // Admin dismiss / acknowledge storage overdue warning (repeats every 7 days)
  const handleDismissStorageWarning = async (stageRecord: any) => {
    if (!stageRecord?.id) return;
    const nowIso = new Date().toISOString();
    try {
      await StageService.updateStatus(
        stageRecord.id,
        stageRecord.status || "in_progress",
        {
          storage_warning_dismissed_at: nowIso,
        },
      );
      if (onRefresh) await onRefresh();
      toast.success(
        lang === "ar"
          ? "تم تأكيد وإلغاء تنبيه التخزين لمدة 7 أيام إضافية"
          : "Storage alert dismissed for 7 additional days",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to dismiss warning");
    }
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
        // Marking as DONE
        onStageUpdate(stageRecord.id, "done");

        // Trigger milestone notifications / payments
        if (["received", "carpentry", "painting"].includes(stageDef.key)) {
          let installmentName = "الاستلام";
          if (stageDef.key === "carpentry") installmentName = "النجارة";
          else if (stageDef.key === "painting") installmentName = "الدهانات";

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

        if (stageDef.key === "painting" && onSendWhatsApp && order.phone) {
          // Painting completion WhatsApp
          const msg =
            lang === "ar"
              ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بانتهاء مرحلة الدهانات لطلبكم في مصنع العماري للأثاث وجاري الانتقال لمرحلة التجهيزات.\nشكراً لثقتكم واختياركم لنا!`
              : `Hello ${order.customerName || ""},\nWe are pleased to inform you that the Painting phase for your order is completed.\nThank you!`;
          onSendWhatsApp(order.phone, msg);
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

  // WhatsApp Collection / Completion Reminder Dispatcher
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
    if (stageKey === "fittings") {
      // Upon full completion of fittings -> request contract completion and final delivery arrangement
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بتمام تجهيز طلبكم بالكامل في مصنع العماري للأثاث وجاهزيته للتسليم.\nنرجو التكرم بإنهاء التعاقد وسداد الدفعة النهائية لترتيب موعد الشحن والتسليم.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لثقتكم واختياركم لنا!`
          : `Hello ${order.customerName || ""},\nWe are pleased to inform you that your order is completely ready for delivery.\nPlease conclude the contract settlement and final payment to schedule delivery.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else if (stageKey === "painting") {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بانتهاء مرحلة الدهانات لطلبكم في مصنع العماري للأثاث.\nنرجو التكرم بسداد دفعة مرحلة الدهانات لمتابعة تجهيز الطلب.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لثقتكم واختياركم لنا!`
          : `Hello ${order.customerName || ""},\nWe are pleased to inform you that the Painting phase for your order is completed.\nPlease settle the painting installment.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else if (stageKey === "carpentry") {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بانتهاء مرحلة النجارة لطلبكم في مصنع العماري للأثاث.\nنرجو التكرم بسداد دفعة المرحلة واختيار الألوان للبدء في مرحلة الدهانات.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لثقتكم واختياركم لنا!`
          : `Hello ${order.customerName || ""},\nWe are pleased to inform you that the Carpentry phase for your order at El-Amary Furniture is completed.\nPlease proceed with the installment payment and color selection to begin the Painting phase.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else if (stageKey === "contract") {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nتم تأكيد تعاقدكم في مصنع العماري للأثاث.\nيرجى التكرم بسداد دفعة التعاقد لتأكيد بدء مراحل العمل بالمصنع.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لتعاملكم معنا!`
          : `Hello ${order.customerName || ""},\nYour order at El-Amary Furniture has been contracted.\nPlease settle the contract deposit.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nتم استلام وتأكيد طلبكم في مصنع العماري للأثاث.\nيرجى التكرم بسداد دفعة الاستلام لتأكيد مراحل العمل بالمصنع.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لتعاملكم معنا!`
          : `Hello ${order.customerName || ""},\nYour order at El-Amary Furniture has been received and confirmed.\nPlease settle the intake deposit.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you for choosing us!`;
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
        amount: Number(paymentAmount),
        paid_at: new Date().toISOString(),
        installment: paymentStage,
        note: `cc:${paymentTargetOrder.id}:${paymentStage}`,
        created_at: new Date().toISOString(),
      };

      await InvoiceService.savePayment(newPayment);

      if (onRefresh) await onRefresh();

      toast.success(
        lang === "ar"
          ? `تم تسجيل دفعة بقيمة ${paymentAmount} ج.م بنجاح`
          : `Payment of ${paymentAmount} EGP recorded successfully`,
      );

      if (onSendWhatsApp && paymentTargetOrder.phone) {
        const msg =
          lang === "ar"
            ? `مرحباً ${paymentTargetOrder.customerName || ""},\nتم استلام دفعة بقيمة ${paymentAmount} جنيه (مرحلة: ${paymentStage}).\nالمتبقي من إجمالي الحساب: ${remaining} جنيه.\nشكراً لك!`
            : `Hello ${paymentTargetOrder.customerName || ""},\nPayment of ${paymentAmount} EGP received (Stage: ${paymentStage}).\nRemaining balance: ${remaining} EGP.\nThank you!`;
        onSendWhatsApp(paymentTargetOrder.phone, msg);
      }

      setPaymentModalOpen(false);
      setCollectionModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save payment");
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Detect pending payment collection milestone for an order (contract, received, carpentry, painting)
  const getOrderCollectionMilestone = (order: Inspection, orderStages: any[]) => {
    const custPayments = getCustomerPayments(order.id);
    const totalPaid = custPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );
    const remaining = (order.totalAmount || 0) - totalPaid;
    if (remaining <= 0) return null;

    // Determine paid installments sequentially
    const paidStages = new Set(
      custPayments.map((p) => {
        const s = (p.installment || "").trim();
        if (s.includes("تعاقد")) return "التعاقد";
        if (s.includes("نجارة")) return "النجارة";
        if (s.includes("دهان") || s.includes("تجهيز")) return "الدهانات";
        if (s.includes("استلام") || s.includes("تسليم")) return "الاستلام";
        return s;
      }),
    );

    // Strictly sequential installments:
    // 1. Contract ("التعاقد")
    if (!paidStages.has("التعاقد")) {
      return {
        key: "contract",
        stageName: lang === "ar" ? "دفعة التعاقد" : "Contract Deposit",
        installmentName: "التعاقد",
        remaining,
      };
    }

    // 2. Carpentry ("النجارة")
    if (!paidStages.has("النجارة")) {
      return {
        key: "carpentry",
        stageName: lang === "ar" ? "دفعة مرحلة النجارة" : "Carpentry Installment",
        installmentName: "النجارة",
        remaining,
      };
    }

    // 3. Painting ("الدهانات") - Example: if carpentry is paid, next due is painting
    if (!paidStages.has("الدهانات")) {
      return {
        key: "painting",
        stageName: lang === "ar" ? "دفعة مرحلة الدهانات" : "Painting Installment",
        installmentName: "الدهانات",
        remaining,
      };
    }

    // 4. Delivery / Final Handover ("الاستلام")
    if (!paidStages.has("الاستلام")) {
      return {
        key: "received",
        stageName: lang === "ar" ? "دفعة الاستلام النهائي" : "Final Delivery Installment",
        installmentName: "الاستلام",
        remaining,
      };
    }

    // 5. Remaining balance if any
    return {
      key: "remaining",
      stageName: lang === "ar" ? "متبقي الحساب النهائي" : "Remaining Balance",
      installmentName: "الاستلام",
      remaining,
    };
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
              {lang === "ar" ? "مؤقتات المراحل (3-7 أيام)" : "Phase Timers (3-7d)"}
            </span>
          </div>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "تابع مراحل الإنتاج ومؤقتات النجارة والدهانات والتجهيزات ومطالبات الدفعات"
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
            {/* Status Filters: Waiting List, In-Production, Completed, All */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => onProductionFilterChange("waiting_list")}
                className={`filter-chip flex items-center gap-1.5 ${productionFilter === "waiting_list" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                <span>{lang === "ar" ? "قوائم الانتظار" : "Waiting List"}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/20 text-amber-800 font-bold font-mono">
                  {waitingCount}
                </span>
              </button>
              <button
                onClick={() => onProductionFilterChange("in_production")}
                className={`filter-chip flex items-center gap-1.5 ${productionFilter === "in_production" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                <span>{lang === "ar" ? "في الإنتاج" : "In Production"}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-500/20 text-indigo-800 font-bold font-mono">
                  {inProductionCount}
                </span>
              </button>
              <button
                onClick={() => onProductionFilterChange("completed")}
                className={`filter-chip flex items-center gap-1.5 ${productionFilter === "completed" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                <span>{lang === "ar" ? "مكتمل" : "Completed"}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-500/20 text-emerald-800 font-bold font-mono">
                  {completedCount}
                </span>
              </button>
              <button
                onClick={() => onProductionFilterChange("all")}
                className={`filter-chip flex items-center gap-1.5 ${productionFilter === "all" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                <span>{lang === "ar" ? "الكل" : "All"}</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-zinc-500/20 text-zinc-700 font-bold font-mono">
                  {allProductionData.length}
                </span>
              </button>
            </div>

            {/* City Filters */}
            {showCityFilter ? (
              <div className="flex items-center gap-1.5 flex-wrap border-r rtl:border-r-0 rtl:border-l border-zinc-200/80 pr-1.5 rtl:pr-0 rtl:pl-1.5">
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
                  {lang === "ar" ? "قاهرة" : "Cairo"}
                </button>
                <button
                  onClick={() => setGovFilter("الاسكندرية")}
                  className={`filter-chip ${govFilter === "الاسكندرية" ? "filter-chip-active" : "filter-chip-inactive"}`}
                >
                  {lang === "ar" ? "أسكندرية" : "Alexandria"}
                </button>
              </div>
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

            {/* Time & Storage Filters */}
            <div className="flex items-center gap-1.5 flex-wrap border-r rtl:border-r-0 rtl:border-l border-zinc-200/80 pr-1.5 rtl:pr-0 rtl:pl-1.5">
              <button
                onClick={() => setTimeFilter("all")}
                className={`filter-chip ${timeFilter === "all" ? "filter-chip-active" : "filter-chip-inactive"}`}
                title={lang === "ar" ? "فلتر الوقت: الكل" : "Time filter: All"}
              >
                <Clock className="w-3 h-3 inline-block mr-1 rtl:mr-0 rtl:ml-1" />
                {lang === "ar" ? "الوقت" : "Time"}
              </button>
              {timeFilter !== "all" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  {timeFilter === "overdue" && (lang === "ar" ? "متأخر 🔴" : "Overdue 🔴")}
                  {timeFilter === "urgent" && (lang === "ar" ? "عاجل 🟡" : "Urgent 🟡")}
                  {timeFilter === "active" && (lang === "ar" ? "ساري 🟢" : "Active 🟢")}
                  {timeFilter === "storage" && (lang === "ar" ? "تخزين ⚠️" : "Storage ⚠️")}
                </span>
              )}
              <button
                onClick={() => setTimeFilter("overdue")}
                className={`filter-chip text-rose-600 ${timeFilter === "overdue" ? "bg-rose-500 text-white shadow-md" : "filter-chip-inactive hover:text-rose-700"}`}
              >
                {lang === "ar" ? "متأخر" : "Overdue"}
              </button>
              <button
                onClick={() => setTimeFilter("urgent")}
                className={`filter-chip text-amber-600 ${timeFilter === "urgent" ? "bg-amber-500 text-white shadow-md" : "filter-chip-inactive hover:text-amber-700"}`}
              >
                {lang === "ar" ? "عاجل" : "Urgent"}
              </button>
              <button
                onClick={() => setTimeFilter(timeFilter === "storage" ? "all" : "storage")}
                className={`filter-chip text-amber-700 border-amber-300/80 ${timeFilter === "storage" ? "bg-amber-500 text-white shadow-md" : "filter-chip-inactive hover:text-amber-800"}`}
              >
                ⚠️ {lang === "ar" ? "تخزين" : "Storage"}
              </button>
            </div>
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

      {/* ===================== PHASE EXPENSES SECTION ===================== */}
      {(isAdmin || canEditStages) && (
        <div className="glass rounded-[2rem] p-6 border border-emerald-500/20 shadow-xl bg-gradient-to-br from-white/95 via-emerald-50/20 to-white/90 relative overflow-hidden transition-all">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pb-5 border-b border-emerald-100/60">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-bold text-zinc-900">
                    {lang === "ar" ? "قسم مصروفات المراحل" : "Phase Expenses Tracker"}
                  </h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {lang === "ar" ? "خاص بالورشة" : "Factory Internal"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {lang === "ar"
                    ? "تجميع وحساب كافة المصروفات التشغيلية لجميع مراحل الإنتاج وعرض الإجمالي النهائي"
                    : "Aggregated operational expenses across all production stages and workshop operations"}
                </p>
              </div>
            </div>

            {/* Grand Total Highlight Card */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3.5 rounded-2xl shadow-xl shadow-emerald-600/20 flex items-center gap-3.5 border border-emerald-400/30">
                <div className="text-right rtl:text-right ltr:text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5 justify-end">
                    <WalletCards className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{lang === "ar" ? "الإجمالي النهائي للمصروفات" : "Grand Total Expenses"}</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-black font-mono tracking-tight mt-0.5">
                    {phaseExpensesSummary.grandTotal.toLocaleString()}{" "}
                    <span className="text-sm font-normal opacity-90">{lang === "ar" ? "ج.م" : "EGP"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4">
            {/* Stage Breakdown Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-500 flex items-center gap-1">
                <WalletCards className="w-3.5 h-3.5 text-zinc-400" />
                {lang === "ar" ? "حسب المرحلة:" : "By Stage:"}
              </span>
              {STAGE_ORDER.map((st) => {
                const stData = phaseExpensesSummary.stageTotals[st.key];
                const hasAmount = (stData?.total || 0) > 0;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      setStageExpenseFilter(stageExpenseFilter === st.key ? "all" : st.key);
                      if (!isExpenseDetailsOpen) setIsExpenseDetailsOpen(true);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      stageExpenseFilter === st.key
                        ? "bg-emerald-600 text-white shadow-sm"
                        : hasAmount
                        ? "bg-white text-zinc-800 border border-zinc-200 hover:border-emerald-300"
                        : "bg-zinc-100/70 text-zinc-400 border border-transparent"
                    }`}
                  >
                    <span>{lang === "ar" ? st.ar : st.en}</span>
                    <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${stageExpenseFilter === st.key ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                      {(stData?.total || 0).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Export & Toggle Actions */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleExportAllExpensesExcel}
                className="btn-3d px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                title={lang === "ar" ? "تصدير إلى ملف Excel" : "Export to Excel"}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{lang === "ar" ? "إكسيل" : "Excel"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllExpensesPdf}
                className="btn-3d px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-rose-700 hover:bg-rose-50 border border-rose-200 flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                title={lang === "ar" ? "تحميل كملف PDF" : "Download PDF"}
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>{lang === "ar" ? "PDF" : "PDF"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllExpensesImage}
                className="btn-3d px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                title={lang === "ar" ? "تحميل كصورة عالية الدقة" : "Download Image"}
              >
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>{lang === "ar" ? "صورة" : "Image"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpenseDetailsOpen(!isExpenseDetailsOpen)}
                className="btn-3d px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {isExpenseDetailsOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>{lang === "ar" ? "إخفاء التفاصيل" : "Hide Details"}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>
                      {lang === "ar"
                        ? `عرض الكشف (${phaseExpensesSummary.items.length})`
                        : `Show Details (${phaseExpensesSummary.items.length})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Itemized Table */}
          <AnimatePresence>
            {isExpenseDetailsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-4 mt-4 border-t border-zinc-100"
              >
                <div className="bg-white/90 rounded-2xl border border-zinc-200/80 overflow-hidden shadow-sm">
                  <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-bold text-zinc-700 flex items-center gap-2">
                      <span>{lang === "ar" ? "كشف بنود المصروفات المفصلة" : "Itemized Phase Expenses"}</span>
                      {stageExpenseFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => setStageExpenseFilter("all")}
                          className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full hover:underline cursor-pointer"
                        >
                          {lang === "ar" ? "إلغاء التصفية" : "Clear Filter"}
                        </button>
                      )}
                    </div>
                    <div className="text-zinc-500 font-mono text-[11px]">
                      {lang === "ar"
                        ? `${filteredExpenseItems.length} بند مسجل`
                        : `${filteredExpenseItems.length} recorded items`}
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    {filteredExpenseItems.length > 0 ? (
                      <table className="w-full text-right rtl:text-right ltr:text-left text-xs border-collapse">
                        <thead className="bg-zinc-100/80 sticky top-0 z-10 text-zinc-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">{lang === "ar" ? "اسم العميل" : "Customer"}</th>
                            <th className="p-3">{lang === "ar" ? "الهاتف" : "Phone"}</th>
                            <th className="p-3">{lang === "ar" ? "المرحلة" : "Stage"}</th>
                            <th className="p-3">{lang === "ar" ? "جهة الصرف / البيان" : "Destination"}</th>
                            <th className="p-3 text-left rtl:text-left ltr:text-right">{lang === "ar" ? "المبلغ (جنيه)" : "Amount (EGP)"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-800">
                          {filteredExpenseItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="p-3 font-mono text-zinc-400 font-bold">{idx + 1}</td>
                              <td className="p-3 font-bold text-zinc-900">{item.customerName}</td>
                              <td className="p-3 font-mono text-zinc-500" dir="ltr">{item.phone}</td>
                              <td className="p-3">
                                <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                                  {item.stageName}
                                </span>
                              </td>
                              <td className="p-3 font-medium text-zinc-700">{item.destination}</td>
                              <td className="p-3 font-mono font-bold text-emerald-700 text-left rtl:text-left ltr:text-right">
                                {item.amount.toLocaleString()} ج.م
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-emerald-50/70 border-t-2 border-emerald-200 font-bold text-xs sticky bottom-0">
                          <tr>
                            <td colSpan={5} className="p-3 text-emerald-900">
                              {lang === "ar" ? "إجمالي المعروض:" : "Subtotal:"}
                            </td>
                            <td className="p-3 font-mono text-emerald-800 text-sm font-black text-left rtl:text-left ltr:text-right">
                              {filteredExpenseItems.reduce((s, i) => s + i.amount, 0).toLocaleString()} ج.م
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="py-8 text-center text-zinc-400 text-xs font-semibold">
                        {lang === "ar" ? "لا توجد مصروفات مسجلة للمراحل المحددة" : "No expenses recorded for this filter"}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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

            // Storage Overdue Warning
            const storageInfo = getStorageOverdueInfo(order, orderStages);

            // Collection Milestone
            const collectionMilestone = getOrderCollectionMilestone(order, orderStages);

            const isStoreOnly = canEditStages && !isAdmin;
            const isReceived = isOrderReceived(order);
            const isCompleted = isOrderCompleted(order);
            const orderTotalExpenses = orderStages.reduce((sum: number, s: any) => {
              const exps = (s.expenses || []) as { destination: string; amount: number }[];
              return sum + exps.reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
            }, 0);

            return (
              <div
                key={order.id}
                className="glass rounded-[2.5rem] p-6 shadow-xl border border-white/40 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl relative overflow-hidden"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-bold text-zinc-900">
                          {order.customerName}
                        </h3>
                        {!isReceived && !isCompleted && (
                          <span className="bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {lang === "ar" ? "قائمة انتظار" : "Waiting List"}
                          </span>
                        )}
                      </div>
                      {!isStoreUser && (
                        <p className="text-sm text-zinc-500 font-mono">
                          {order.phone}
                        </p>
                      )}
                    </div>
                    {!isFactorySupervisor && (
                      <div className="bg-accent-tan/10 px-3 py-1 rounded-full text-xs font-bold text-accent-tan">
                        {order.contractDate
                          ? new Date(order.contractDate).toLocaleDateString("ar-EG")
                          : lang === "ar"
                            ? "بدون تاريخ تعاقد"
                            : "No date"}
                      </div>
                    )}
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
                    {orderTotalExpenses > 0 && (isAdmin || canEditStages) && (
                      <div className="flex justify-between text-sm text-emerald-700 bg-emerald-50/70 px-2 py-1 rounded-lg border border-emerald-200/50">
                        <span className="font-semibold flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-emerald-600" />
                          {lang === "ar" ? "إجمالي المصروفات" : "Total Expenses"}
                        </span>
                        <span className="font-mono font-bold">
                          {orderTotalExpenses.toLocaleString()} EGP
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

                  {/* WAITING LIST QUICK ACTION BANNER */}
                  {!isReceived && !isCompleted && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 animate-pulse flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-amber-900">
                            {lang === "ar" ? "في قائمة الانتظار (بدون استلام)" : "In Waiting List (Unreceived)"}
                          </div>
                          <div className="text-[10px] text-amber-700">
                            {lang === "ar" ? "انقر تأكيد الاستلام لبدء مراحل الإنتاج" : "Click confirm intake to begin production"}
                          </div>
                        </div>
                      </div>
                      {canEditStages && (
                        <button
                          type="button"
                          onClick={() => {
                            const receivedStage = orderStages.find((s: any) => s.stage === "received");
                            if (receivedStage) {
                              onStageUpdate(receivedStage.id, "done");
                              toast.success(
                                lang === "ar"
                                  ? "تم الاستلام بنجاح وتم نقل الطلب إلى الإنتاج"
                                  : "Intake confirmed, moved to production",
                              );
                            }
                          }}
                          className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white py-2 px-3.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{lang === "ar" ? "تأكيد الاستلام" : "Confirm Intake"}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* STORAGE OVERDUE WARNING BANNER */}
                  {storageInfo && storageInfo.isOverdue && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
                          <span className="text-xs font-bold text-amber-900">
                            {lang === "ar"
                              ? `⚠️ تحذير: تجاوز مدة التخزين (${storageInfo.daysInStorage} يوم)`
                              : `⚠️ Storage Exceeded (${storageInfo.daysInStorage}d)`}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                          {lang === "ar" ? "تكرار كل 7 أيام" : "Every 7d"}
                        </span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDismissStorageWarning(storageInfo.stageRecord)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          {lang === "ar"
                            ? "إلغاء التحذير وتأجيله (7 أيام إضافية)"
                            : "Dismiss Warning (7 extra days)"}
                        </button>
                      )}
                    </div>
                  )}

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
                              ? `مؤقت مرحلة ${activeStageDef.ar} (${activeInProgressStage.timer_days || 7} أيام بالورشة)`
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
                            ? `الموعد المحدد للورشة: ${timerInfo.targetDateFormatted}`
                            : `Target: ${timerInfo.targetDateFormatted}`}
                        </span>
                        {canEditStages && isTimedStage(activeStageDef.key) && (
                          <span className="text-zinc-400 group-hover:text-zinc-700 underline">
                            {lang === "ar" ? "تعديل المدة" : "Edit duration"}
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
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
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
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-1.5 px-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
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
                              ? "تعديل مدة المؤقت ⏱️"
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
                              ? "بدء وتحديد المؤقت ⏱️"
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
                            title={tooltipText}
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all duration-200 cursor-pointer ${circleColor} ${clickable ? "hover:scale-110 active:scale-95" : "cursor-default opacity-80"}`}
                          >
                            {isDone ? "✓" : isInProgress ? "⏱" : idx + 1}
                          </button>
                          <span className="text-[11px] font-semibold text-zinc-600 text-center">
                            {lang === "ar" ? stageDef.ar : stageDef.en}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Stage Photos Row (Carpentry & Painting) */}
                  <div className="mt-3 pt-3 border-t border-zinc-100/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-zinc-500" />
                      {lang === "ar" ? "صور التنفيذ:" : "Stage Photos:"}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["carpentry", "painting"].map((stKey) => {
                        const stDef = STAGE_ORDER.find((s) => s.key === stKey);
                        const stRec = orderStages.find((s: any) => s.stage === stKey);
                        const imgCount = stRec?.images?.length || 0;
                        if (!stDef || !stRec) return null;

                        return (
                          <button
                            key={stKey}
                            type="button"
                            onClick={() => handleOpenPhotoModal(stRec, stDef, order)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              imgCount > 0
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 shadow-sm"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200/60"
                            }`}
                            title={lang === "ar" ? `إرفاق / عرض صور مرحلة ${stDef.ar}` : `Photos for ${stDef.en}`}
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>{stDef.ar}</span>
                            {imgCount > 0 ? (
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold font-mono">
                                {imgCount}
                              </span>
                            ) : (
                              canEditStages && (
                                <span className="text-[9px] text-zinc-400 font-bold">+</span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stage Expenses Row */}
                  <div className="mt-3 pt-3 border-t border-zinc-100/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                      {lang === "ar" ? "مصروفات المراحل:" : "Stage Expenses:"}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {STAGE_ORDER.map((stDef) => {
                        const stRec = orderStages.find((s: any) => s.stage === stDef.key);
                        if (!stRec) return null;
                        const expenses = (stRec.expenses || []) as { destination: string; amount: number }[];
                        const stageExpenseSum = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                        return (
                          <button
                            key={stDef.key}
                            type="button"
                            onClick={() => handleOpenExpenseModal(stRec, stDef, order)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              stageExpenseSum > 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-sm"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200/60"
                            }`}
                            title={lang === "ar" ? `إدخال / عرض مصروفات مرحلة ${stDef.ar}` : `Expenses for ${stDef.en}`}
                          >
                            <span>{stDef.ar}</span>
                            {stageExpenseSum > 0 ? (
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-600 text-white text-[9px] font-bold font-mono">
                                {stageExpenseSum.toLocaleString()} ج
                              </span>
                            ) : (
                              canEditStages && (
                                <span className="text-[9px] text-zinc-400 font-bold">+</span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
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
              ? "لا توجد طلبات إنتاج مطابقة للفلتر المحدد"
              : "No production orders matching the selected filter"}
          </p>
        </div>
      )}

      {/* ===================== TIMER DURATION CONFIGURATION MODAL (WITH +5 DAYS BUFFER) ===================== */}
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
              className="relative bg-[#f6f2ec] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-white/60 max-h-[90vh] overflow-y-auto"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setTimerModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto p-2 bg-white/60 hover:bg-white rounded-full transition-colors cursor-pointer"
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
                      ? `بدء مرحلة: ${timerStageData.stageDef.ar}`
                      : `Start Stage: ${timerStageData.stageDef.en}`}
                  </h2>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {timerStageData.order.customerName}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white/70 rounded-2xl border border-white/80 mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-zinc-700 uppercase">
                    {lang === "ar" ? "المدة الفعلية للورشة / الفني" : "Technician Duration (Days)"}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {lang === "ar" ? "حدد الأيام الفعلية للعمل" : "Select actual work days"}
                  </span>
                </div>

                {/* Stepper / Input */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDuration((prev) => Math.max(1, prev - 1))
                    }
                    className="w-12 h-12 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xl font-bold flex items-center justify-center transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={selectedDuration}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        setSelectedDuration(Math.max(1, Math.min(60, val)));
                      }
                    }}
                    className="flex-1 text-center py-3 text-2xl font-bold bg-white rounded-2xl border border-zinc-200 outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDuration((prev) => Math.min(60, prev + 1))
                    }
                    className="w-12 h-12 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xl font-bold flex items-center justify-center transition-colors cursor-pointer"
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
                    {[5, 7, 10, 15, 20, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSelectedDuration(days)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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

              {/* Automatic +5 Days Buffer Banner */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-900">
                    {lang === "ar"
                      ? "إضافة 5 أيام تلقائياً لرسالة العميل"
                      : "Automatic +5 days buffer for customer message"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/60 p-2.5 rounded-xl">
                    <span className="text-[10px] text-zinc-500 block font-bold">
                      {lang === "ar" ? "مدة الفني الفعلية:" : "Tech Duration:"}
                    </span>
                    <span className="font-bold text-zinc-900 font-mono text-sm">
                      {selectedDuration} {lang === "ar" ? "أيام" : "days"}
                    </span>
                  </div>
                  <div className="bg-white/60 p-2.5 rounded-xl border border-amber-300">
                    <span className="text-[10px] text-amber-800 block font-bold">
                      {lang === "ar" ? "المدة لرسالة العميل:" : "Client Message:"}
                    </span>
                    <span className="font-bold text-amber-700 font-mono text-sm">
                      {selectedDuration + 5} {lang === "ar" ? "أيام (+5 أيام)" : "days (+5d)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Calculation Preview */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl mb-4">
                <div className="flex justify-between items-center text-xs text-indigo-900">
                  <span className="font-medium">
                    {lang === "ar" ? "تاريخ بدء المرحلة:" : "Stage Start Date:"}
                  </span>
                  <span className="font-bold font-mono">
                    {new Date().toLocaleDateString(
                      lang === "ar" ? "ar-EG" : "en-US",
                      { weekday: "short", month: "short", day: "numeric" },
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-indigo-900 mt-1.5 pt-1.5 border-t border-indigo-100">
                  <span className="font-medium">
                    {lang === "ar" ? "تاريخ الانتهاء للعميل (+5 أيام):" : "Expected Client Date:"}
                  </span>
                  <span className="font-bold text-sm text-indigo-700 font-mono">
                    {new Date(
                      Date.now() + (selectedDuration + 5) * 86400000,
                    ).toLocaleDateString(
                      lang === "ar" ? "ar-EG" : "en-US",
                      { weekday: "short", month: "short", day: "numeric", year: "numeric" },
                    )}
                  </span>
                </div>
              </div>

              {/* Live WhatsApp Message Preview */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl mb-6">
                <div className="flex items-center gap-1.5 mb-2 text-emerald-800 text-xs font-bold">
                  <Send className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "معاينة رسالة الواتساب للعميل:" : "WhatsApp Message Preview:"}</span>
                </div>
                <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed bg-white/70 p-3 rounded-xl border border-emerald-100 font-sans">
                  {getStageStartWhatsAppMessage(
                    timerStageData.order.customerName || "",
                    timerStageData.stageDef.key,
                    selectedDuration + 5,
                  )}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTimerModalOpen(false)}
                  className="flex-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 py-3.5 rounded-2xl font-bold transition-all cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTimer}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Timer className="w-4 h-4" />
                  {timerStageData.isEditOnly
                    ? lang === "ar"
                      ? "تحديث المؤقت"
                      : "Update Timer"
                    : lang === "ar"
                      ? `بدء المرحلة وإرسال (${selectedDuration + 5} يوم للعميل)`
                      : `Start & Send (${selectedDuration + 5}d)`}
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

      {/* ===================== STAGE PHOTOS MODAL (CARPENTRY & PAINTING) ===================== */}
      <AnimatePresence>
        {photoModalOpen && photoStageData && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPhotoModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-[#f6f2ec] rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl border border-white/60 max-h-[90vh] overflow-y-auto"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto p-2 bg-white/60 hover:bg-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {lang === "ar"
                      ? `صور مرحلة: ${photoStageData.stageDef.ar}`
                      : `Stage Photos: ${photoStageData.stageDef.en}`}
                  </h2>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {photoStageData.order.customerName} ({stageImages.length}{" "}
                    {lang === "ar" ? "صورة مرفوعة" : "photos attached"})
                  </p>
                </div>
              </div>

              {/* Upload Drop Area */}
              {canEditStages && (
                <div className="mb-6">
                  <label className="border-2 border-dashed border-zinc-300 hover:border-indigo-400 bg-white/60 hover:bg-white/90 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group">
                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all mb-2" />
                    <span className="text-sm font-bold text-zinc-700">
                      {lang === "ar"
                        ? "اضغط لإضافة صور جديدة للمرحلة (من الكاميرا أو الاستوديو)"
                        : "Click to upload stage photos (camera or gallery)"}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-1">
                      {lang === "ar"
                        ? "يمكنك اختيار عدة صور في نفس الوقت"
                        : "Multiple photos supported"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadPhotoFiles}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Photo Gallery Grid */}
              {stageImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {stageImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-2xl overflow-hidden aspect-square bg-black/5 group border border-white/80 shadow-sm"
                    >
                      <img
                        src={imgUrl}
                        alt={`Stage ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => setPreviewImage(imgUrl)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(imgUrl)}
                          className="p-2 rounded-xl bg-white/80 hover:bg-white text-zinc-800 shadow-sm cursor-pointer"
                          title={lang === "ar" ? "تكبير الصورة" : "Preview"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEditStages && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm cursor-pointer"
                            title={lang === "ar" ? "حذف الصورة" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-white/40 rounded-2xl border border-dashed border-zinc-200 mb-6">
                  <ImageIcon className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 font-semibold">
                    {lang === "ar"
                      ? "لا توجد صور مرفوعة لهذه المرحلة حتى الآن"
                      : "No photos uploaded for this stage yet"}
                  </p>
                </div>
              )}

              {canEditStages && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPhotoModalOpen(false)}
                    className="flex-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 py-3.5 rounded-2xl font-bold transition-all cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPhotos}
                    onClick={handleSaveStagePhotos}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    {isSavingPhotos
                      ? lang === "ar"
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : lang === "ar"
                        ? "حفظ ونشر الصور للعميل"
                        : "Save & Publish to Customer"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== STAGE EXPENSES MODAL (2 COLUMNS, 15 ROWS) ===================== */}
      <AnimatePresence>
        {expenseModalOpen && expenseStageData && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              ref={stageExpensesModalRef}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-zinc-100 max-h-[90vh] flex flex-col"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-emerald-600" />
                    {lang === "ar"
                      ? `مصروفات مرحلة (${expenseStageData.stageDef.ar})`
                      : `Expenses for (${expenseStageData.stageDef.en})`}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {lang === "ar"
                      ? `العميل: ${expenseStageData.order.customerName} - خاص بالمصنع فقط (لا يظهر للعميل)`
                      : `Customer: ${expenseStageData.order.customerName} - Factory internal only (Hidden from customer)`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const items = stageExpenses
                        .filter((r) => (Number(r.amount) || 0) > 0 || r.destination.trim() !== "")
                        .map((r) => ({
                          customerName: expenseStageData.order.customerName,
                          phone: expenseStageData.order.phone,
                          stageName: lang === "ar" ? expenseStageData.stageDef.ar : expenseStageData.stageDef.en,
                          destination: r.destination,
                          amount: Number(r.amount) || 0,
                        }));
                      const total = items.reduce((s, i) => s + i.amount, 0);
                      exportExpensesToExcel(
                        `مصروفات_${expenseStageData.stageDef.ar}`,
                        items,
                        total,
                        `مصروفات_${expenseStageData.stageDef.ar}_${expenseStageData.order.customerName}_${new Date().toISOString().slice(0, 10)}`,
                        lang,
                      );
                    }}
                    className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all border border-emerald-200 cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title={lang === "ar" ? "تصدير إلى إكسيل" : "Export Excel"}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">{lang === "ar" ? "إكسيل" : "Excel"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const exportTarget = singleStageStatementRef.current || stageExpensesModalRef.current;
                      if (exportTarget) {
                        exportElementToPdf(
                          exportTarget,
                          `مصروفات_${expenseStageData.stageDef.ar}_${expenseStageData.order.customerName}_${new Date().toISOString().slice(0, 10)}`,
                          lang,
                        );
                      }
                    }}
                    className="p-2 text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-rose-200 cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title={lang === "ar" ? "تحميل كملف PDF" : "Download PDF"}
                  >
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span className="hidden sm:inline">{lang === "ar" ? "PDF" : "PDF"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const exportTarget = singleStageStatementRef.current || stageExpensesModalRef.current;
                      if (exportTarget) {
                        exportElementToImage(
                          exportTarget,
                          `مصروفات_${expenseStageData.stageDef.ar}_${expenseStageData.order.customerName}_${new Date().toISOString().slice(0, 10)}`,
                          lang,
                        );
                      }
                    }}
                    className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-200 cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title={lang === "ar" ? "تحميل كصورة" : "Download Image"}
                  >
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span className="hidden sm:inline">{lang === "ar" ? "صورة" : "Image"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseModalOpen(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                <div className="grid grid-cols-[36px_1fr_130px] gap-2 px-1 text-[11px] font-bold text-zinc-500 uppercase">
                  <span className="text-center">#</span>
                  <span>{lang === "ar" ? "جهة الصرف" : "Destination / Entity"}</span>
                  <span>{lang === "ar" ? "المبلغ (جنيه)" : "Amount (EGP)"}</span>
                </div>

                {stageExpenses.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[36px_1fr_130px] gap-2 items-center bg-zinc-50/80 p-1.5 rounded-xl border border-zinc-200/60"
                  >
                    <span className="text-center text-xs font-bold text-zinc-400 font-mono">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      disabled={!canEditStages}
                      value={row.destination}
                      onChange={(e) => {
                        const updated = [...stageExpenses];
                        updated[idx].destination = e.target.value;
                        setStageExpenses(updated);
                      }}
                      placeholder={lang === "ar" ? `جهة الصرف ${idx + 1}...` : `Expense item ${idx + 1}...`}
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-800 outline-none focus:border-emerald-500 transition-colors"
                    />
                    <input
                      type="number"
                      min={0}
                      disabled={!canEditStages}
                      value={row.amount}
                      onChange={(e) => {
                        const updated = [...stageExpenses];
                        updated[idx].amount = e.target.value === "" ? "" : Number(e.target.value);
                        setStageExpenses(updated);
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-800 outline-none focus:border-emerald-500 text-right transition-colors"
                    />
                  </div>
                ))}
              </div>

              {/* Total & Actions */}
              <div className="pt-4 mt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                  <span>{lang === "ar" ? "إجمالي مصروفات المرحلة:" : "Stage Total:"}</span>
                  <span className="text-base text-emerald-600 font-mono font-extrabold">
                    {stageExpenses
                      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
                      .toLocaleString()}{" "}
                    جنيه
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setExpenseModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-all cursor-pointer"
                  >
                    {lang === "ar" ? "إغلاق" : "Close"}
                  </button>
                  {canEditStages && (
                    <button
                      type="button"
                      disabled={isSavingExpenses}
                      onClick={handleSaveStageExpenses}
                      className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSavingExpenses
                          ? (lang === "ar" ? "جاري الحفظ..." : "Saving...")
                          : (lang === "ar" ? "حفظ المصروفات" : "Save Expenses")}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== FULLSCREEN IMAGE LIGHTBOX ===================== */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-6 right-6 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={previewImage}
              alt="Enlarged stage preview"
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        )}
      </AnimatePresence>
      {/* ===================== PRINTABLE STATEMENT FOR PDF & IMAGE EXPORT ===================== */}
      <div style={{ position: "fixed", left: 0, top: 0, zIndex: -9999, pointerEvents: "none" }} aria-hidden="true">
        <div
          ref={phaseExpensesStatementRef}
          id="phase-expenses-statement"
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="bg-white p-10 text-zinc-900 w-[1000px] border border-zinc-200"
          style={{ fontFamily: "inherit" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b-2 border-emerald-600 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                  ع
                </div>
                <div>
                  <h1 className="text-2xl font-black text-zinc-900">
                    {lang === "ar" ? "مصنع العماري للأثاث الراقي" : "El-Amary Furniture Industry"}
                  </h1>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {lang === "ar" ? "إدارة الإنتاج والتشغيل - كشف مصروفات المراحل" : "Production Management - Phase Expenses Statement"}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-left rtl:text-left ltr:text-right text-xs text-zinc-500 space-y-1">
              <div>
                <span className="font-bold text-zinc-700">{lang === "ar" ? "تاريخ التصدير:" : "Export Date:"} </span>
                <span className="font-mono">{new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
              <div>
                <span className="font-bold text-zinc-700">{lang === "ar" ? "وقت الإصدار:" : "Issue Time:"} </span>
                <span className="font-mono">{new Date().toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div>
                <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-md">
                  {lang === "ar" ? "مستند رسمي معتمد داخلياً" : "Official Internal Document"}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-emerald-800 mb-1">
                {lang === "ar" ? "إجمالي مصروفات المراحل" : "Total Phase Expenses"}
              </div>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {phaseExpensesSummary.grandTotal.toLocaleString()}{" "}
                <span className="text-sm font-bold">{lang === "ar" ? "جنيه مصري" : "EGP"}</span>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-zinc-600 mb-1">
                {lang === "ar" ? "عدد البنود المسجلة" : "Recorded Items"}
              </div>
              <div className="text-2xl font-black font-mono text-zinc-800">
                {phaseExpensesSummary.items.length}{" "}
                <span className="text-sm font-bold text-zinc-500">{lang === "ar" ? "بند" : "items"}</span>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
              <div className="text-xs font-bold text-zinc-600 mb-1">
                {lang === "ar" ? "عدد الطلبات المستفيدة" : "Affected Orders"}
              </div>
              <div className="text-2xl font-black font-mono text-zinc-800">
                {phaseExpensesSummary.uniqueOrders}{" "}
                <span className="text-sm font-bold text-zinc-500">{lang === "ar" ? "طلب" : "orders"}</span>
              </div>
            </div>
          </div>

          {/* Stage Breakdown Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-800 mb-2 pb-1 border-b border-zinc-200">
              {lang === "ar" ? "ملخص المصروفات حسب مراحل الإنتاج:" : "Summary by Production Stage:"}
            </h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {STAGE_ORDER.map((st) => {
                const info = phaseExpensesSummary.stageTotals[st.key] || { count: 0, total: 0 };
                const pct = phaseExpensesSummary.grandTotal > 0
                  ? Math.round((info.total / phaseExpensesSummary.grandTotal) * 100)
                  : 0;
                return (
                  <div key={st.key} className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/70">
                    <div className="font-bold text-zinc-700">{lang === "ar" ? st.ar : st.en}</div>
                    <div className="text-emerald-700 font-mono font-black text-sm mt-0.5">
                      {info.total.toLocaleString()} ج.م
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {info.count} {lang === "ar" ? "بند" : "items"} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Itemized Table */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-zinc-800 mb-2 pb-1 border-b border-zinc-200">
              {lang === "ar" ? "كشف تفصيلي ببنود المصروفات:" : "Itemized Expenses Details:"}
            </h3>
            <table className="w-full text-right rtl:text-right ltr:text-left text-xs border border-zinc-200">
              <thead>
                <tr className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200">
                  <th className="p-2.5 border-l border-zinc-200 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-zinc-200">{lang === "ar" ? "اسم العميل" : "Customer"}</th>
                  <th className="p-2.5 border-l border-zinc-200">{lang === "ar" ? "الهاتف" : "Phone"}</th>
                  <th className="p-2.5 border-l border-zinc-200">{lang === "ar" ? "المرحلة" : "Stage"}</th>
                  <th className="p-2.5 border-l border-zinc-200">{lang === "ar" ? "جهة الصرف / البيان" : "Destination"}</th>
                  <th className="p-2.5 text-left rtl:text-left ltr:text-right">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {phaseExpensesSummary.items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                    <td className="p-2 border-l border-zinc-200 text-center font-mono text-zinc-400 font-bold">{idx + 1}</td>
                    <td className="p-2 border-l border-zinc-200 font-bold text-zinc-900">{item.customerName}</td>
                    <td className="p-2 border-l border-zinc-200 font-mono text-zinc-600" dir="ltr">{item.phone}</td>
                    <td className="p-2 border-l border-zinc-200 font-semibold text-zinc-700">{item.stageName}</td>
                    <td className="p-2 border-l border-zinc-200 text-zinc-800">{item.destination}</td>
                    <td className="p-2 font-mono font-bold text-emerald-700 text-left rtl:text-left ltr:text-right">
                      {item.amount.toLocaleString()} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-bold text-xs border-t-2 border-emerald-300">
                  <td colSpan={5} className="p-3 text-emerald-950 font-bold border-l border-zinc-200">
                    {lang === "ar" ? "الإجمالي الكلي النهائي لكافة مصروفات المراحل:" : "Grand Total Phase Expenses:"}
                  </td>
                  <td className="p-3 font-mono font-black text-sm text-emerald-800 text-left rtl:text-left ltr:text-right">
                    {phaseExpensesSummary.grandTotal.toLocaleString()} ج.م
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures & Approvals */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-zinc-200 text-xs">
            <div className="text-center space-y-10">
              <div className="font-bold text-zinc-700">{lang === "ar" ? "المسؤول عن الإدخال" : "Data Entry Officer"}</div>
              <div className="border-b border-dashed border-zinc-400 w-36 mx-auto"></div>
            </div>
            <div className="text-center space-y-10">
              <div className="font-bold text-zinc-700">{lang === "ar" ? "مدير المصنع / التشغيل" : "Factory Manager"}</div>
              <div className="border-b border-dashed border-zinc-400 w-36 mx-auto"></div>
            </div>
            <div className="text-center space-y-10">
              <div className="font-bold text-zinc-700">{lang === "ar" ? "الإدارة المالية والاعتماد" : "Financial Approver"}</div>
              <div className="border-b border-dashed border-zinc-400 w-36 mx-auto"></div>
            </div>
          </div>
        </div>

        {/* Offscreen Single Stage Expenses Statement */}
        {expenseStageData && (
          <div
            ref={singleStageStatementRef}
            id="single-stage-expenses-statement"
            dir={lang === "ar" ? "rtl" : "ltr"}
            className="bg-white p-10 text-zinc-900 w-[900px] border border-zinc-200 mt-6"
            style={{ fontFamily: "inherit" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b-2 border-emerald-600 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                  ع
                </div>
                <div>
                  <h1 className="text-2xl font-black text-zinc-900">
                    {lang === "ar" ? "مصنع العماري للأثاث الراقي" : "El-Amary Furniture Industry"}
                  </h1>
                  <p className="text-xs text-zinc-500 font-semibold">
                    {lang === "ar"
                      ? `كشف مصروفات مرحلة (${expenseStageData.stageDef.ar})`
                      : `Expenses Statement for (${expenseStageData.stageDef.en})`}
                  </p>
                </div>
              </div>
              <div className="text-left rtl:text-left ltr:text-right text-xs text-zinc-500 space-y-1">
                <div>
                  <span className="font-bold text-zinc-700">{lang === "ar" ? "التاريخ:" : "Date:"} </span>
                  <span className="font-mono">
                    {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-zinc-700">{lang === "ar" ? "الوقت:" : "Time:"} </span>
                  <span className="font-mono">
                    {new Date().toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer & Stage Info Box */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-6 grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block mb-0.5">{lang === "ar" ? "اسم العميل" : "Customer"}</span>
                <span className="font-bold text-sm text-zinc-900">{expenseStageData.order.customerName}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">{lang === "ar" ? "رقم الهاتف" : "Phone"}</span>
                <span className="font-mono font-bold text-sm text-zinc-800" dir="ltr">
                  {expenseStageData.order.phone || "-"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">{lang === "ar" ? "المرحلة التشغيلية" : "Stage"}</span>
                <span className="font-bold text-sm text-emerald-700">
                  {lang === "ar" ? expenseStageData.stageDef.ar : expenseStageData.stageDef.en}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-right rtl:text-right ltr:text-left text-xs border border-zinc-200 mb-6">
              <thead>
                <tr className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200">
                  <th className="p-2.5 border-l border-zinc-200 w-12 text-center">#</th>
                  <th className="p-2.5 border-l border-zinc-200">
                    {lang === "ar" ? "جهة الصرف / البيان" : "Destination / Description"}
                  </th>
                  <th className="p-2.5 text-left rtl:text-left ltr:text-right w-44">
                    {lang === "ar" ? "المبلغ (جنيه)" : "Amount (EGP)"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {stageExpenses
                  .filter((r) => (Number(r.amount) || 0) > 0 || r.destination.trim() !== "")
                  .map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                      <td className="p-2.5 border-l border-zinc-200 text-center font-mono text-zinc-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 border-l border-zinc-200 text-zinc-800 font-medium">
                        {row.destination || "-"}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700 text-left rtl:text-left ltr:text-right">
                        {(Number(row.amount) || 0).toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-bold text-xs border-t-2 border-emerald-300">
                  <td colSpan={2} className="p-3 text-emerald-950 font-bold border-l border-zinc-200">
                    {lang === "ar" ? "إجمالي مصروفات هذه المرحلة:" : "Total Stage Expenses:"}
                  </td>
                  <td className="p-3 font-mono font-black text-sm text-emerald-800 text-left rtl:text-left ltr:text-right">
                    {stageExpenses
                      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
                      .toLocaleString()}{" "}
                    ج.م
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-zinc-200 text-xs">
              <div className="text-center space-y-10">
                <div className="font-bold text-zinc-700">
                  {lang === "ar" ? "مسؤول المرحلة" : "Stage Supervisor"}
                </div>
                <div className="border-b border-dashed border-zinc-400 w-36 mx-auto"></div>
              </div>
              <div className="text-center space-y-10">
                <div className="font-bold text-zinc-700">
                  {lang === "ar" ? "الاعتماد المالي" : "Financial Approval"}
                </div>
                <div className="border-b border-dashed border-zinc-400 w-36 mx-auto"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};