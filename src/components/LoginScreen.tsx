import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Armchair, ChevronRight, Eye, EyeOff, Key, Phone, Users } from "lucide-react";

interface LoginScreenProps {
  isAuthorizedButWrongAccount: boolean;
  lang: "en" | "ar";
  t: Record<string, string>;
  username: string;
  password: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void; // Employee Login
  onLogout: () => void;
  // Customer Login Props
  customerPhone: string;
  onCustomerPhoneChange: (v: string) => void;
  onCustomerSubmit: (e: React.FormEvent) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  isAuthorizedButWrongAccount,
  lang,
  t,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  isLoading,
  onSubmit,
  onLogout,
  customerPhone,
  onCustomerPhoneChange,
  onCustomerSubmit,
}) => {
  const isAr = lang === "ar";
  const [activeTab, setActiveTab] = useState<"employee" | "customer">("employee");

  if (isAuthorizedButWrongAccount) {
    return (
      <motion.div
        key="unauthorized"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="glass rounded-[2.5rem] p-12 shadow-2xl text-center border border-white/40">
          <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" />
          <h2 className="heading-accent text-4xl md:text-5xl font-light mb-4 text-zinc-950">
            {isAr ? "لا تملك صلاحية الدخول" : "Access not authorized"}
          </h2>
          <p className="text-zinc-500 text-base md:text-lg mb-8">
            {isAr
              ? "تم تسجيل الدخول ولكن هذا الحساب غير مصرح له باستخدام لوحة التحكم."
              : "You are signed in, but this account is not authorized to access the admin portal."}
          </p>
          <button
            onClick={onLogout}
            className="bg-zinc-900 text-white py-4 px-8 rounded-3xl font-bold uppercase tracking-widest btn-3d btn-3d-zinc cursor-pointer"
          >
            {isAr ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8" dir={isAr ? "rtl" : "ltr"}>
      {/* Title */}
      <div className="text-center mb-10">
        <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-4" />
        <h2 className="heading-accent text-4xl md:text-5xl font-light text-zinc-950">
          {t.welcome}
        </h2>
        <p className="text-zinc-500 text-base md:text-lg mt-2 max-w-2xl mx-auto">
          {isAr 
            ? "بوابة العمري للأثاث لمتابعة الإنتاج والتعاقدات" 
            : "El3mmary Furniture production & contract portal"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-200/50 p-1.5 rounded-3xl mb-8 max-w-md mx-auto border border-white/30 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setActiveTab("employee")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase transition-all duration-300 cursor-pointer ${
            activeTab === "employee"
              ? "bg-zinc-900 text-white shadow-lg scale-[1.02]"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <Users className="w-4 h-4" />
          {isAr ? "دخول الموظفين" : "Employee Login"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("customer")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase transition-all duration-300 cursor-pointer ${
            activeTab === "customer"
              ? "bg-zinc-900 text-white shadow-lg scale-[1.02]"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <Phone className="w-4 h-4" />
          {isAr ? "دخول العملاء" : "Customer Portal"}
        </button>
      </div>

      {/* Login Panels */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-[2.5rem] p-10 md:p-12 shadow-2xl login-panel border border-white/40"
      >
        <AnimatePresence mode="wait">
          {activeTab === "employee" ? (
            <motion.form
              key="employee-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={onSubmit}
              className="space-y-6"
            >
              {/* Username Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em] block">
                  {isAr ? "اسم المستخدم" : "Username"}
                </label>
                <div className="relative">
                  <Users className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 pointer-events-none" />
                  <input
                    required
                    type="text"
                    className="w-full ltr:pl-12 rtl:pr-12 pe-5 py-4 text-base md:text-lg bg-white/60 border border-black/10 rounded-2xl shadow-sm outline-none focus:border-zinc-500 focus:bg-white transition-all text-zinc-800"
                    placeholder={isAr ? "أدخل اسم المستخدم" : "Enter username"}
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value.replace(/\s+/g, ""))}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em] block">
                  {t.passphrase}
                </label>
                <div className="relative">
                  <Key className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 pointer-events-none" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    className="w-full ltr:pl-12 rtl:pr-12 ltr:pr-12 rtl:pl-12 py-4 text-base md:text-lg bg-white/60 border border-black/10 rounded-2xl shadow-sm outline-none focus:border-zinc-500 focus:bg-white transition-all text-zinc-800"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={onToggleShowPassword}
                    className="absolute ltr:right-4 rtl:left-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                disabled={isLoading}
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-5 rounded-2xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-base btn-3d btn-3d-zinc cursor-pointer active:scale-95 transition-all mt-4"
              >
                {isLoading ? t.authenticating : t.adminAccess}
                <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${isAr ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="customer-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={onCustomerSubmit}
              className="space-y-6"
            >
              {/* Phone Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em] block">
                  {isAr ? "رقم الهاتف المسجل بالتعاقد" : "Registered Phone Number"}
                </label>
                <div className="relative">
                  <Phone className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 pointer-events-none" />
                  <input
                    required
                    type="tel"
                    className="w-full ltr:pl-12 rtl:pr-12 pe-5 py-4 text-base md:text-lg bg-white/60 border border-black/10 rounded-2xl shadow-sm outline-none focus:border-zinc-500 focus:bg-white transition-all text-zinc-800 text-center font-mono"
                    placeholder="01xxxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => onCustomerPhoneChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-amber-50 text-amber-800 border border-amber-100 p-4 rounded-xl text-xs leading-relaxed">
                {isAr
                  ? "ملاحظة: يمكنك الوصول لبوابة العملاء وعرض عقدك ومراحل إنتاج طلبك فوراً باستخدام رقم هاتفك المسجل لدينا في العقد."
                  : "Note: You can access the customer portal to view your contract and live production progress using the phone number registered in your contract."}
              </div>

              {/* Submit */}
              <button
                disabled={isLoading}
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-5 rounded-2xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-base btn-3d btn-3d-zinc cursor-pointer active:scale-95 transition-all mt-4"
              >
                {isLoading ? (isAr ? "جاري التحقق..." : "Verifying...") : (isAr ? "دخول البوابة" : "Access Portal")}
                <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${isAr ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};