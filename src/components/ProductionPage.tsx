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
  Camera,
  Image as ImageIcon,
  Trash2,
  Upload,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Inspection } from "../types";
import { STAGE_ORDER } from "../constants";
import { InvoiceService, StageService } from "../services/data";

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
  productionFilter: "all" | "in_production" | "completed";
  onProductionFilterChange: (filter: "all" | "in_production" | "completed") => void;
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
  const [paymentStage, setPaymentStage] = useState<string>("بعد تمام الاستلام");
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
    "بعد تمام الاستلام",
    "بعد تمام النجارة",
    "بعد تمام التجهيزات",
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
    const isCompleted = isOrderCompleted(order);
    if (govFilter !== "all" && order.governorate !== govFilter) {
      return false;
    }
    if (productionFilter === "completed" && !isCompleted) {
      return false;
    }
    if (productionFilter === "in_production" && isCompleted) {
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
        if (["received", "carpentry", "fittings"].includes(stageDef.key)) {
          let installmentName = "بعد تمام الاستلام";
          if (stageDef.key === "carpentry") installmentName = "بعد تمام النجارة";
          else if (stageDef.key === "fittings") installmentName = "بعد تمام التجهيزات";

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
        } else if (stageDef.key === "painting" && onSendWhatsApp && order.phone) {
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
    } else if (stageKey === "carpentry") {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nيسعدنا إبلاغكم بانتهاء مرحلة النجارة لطلبكم في مصنع العماري للأثاث.\nنرجو التكرم بسداد دفعة المرحلة واختيار الألوان للبدء في مرحلة الدهانات.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لثقتكم واختياركم لنا!`
          : `Hello ${order.customerName || ""},\nWe are pleased to inform you that the Carpentry phase for your order at El-Amary Furniture is completed.\nPlease proceed with the installment payment and color selection to begin the Painting phase.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you!`;
    } else {
      msg =
        lang === "ar"
          ? `مرحباً ${order.customerName || ""}،\nتم استلام وتأكيد طلبكم في مصنع العماري للأثاث.\nيرجى التكرم بسداد دفعة التعاقد / الاستلام لتأكيد بدء مراحل العمل بالورشة.\nالمبلغ المتبقي: ${remaining.toLocaleString()} ج.م.\nشكراً لتعاملكم معنا!`
          : `Hello ${order.customerName || ""},\nYour order at El-Amary Furniture has been received and confirmed.\nPlease settle the intake deposit to commence production.\nRemaining balance: ${remaining.toLocaleString()} EGP.\nThank you for choosing us!`;
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

  // Detect pending payment collection milestone for an order (only received, carpentry, fittings)
  const getOrderCollectionMilestone = (order: Inspection, orderStages: any[]) => {
    const totalPaid = getCustomerPayments(order.id).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );
    const remaining = (order.totalAmount || 0) - totalPaid;
    if (remaining <= 0) return null;

    const fittingsStage = orderStages.find((s) => s.stage === "fittings");
    const carpentryStage = orderStages.find((s) => s.stage === "carpentry");
    const receivedStage = orderStages.find((s) => s.stage === "received");

    if (fittingsStage?.status === "done") {
      return {
        key: "fittings",
        stageName: lang === "ar" ? "تمام التجهيزات" : "Fittings Completed",
        installmentName: "بعد تمام التجهيزات",
        remaining,
      };
    }
    if (carpentryStage?.status === "done") {
      return {
        key: "carpentry",
        stageName: lang === "ar" ? "تمام النجارة" : "Carpentry Completed",
        installmentName: "بعد تمام النجارة",
        remaining,
      };
    }
    if (receivedStage?.status === "done") {
      return {
        key: "received",
        stageName: lang === "ar" ? "تمام الاستلام" : "Intake Completed",
        installmentName: "بعد تمام الاستلام",
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
            {/* Status Filters: All, Incomplete (In-Progress), Completed */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => onProductionFilterChange("all")}
                className={`filter-chip ${productionFilter === "all" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                {lang === "ar" ? "الكل" : "All"}
              </button>
              <button
                onClick={() => onProductionFilterChange("in_production")}
                className={`filter-chip ${productionFilter === "in_production" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                {lang === "ar" ? "غير مكتمل" : "Incomplete"}
              </button>
              <button
                onClick={() => onProductionFilterChange("completed")}
                className={`filter-chip ${productionFilter === "completed" ? "filter-chip-active" : "filter-chip-inactive"}`}
              >
                {lang === "ar" ? "مكتمل" : "Completed"}
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
    </div>
  );
};