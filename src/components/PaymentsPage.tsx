// Payments / statement-of-account page for contracted customers.
// Extracted from App.tsx.
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Plus, Search, X } from "lucide-react";
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
export const PaymentsPage: React.FC<{
  contractedCustomers: Inspection[];
  lang: "en" | "ar";
  isAdmin: boolean;
  t: Record<string, string>;
  onRefresh: () => Promise<void>;
  onSendWhatsApp: (phone: string, msg: string) => void;
}> = ({ contractedCustomers, lang, isAdmin, t, onRefresh, onSendWhatsApp }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Inspection | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentStage, setPaymentStage] = useState<string>("عند التعاقد");
  const [isSaving, setIsSaving] = useState(false);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const stages = [
    "عند التعاقد",
    "عند انتهاء النجارة واختيار اللون",
    "قبل الاستلام بـ 48 ساعة",
    "عند استلام الغرفة",
  ];

  const getCustomerPaymentBreakdown = (customerId: string) =>
    stages
      .map((stage) => ({
        stage,
        amount: getCustomerPayments(customerId)
          .filter((payment) => payment.installment === stage)
          .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
      }))
      .filter((item) => item.amount > 0);

  const stageColor = (stage: string) => {
    if (stage.includes("التعاقد")) return "bg-amber-400";
    if (stage.includes("النجارة")) return "bg-indigo-500";
    if (stage.includes("48")) return "bg-rose-500";
    if (stage.includes("استلام")) return "bg-emerald-500";
    return "bg-zinc-400";
  };

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

  const handleOpenModal = (customer: Inspection) => {
    setSelectedCustomer(customer);
    setPaymentAmount("");
    setPaymentStage(stages[0]);
    setIsModalOpen(true);
  };

  const filteredContractedCustomers = contractedCustomers.filter(
    (c) =>
      !searchQuery ||
      (c.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || "").includes(searchQuery),
  );

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

      const newPayment = {
        id: crypto.randomUUID(),
        client_id: null,
        visit_id: null,
        amount: Number(paymentAmount),
        paid_at: new Date().toISOString(),
        installment: paymentStage,
        note: `cc:${selectedCustomer.id}:${selectedCustomer.customerName}`,
        created_at: new Date().toISOString(),
      };
      // Optimistic UI: save locally & queue sync
      await InvoiceService.insert(newPayment);
      await fetchPayments();

      if (selectedCustomer.phone) {
        const msg =
          lang === "ar"
            ? `مرحباً ${selectedCustomer.customerName || ""},\nتم استلام دفعة بقيمة ${paymentAmount} جنيه (مرحلة: ${paymentStage}).\nالمتبقي من إجمالي الحساب: ${remaining} جنيه.\nشكراً لك!`
            : `Hello ${selectedCustomer.customerName || ""},\nA payment of ${paymentAmount} EGP has been received (Stage: ${paymentStage}).\nRemaining balance: ${remaining} EGP.\nThank you!`;
        onSendWhatsApp(selectedCustomer.phone, msg);
      }

      toast.success(
        lang === "ar" ? "تم إضافة الدفعة بنجاح" : "Payment added successfully",
      );
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error saving payment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-light">
            {lang === "ar" ? "كشف الحساب" : "Statement of Account"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "تابع حالة المدفوعات للعملاء المتعاقدين"
              : "Track payment status for contracted customers"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
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
          <div className="glass px-4 py-3 rounded-2xl min-w-[120px]">
            <div className="text-[10px] uppercase font-bold text-zinc-400">
              {lang === "ar" ? "إجمالي العقود" : "Total Contracts"}
            </div>
            <div className="text-2xl font-semibold">
              {totalContractValue.toLocaleString()}
            </div>
          </div>
          <div className="glass px-4 py-3 rounded-2xl min-w-[120px]">
            <div className="text-[10px] uppercase font-bold text-emerald-500">
              {lang === "ar" ? "إجمالي المحصل" : "Total Paid"}
            </div>
            <div className="text-2xl font-semibold text-emerald-600">
              {totalPaidValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {loadingPayments ? (
        <div className="glass rounded-[2rem] py-20 text-center text-zinc-400">
          {lang === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : filteredContractedCustomers.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block glass rounded-[2.5rem] overflow-hidden p-6 md:p-10 shadow-xl border border-white/40">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-black/5 text-[10px] font-bold uppercase text-zinc-400 tracking-widest">
                    <th className="px-6 py-4">
                      {lang === "ar" ? "العميل" : "Customer"}
                    </th>
                    <th className="px-6 py-4">
                      {lang === "ar" ? "الهاتف" : "Phone"}
                    </th>
                    <th className="px-6 py-4">
                      {lang === "ar" ? "الإجمالي" : "Total"}
                    </th>
                    <th className="px-6 py-4 text-emerald-600">
                      {lang === "ar" ? "المدفوع" : "Paid"}
                    </th>
                    <th className="px-6 py-4 text-rose-600">
                      {lang === "ar" ? "المتبقي" : "Remaining"}
                    </th>
                    <th className="px-6 py-4">
                      {lang === "ar" ? "إجراءات" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContractedCustomers.map((customer) => {
                    const total = customer.totalAmount || 0;
                    const paid = getCustomerPayments(customer.id).reduce(
                      (sum, p) => sum + (Number(p.amount) || 0),
                      0,
                    );
                    const remaining = total - paid;
                    const pct =
                      total > 0
                        ? Math.min(100, Math.round((paid / total) * 100))
                        : 0;
                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-black/5 hover:bg-black/5 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-zinc-900">
                          {customer.customerName}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 font-mono">
                          {customer.phone}
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-900">
                          {total.toLocaleString()} EGP
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">
                          {paid.toLocaleString()} EGP
                        </td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold uppercase text-zinc-400">
                              {lang === "ar"
                                ? "الدفعات حسب المرحلة"
                                : "Payments by stage"}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {getCustomerPaymentBreakdown(customer.id).length >
                              0 ? (
                                getCustomerPaymentBreakdown(customer.id).map(
                                  ({ stage, amount }) => (
                                    <div
                                      key={stage}
                                      className={`flex items-center gap-3 bg-white/60 border p-2 rounded-xl shadow-sm min-w-[160px] ${lang === "ar" ? "flex-row-reverse" : ""}`}
                                    >
                                      <div
                                        className={`w-1.5 h-8 rounded-full ${stageColor(stage)}`}
                                      />
                                      <div className="flex flex-col leading-tight">
                                        <span className="text-[11px] font-semibold text-zinc-700">
                                          {stage}
                                        </span>
                                        <span className="text-sm font-bold text-zinc-900">
                                          {amount.toLocaleString()} EGP
                                        </span>
                                      </div>
                                    </div>
                                  ),
                                )
                              ) : (
                                <span className="text-[11px] text-zinc-400">
                                  {lang === "ar"
                                    ? "لا توجد دفعات بعد"
                                    : "No payments yet"}
                                </span>
                              )}
                            </div>
                          </div>
                          {isAdmin && remaining > 0 && (
                            <button
                              onClick={() => handleOpenModal(customer)}
                              className="mt-3 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              {lang === "ar" ? "إضافة دفعة" : "Add Payment"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredContractedCustomers.map((customer) => {
              const total = customer.totalAmount || 0;
              const paid = getCustomerPayments(customer.id).reduce(
                (sum, p) => sum + (Number(p.amount) || 0),
                0,
              );
              const remaining = total - paid;
              const pct =
                total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
              return (
                <div
                  key={customer.id}
                  className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/50 shadow-lg relative overflow-hidden group card-accent"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-zinc-900 mb-1">
                        {customer.customerName}
                      </h4>
                      <p className="text-zinc-500 font-mono text-sm">
                        {customer.phone}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full mb-4">
                    <div
                      className="h-2 bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="space-y-3 pt-4 border-t border-zinc-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                        {lang === "ar" ? "الإجمالي" : "Total"}
                      </span>
                      <span className="text-lg font-bold text-zinc-900">
                        {total.toLocaleString()} EGP
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                        {lang === "ar" ? "المدفوع" : "Paid"}
                      </span>
                      <span className="text-md font-bold text-emerald-600">
                        {paid.toLocaleString()} EGP
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                        {lang === "ar" ? "المتبقي" : "Remaining"}
                      </span>
                      <span
                        className={`text-md font-bold ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}
                      >
                        {remaining.toLocaleString()} EGP
                      </span>
                    </div>
                    <div className="pt-3 border-t border-zinc-100 mt-3">
                      <div className="text-[11px] font-bold uppercase text-zinc-400 mb-2">
                        {lang === "ar"
                          ? "الدفعات حسب المرحلة"
                          : "Payments by stage"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getCustomerPaymentBreakdown(customer.id).length > 0 ? (
                          getCustomerPaymentBreakdown(customer.id).map(
                            ({ stage, amount }) => (
                              <div
                                key={stage}
                                className={`flex items-center gap-3 bg-white/60 border p-2 rounded-xl shadow-sm min-w-[140px] ${lang === "ar" ? "flex-row-reverse" : ""}`}
                              >
                                <div
                                  className={`w-1.5 h-8 rounded-full ${stageColor(stage)}`}
                                />
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[11px] font-semibold text-zinc-700">
                                    {stage}
                                  </span>
                                  <span className="text-sm font-bold text-zinc-900">
                                    {amount.toLocaleString()} EGP
                                  </span>
                                </div>
                              </div>
                            ),
                          )
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            {lang === "ar"
                              ? "لا توجد دفعات بعد"
                              : "No payments yet"}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && remaining > 0 && (
                      <div className="pt-3">
                        <button
                          onClick={() => handleOpenModal(customer)}
                          className="w-full bg-zinc-900 text-white px-4 py-3 rounded-2xl text-xs font-bold uppercase transition-all shadow-md flex justify-center items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          {lang === "ar" ? "إضافة دفعة" : "Add Payment"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="glass rounded-[2rem] py-20 text-center">
          <CheckCircle2 className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-400 font-semibold">
            {lang === "ar" ? "لا توجد مدفوعات مسجلة" : "No payments recorded"}
          </p>
        </div>
      )}

      {/* Add Payment Modal */}
      <AnimatePresence>
        {isModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
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
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto p-2 bg-white/50 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-zinc-900">
                {lang === "ar" ? "إضافة دفعة جديدة" : "Add New Payment"}
              </h2>
              <div className="mb-6 p-4 bg-white/50 rounded-2xl">
                <p className="font-bold">{selectedCustomer.customerName}</p>
                <p className="text-sm text-zinc-500">
                  {lang === "ar" ? "المتبقي:" : "Remaining:"}{" "}
                  {(
                    (selectedCustomer.totalAmount || 0) -
                    getCustomerPayments(selectedCustomer.id).reduce(
                      (sum, p) => sum + (Number(p.amount) || 0),
                      0,
                    )
                  ).toLocaleString()}{" "}
                  EGP
                </p>
              </div>
              <div className="mb-4 rounded-2xl bg-white/60 p-4">
                <p className="text-[11px] font-bold uppercase text-zinc-500 mb-2">
                  {lang === "ar"
                    ? "الدفعات الحالية حسب المرحلة"
                    : "Current payments by stage"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {getCustomerPaymentBreakdown(selectedCustomer.id).length >
                  0 ? (
                    getCustomerPaymentBreakdown(selectedCustomer.id).map(
                      ({ stage, amount }) => (
                        <div
                          key={stage}
                          className={`flex items-center gap-3 bg-white/60 border p-2 rounded-xl shadow-sm min-w-[160px] ${lang === "ar" ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`w-1.5 h-8 rounded-full ${stageColor(stage)}`}
                          />
                          <div className="flex flex-col leading-tight">
                            <span className="text-[11px] font-semibold text-zinc-700">
                              {stage}
                            </span>
                            <span className="text-sm font-bold text-zinc-900">
                              {amount.toLocaleString()} EGP
                            </span>
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <span className="text-sm text-zinc-500">
                      {lang === "ar"
                        ? "لا توجد دفعات مسجلة بعد"
                        : "No payments recorded yet"}
                    </span>
                  )}
                </div>
              </div>
              <form onSubmit={handleAddPayment} className="space-y-4">
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
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50 mt-4"
                >
                  {isSaving
                    ? lang === "ar"
                      ? "جاري الحفظ..."
                      : "Saving..."
                    : lang === "ar"
                      ? "تأكيد وحفظ"
                      : "Confirm & Save"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};