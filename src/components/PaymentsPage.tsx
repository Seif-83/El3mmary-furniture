// Payments / statement-of-account page for contracted customers.
// Includes 4 collection stages: (التعاقد، الاستلام، النجارة، الدهانات)
// With full CRUD capabilities: Add, Edit, and Delete payments with real-time recalculation and sync.
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  History,
  AlertTriangle,
  Receipt,
  Calendar,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { SyncManager } from "../services/sync";
import { InvoiceService } from "../services/data";
import type { Inspection } from "../types";

export interface PaymentRecord {
  id: string;
  amount: number;
  paid_at: string;
  installment?: string | null;
  note?: string | null;
}

export const PAYMENT_STAGES = [
  "التعاقد",
  "النجارة",
  "الدهانات",
  "الاستلام",
] as const;

export const normalizePaymentStage = (stage?: string | null): string => {
  if (!stage) return "التعاقد";
  const s = stage.trim();
  if (s.includes("تعاقد") || s === "التعاقد") return "التعاقد";
  if (s.includes("نجارة") || s === "النجارة") return "النجارة";
  if (s.includes("دهان") || s === "الدهانات" || s.includes("تجهيز")) return "الدهانات";
  if (s.includes("استلام") || s === "الاستلام" || s.includes("تسليم")) return "الاستلام";
  return s;
};

export const stageColor = (stage: string) => {
  const norm = normalizePaymentStage(stage);
  if (norm === "التعاقد") return "bg-blue-500";
  if (norm === "النجارة") return "bg-indigo-500";
  if (norm === "الدهانات") return "bg-purple-500";
  if (norm === "الاستلام") return "bg-emerald-500";
  return "bg-zinc-400";
};

export const stageBadgeClass = (stage: string) => {
  const norm = normalizePaymentStage(stage);
  if (norm === "التعاقد")
    return "bg-blue-50 text-blue-700 border-blue-200/80";
  if (norm === "النجارة")
    return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
  if (norm === "الدهانات")
    return "bg-purple-50 text-purple-700 border-purple-200/80";
  if (norm === "الاستلام")
    return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  return "bg-zinc-50 text-zinc-700 border-zinc-200/80";
};

