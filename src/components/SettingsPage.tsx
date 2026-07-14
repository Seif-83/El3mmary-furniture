// Settings page (sync status, language, admin tools). Extracted from App.tsx.
import React, { useState, useEffect } from "react";
import { Activity, Languages, Users } from "lucide-react";
import toast from "react-hot-toast";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { SyncManager } from "../services/sync";
import { db } from "../services/db";

export const SettingsPage: React.FC<{
  lang: "en" | "ar";
  setLang: (v: "en" | "ar") => void;
  isAdmin: boolean;
  t: Record<string, string>;
  settings: Record<string, string>;
  currentUserEmail?: string;
  onSyncTrigger?: () => Promise<void>;
}> = ({
  lang,
  setLang,
  isAdmin,
  t,
  settings,
  currentUserEmail,
  onSyncTrigger,
}) => {
  const [saving, setSaving] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

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
                {lang === "ar" ? "البريد الإلكتروني" : "Email"}
              </div>
              <div className="text-lg font-bold text-zinc-900 truncate">
                {currentUserEmail ||
                  (lang === "ar" ? "غير مسجل" : "Not signed in")}
              </div>
            </div>
            <div className="bg-white/60 p-6 rounded-2xl border border-white/60">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {lang === "ar" ? "نوع الحساب" : "Role"}
              </div>
              <div
                className={`text-lg font-bold ${isAdmin ? "text-amber-600" : "text-zinc-900"}`}
              >
                {isAdmin
                  ? lang === "ar"
                    ? "مسؤول"
                    : "Admin"
                  : lang === "ar"
                    ? "مشاهد"
                    : "Viewer"}
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
      </div>
    </div>
  );
};