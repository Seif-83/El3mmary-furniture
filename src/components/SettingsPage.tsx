import React, { useState, useEffect } from "react";
import { Activity, Languages, Users, MessageCircle, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { SyncManager } from "../services/sync";
import { db } from "../services/db";
import { WhatsAppGatewayService } from "../services/whatsappGateway";

export const SettingsPage: React.FC<{
  lang: "en" | "ar";
  setLang: (v: "en" | "ar") => void;
  isAdmin: boolean;
  t: Record<string, string>;
  settings: Record<string, string>;
  currentUserEmail?: string;
  onSyncTrigger?: () => Promise<void>;
  userProfile?: { username: string; role: string; email: string } | null;
}> = ({
  lang,
  setLang,
  isAdmin,
  t,
  settings,
  currentUserEmail,
  onSyncTrigger,
  userProfile,
}) => {
  const [saving, setSaving] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [waConfig, setWaConfig] = useState(() => WhatsAppGatewayService.getConfig());
  const [testingWa, setTestingWa] = useState(false);
  const [waTestResult, setWaTestResult] = useState<{ ok: boolean; message: string; status?: string } | null>(null);

  const handleTestWa = async () => {
    setTestingWa(true);
    setWaTestResult(null);
    WhatsAppGatewayService.saveConfig(waConfig);
    const res = await WhatsAppGatewayService.testConnection();
    setWaTestResult({
      ok: res.ok,
      message: res.message || (res.ok ? "الاتصال ناجح" : "فشل الاتصال"),
      status: res.status,
    });
    setTestingWa(false);
  };

  const handleSaveWaConfig = () => {
    WhatsAppGatewayService.saveConfig(waConfig);
    toast.success(
      lang === "ar"
        ? "تم حفظ إعدادات خادم واتساب (OpenWA) بنجاح"
        : "WhatsApp gateway settings saved",
    );
  };

  const checkQueueCount = async () => {
    try {
      const count = await db.sync_queue.count();
      setQueueCount(count);
    } catch (err) {
      console.error("Failed to count sync queue", err);
    }
  };

  useEffect(() => {
    checkQueueCount();
    const interval = setInterval(checkQueueCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      if (onSyncTrigger) {
        await onSyncTrigger();
      } else {
        await SyncManager.triggerSync();
      }
      await checkQueueCount();
      toast.success(
        lang === "ar"
          ? "تمت المزامنة وتحديث البيانات"
          : "Data synchronized successfully",
      );
    } catch (err: any) {
      toast.error(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw error;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-light">
            {lang === "ar" ? "الإعدادات" : "Settings"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "إعدادات النظام والتطبيق"
              : "System and application settings"}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Language */}
        <div className="w-full glass rounded-[3rem] p-10 md:p-14 shadow-2xl border border-white/40">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent-tan/10 flex items-center justify-center">
              <Languages className="w-8 h-8 text-accent-tan" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-zinc-900">
                {lang === "ar" ? "اللغة" : "Language"}
              </h3>
              <p className="text-base text-zinc-500">
                {lang === "ar" ? "لغة واجهة التطبيق" : "Interface language"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setLang("ar")}
              className={`flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg transition-all ${lang === "ar" ? "bg-zinc-900 text-white shadow-lg scale-[1.02]" : "bg-white border-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300"}`}
            >
              العربية
            </button>
            <button
              onClick={() => setLang("en")}
              className={`flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg transition-all ${lang === "en" ? "bg-zinc-900 text-white shadow-lg scale-[1.02]" : "bg-white border-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300"}`}
            >
              English
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="w-full glass rounded-[3rem] p-10 md:p-14 shadow-2xl border border-white/40">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent-sage/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-accent-sage" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-zinc-900">
                {lang === "ar" ? "الحساب" : "Account"}
              </h3>
              <p className="text-base text-zinc-500">
                {lang === "ar" ? "معلومات حسابك" : "Your account info"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/60 p-6 rounded-2xl border border-white/60">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {lang === "ar" ? "اسم المستخدم" : "Username"}
              </div>
              <div className="text-lg font-bold text-zinc-900 truncate">
                {userProfile?.username || currentUserEmail ||
                  (lang === "ar" ? "غير مسجل" : "Not signed in")}
              </div>
            </div>
            <div className="bg-white/60 p-6 rounded-2xl border border-white/60">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {lang === "ar" ? "نوع الحساب / الدور" : "Role"}
              </div>
              <div
                className={`text-lg font-bold ${isAdmin || userProfile?.role === "super_admin" ? "text-amber-600" : "text-zinc-900"}`}
              >
                {userProfile ? (
                  userProfile.role === "super_admin"
                    ? (lang === "ar" ? "مسؤول خارق" : "Super Admin")
                    : userProfile.role === "contract_admin"
                    ? (lang === "ar" ? "مسؤول تعاقدات" : "Contract Admin")
                    : userProfile.role === "production_alexandria"
                    ? (lang === "ar" ? "إنتاج الإسكندرية" : "Alex Alexandria")
                    : userProfile.role === "production_cairo"
                    ? (lang === "ar" ? "إنتاج القاهرة" : "Cairo Production")
                    : (lang === "ar" ? "مشاهد عام" : "General Moderator")
                ) : isAdmin
                  ? (lang === "ar" ? "مسؤول" : "Admin")
                  : (lang === "ar" ? "مشاهد" : "Viewer")}
              </div>
            </div>
            <div className="bg-white/60 p-6 rounded-2xl border border-white/60">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {lang === "ar" ? "الحالة" : "Status"}
              </div>
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-bold">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {lang === "ar" ? "نشط" : "Active"}
              </div>
            </div>
          </div>
        </div>

        {/* Sync & Diagnostics */}
        <div className="w-full glass rounded-[3rem] p-10 md:p-14 shadow-2xl border border-white/40">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Activity className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-zinc-900">
                {lang === "ar" ? "مزامنة البيانات" : "Data Sync"}
              </h3>
              <p className="text-base text-zinc-500">
                {lang === "ar"
                  ? "حالة الاتصال والعمليات المعلقة في الخلفية"
                  : "Connection status and pending background operations"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-white/60 p-6 rounded-2xl border border-white/60">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {lang === "ar" ? "حالة قاعدة البيانات" : "Database Connection"}
              </div>
              <div
                className={`text-lg font-bold ${SUPABASE_CONFIGURED ? "text-emerald-600" : "text-amber-600"}`}
              >
                {SUPABASE_CONFIGURED
                  ? lang === "ar"
                    ? "سحابية متصلة"
                    : "Cloud Connected"
                  : lang === "ar"
                    ? "محلية فقط (غير متصل)"
                    : "Local only (Not connected)"}
              </div>
            </div>
            <div className="bg-white/60 p-6 rounded-2xl border border-white/60">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {lang === "ar"
                  ? "العمليات المعلقة في الخلفية"
                  : "Pending Operations"}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-zinc-900">
                  {queueCount}
                </span>
                {queueCount > 0 ? (
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    {lang === "ar" ? "جاري الرفع" : "Syncing..."}
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                    {lang === "ar" ? "مكتمل" : "Synced"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Gateway (OpenWA) Settings */}
        <div className="w-full glass rounded-[3rem] p-10 md:p-14 shadow-2xl border border-white/40">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-zinc-900">
                {lang === "ar" ? "خادم واتساب التلقائي (OpenWA)" : "WhatsApp Gateway (OpenWA)"}
              </h3>
              <p className="text-base text-zinc-500">
                {lang === "ar"
                  ? "إرسال إشعارات ومراحل التصنيع تلقائياً إلى هواتف العملاء من رقم مفروشات العماري"
                  : "Send production notifications automatically to customer phones via El-Ammari number"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Server URL */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 px-1 block">
                  {lang === "ar" ? "عنوان خادم OpenWA (Server URL)" : "OpenWA Server URL"}
                </label>
                <input
                  type="url"
                  value={waConfig.apiUrl}
                  onChange={(e) => setWaConfig({ ...waConfig, apiUrl: e.target.value })}
                  placeholder="http://localhost:2785"
                  className="w-full px-5 py-3.5 bg-white/80 border border-black/10 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-zinc-400 px-1">
                  {lang === "ar"
                    ? "الرابط المحلي أو عنوان السيرفر الذي يعمل عليه OpenWA (افتراضياً: http://localhost:2785)"
                    : "Default local address is http://localhost:2785"}
                </p>
              </div>

              {/* Session ID */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 px-1 block">
                  {lang === "ar" ? "اسم الجلسة (Session ID)" : "Session ID"}
                </label>
                <input
                  type="text"
                  value={waConfig.sessionId}
                  onChange={(e) => setWaConfig({ ...waConfig, sessionId: e.target.value })}
                  placeholder="default"
                  className="w-full px-5 py-3.5 bg-white/80 border border-black/10 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-zinc-400 px-1">
                  {lang === "ar"
                    ? "اسم الجلسة المسجلة برقم هاتف العماري في خادم OpenWA (افتراضياً: default)"
                    : "The session name connected in OpenWA (default: default)"}
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 px-1 block">
                  {lang === "ar" ? "مفتاح الـ API (API Key - اختياري)" : "API Key (Optional)"}
                </label>
                <input
                  type="password"
                  value={waConfig.apiKey}
                  onChange={(e) => setWaConfig({ ...waConfig, apiKey: e.target.value })}
                  placeholder="X-API-Key"
                  className="w-full px-5 py-3.5 bg-white/80 border border-black/10 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Toggle Enable */}
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="wa-enabled"
                  checked={waConfig.enabled}
                  onChange={(e) => setWaConfig({ ...waConfig, enabled: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="wa-enabled" className="text-sm font-bold text-zinc-800 cursor-pointer">
                  {lang === "ar" ? "تفعيل الإرسال التلقائي عبر خادم OpenWA" : "Enable automated dispatch via OpenWA"}
                </label>
              </div>
            </div>

            {/* Test Result Box */}
            {waTestResult && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  waTestResult.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {waTestResult.ok ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div className="text-sm">
                  <p className="font-bold">{waTestResult.message}</p>
                  {waTestResult.status && (
                    <p className="text-xs opacity-75 font-mono mt-0.5">
                      Session Status: {waTestResult.status}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                disabled={testingWa}
                onClick={handleTestWa}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${testingWa ? "animate-spin" : ""}`} />
                <span>{lang === "ar" ? (testingWa ? "جاري الفحص..." : "فحص الاتصال بالخادم") : (testingWa ? "Testing..." : "Test Connection")}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveWaConfig}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{lang === "ar" ? "حفظ الإعدادات" : "Save Settings"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};