export const PaymentsPage: React.FC<{
  contractedCustomers: Inspection[];
  stages?: any[];
  lang: "en" | "ar";
  isAdmin: boolean;
  t: Record<string, string>;
  onRefresh: () => Promise<void>;
  onSendWhatsApp: (phone: string, msg: string) => void;
}> = ({
  contractedCustomers,
  stages = [],
  lang,
  isAdmin,
  t,
  onRefresh,
  onSendWhatsApp,
}) => {
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Inspection | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentStage, setPaymentStage] = useState<string>("التعاقد");
  const [isSaving, setIsSaving] = useState(false);

  // Edit modal states
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editCustomer, setEditCustomer] = useState<Inspection | null>(null);
  const [editAmount, setEditAmount] = useState<number | "">("");
  const [editStage, setEditStage] = useState<string>("التعاقد");
  const [editDate, setEditDate] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation states
  const [deletingPayment, setDeletingPayment] = useState<PaymentRecord | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Inspection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // History modal for specific customer
  const [historyCustomer, setHistoryCustomer] = useState<Inspection | null>(null);

  // View mode: by customer account vs all payments ledger
  const [viewMode, setViewMode] = useState<"customers" | "all_payments">("customers");

  // Data & search
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const paymentStages = PAYMENT_STAGES;

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const localPayments = await InvoiceService.getPayments();
      setAllPayments(localPayments);
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("payments")
          .select("id, amount, paid_at, installment, note")
          .order("paid_at", { ascending: false });
        if (!error && data) {
          for (const r of data) {
            await SyncManager.resolveConflict("payments", r);
          }
          const updatedPayments = await InvoiceService.getPayments();
          setAllPayments(updatedPayments);
        }
      }
    } catch (_) {}
    setLoadingPayments(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const getCustomerPayments = (customerId: string): PaymentRecord[] =>
    allPayments.filter((p) => p.note?.startsWith(`cc:${customerId}:`));

  const findCustomerForPayment = (payment: PaymentRecord): Inspection | undefined => {
    if (!payment.note?.startsWith("cc:")) return undefined;
    const parts = payment.note.split(":");
    const customerId = parts[1];
    return contractedCustomers.find((c) => c.id === customerId);
  };

  const getPendingCollectionTrigger = (customer: Inspection) => {
    const customerPhone = customer.phone;
    const matchingStage = customerPhone
      ? stages.find((s: any) => s.client?.phones?.includes(customerPhone))
      : null;
    const clientId = matchingStage?.client_id || null;
    const customerStages = clientId
      ? stages.filter((s: any) => s.client_id === clientId)
      : [];

    const total = customer.totalAmount || 0;
    const customerPayments = getCustomerPayments(customer.id);
    const paid = customerPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );
    const remaining = total - paid;
    if (remaining <= 0) return null;

    // Check which installment stages have already been paid
    const paidStages = new Set(
      customerPayments.map((p) => normalizePaymentStage(p.installment)),
    );

    // Strictly sequential installments:
    // 1. Contract ("التعاقد")
    if (!paidStages.has("التعاقد")) {
      return {
        stageKey: "contract",
        title:
          lang === "ar"
            ? "مطلوب تحصيل دفعة التعاقد"
            : "Contract Payment Due",
        installment: "التعاقد",
      };
    }

    // 2. Carpentry ("النجارة")
    if (!paidStages.has("النجارة")) {
      return {
        stageKey: "carpentry",
        title:
          lang === "ar"
            ? "مطلوب تحصيل دفعة النجارة"
            : "Post-Carpentry Payment Due",
        installment: "النجارة",
      };
    }

    // 3. Painting ("الدهانات") - Example: if carpentry is paid, next due is painting
    if (!paidStages.has("الدهانات")) {
      return {
        stageKey: "painting",
        title:
          lang === "ar"
            ? "مطلوب تحصيل دفعة الدهانات"
            : "Post-Painting Payment Due",
        installment: "الدهانات",
      };
    }

    // 4. Delivery / Final Handover ("الاستلام")
    if (!paidStages.has("الاستلام")) {
      return {
        stageKey: "received",
        title:
          lang === "ar"
            ? "مطلوب تحصيل دفعة الاستلام النهائي"
            : "Final Delivery Payment Due",
        installment: "الاستلام",
      };
    }

    // 5. If all 4 predefined stages are recorded but remaining balance > 0
    return {
      stageKey: "remaining",
      title:
        lang === "ar"
          ? "مطلوب تحصيل متبقي الحساب"
          : "Remaining Balance Due",
      installment: "الاستلام",
    };
  };

  const getCustomerPaymentBreakdown = (customerId: string): { stage: string; amount: number }[] => {
    const customerPayments = getCustomerPayments(customerId);
    const breakdown: { stage: string; amount: number }[] = paymentStages
      .map((stage) => ({
        stage: stage as string,
        amount: customerPayments
          .filter((payment) => normalizePaymentStage(payment.installment) === stage)
          .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
      }))
      .filter((item) => item.amount > 0);

    // Add any payments that were recorded under other custom labels
    const standardNorms = new Set(paymentStages.map((s) => s as string));
    const extraPayments = customerPayments.filter(
      (p) => !standardNorms.has(normalizePaymentStage(p.installment)),
    );
    if (extraPayments.length > 0) {
      const extraMap = new Map<string, number>();
      for (const p of extraPayments) {
        const key = p.installment || (lang === "ar" ? "أخرى" : "Other");
        extraMap.set(key, (extraMap.get(key) || 0) + (Number(p.amount) || 0));
      }
      for (const [stage, amount] of extraMap.entries()) {
        breakdown.push({ stage, amount });
      }
    }

    return breakdown;
  };

  const totalContractValue = contractedCustomers.reduce(
    (sum, c) => sum + (c.totalAmount || 0),
    0,
  );
  const totalPaidValue = allPayments.reduce((sum, p) => {
    const isForContracted = contractedCustomers.some((c) =>
      p.note?.startsWith(`cc:${c.id}:`),
    );
    return isForContracted ? sum + (Number(p.amount) || 0) : sum;
  }, 0);
  const totalRemainingValue = Math.max(0, totalContractValue - totalPaidValue);

  // Filtered lists
  const filteredContractedCustomers = contractedCustomers.filter(
    (c) =>
      !searchQuery ||
      (c.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || "").includes(searchQuery),
  );

  const filteredAllPayments = allPayments.filter((payment) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const customer = findCustomerForPayment(payment);
    const customerName = (customer?.customerName || payment.note || "").toLowerCase();
    const customerPhone = customer?.phone || "";
    const stage = (payment.installment || "").toLowerCase();
    const amountStr = String(payment.amount);
    return (
      customerName.includes(q) ||
      customerPhone.includes(q) ||
      stage.includes(q) ||
      amountStr.includes(q)
    );
  });

  // Modal open handlers
  const handleOpenAddModal = (customer: Inspection, prefillStage?: string) => {
    setSelectedCustomer(customer);
    setPaymentAmount("");
    const nextDue = getPendingCollectionTrigger(customer)?.installment;
    setPaymentStage(prefillStage || nextDue || paymentStages[0]);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (payment: PaymentRecord, customer?: Inspection) => {
    const targetCust = customer || findCustomerForPayment(payment);
    setEditingPayment(payment);
    setEditCustomer(targetCust || null);
    setEditAmount(payment.amount);
    setEditStage(normalizePaymentStage(payment.installment));
    const dt = payment.paid_at ? new Date(payment.paid_at) : new Date();
    // format as YYYY-MM-DDTHH:mm for datetime-local input
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditDate(localIso);
  };

  const handleOpenDeleteModal = (payment: PaymentRecord, customer?: Inspection) => {
    const targetCust = customer || findCustomerForPayment(payment);
    setDeletingPayment(payment);
    setDeletingCustomer(targetCust || null);
  };

  // Add payment action
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    setIsSaving(true);

    try {
      const customerPayments = getCustomerPayments(selectedCustomer.id);
      const totalPaid = customerPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0,
      );
      const remaining =
        (selectedCustomer.totalAmount || 0) - totalPaid - Number(paymentAmount);

      const newPayment: PaymentRecord = {
        id: crypto.randomUUID(),
        amount: Number(paymentAmount),
        paid_at: new Date().toISOString(),
        installment: paymentStage,
        note: `cc:${selectedCustomer.id}:${selectedCustomer.customerName}`,
      };

      await InvoiceService.insert({
        ...newPayment,
        client_id: null,
        visit_id: null,
        created_at: new Date().toISOString(),
      });

      await fetchPayments();
      if (onRefresh) await onRefresh();

      if (selectedCustomer.phone) {
        // Calculate the next due installment stage in sequence
        const updatedPaidStages = new Set([
          ...customerPayments.map((p) => normalizePaymentStage(p.installment)),
          normalizePaymentStage(paymentStage),
        ]);
        let nextStageName = "";
        if (remaining > 0) {
          if (!updatedPaidStages.has("التعاقد")) nextStageName = "التعاقد";
          else if (!updatedPaidStages.has("النجارة")) nextStageName = "النجارة";
          else if (!updatedPaidStages.has("الدهانات")) nextStageName = "الدهانات";
          else if (!updatedPaidStages.has("الاستلام")) nextStageName = "الاستلام النهائي";
          else nextStageName = "متبقي الحساب";
        }

        const nextDueNote = nextStageName
          ? lang === "ar"
            ? `\nالدفعة القادمة المستحقة: (${nextStageName}).`
            : `\nNext installment due: (${nextStageName}).`
          : "";

        const msg =
          lang === "ar"
            ? `مرحباً ${selectedCustomer.customerName || ""},\nتم استلام دفعة بقيمة ${paymentAmount} جنيه (مرحلة: ${paymentStage}).\nالمتبقي من إجمالي الحساب: ${remaining} جنيه.${nextDueNote}\nشكراً لتعاملكم معنا!`
            : `Hello ${selectedCustomer.customerName || ""},\nA payment of ${paymentAmount} EGP has been received (Stage: ${paymentStage}).\nRemaining balance: ${remaining} EGP.${nextDueNote}\nThank you!`;
        onSendWhatsApp(selectedCustomer.phone, msg);
      }

      toast.success(
        lang === "ar" ? "تم إضافة الدفعة بنجاح" : "Payment added successfully",
      );
      setIsAddModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error saving payment");
    } finally {
      setIsSaving(false);
    }
  };

  // Edit payment action
  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !editAmount) return;
    setIsUpdating(true);

    try {
      const paidDate = editDate ? new Date(editDate).toISOString() : editingPayment.paid_at;
      const updates = {
        amount: Number(editAmount),
        installment: editStage,
        paid_at: paidDate,
      };

      await InvoiceService.update(editingPayment.id, updates);
      await fetchPayments();
      if (onRefresh) await onRefresh();

      toast.success(
        lang === "ar" ? "تم تعديل الدفعة بنجاح" : "Payment updated successfully",
      );
      setEditingPayment(null);
    } catch (err: any) {
      toast.error(err.message || "Error updating payment");
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete payment action
  const handleConfirmDeletePayment = async () => {
    if (!deletingPayment) return;
    setIsDeleting(true);

    try {
      await InvoiceService.delete(deletingPayment.id);
      await fetchPayments();
      if (onRefresh) await onRefresh();

      toast.success(
        lang === "ar" ? "تم حذف الدفعة بنجاح" : "Payment deleted successfully",
      );
      setDeletingPayment(null);
    } catch (err: any) {
      toast.error(err.message || "Error deleting payment");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Summary Stats */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-light">
            {lang === "ar" ? "كشف الحساب وتحصيل الدفعات" : "Statement of Account & Payments"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "مراحل التحصيل الأربعة: (التعاقد، الاستلام، النجارة، الدهانات) مع إمكانية التعديل والحذف"
              : "Four collection stages: (Contract, Intake, Carpentry, Painting) with edit & delete controls"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Search Box */}
          <div className="relative group flex-1 sm:flex-initial">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-zinc-700 transition-colors pointer-events-none z-10" />
            <input
              type="text"
              placeholder={
                viewMode === "customers"
                  ? lang === "ar"
                    ? "بحث بالعميل أو الهاتف..."
                    : "Search customer or phone..."
                  : lang === "ar"
                    ? "بحث في الدفعات أو المراحل..."
                    : "Search payments or stages..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm pr-9 pl-8 py-3 rounded-2xl text-sm font-medium outline-none w-full sm:w-48 sm:focus:w-60 focus:shadow-md focus:border-zinc-300 transition-all duration-300 placeholder:text-zinc-400 text-zinc-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 -translate-y-1/2 left-2 w-4 h-4 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-500 transition-all cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* 1st Card: Actual Paid */}
          <div className="glass px-4 py-3 rounded-2xl min-w-[130px] border-emerald-500/20 bg-emerald-50/30">
            <div className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {lang === "ar" ? "المدفوع فعلياً" : "Actual Paid"}
            </div>
            <div className="text-xl font-bold text-emerald-600 font-mono mt-0.5">
              {totalPaidValue.toLocaleString()} <span className="text-xs font-normal">EGP</span>
            </div>
          </div>

          {/* 2nd Card: Required to Collect */}
          <div className="glass px-4 py-3 rounded-2xl min-w-[130px] border-amber-500/20 bg-amber-50/30">
            <div className="text-[10px] uppercase font-bold text-amber-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {lang === "ar" ? "المطلوب تحصيله" : "To Collect"}
            </div>
            <div className="text-xl font-bold text-amber-600 font-mono mt-0.5">
              {totalRemainingValue.toLocaleString()} <span className="text-xs font-normal">EGP</span>
            </div>
          </div>

          {/* 3rd Card: Total Contract Output */}
          <div className="glass px-4 py-3 rounded-2xl min-w-[140px] border-indigo-500/20 bg-indigo-50/30 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-indigo-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              {lang === "ar" ? "إجمالي التعاقدات" : "Total Contracts"}
            </div>
            <div className="text-xl font-bold text-indigo-700 font-mono mt-0.5">
              {totalContractValue.toLocaleString()} <span className="text-xs font-normal">EGP</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-3">
        <button
          onClick={() => setViewMode("customers")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            viewMode === "customers"
              ? "bg-zinc-900 text-white shadow-md scale-[1.02]"
              : "bg-white/60 text-zinc-600 hover:bg-white border border-white"
          }`}
        >
          <Users className="w-4 h-4" />
          {lang === "ar" ? "حسب كشف حساب العملاء" : "By Customer Accounts"}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">
            {filteredContractedCustomers.length}
          </span>
        </button>

        <button
          onClick={() => setViewMode("all_payments")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            viewMode === "all_payments"
              ? "bg-zinc-900 text-white shadow-md scale-[1.02]"
              : "bg-white/60 text-zinc-600 hover:bg-white border border-white"
          }`}
        >
          <Receipt className="w-4 h-4" />
          {lang === "ar" ? "سجل جميع الدفعات (تعديل وحذف)" : "All Payments Ledger (Edit/Delete)"}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">
            {filteredAllPayments.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {loadingPayments ? (
        <div className="glass rounded-[2rem] py-20 text-center text-zinc-400">
          {lang === "ar" ? "جاري تحميل الدفعات والحسابات..." : "Loading payments..."}
        </div>
      ) : viewMode === "customers" ? (
        filteredContractedCustomers.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block glass rounded-[2.5rem] overflow-hidden p-6 md:p-8 shadow-xl border border-white/40">
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-black/5 text-[10px] font-bold uppercase text-zinc-400 tracking-widest">
                      <th className="px-6 py-4">{lang === "ar" ? "العميل" : "Customer"}</th>
                      <th className="px-6 py-4">{lang === "ar" ? "الهاتف" : "Phone"}</th>
                      <th className="px-6 py-4">{lang === "ar" ? "الإجمالي" : "Total"}</th>
                      <th className="px-6 py-4 text-emerald-600">{lang === "ar" ? "المدفوع" : "Paid"}</th>
                      <th className="px-6 py-4 text-rose-600">{lang === "ar" ? "المتبقي" : "Remaining"}</th>
                      <th className="px-6 py-4">{lang === "ar" ? "المراحل الأربعة وسجل الدفعات" : "Stages & Payments"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContractedCustomers.map((customer) => {
                      const total = customer.totalAmount || 0;
                      const customerPayments = getCustomerPayments(customer.id);
                      const paid = customerPayments.reduce(
                        (sum, p) => sum + (Number(p.amount) || 0),
                        0,
                      );
                      const remaining = total - paid;
                      const pct =
                        total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                      const collectionTrigger = getPendingCollectionTrigger(customer);
                      const breakdown = getCustomerPaymentBreakdown(customer.id);

                      return (
                        <tr
                          key={customer.id}
                          className="border-b border-black/5 hover:bg-black/5 transition-colors"
                        >
                          {/* Customer Name */}
                          <td className="px-6 py-4">
                            <div className="font-bold text-zinc-900">
                              {customer.customerName}
                            </div>
                            {collectionTrigger && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                                💰 {collectionTrigger.title}
                              </span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="px-6 py-4 text-zinc-600 font-mono text-xs">
                            {customer.phone}
                          </td>

                          {/* Total Contract */}
                          <td className="px-6 py-4 font-bold text-zinc-900 whitespace-nowrap">
                            {total.toLocaleString()} EGP
                          </td>

                          {/* Paid */}
                          <td className="px-6 py-4 font-bold text-emerald-600 whitespace-nowrap">
                            {paid.toLocaleString()} EGP
                          </td>

                          {/* Remaining */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`font-bold ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}
                            >
                              {remaining.toLocaleString()} EGP
                            </span>
                            <div className="w-24 h-1.5 bg-zinc-100 rounded-full mt-1">
                              <div
                                className="h-1.5 bg-emerald-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>

                          {/* Stages Breakdown & History Actions */}
                          <td className="px-6 py-4">
                            <div className="space-y-2.5">
                              {/* Breakdown Pills */}
                              <div className="flex flex-wrap gap-2">
                                {breakdown.length > 0 ? (
                                  breakdown.map(({ stage, amount }) => (
                                    <div
                                      key={stage}
                                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs font-semibold shadow-xs ${stageBadgeClass(stage)}`}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${stageColor(stage)}`} />
                                      <span>{stage}:</span>
                                      <span className="font-bold font-mono">{amount.toLocaleString()} ج.م</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-zinc-400">
                                    {lang === "ar" ? "لا توجد دفعات مسجلة بعد" : "No payments yet"}
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons: Add Payment & View History */}
                              <div className="flex items-center gap-2 pt-1">
                                {isAdmin && remaining > 0 && (
                                  <button
                                    onClick={() =>
                                      handleOpenAddModal(
                                        customer,
                                        collectionTrigger?.installment || "التعاقد",
                                      )
                                    }
                                    className="bg-zinc-900 hover:bg-zinc-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    {collectionTrigger
                                      ? lang === "ar"
                                        ? `تحصيل (${collectionTrigger.installment})`
                                        : `Collect (${collectionTrigger.installment})`
                                      : lang === "ar"
                                        ? "إضافة دفعة"
                                        : "Add Payment"}
                                  </button>
                                )}

                                <button
                                  onClick={() => setHistoryCustomer(customer)}
                                  className="bg-white/80 hover:bg-white text-zinc-700 border border-zinc-200/80 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5 text-zinc-500" />
                                  {lang === "ar"
                                    ? `سجل الدفعات (${customerPayments.length})`
                                    : `History (${customerPayments.length})`}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredContractedCustomers.map((customer) => {
                const total = customer.totalAmount || 0;
                const customerPayments = getCustomerPayments(customer.id);
                const paid = customerPayments.reduce(
                  (sum, p) => sum + (Number(p.amount) || 0),
                  0,
                );
                const remaining = total - paid;
                const pct =
                  total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                const collectionTrigger = getPendingCollectionTrigger(customer);
                const breakdown = getCustomerPaymentBreakdown(customer.id);

                return (
                  <div
                    key={customer.id}
                    className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/50 shadow-lg relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-xl font-bold text-zinc-900 mb-0.5">
                          {customer.customerName}
                        </h4>
                        <p className="text-zinc-500 font-mono text-xs">
                          {customer.phone}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                        {pct}%
                      </span>
                    </div>

                    {collectionTrigger && (
                      <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 text-xs font-bold flex items-center gap-1.5">
                        <span>💰</span>
                        <span>{collectionTrigger.title}</span>
                      </div>
                    )}

                    <div className="w-full h-2 bg-zinc-100 rounded-full mb-4">
                      <div
                        className="h-2 bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-zinc-100">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400 font-bold uppercase text-xs">
                          {lang === "ar" ? "الإجمالي" : "Total"}
                        </span>
                        <span className="font-bold text-zinc-900">
                          {total.toLocaleString()} EGP
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400 font-bold uppercase text-xs">
                          {lang === "ar" ? "المدفوع" : "Paid"}
                        </span>
                        <span className="font-bold text-emerald-600">
                          {paid.toLocaleString()} EGP
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400 font-bold uppercase text-xs">
                          {lang === "ar" ? "المتبقي" : "Remaining"}
                        </span>
                        <span
                          className={`font-bold ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {remaining.toLocaleString()} EGP
                        </span>
                      </div>

                      {/* Stages Breakdown */}
                      <div className="pt-2 border-t border-zinc-100">
                        <div className="text-[11px] font-bold uppercase text-zinc-400 mb-2">
                          {lang === "ar" ? "المراحل الأربعة" : "Collection Stages"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {breakdown.length > 0 ? (
                            breakdown.map(({ stage, amount }) => (
                              <div
                                key={stage}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold ${stageBadgeClass(stage)}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${stageColor(stage)}`} />
                                <span>{stage}:</span>
                                <span className="font-bold font-mono">{amount.toLocaleString()} EGP</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400">
                              {lang === "ar" ? "لا توجد دفعات بعد" : "No payments yet"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Actions */}
                      <div className="flex gap-2 pt-3">
                        {isAdmin && remaining > 0 && (
                          <button
                            onClick={() =>
                              handleOpenAddModal(
                                customer,
                                collectionTrigger?.installment || "التعاقد",
                              )
                            }
                            className="flex-1 bg-zinc-900 text-white px-3 py-2.5 rounded-xl text-xs font-bold uppercase transition-all shadow-md flex justify-center items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {collectionTrigger
                              ? lang === "ar"
                                ? `تحصيل (${collectionTrigger.installment})`
                                : `Collect`
                              : lang === "ar"
                                ? "إضافة دفعة"
                                : "Add Payment"}
                          </button>
                        )}
                        <button
                          onClick={() => setHistoryCustomer(customer)}
                          className="bg-white border border-zinc-200 text-zinc-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{customerPayments.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="glass rounded-[2rem] py-20 text-center">
            <CheckCircle2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-400 font-semibold">
              {lang === "ar" ? "لا يوجد عملاء مطابقين للبحث" : "No customers found"}
            </p>
          </div>
        )
      ) : (
        /* View Mode: All Payments Ledger (Direct Edit & Delete) */
        <div className="glass rounded-[2.5rem] overflow-hidden p-6 md:p-8 shadow-xl border border-white/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-800">
                {lang === "ar" ? "سجل جميع الدفعات المسجلة" : "All Payments Ledger"}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {lang === "ar"
                  ? "يمكنك تعديل أي دفعة أو حذفها لإعادة ضبط الحساب فورياً"
                  : "You can edit or delete any payment to correct accounts immediately"}
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-zinc-500 bg-white/70 px-3 py-1.5 rounded-xl border border-white">
              {filteredAllPayments.length} {lang === "ar" ? "دفعة" : "payments"}
            </div>
          </div>

          {filteredAllPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-black/5 text-[10px] font-bold uppercase text-zinc-400 tracking-widest">
                    <th className="px-4 py-3">{lang === "ar" ? "العميل" : "Customer"}</th>
                    <th className="px-4 py-3">{lang === "ar" ? "المرحلة" : "Stage"}</th>
                    <th className="px-4 py-3">{lang === "ar" ? "المبلغ" : "Amount"}</th>
                    <th className="px-4 py-3">{lang === "ar" ? "تاريخ السداد" : "Date"}</th>
                    <th className="px-4 py-3 text-center">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllPayments.map((payment) => {
                    const cust = findCustomerForPayment(payment);
                    const stage = payment.installment || "التعاقد";
                    const formattedDate = payment.paid_at
                      ? new Date(payment.paid_at).toLocaleString("ar-EG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "-";

                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-black/5 hover:bg-black/5 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-zinc-900 text-sm">
                            {cust?.customerName || payment.note?.replace("cc:", "") || (lang === "ar" ? "عميل غير محدد" : "Unknown")}
                          </div>
                          {cust?.phone && (
                            <div className="text-[11px] font-mono text-zinc-500">
                              {cust.phone}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold ${stageBadgeClass(stage)}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${stageColor(stage)}`} />
                            {normalizePaymentStage(stage)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 font-bold font-mono text-emerald-700 text-sm whitespace-nowrap">
                          {payment.amount.toLocaleString()} ج.م
                        </td>

                        <td className="px-4 py-3.5 text-xs text-zinc-500 font-medium whitespace-nowrap">
                          {formattedDate}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditModal(payment, cust)}
                              className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer"
                              title={lang === "ar" ? "تعديل الدفعة" : "Edit Payment"}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteModal(payment, cust)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title={lang === "ar" ? "حذف الدفعة" : "Delete Payment"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 text-sm">
              {lang === "ar" ? "لا توجد دفعات مسجلة مطابقة" : "No payments found"}
            </div>
          )}
        </div>
      )}

      {/* 1. Add Payment Modal */}
      <AnimatePresence>
        {isAddModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#f2eee8] rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-white/50"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-6 left-6 rtl:right-auto rtl:left-6 p-2 bg-white/50 hover:bg-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-zinc-900">
                {lang === "ar" ? "إضافة دفعة جديدة" : "Add New Payment"}
              </h2>

              <div className="mb-4 p-4 bg-white/60 rounded-2xl border border-white/80">
                <p className="font-bold text-zinc-900">{selectedCustomer.customerName}</p>
                <div className="flex justify-between items-center text-xs mt-1 text-zinc-600">
                  <span>{lang === "ar" ? "إجمالي العقد:" : "Total Contract:"}</span>
                  <span className="font-bold font-mono">
                    {(selectedCustomer.totalAmount || 0).toLocaleString()} EGP
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mt-0.5 text-zinc-600">
                  <span>{lang === "ar" ? "المتبقي حالياً:" : "Current Remaining:"}</span>
                  <span className="font-bold font-mono text-rose-600">
                    {(
                      (selectedCustomer.totalAmount || 0) -
                      getCustomerPayments(selectedCustomer.id).reduce(
                        (sum, p) => sum + (Number(p.amount) || 0),
                        0,
                      )
                    ).toLocaleString()}{" "}
                    EGP
                  </span>
                </div>
              </div>

              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "المبلغ (ج.م)" : "Amount (EGP)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                    value={paymentAmount}
                    onChange={(e) =>
                      setPaymentAmount(Number(e.target.value) || "")
                    }
                    className="w-full px-5 py-4 bg-white/80 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-zinc-800 text-lg font-bold font-mono transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "مرحلة التحصيل (من الـ 4 مراحل)" : "Collection Stage"}
                  </label>
                  <select
                    value={paymentStage}
                    onChange={(e) => setPaymentStage(e.target.value)}
                    className="w-full px-5 py-4 bg-white/80 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-zinc-800 font-bold transition-all"
                  >
                    {paymentStages.map((s, idx) => (
                      <option key={s} value={s}>
                        {idx + 1}. {s}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {isSaving
                    ? lang === "ar"
                      ? "جاري حفظ الدفعة..."
                      : "Saving..."
                    : lang === "ar"
                      ? "تأكيد وحفظ الدفعة"
                      : "Confirm & Save"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Customer Payment History Modal (With Edit & Delete Buttons) */}
      <AnimatePresence>
        {historyCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryCustomer(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#f7f5f0] rounded-[2.5rem] p-6 md:p-8 max-w-xl w-full shadow-2xl border border-white/60 max-h-[90vh] flex flex-col"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-zinc-200">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-zinc-700" />
                    <h2 className="text-xl font-bold text-zinc-900">
                      {lang === "ar" ? "سجل دفعات العميل" : "Customer Payment History"}
                    </h2>
                  </div>
                  <p className="font-bold text-zinc-800 mt-1">{historyCustomer.customerName}</p>
                  <p className="text-xs text-zinc-500 font-mono">{historyCustomer.phone}</p>
                </div>
                <button
                  onClick={() => setHistoryCustomer(null)}
                  className="p-2 bg-white/70 hover:bg-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Account Stats Summary */}
              {(() => {
                const total = historyCustomer.totalAmount || 0;
                const custPayments = getCustomerPayments(historyCustomer.id);
                const paid = custPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const remaining = total - paid;
                return (
                  <div className="grid grid-cols-3 gap-2 my-4">
                    <div className="bg-white/80 p-3 rounded-2xl text-center border border-white">
                      <span className="text-[10px] text-zinc-400 font-bold block uppercase">
                        {lang === "ar" ? "الإجمالي" : "Total"}
                      </span>
                      <span className="font-bold font-mono text-zinc-900 text-sm">
                        {total.toLocaleString()} EGP
                      </span>
                    </div>
                    <div className="bg-emerald-50/80 p-3 rounded-2xl text-center border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 font-bold block uppercase">
                        {lang === "ar" ? "المدفوع" : "Paid"}
                      </span>
                      <span className="font-bold font-mono text-emerald-700 text-sm">
                        {paid.toLocaleString()} EGP
                      </span>
                    </div>
                    <div className="bg-rose-50/80 p-3 rounded-2xl text-center border border-rose-100">
                      <span className="text-[10px] text-rose-600 font-bold block uppercase">
                        {lang === "ar" ? "المتبقي" : "Remaining"}
                      </span>
                      <span className="font-bold font-mono text-rose-700 text-sm">
                        {remaining.toLocaleString()} EGP
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Add Payment Button Inside History */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    const cust = historyCustomer;
                    setHistoryCustomer(null);
                    handleOpenAddModal(cust);
                  }}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl text-xs font-bold uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {lang === "ar" ? "إضافة دفعة جديدة لهذا العميل" : "Add Payment for Customer"}
                </button>
              </div>

              {/* Payments List */}
              <div className="overflow-y-auto flex-1 space-y-3 pr-1 pl-1">
                {getCustomerPayments(historyCustomer.id).length > 0 ? (
                  getCustomerPayments(historyCustomer.id).map((payment) => {
                    const stage = payment.installment || "التعاقد";
                    const formattedDate = payment.paid_at
                      ? new Date(payment.paid_at).toLocaleString("ar-EG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "-";

                    return (
                      <div
                        key={payment.id}
                        className="bg-white/90 p-4 rounded-2xl border border-white shadow-xs flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-10 rounded-full ${stageColor(stage)}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base font-mono text-zinc-900">
                                {payment.amount.toLocaleString()} ج.م
                              </span>
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${stageBadgeClass(stage)}`}
                              >
                                {normalizePaymentStage(stage)}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {formattedDate}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(payment, historyCustomer)}
                            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer"
                            title={lang === "ar" ? "تعديل الدفعة" : "Edit Payment"}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(payment, historyCustomer)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title={lang === "ar" ? "حذف الدفعة" : "Delete Payment"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-zinc-400 text-sm">
                    {lang === "ar" ? "لا توجد دفعات مسجلة لهذا العميل بعد" : "No payments recorded yet"}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Edit Payment Modal */}
      <AnimatePresence>
        {editingPayment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPayment(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#f2eee8] rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-white/60"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setEditingPayment(null)}
                className="absolute top-6 left-6 rtl:right-auto rtl:left-6 p-2 bg-white/50 hover:bg-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
              <h2 className="text-2xl font-bold mb-2 text-zinc-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                {lang === "ar" ? "تعديل بيانات الدفعة" : "Edit Payment"}
              </h2>
              {editCustomer && (
                <p className="text-sm text-zinc-500 mb-6">
                  {editCustomer.customerName} - {editCustomer.phone}
                </p>
              )}

              <form onSubmit={handleSaveEditPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "المبلغ (ج.م)" : "Amount (EGP)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value) || "")}
                    className="w-full px-5 py-4 bg-white/90 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-zinc-800 text-lg font-bold font-mono transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "المرحلة" : "Stage"}
                  </label>
                  <select
                    value={editStage}
                    onChange={(e) => setEditStage(e.target.value)}
                    className="w-full px-5 py-4 bg-white/90 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-zinc-800 font-bold transition-all"
                  >
                    {paymentStages.map((s, idx) => (
                      <option key={s} value={s}>
                        {idx + 1}. {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2 px-1">
                    {lang === "ar" ? "تاريخ ووقت السداد" : "Payment Date & Time"}
                  </label>
                  <input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-5 py-4 bg-white/90 border border-white rounded-2xl outline-none focus:ring-2 focus:ring-zinc-800 font-mono text-sm transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPayment(null)}
                    className="flex-1 py-4 bg-white hover:bg-zinc-100 text-zinc-700 rounded-2xl font-bold uppercase text-xs transition-all border border-zinc-200 cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-bold uppercase text-xs tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isUpdating
                      ? lang === "ar"
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : lang === "ar"
                        ? "حفظ التعديلات"
                        : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingPayment && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingPayment(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-rose-100 text-center"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">
                {lang === "ar" ? "تأكيد حذف الدفعة" : "Confirm Payment Deletion"}
              </h3>
              <div className="text-sm text-zinc-500 mb-6 leading-relaxed">
                {lang === "ar" ? (
                  <>
                    هل أنت متأكد من رغبتك في حذف دفعة بقيمة{" "}
                    <span className="font-bold text-rose-600 font-mono">
                      {deletingPayment.amount.toLocaleString()} ج.م
                    </span>{" "}
                    (مرحلة: {normalizePaymentStage(deletingPayment.installment)})
                    {deletingCustomer ? ` للعميل ${deletingCustomer.customerName}` : ""}؟
                    <br />
                    سيتم إعادة احتساب الرصيد المتبقي تلقائياً.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete payment of{" "}
                    <span className="font-bold text-rose-600">
                      {deletingPayment.amount.toLocaleString()} EGP
                    </span>
                    ? The remaining balance will be recalculated automatically.
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingPayment(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl font-bold text-xs transition-all cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء التراجع" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePayment}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting
                    ? lang === "ar"
                      ? "جاري الحذف..."
                      : "Deleting..."
                    : lang === "ar"
                      ? "نعم، احذف الدفعة"
                      : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};