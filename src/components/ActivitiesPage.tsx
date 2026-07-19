// Activity log page (admin audit trail). Extracted from App.tsx.
import React, { useState, useEffect } from "react";
import { Activity, MessageCircle, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

const ACTIVITY_LABELS: Record<string, { ar: string; en: string }> = {
  login: { ar: "تسجيل دخول", en: "Login" },
  logout: { ar: "تسجيل خروج", en: "Logout" },
  delete: { ar: "حذف", en: "Delete" },
  delete_sheet: { ar: "حذف ملف", en: "Delete Sheet" },
  contract: { ar: "تعاقد", en: "Contract" },
  refuse: { ar: "رفض", en: "Refuse" },
  create_inspection: { ar: "معاينة جديدة", en: "New Inspection" },
  move_to_inspection: { ar: "نقل لمعاينة", en: "Move to Inspection" },
  update_inspection: { ar: "تحديث معاينة", en: "Update Inspection" },
  update_contract: { ar: "تحديث تعاقد", en: "Update Contract" },
  upload_sheet: { ar: "نشر ملف", en: "Upload Sheet" },
  edit_sheet: { ar: "تعديل ملف", en: "Edit Sheet" },
  status_change: { ar: "تغيير حالة", en: "Status Change" },
};

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  login: { icon: "🔑", color: "text-blue-600 bg-blue-100" },
  logout: { icon: "🚪", color: "text-zinc-600 bg-zinc-100" },
  delete: { icon: "🗑️", color: "text-red-600 bg-red-100" },
  delete_sheet: { icon: "📄", color: "text-red-600 bg-red-100" },
  contract: { icon: "✓", color: "text-emerald-600 bg-emerald-100" },
  refuse: { icon: "✗", color: "text-rose-600 bg-rose-100" },
  create_inspection: { icon: "📋", color: "text-amber-600 bg-amber-100" },
  move_to_inspection: { icon: "📋", color: "text-amber-600 bg-amber-100" },
  update_inspection: { icon: "✏️", color: "text-amber-600 bg-amber-100" },
  update_contract: { icon: "✏️", color: "text-emerald-600 bg-emerald-100" },
  upload_sheet: { icon: "📤", color: "text-teal-600 bg-teal-100" },
  edit_sheet: { icon: "✏️", color: "text-teal-600 bg-teal-100" },
  status_change: { icon: "↔", color: "text-indigo-600 bg-indigo-100" },
};

const getActivityTypeLabel = (
  type: string | null | undefined,
  lang: "en" | "ar",
) => {
  if (!type) return lang === "ar" ? "نشاط" : "Activity";
  return (
    ACTIVITY_LABELS[type]?.[lang] ||
    (lang === "ar" ? "نشاط غير مصنف" : type.replace(/_/g, " "))
  );
};

const getArabicActivityMessage = (message: string | null | undefined) => {
  if (!message) return "-";

  return message
    .replace(/^Deleted inspection\s+/i, "حذف معاينة ")
    .replace(/^Published sheet\s+/i, "نشر ملف ")
    .replace(/^Deleted sheet\s+/i, "حذف ملف ")
    .replace(/^Edited sheet\s+/i, "تعديل ملف ")
    .replace(/^Deleted customer\s+/i, "حذف عميل ")
    .replace(/^Moved to non-contracted\s+/i, "نقل إلى غير متعاقدين ")
    .replace(
      /^Moved non-contracted to contracted\s+/i,
      "نقل غير متعاقد للمتعاقدين ",
    )
    .replace(/^Moved\s+(.+)\s+to inspections(?:\s+by\s+(\S+))?$/i, (_, name, user) => {
      return `نقل ${name} إلى المعاينات` + (user ? ` بواسطة ${user}` : "");
    })
    .replace(/^Created inspection for\s+/i, "إنشاء معاينة لـ ")
    .replace(/^Deleted contracted\s+/i, "حذف متعاقد ")
    .replace(/^Deleted non-contracted\s+/i, "حذف غير متعاقد ")
    .replace(/\slogged in$/i, " سجل دخول")
    .replace(/\slogged out$/i, " سجل خروج")
    .replace(/\s+by\s+(\S+)/gi, " بواسطة $1")
    .replace(/\bUnknown\b/g, "غير معروف")
    .replace(/\bstatus_change\b/g, "تغيير حالة");
};

