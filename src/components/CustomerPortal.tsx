import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Armchair, 
  Calendar, 
  MapPin, 
  CreditCard, 
  Wrench, 
  FileText, 
  CheckCircle2, 
  Download, 
  LogOut, 
  Phone, 
  Coins,
  Timer,
  Clock,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  Send,
  Camera,
  Eye,
  X,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { STAGE_ORDER } from "../constants";
import { CustomerServiceLogsService } from "../services/data";

// Helper to format remaining timer for customer
const formatCustomerRemainingTime = (
  startedAtStr?: string | null,
  daysAllocated: number = 7,
  isAr: boolean = true,
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
    text = isAr ? `متأخر بـ ${days} يوم` : `Overdue by ${days}d`;
  } else {
    text = isAr
      ? `متبقي ${days} يوم${hours > 0 ? ` و ${hours} ساعة` : ""}`
      : `${days}d ${hours}h left`;
  }

  const targetDateFormatted = new Date(targetTime).toLocaleDateString(
    isAr ? "ar-EG" : "en-US",
    { month: "short", day: "numeric" },
  );

  return {
    isOverdue,
    text,
    progressPct,
    targetDateFormatted,
  };
};

interface CustomerPortalProps {
  lang: "en" | "ar";
  customerRecord: any; // The contracted customer record
  payments: any[];
  stages: any[];
  onLogout: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  lang,
  customerRecord,
  payments,
  stages,
  onLogout,
}) => {
  const isAr = lang === "ar";
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState<"شكوى" | "مقترح" | "استفسار">("مقترح");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Submit Feedback / Complaint to Customer Service
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    setIsSubmittingFeedback(true);
    try {
      const newLog = {
        id: crypto.randomUUID(),
        customerName:
          customerRecord.customerName ||
          customerRecord.customer_name ||
          "عميل البوابة",
        phone: customerRecord.phone || "",
        notes: `[${feedbackType} من العميل عبر البوابة]: ${feedbackText.trim()}`,
        createdAt: new Date().toISOString(),
        createdBy: "بوابة العميل",
      };

      await CustomerServiceLogsService.insert(newLog);
      setFeedbackText("");
      setFeedbackSuccess(true);
      toast.success(
        isAr
          ? "تم إرسال رسالتكم لخدمة العملاء بنجاح وسيتم الرد عليكم فوراً"
          : "Your message has been sent to Customer Service successfully",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Filter payments belonging to this customer
  const customerPhone = customerRecord.phone;
  const filteredPayments = payments.filter((p) => {
    return p.note?.startsWith(`cc:${customerRecord.id}:`);
  });

  // Find client ID from stages to filter client's specific stages
  const normalizedPhone = customerPhone.replace(/\D/g, "");
  const clientStage = stages.find((s) => 
    s.client?.phones?.some((p: string) => p.replace(/\D/g, "") === normalizedPhone)
  );
  const clientId = clientStage?.client_id || null;
  const clientStages = clientId ? stages.filter((s) => s.client_id === clientId) : [];

  // Calculate overall progress percentage
  const totalStagesCount = STAGE_ORDER.length;
  const completedStagesCount = STAGE_ORDER.filter((s) => {
    const stageRec = clientStages.find((cs) => cs.stage === s.key);
    return stageRec?.status === "done";
  }).length;
  const progressPercent = totalStagesCount > 0 
    ? Math.round((completedStagesCount / totalStagesCount) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4 sm:px-6 lg:px-8" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-10 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Armchair className="w-8 h-8 text-accent-tan" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-light tracking-wider text-zinc-900">
              {isAr ? "بوابة العملاء | العماري للأثاث" : "Customer Portal | El3mmary Furniture"}
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {isAr ? "تابع طلبك ومدفوعاتك مباشرة" : "Track your order and payments live"}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-500 hover:text-white px-5 py-3 rounded-2xl text-sm font-bold uppercase transition-all duration-200 shadow-md active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {isAr ? "تسجيل الخروج" : "Sign Out"}
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Customer Card */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[2.5rem] p-8 shadow-xl border border-white/40 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-tan/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <h2 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
              {isAr ? "تفاصيل التعاقد" : "Contract Details"}
            </h2>
            <div className="space-y-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider mb-1">
                  {isAr ? "اسم العميل" : "Customer Name"}
                </span>
                <span className="text-lg font-bold text-zinc-800">
                  {customerRecord.customerName || customerRecord.customer_name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider mb-1">
                    {isAr ? "رقم الهاتف" : "Phone"}
                  </span>
                  <span className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    {customerRecord.phone}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider mb-1">
                    {isAr ? "كود العميل" : "Customer Code"}
                  </span>
                  <span className="text-sm font-bold text-zinc-700 font-mono">
                    #{customerRecord.id?.slice(0, 8).toUpperCase() || "-"}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-accent-tan mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      {isAr ? "تاريخ التعاقد" : "Contract Date"}
                    </span>
                    <span className="text-sm font-semibold text-zinc-700">
                      {customerRecord.contractDate || customerRecord.contract_date || (isAr ? "غير محدد" : "Not set")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      {isAr ? "تاريخ الاستلام المتوقع" : "Expected Delivery"}
                    </span>
                    <span className="text-sm font-semibold text-zinc-700">
                      {customerRecord.deliveryDate || customerRecord.delivery_date || (isAr ? "غير محدد" : "Not set")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      {isAr ? "عنوان التوصيل" : "Delivery Address"}
                    </span>
                    <span className="text-sm font-semibold text-zinc-700">
                      {customerRecord.deliveryAddress || customerRecord.delivery_address || customerRecord.address || (isAr ? "غير محدد" : "Not set")}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-indigo-400 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      {isAr ? "المحافظة" : "Governorate"}
                    </span>
                    <span className="text-sm font-semibold text-zinc-700">
                      {customerRecord.governorate || (isAr ? "غير محدد" : "Not set")}
                    </span>
                  </div>
                </div>
              </div>

              {customerRecord.contract_url && (
                <div className="border-t border-zinc-100 pt-6">
                  <a
                    href={customerRecord.contract_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-zinc-900 text-white py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 group transition-all hover:bg-zinc-800 active:scale-95 shadow-md"
                  >
                    <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                    {isAr ? "تحميل نسخة العقد" : "Download Contract COPY"}
                  </a>
                </div>
              )}
            </div>
          </motion.div>

          {/* Pricing Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-xl border border-zinc-800 relative overflow-hidden"
          >
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-accent-tan/5 rounded-full -mr-16 -mb-16 blur-3xl" />
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Coins className="w-5 h-5 text-accent-tan" />
              {isAr ? "الملخص المالي" : "Financial Summary"}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-400 text-sm">{isAr ? "إجمالي قيمة العقد" : "Total Contract Value"}</span>
                <span className="text-lg font-bold text-accent-tan">
                  {customerRecord.totalAmount?.toLocaleString() || customerRecord.total_amount?.toLocaleString() || 0} EGP
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-400 text-sm">{isAr ? "عدد الغرف المتعاقد عليها" : "Rooms Contracted"}</span>
                <span className="text-lg font-bold text-white">
                  {customerRecord.rooms || 0}
                </span>
              </div>
              {customerRecord.notes && (
                <div className="pt-2">
                  <span className="text-zinc-400 text-xs block mb-1">{isAr ? "ملاحظات إضافية" : "Additional Notes"}</span>
                  <p className="text-zinc-300 text-xs bg-zinc-800/50 p-4 rounded-xl leading-relaxed border border-zinc-800">
                    {customerRecord.notes}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Tracker and Payments */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tracker Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-white/40"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <Wrench className="w-6 h-6 text-accent-tan" />
                  {isAr ? "حالة مراحل الإنتاج" : "Production Progress"}
                </h3>
                <p className="text-zinc-500 text-sm mt-1">
                  {isAr ? "متابعة حية لمراحل تصنيع غرفتك بالورشة" : "Live tracker of your furniture's manufacturing stages"}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-zinc-900 text-white rounded-2xl px-5 py-3 shadow-lg">
                <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
                  {isAr ? "التقدم" : "Progress"}
                </span>
                <span className="text-xl font-bold font-mono text-accent-tan">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Active Stage Countdown Timer Widget */}
            {(() => {
              const activeTimerStage = clientStages.find(
                (s) => s.status === "in_progress" && s.timer_started_at,
              );
              const activeTimerDef = activeTimerStage
                ? STAGE_ORDER.find((s) => s.key === activeTimerStage.stage)
                : null;
              const customerTimerInfo = activeTimerStage?.timer_started_at
                ? formatCustomerRemainingTime(
                    activeTimerStage.timer_started_at,
                    activeTimerStage.timer_days || 7,
                    isAr,
                  )
                : null;

              if (!activeTimerStage || !activeTimerDef || !customerTimerInfo)
                return null;

              return (
                <div className="mb-8 p-5 rounded-3xl bg-indigo-50/80 border border-indigo-100/80 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                        <Timer className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-indigo-950 block">
                          {isAr
                            ? `المرحلة الحالية: ${activeTimerDef.ar}`
                            : `Current Stage: ${activeTimerDef.en}`}
                        </span>
                        <span className="text-[11px] text-indigo-600">
                          {isAr
                            ? `المدة المحددة للمرحلة: ${activeTimerStage.timer_days || 7} أيام (حتى ${customerTimerInfo.targetDateFormatted})`
                            : `Allocated duration: ${activeTimerStage.timer_days || 7} days (until ${customerTimerInfo.targetDateFormatted})`}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-indigo-200/80 text-indigo-900 font-mono font-bold text-xs rounded-full">
                      {customerTimerInfo.text}
                    </span>
                  </div>

                  <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden mt-3">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-700"
                      style={{ width: `${customerTimerInfo.progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Payment Collection Milestone Notice */}
            {(() => {
              const totalPaid = filteredPayments.reduce(
                (sum, p) => sum + (Number(p.amount) || 0),
                0,
              );
              const remainingBalance = (customerRecord.totalAmount || 0) - totalPaid;
              if (remainingBalance <= 0) return null;

              const deliveryDone = clientStages.find(
                (s) => s.stage === "delivery" && s.status === "done",
              );
              const paintingDone = clientStages.find(
                (s) => s.stage === "painting" && s.status === "done",
              );
              const carpentryDone = clientStages.find(
                (s) => s.stage === "carpentry" && s.status === "done",
              );

              let notice = null;
              if (deliveryDone) {
                notice = {
                  title: isAr
                    ? "طلب سداد دفعة الاستلام النهائي"
                    : "Final Delivery Payment Due",
                  desc: isAr
                    ? "طلبكم جاهز بالكامل للتسليم. يرجى سداد المبلغ المتبقي لترتيب الشحن."
                    : "Your order is ready for delivery. Please settle the remaining balance.",
                };
              } else if (paintingDone) {
                notice = {
                  title: isAr
                    ? "طلب سداد دفعة ما بعد الدهانات"
                    : "Post-Painting Installment Due",
                  desc: isAr
                    ? "تم الانتهاء من مرحلة الدهانات بنجاح. يرجى سداد دفعة المرحلة للمتابعة."
                    : "Painting phase is completed. Please settle the stage installment.",
                };
              } else if (carpentryDone) {
                notice = {
                  title: isAr
                    ? "طلب سداد دفعة انتهاء النجارة"
                    : "Post-Carpentry Installment Due",
                  desc: isAr
                    ? "تم الانتهاء من مرحلة النجارة بنجاح. يرجى سداد دفعة المرحلة واختيار الألوان."
                    : "Carpentry phase is completed. Please settle the stage installment.",
                };
              }

              if (!notice) return null;

              return (
                <div className="mb-8 p-5 rounded-3xl bg-amber-50/90 border border-amber-200 shadow-sm flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-amber-950 text-sm">
                        {notice.title}
                      </h4>
                      <span className="font-bold font-mono text-sm text-rose-600">
                        {remainingBalance.toLocaleString()} EGP
                      </span>
                    </div>
                    <p className="text-xs text-amber-800/80 leading-relaxed">
                      {notice.desc}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Progress Bar */}
            <div className="w-full bg-zinc-100 rounded-full h-3 mb-10 overflow-hidden border border-zinc-200">
              <div 
                className="bg-gradient-to-r from-accent-tan to-zinc-900 h-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stages Timeline */}
            <div className="space-y-6 relative before:absolute before:top-4 before:bottom-4 before:w-0.5 before:bg-zinc-200 ltr:before:left-5 rtl:before:right-5">
              {STAGE_ORDER.map((stageDef, idx) => {
                const stageRecord = clientStages.find((s) => s.stage === stageDef.key);
                const stageStatus = stageRecord?.status || "not_started";
                const isDone = stageStatus === "done";
                const isInProgress = stageStatus === "in_progress";
                const timerDetails =
                  isInProgress && stageRecord?.timer_started_at
                    ? formatCustomerRemainingTime(
                        stageRecord.timer_started_at,
                        stageRecord.timer_days || 7,
                        isAr,
                      )
                    : null;

                return (
                  <div key={stageDef.key} className="flex items-start gap-4 relative">
                    {/* Circle Indicator */}
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold z-10 transition-all border shadow-sm ${
                        isDone 
                          ? "bg-emerald-500 text-white border-emerald-400" 
                          : isInProgress 
                            ? "bg-indigo-600 text-white border-indigo-400 animate-pulse ring-2 ring-indigo-300" 
                            : "bg-white text-zinc-400 border-zinc-200"
                      }`}
                    >
                      {isDone ? "✓" : isInProgress ? "⏱" : idx + 1}
                    </div>

                    <div className="bg-white/60 backdrop-blur-sm border border-white/80 p-5 rounded-2xl flex-1 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-zinc-800">
                            {isAr ? stageDef.ar : stageDef.en}
                          </h4>
                          {timerDetails && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 font-mono">
                              ⏱ {timerDetails.text}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {isDone 
                            ? (isAr ? "تم الانتهاء من هذه المرحلة بنجاح" : "This stage has been completed") 
                            : isInProgress 
                              ? (isAr ? "هذه المرحلة قيد العمل حالياً بالمصنع" : "This stage is currently in progress") 
                              : (isAr ? "مرحلة معلقة لم تبدأ بعد" : "Pending start")}
                        </p>

                        {/* Stage Photos Gallery (Carpentry & Painting photos) */}
                        {stageRecord?.images && stageRecord.images.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-200/60">
                            <span className="text-[11px] font-bold text-zinc-700 mb-2 flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-indigo-600" />
                              {isAr ? "📸 صور تنفيذ هذه المرحلة بالمصنع:" : "📸 Stage progress photos:"}
                            </span>
                            <div className="flex gap-2 flex-wrap mt-1.5">
                              {stageRecord.images.map((img: string, imgIdx: number) => (
                                <button
                                  key={imgIdx}
                                  type="button"
                                  onClick={() => setPreviewPhoto(img)}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:scale-105 hover:shadow-md transition-all group relative cursor-pointer"
                                >
                                  <img
                                    src={img}
                                    alt={`Stage photo ${imgIdx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Eye className="w-5 h-5" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                        isDone 
                          ? "bg-emerald-100 text-emerald-700" 
                          : isInProgress 
                            ? "bg-indigo-100 text-indigo-700" 
                            : "bg-zinc-100 text-zinc-500"
                      }`}>
                        {isDone 
                          ? (isAr ? "مكتمل" : "Completed") 
                          : isInProgress 
                            ? (isAr ? "قيد التنفيذ" : "In Progress") 
                            : (isAr ? "لم تبدأ" : "Not Started")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Payments Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-white/40"
          >
            <h3 className="text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-accent-tan" />
              {isAr ? "سجل الدفعات والمدفوعات" : "Payments History"}
            </h3>
            {filteredPayments.length > 0 ? (
              <div className="overflow-hidden border border-zinc-100 rounded-2xl bg-white/40">
                <table className="w-full text-right table-zebra">
                  <thead>
                    <tr className="bg-zinc-900 text-white text-xs uppercase font-bold tracking-wider">
                      <th className="p-4 text-center">{isAr ? "القيمة" : "Amount"}</th>
                      <th className="p-4 text-center">{isAr ? "التاريخ" : "Paid At"}</th>
                      <th className="p-4 text-center">{isAr ? "القسط / الملاحظة" : "Installment/Note"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-zinc-100 hover:bg-white/60 transition-colors">
                        <td className="p-4 font-bold text-zinc-800 text-center font-mono">
                          {payment.amount?.toLocaleString() || 0} EGP
                        </td>
                        <td className="p-4 text-zinc-500 text-center text-sm font-mono">
                          {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString(isAr ? "ar-EG" : "en-US") : "-"}
                        </td>
                        <td className="p-4 text-zinc-600 text-center text-sm">
                          {payment.installment || payment.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white/40 border border-zinc-100 rounded-2xl py-12 text-center text-zinc-400 font-semibold">
                <Coins className="w-10 h-10 text-zinc-200 mx-auto mb-2" />
                {isAr ? "لا توجد دفعات مسجلة حتى الآن" : "No recorded payments yet"}
              </div>
            )}
          </motion.div>

          {/* Complaints & Suggestions Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-white/40 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-zinc-900">
                  {isAr ? "الشكاوى والمقترحات" : "Complaints & Suggestions"}
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {isAr
                    ? "صوتك يهمنا - اكتب مقترحك أو ملاحظتك وستصل مباشرة لفريق خدمة العملاء"
                    : "Your feedback matters - write your suggestions or complaints directly to CS"}
                </p>
              </div>
            </div>

            {feedbackSuccess && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {isAr
                    ? "تم استلام رسالتك بنجاح وسيتواصل معك فريق خدمة العملاء في أقرب وقت."
                    : "Your feedback has been received. Our customer care team will review it promptly."}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              {/* Type Selector */}
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-2">
                  {isAr ? "نوع الرسالة:" : "Message Type:"}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(["مقترح", "شكوى", "استفسار"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFeedbackType(type)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        feedbackType === type
                          ? "bg-zinc-900 text-white shadow-md scale-105"
                          : "bg-white/80 text-zinc-600 hover:bg-white border border-zinc-200"
                      }`}
                    >
                      {type === "مقترح"
                        ? isAr ? "💡 مقترح" : "💡 Suggestion"
                        : type === "شكوى"
                          ? isAr ? "⚠️ شكوى" : "⚠️ Complaint"
                          : isAr ? "❓ استفسار" : "❓ Inquiry"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-2">
                  {isAr ? "تفاصيل المقترح أو الشكوى:" : "Details:"}
                </label>
                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={
                    isAr
                      ? "اكتب تفاصيل مقترحك أو شكواك هنا بكل وضوح وسنقوم بمتابعتها فوراً..."
                      : "Type your message or complaint here..."
                  }
                  required
                  className="w-full bg-white/80 border border-zinc-200 rounded-2xl p-4 text-sm font-medium text-zinc-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingFeedback || !feedbackText.trim()}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {isSubmittingFeedback
                  ? isAr ? "جاري الإرسال..." : "Sending..."
                  : isAr ? "إرسال إلى خدمة العملاء" : "Send to Customer Service"}
              </button>
            </form>
          </motion.div>
        </div>
      </main>

      {/* Fullscreen Photo Lightbox Modal */}
      <AnimatePresence>
        {previewPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewPhoto}
                alt="Stage photo full view"
                className="max-h-[85vh] w-auto object-contain mx-auto"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