export const ActivitiesPage: React.FC<{
  lang: "en" | "ar";
  t: Record<string, string>;
  settings: Record<string, string>;
  isAdmin: boolean;
}> = ({ lang, t, settings, isAdmin }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setActivities(data || []);
    } catch (err) {
      console.error("Failed to fetch activities", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const [notifyPhone, setNotifyPhone] = useState("01221915144");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteOne = async (id: string) => {
    if (!isAdmin) return;
    if (
      !confirm(
        lang === "ar"
          ? "هل أنت متأكد من حذف هذا النشاط؟"
          : "Are you sure you want to delete this activity?",
      )
    )
      return;
    setDeletingId(id);
    const { error } = await supabase
      .from("activity_logs")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(lang === "ar" ? "فشل الحذف" : "Delete failed");
    } else {
      setActivities((prev) => prev.filter((a) => a.id !== id));
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
    }
    setDeletingId(null);
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) return;
    if (
      !confirm(
        lang === "ar"
          ? "هل أنت متأكد من حذف جميع الأنشطة؟"
          : "Are you sure you want to delete all activities?",
      )
    )
      return;
    setDeletingId("all");
    const { error } = await supabase
      .from("activity_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error(lang === "ar" ? "فشل الحذف" : "Delete failed");
    } else {
      setActivities([]);
      toast.success(lang === "ar" ? "تم حذف الكل" : "All deleted");
    }
    setDeletingId(null);
  };

  const sendActivityNotification = (phone: string, activity: any) => {
    const dateStr = activity.created_at
      ? new Date(activity.created_at).toLocaleDateString("ar-EG")
      : "-";
    const typeLabel = getActivityTypeLabel(activity.type, "ar");
    const activityMessage = getArabicActivityMessage(activity.message);
    const message = `${typeLabel}: ${activityMessage} - ${dateStr}`;
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("2")
      ? cleanPhone
      : `2${cleanPhone}`;
    window.open(
      `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
    toast.success(lang === "ar" ? "تم فتح واتساب" : "WhatsApp opened");
  };

  const handleSendOne = async (activity: (typeof activities)[0]) => {
    if (!isAdmin || !notifyPhone) return;
    setSendingId(activity.id);
    await sendActivityNotification(notifyPhone, activity);
    setSendingId(null);
  };

  const handleSendAll = async () => {
    if (!isAdmin || !notifyPhone) return;
    setSendingId("all");
    for (const a of activities) {
      await sendActivityNotification(notifyPhone, a);
    }
    setSendingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-light">
            {lang === "ar" ? "سجل الأنشطة" : "Activity Log"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "تابع جميع الأنشطة الحديثة في النظام"
              : "Track all recent activities in the system"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchActivities}
            className="glass p-3 rounded-2xl border border-white/40 hover:shadow-md transition-all"
            title={lang === "ar" ? "تحديث" : "Refresh"}
          >
            <svg
              className="w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <div className="glass px-4 py-3 rounded-2xl min-w-[90px]">
            <div className="text-[10px] uppercase font-bold text-zinc-400">
              {lang === "ar" ? "النشاط" : "Activities"}
            </div>
            <div className="text-2xl font-semibold">{activities.length}</div>
          </div>
        </div>
      </div>

      {/* Notification Bar */}
      {isAdmin && (
        <div className="glass rounded-[2rem] p-5 shadow-sm border border-white/40 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <input
              value={notifyPhone}
              onChange={(e) => setNotifyPhone(e.target.value)}
              className="w-full sm:w-52 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-mono"
              placeholder={lang === "ar" ? "رقم الهاتف" : "Phone number"}
            />
          </div>
          <button
            onClick={handleSendAll}
            disabled={sendingId === "all" || activities.length === 0}
            className="w-full sm:w-auto py-2.5 px-6 rounded-2xl bg-zinc-900 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {sendingId === "all"
              ? lang === "ar"
                ? "جاري الإرسال..."
                : "Sending..."
              : lang === "ar"
                ? "إرسال الكل"
                : "Send All"}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deletingId === "all" || activities.length === 0}
            className="w-full sm:w-auto py-2.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            {deletingId === "all"
              ? lang === "ar"
                ? "جاري الحذف..."
                : "Deleting..."
              : lang === "ar"
                ? "حذف الكل"
                : "Delete All"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass rounded-[2rem] py-20 text-center">
          <div className="w-8 h-8 border-2 border-accent-tan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 font-semibold">
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </p>
        </div>
      ) : activities.length > 0 ? (
        <div className="space-y-4">
          {activities.map((activity) => {
            const iconDef = ACTIVITY_ICONS[activity.type] || {
              icon: "📌",
              color: "text-zinc-600 bg-zinc-100",
            };
            const [textColor, bgColor] = iconDef.color.split(" ");
            return (
              <div
                key={activity.id}
                className="glass rounded-[2rem] p-6 shadow-sm border border-white/40 flex items-center gap-4"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${bgColor} ${textColor} flex items-center justify-center text-xl`}
                >
                  {iconDef.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`text-xs font-bold ${textColor} uppercase`}
                    >
                      {getActivityTypeLabel(activity.type, lang)}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {activity.created_at
                        ? new Date(activity.created_at).toLocaleDateString(
                            "ar-EG",
                          )
                        : "-"}
                    </span>
                  </div>
                  <p className="font-bold text-zinc-900 mt-1 truncate">
                    {lang === "ar"
                      ? getArabicActivityMessage(activity.message)
                      : activity.message}
                  </p>
                </div>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleSendOne(activity)}
                      disabled={sendingId === activity.id}
                      className="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                      title={lang === "ar" ? "إرسال واتساب" : "Send WhatsApp"}
                    >
                      {sendingId === activity.id ? (
                        <span className="text-xs animate-pulse">...</span>
                      ) : (
                        <MessageCircle className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteOne(activity.id)}
                      disabled={deletingId === activity.id}
                      className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                      title={lang === "ar" ? "حذف" : "Delete"}
                    >
                      {deletingId === activity.id ? (
                        <span className="text-xs animate-pulse">...</span>
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass rounded-[2rem] py-20 text-center">
          <Activity className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
          <p className="text-zinc-400 font-semibold">
            {lang === "ar" ? "لا توجد أنشطة حديثة" : "No recent activities"}
          </p>
        </div>
      )}
    </div>
  );
};