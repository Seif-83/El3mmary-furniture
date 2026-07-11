/// <reference types="react" />
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Armchair,
  Users,
  Trash2,
  LogOut,
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
  Languages,
  Eye,
  EyeOff,
  Download,
  Plus,
  Edit2,
  X,
  FileSpreadsheet,
  Upload,
  ClipboardList,
  Calendar,
  Search,
  Printer,
  Menu,
  MessageCircle,
  PhoneCall,
  LayoutDashboard,
  Settings,
  Activity,
  Wrench,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase, supabaseAdmin, SUPABASE_CONFIGURED } from "./lib/supabase";
import { User } from "@supabase/supabase-js";
import { SyncManager } from "./services/sync";
import {
  CustomerService,
  OrderService,
  ProductService,
  InvoiceService,
  StageService,
  SettingsService,
  ActivityLogService,
} from "./services/data";
import { db } from "./services/db";

interface FakeTimestamp {
  toDate: () => Date;
}
const toTimestamp = (isoString: string | null | undefined): FakeTimestamp => {
  const d = isoString ? new Date(isoString) : new Date();
  return {
    toDate: () => d,
  };
};

const toSortableDateValue = (value?: string | null): number => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

type Timestamp = FakeTimestamp;
import toast, { Toaster } from "react-hot-toast";
import { format } from "date-fns";
import NewApp from "./NewApp";

interface CatalogSheet {
  id: string;
  title: string;
  data: any[];
  createdAt: Timestamp;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  createdAt: Timestamp;
  governorate?: string;
  // Extra fields saved at Step 1
  address?: string;
  deliveryAddress?: string;
  visitDate?: string;
  visitDateTo?: string;
  notes?: string;
  deliveryDate?: string;
  pickupDate?: string;
  portfolioDate?: string;
  status?: string;
  raw?: any;
}

interface FurniturePiece {
  name: string;
  price: number;
  quantity: number;
  details?: string;
  room_type?: string;
  room_instance_id?: string;
  aro_veneer_addon?: boolean;
  aro_surcharge?: number;
}

interface Inspection {
  id: string;
  customerName: string;
  phone: string;
  address?: string;
  deliveryAddress?: string;
  governorate?: string;
  visitDate: string;
  visitDateTo?: string;
  notes: string;
  rooms: number;
  pieces: FurniturePiece[];
  totalAmount: number;
  status: "pending" | "contracted" | "refused";
  createdAt: Timestamp;
  // Contracting details
  portfolio?: string;
  room_types?: string[];
  room_aro_veneer?: Record<string, boolean>;
  room_aro_veneer_price?: Record<string, number>;
  deliveryDate?: string;
  pickupDate?: string;
  portfolioDate?: string;
  portfolio_date?: string;
  contractDate?: string;
  contractUrl?: string;
  payments?: { amount: number; date: string; stage: string }[];
}

type RoomDraftItem = {
  item_name: string;
  custom_item: boolean;
  quantity: number;
  dimensions: string;
  price: number;
  notes: string;
  aro_veneer_addon: boolean;
  aro_surcharge: number;
};

type RoomDraft = {
  id?: string;
  room_type: string;
  aro_veneer: boolean;
  aro_veneer_price?: number;
  items: RoomDraftItem[];
  customLabel?: string | null;
};

const ROOM_TYPES = [
  {
    key: "bedroom",
    ar: "غرفة نوم",
    en: "Bedroom",
    defaults: [
      "سرير",
      "كومود",
      "دولاب",
      "تسريحة",
      "شيفونيرة",
      "شماعة",
      "كرسي/بف",
    ],
  },
  {
    key: "dining",
    ar: "سفرة",
    en: "Dining room",
    defaults: ["كرسي", "سفرة", "بوفيه", "نيش"],
  },
  {
    key: "kids",
    ar: "أطفال",
    en: "Kids room",
    defaults: [
      "سرير",
      "كومود",
      "دولاب",
      "تسريحة",
      "شيفونيرة",
      "شماعة",
      "كرسي/بف",
      "مكتب",
    ],
  },
  {
    key: "salon",
    ar: "صالون",
    en: "Salon",
    defaults: ["كنبة كبيرة", "كنبة صغيرة", "كرسي", "كُوفي تيبل"],
  },
  {
    key: "antrei",
    ar: "أنتريه",
    en: "Antrei",
    defaults: ["كنبة كبيرة", "كنبة صغيرة", "كرسي", "كُوفي تيبل"],
  },
  {
    key: "other",
    ar: "أخرى",
    en: "Other",
    defaults: ["مكتب", "مكتبة", "تي في يونيت"],
  },
] as const;

const STAGE_ORDER = [
  { key: "received", ar: "استلام", en: "Received" },
  { key: "carpentry", ar: "نجارة", en: "Carpentry" },
  { key: "finishing", ar: "تشطيب", en: "Finishing" },
  { key: "painting", ar: "دهان", en: "Painting" },
  { key: "upholstery", ar: "تنجيد", en: "Upholstery" },
  { key: "delivery", ar: "تسليم", en: "Delivery" },
] as const;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com") as string;
const VIEWER_EMAIL = (process.env.VIEWER_EMAIL || "view@gmail.com") as string;

const FURNITURE_OPTIONS = [
  "سرير كبير",
  "دولاب",
  "كومود",
  "سراحة",
  "شفونيرة",
  "سرير أطفال",
  "دولاب أطفال",
  "كومود أطفال",
  "ترابيزة سفرة",
  "كرسي سفرة",
  "بوفيه",
  "نيش",
  "مطبخ",
  "كنبة",
  "ركنة",
  "صالون",
];

const translations: Record<"en" | "ar", Record<string, string>> = {
  en: {
    brand: "Welcome to EL3mmary",
    userDatabase: "User Database",
    signOut: "Sign Out",
    masterAdmin: "Master Administrator",
    userManagement: "User Management",
    totalUsers: "Total Users",
    userName: "User Name",
    phoneNumber: "Phone Number",
    loginDate: "First Login Date",
    actions: "Actions",
    delete: "Delete",
    successMsg: "Logged in successfully!",
    portalSoon: "User portal coming soon...",
    return: "Return",
    welcome: "Welcome to El3mmary",
    enterCreds: "Enter your credentials to access the database.",
    userLogin: "User Login",
    adminAccess: "Admin Access",
    fullName: "Your Full Name",
    enterPortal: "Enter Portal",
    adminUser: "Admin Username",
    passphrase: "Passphrase",
    authenticating: "Authenticating...",
    noRecords: "No user records found.",
    processing: "Processing...",
    phoneError: "Phone number must be between 10 and 11 digits",
    exportExcel: "Export Excel",
    start: "Start",
    welcomeDesc: "Premium Furniture & Interior Design Solutions",
    addCustomer: "Add User",
    editCustomer: "Edit Record",
    save: "Save",
    cancel: "Cancel",
    publishedSheets: "Published Sheets",
    uploadNew: "Upload New Sheet",
    deleteSheet: "Delete Sheet",
    noSheets: "No sheets published yet.",
    logins: "Logins",
    catalog: "Catalog",
    customers: "Customers",
    totalCustomers: "Total Customers",
    addCustomerBtn: "Add Customer",
    inspections: "Inspections",
    contracted: "Contracted Customers",
    notContracted: "Non-Contracted Customers",
    addInspection: "New Inspection",
    step1: "Pre-Visit",
    step2: "During Visit",
    step3: "Contracting",
    customerName: "Customer Name",
    address: "Inspection / Pickup Address",
    deliveryAddress: "Delivery Address",
    visitDate: "Visit Date",
    notes: "Notes",
    rooms: "Rooms",
    pieces: "Furniture Pieces",
    addPiece: "Add Piece",
    price: "Price",
    total: "Total Amount",
    contractedBtn: "Contracted",
    refusedBtn: "Not Contracted",
    portfolio: "Portfolio",
    deliveryDate: "Delivery Date",
    pickupDate: "Pickup Date",
    portfolioDate: "Portfolio Date",
    contractDate: "Contract Date",
    contractImg: "Contract Image",
    viewOnly: "Viewer (Read Only)",
    editor: "Editor (Full Access)",
    phonebook: "Phonebook",
    openWhatsApp: "Open WhatsApp",
    workflow: "Workflow",
    workflowCount: "Workflow Items",
    dashboard: "Dashboard",
    production: "Production",
    payments: "Payments",
    activities: "Activity Log",
    settings: "Settings",
  },
  ar: {
    brand: "مرحبا بكم في العماري",
    userDatabase: "قاعدة البيانات",
    signOut: "تسجيل الخروج",
    masterAdmin: "المسؤول الرئيسي",
    userManagement: "إدارة المستخدمين",
    totalUsers: "إجمالي المستخدمين",
    userName: "الاسم",
    phoneNumber: "رقم الهاتف",
    loginDate: "تاريخ الدخول",
    actions: "إجراءات",
    delete: "حذف",
    successMsg: "تم تسجيل الدخول بنجاح!",
    portalSoon: "بوابة المستخدم قادمة قريبًا...",
    return: "العودة",
    welcome: "مرحباً بكم في العماري",
    enterCreds: "أدخل بياناتك للوصول إلى قاعدة البيانات.",
    userLogin: "دخول المستخدم",
    adminAccess: "دخول المسؤول",
    fullName: "الاسم الكامل",
    enterPortal: "دخول البوابة",
    adminUser: "اسم المسؤول",
    passphrase: "كلمة المرور",
    authenticating: "جاري الدخول...",
    noRecords: "لا يوجد سجلات.",
    processing: "جاري المعالجة...",
    phoneError: "يجب أن يكون رقم الهاتف بين 10 و 11 رقم",
    exportExcel: "تصدير الملف",
    start: "ابدأ الآن",
    welcomeDesc: "حلول فاخرة للأثاث والتصميم الداخلي",
    addCustomer: "إضافة مستخدم",
    editCustomer: "تعديل السجل",
    save: "حفظ",
    cancel: "إلغاء",
    publishedSheets: "الملفات المنشورة",
    uploadNew: "نشر ملف جديد",
    deleteSheet: "حذف الملف",
    noSheets: "لا توجد ملفات منشورة بعد.",
    logins: "تسجيلات الدخول",
    catalog: "الكتالوج",
    customers: "العملاء",
    totalCustomers: "إجمالي العملاء",
    addCustomerBtn: "إضافة عميل",
    inspections: "المعاينات",
    contracted: "العملاء المتعاقدين",
    notContracted: "عملاء غير متعاقدين",
    addInspection: "معاينة جديدة",
    step1: "تعديل",
    step2: "أثناء المعاينة",
    step3: "التعاقد",
    customerName: "اسم العميل",
    address: "عنوان المعاينة / الاستلام",
    deliveryAddress: "عنوان التسليم",
    visitDate: "تاريخ المعاينة",
    notes: "ملاحظات",
    rooms: "عدد الغرف",
    pieces: "القطع المطلوبة",
    addPiece: "إضافة قطعة",
    price: "السعر",
    total: "الإجمالي",
    contractedBtn: "تم التعاقد",
    refusedBtn: "لم يتم التعاقد",
    portfolio: "البورتفوليو",
    deliveryDate: "تاريخ التسليم",
    pickupDate: "تاريخ الاستلام",
    portfolioDate: "تاريخ البورتفوليو",
    contractDate: "تاريخ العقد",
    contractImg: "صورة العقد",
    viewOnly: "مشاهد فقط",
    editor: "مسؤول (صلاحية كاملة)",
    phonebook: "دليل الأرقام",
    openWhatsApp: "واتساب",
    workflow: "العمل",
    workflowCount: "عناصر العمل",
    quantity: "العدد",
    dashboard: "الرئيسية",
    production: "الإنتاج",
    payments: "المدفوعات",
    activities: "سجل الأنشطة",
    settings: "الإعدادات",
  },
};

// Production Page Component - Shows contracted customers with production tracking
const ProductionPage: React.FC<{
  contractedCustomers: Inspection[];
  inspections: Inspection[];
  lang: "en" | "ar";
  isAdmin: boolean;
  t: Record<string, string>;
  stages: any[];
  onStageUpdate: (stageId: string, status: string) => void;
}> = ({
  contractedCustomers,
  inspections,
  lang,
  isAdmin,
  t,
  stages,
  onStageUpdate,
}) => {
  const allProductionData = [...contractedCustomers];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-light">
            {lang === "ar" ? "الإنتاج والورشة" : "Production Tracker"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {lang === "ar"
              ? "تابع مراحل إنتاج الطلبات المتعاقدة"
              : "Track production stages for contracted orders"}
          </p>
        </div>
        <div className="glass px-4 py-3 rounded-2xl min-w-[90px]">
          <div className="text-[10px] uppercase font-bold text-zinc-400">
            {lang === "ar" ? "إجمالي الطلبات" : "Total Orders"}
          </div>
          <div className="text-2xl font-semibold">
            {allProductionData.length}
          </div>
        </div>
      </div>

      {allProductionData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allProductionData.map((order) => {
            const orderPhone = order.phone;
            const matchingStage = orderPhone
              ? stages.find((s: any) => s.client?.phones?.includes(orderPhone))
              : null;
            const orderClientId = matchingStage?.client_id || null;
            const orderStages = orderClientId
              ? stages.filter((s: any) => s.client_id === orderClientId)
              : [];
            return (
              <div
                key={order.id}
                className="glass rounded-[2.5rem] p-6 shadow-xl border border-white/40"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">
                      {order.customerName}
                    </h3>
                    <p className="text-sm text-zinc-500 font-mono">
                      {order.phone}
                    </p>
                  </div>
                  <div className="bg-accent-tan/10 px-3 py-1 rounded-full text-xs font-bold text-accent-tan">
                    {order.contractDate
                      ? new Date(order.contractDate).toLocaleDateString("ar-EG")
                      : lang === "ar"
                        ? "بدون تاريخ"
                        : "No date"}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      {lang === "ar" ? "الغرف" : "Rooms"}
                    </span>
                    <span className="font-bold">{order.rooms || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      {lang === "ar" ? "القيمة" : "Value"}
                    </span>
                    <span className="font-bold">
                      {order.totalAmount?.toLocaleString() || 0} EGP
                    </span>
                  </div>
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

                <div className="mt-6 pt-4 border-t border-zinc-100">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase mb-3">
                    {lang === "ar" ? "المراحل" : "Stages"}
                  </div>
                  <div className="flex items-center justify-between">
                    {STAGE_ORDER.map((stageDef, idx) => {
                      const stageRecord = orderStages.find(
                        (s: any) => s.stage === stageDef.key,
                      );
                      const stageStatus = stageRecord?.status || "not_started";
                      const isDone = stageStatus === "done";
                      const isInProgress = stageStatus === "in_progress";
                      const circleColor = isDone
                        ? "bg-emerald-500 text-white"
                        : isInProgress
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-200 text-zinc-500";
                      return (
                        <div
                          key={stageDef.key}
                          className="flex flex-col items-center gap-1 relative group"
                        >
                          <button
                            onClick={() =>
                              stageRecord &&
                              isAdmin &&
                              onStageUpdate(
                                stageRecord.id,
                                isDone ? "not_started" : "done",
                              )
                            }
                            disabled={!isAdmin}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${circleColor} ${isAdmin && stageRecord ? "cursor-pointer hover:scale-110 active:scale-95" : "cursor-default"}`}
                          >
                            {isDone ? "✓" : idx + 1}
                          </button>
                          <span className="text-[9px] text-zinc-500">
                            {lang === "ar" ? stageDef.ar : stageDef.en}
                          </span>
                          {isAdmin && stageRecord && (
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[8px] rounded-xl px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {isDone
                                ? lang === "ar"
                                  ? "إلغاء"
                                  : "Undo"
                                : isInProgress
                                  ? lang === "ar"
                                    ? "إكمال"
                                    : "Complete"
                                  : lang === "ar"
                                    ? "بدء"
                                    : "Start"}
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
    </div>
  );
};

// Payments Page Component - Shows Statement of Account for contracted customers
interface PaymentRecord {
  id: string;
  amount: number;
  paid_at: string;
  installment?: string | null;
  note?: string | null;
}
const PaymentsPage: React.FC<{
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
        <div className="flex gap-4">
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
      ) : contractedCustomers.length > 0 ? (
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
                  {contractedCustomers.map((customer) => {
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
            {contractedCustomers.map((customer) => {
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

// Activities Page Component - Shows activity log
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
    .replace(/^Moved\s+(.+)\s+to inspections$/i, "نقل $1 إلى المعاينات")
    .replace(/^Created inspection for\s+/i, "إنشاء معاينة لـ ")
    .replace(/^Deleted contracted\s+/i, "حذف متعاقد ")
    .replace(/^Deleted non-contracted\s+/i, "حذف غير متعاقد ")
    .replace(/\slogged in$/i, " سجل دخول")
    .replace(/\slogged out$/i, " سجل خروج")
    .replace(/\bUnknown\b/g, "غير معروف")
    .replace(/\bstatus_change\b/g, "تغيير حالة");
};

const ActivitiesPage: React.FC<{
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

// Settings Page Component
const SettingsPage: React.FC<{
  lang: "en" | "ar";
  setLang: (v: "en" | "ar") => void;
  isAdmin: boolean;
  t: Record<string, string>;
  settings: Record<string, string>;
  currentUserEmail?: string;
  onSyncTrigger?: () => Promise<void>;
}> = ({ lang, setLang, isAdmin, t, settings, currentUserEmail, onSyncTrigger }) => {
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
        lang === "ar" ? "تمت المزامنة وتحديث البيانات" : "Data synchronized successfully",
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
                {lang === "ar" ? "العمليات المعلقة في الخلفية" : "Pending Operations"}
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
          <button
            onClick={handleSyncClick}
            disabled={syncing}
            className={`w-full py-5 rounded-2xl font-bold text-lg text-white transition-all flex items-center justify-center gap-3 shadow-lg scale-[1.02] ${syncing ? "bg-zinc-400 cursor-not-allowed" : "bg-zinc-900 hover:bg-zinc-800 active:scale-95"}`}
          >
            {syncing ? (
              <span>{lang === "ar" ? "جاري المزامنة..." : "Syncing..."}</span>
            ) : (
              <span>
                {lang === "ar"
                  ? "مزامنة البيانات الآن ↻"
                  : "Sync Data Now ↻"}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


const normalizePhone = (p: any) => {
  if (!p) return "";
  const s = String(p);
  return s
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/\D/g, "");
};

const isTestCustomer = (c: any) => {
  const name = String((c?.name || c?.customerName || "") || "").toLowerCase();
  const phone = String((c?.phone || "") || "").replace(/\D/g, "");
  if (!name && !phone) return false;
  if (phone === "1234567890") return true;
  if (name.includes("test authenticated") || name.includes("test") && name.includes("authenticated")) return true;
  if (name.includes("test")) return true;
  return false;
};

const formatCellValue = (v: any) => {
  if (v === null || v === undefined) return "";

  // Handle Excel Serial Dates (approx range for 1900-2100)
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const date = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
    }
  }

  return String(v);
};

const mapCustomerFromDB = (dbCust: any): CustomerRecord => ({
  id: dbCust.id,
  name: dbCust.name,
  phone: dbCust.phone,
  governorate: dbCust.governorate,
  address: dbCust.address,
  deliveryAddress: dbCust.delivery_address,
  visitDate: dbCust.visit_date,
  notes: dbCust.notes,
  deliveryDate: dbCust.delivery_date,
  pickupDate: dbCust.pickup_date,
  portfolioDate: dbCust.portfolio_date,
  createdAt: toTimestamp(dbCust.created_at),
});

function parseMaybeJsonObject<T>(value: any): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

function parseMaybeJsonArray<T>(value: any): T[] | undefined {
  if (Array.isArray(value)) return value;
  const parsed = parseMaybeJsonObject<T[]>(value);
  return Array.isArray(parsed) ? parsed : undefined;
}

function parseRecordSource<T>(value: any): Record<string, T> {
  const parsed = parseMaybeJsonObject(value) as Record<string, T>;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    return parsed;
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, T>;
  return {};
}

const mapInspectionFromDB = (dbInsp: any): Inspection =>
  ({
    id: dbInsp.id,
    customerName: dbInsp.customer_name,
    phone: dbInsp.phone,
    address: dbInsp.address,
    deliveryAddress: dbInsp.delivery_address,
    visitDate: dbInsp.visit_date,
    notes: dbInsp.notes,
    governorate: dbInsp.governorate,
    rooms: dbInsp.rooms,
    pieces: parseMaybeJsonArray<FurniturePiece>(dbInsp.pieces) || [],
    totalAmount: Number(dbInsp.total_amount || 0),
    status: dbInsp.status || "pending",
    portfolio: dbInsp.portfolio,
    room_types: parseMaybeJsonArray<string>(dbInsp.room_types) || [],
    room_aro_veneer:
      (parseMaybeJsonObject(dbInsp.room_aro_veneer) as Record<
        string,
        boolean
      >) || {},
    room_aro_veneer_price:
      (parseMaybeJsonObject(dbInsp.room_aro_veneer_price) as Record<
        string,
        number
      >) || {},
    deliveryDate: dbInsp.delivery_date,
    pickupDate: dbInsp.pickup_date,
    portfolioDate: dbInsp.portfolio_date,
    contractDate: dbInsp.contract_date,
    contractUrl: dbInsp.contract_url,
    createdAt: toTimestamp(dbInsp.created_at),
    ...((dbInsp as any).finalized_at
      ? { finalizedAt: toTimestamp((dbInsp as any).finalized_at) }
      : {}),
  }) as Inspection;

const sortContractedRecordsByContractDate = (records: Inspection[]) => {
  return [...records].sort((a, b) => {
    const contractDateDiff =
      toSortableDateValue(a.contractDate) - toSortableDateValue(b.contractDate);
    if (contractDateDiff !== 0) return contractDateDiff;
    return (a.customerName || "").localeCompare(b.customerName || "", "ar");
  });
};

const isMissingRoomTypesColumnError = (error: any) => {
  const raw = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    raw.includes("room_types") &&
    (raw.includes("schema cache") ||
      raw.includes("could not find") ||
      raw.includes("column") ||
      raw.includes("pgrst204"))
  );
};

const isMissingAroVeneerColumnError = (error: any) => {
  const raw = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    (raw.includes("room_aro_veneer") || raw.includes("aro_veneer")) &&
    (raw.includes("schema cache") ||
      raw.includes("could not find") ||
      raw.includes("column") ||
      raw.includes("pgrst204"))
  );
};

const withoutRoomTypes = (payload: Record<string, any>) => {
  const { room_types, ...rest } = payload;
  return rest;
};

const withoutAroVeneer = (payload: Record<string, any>) => {
  const { room_aro_veneer, room_aro_veneer_price, ...rest } = payload;
  return rest;
};

const withoutRoomTypesAndAroVeneer = (payload: Record<string, any>) => {
  const { room_types, room_aro_veneer, room_aro_veneer_price, ...rest } =
    payload;
  return rest;
};

const playSound = async (type: "success" | "error" | "delete") => {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    if (ctx.state === "suspended") await ctx.resume();
    const now = ctx.currentTime;

    if (type === "success") {
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, now + i * 0.08);
        g.gain.setValueAtTime(0.01, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.08);
        o.stop(now + i * 0.08 + 0.25);
      });
    } else if (type === "error") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(330, now);
      o.frequency.linearRampToValueAtTime(260, now + 0.12);
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.15, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.3);
    } else if (type === "delete") {
      [523, 440, 349].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.01, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0.14, now + i * 0.1 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.2);
      });
    }
  } catch {}
};

export default function App() {
  const [lang, setLang] = useState<"en" | "ar">("ar");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const t = translations[lang];

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const allowedEmails = [ADMIN_EMAIL, VIEWER_EMAIL];
  const isAdminUser = currentUser?.email === ADMIN_EMAIL;
  const isAuthorizedUser =
    currentUser !== null && allowedEmails.includes(currentUser.email ?? "");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<
    | "customers"
    | "inspections"
    | "contracted_customers"
    | "non_contracted_customers"
    | null
  >(null);

  const [adminSubView, setAdminSubView] = useState<
    | "dashboard"
    | "customers"
    | "catalogs"
    | "contracted"
    | "not-contracted"
    | "inspections"
    | "phonebook"
    | "production"
    | "payments"
    | "activities"
    | "settings"
  >("dashboard");
  const [catalogs, setCatalogs] = useState<CatalogSheet[]>([]);
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [contractedCustomers, setContractedCustomers] = useState<Inspection[]>(
    [],
  );
  const [notContractedCustomers, setNotContractedCustomers] = useState<
    Inspection[]
  >([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const isInspectionView = adminSubView === "inspections";
  const isContractedView = adminSubView === "contracted";
  const activeRecords = isInspectionView
    ? inspections
    : isContractedView
      ? contractedCustomers
      : notContractedCustomers;

  // Unified customers list across tables with status
  const unifiedCustomers = useMemo(() => {
    type CustomerStatus =
      | "customers"
      | "inspections"
      | "contracted"
      | "not-contracted";
    type UnifiedCustomer = {
      id: string | null | undefined;
      phone: string;
      name: string;
      governorate: string;
      pickupDate: string;
      visitDate: string;
      visitDateTo: string;
      address: string;
      deliveryAddress: string;
      notes: string;
      source: string;
      status: CustomerStatus;
      raw: any;
    };

    const map = new Map<string, UnifiedCustomer>();

    const push = (
      key: string | null | undefined,
      entry: any,
      source: string,
      status: CustomerStatus,
    ) => {
      const k = (key || "").toString().trim();
      if (!k) return;
      const existing = map.get(k);
      const obj: UnifiedCustomer = {
        id: entry?.id,
        phone: k,
        name: entry?.name || entry?.customerName || "",
        governorate: entry?.governorate || entry?.city || "",
        pickupDate:
          entry?.pickup_date || entry?.pickupDate || entry?.visitDate || "",
        visitDate: entry?.visit_date || entry?.visitDate || "",
        visitDateTo: entry?.visit_date_to || entry?.visitDateTo || "",
        address: entry?.address || "",
        deliveryAddress:
          entry?.delivery_address || entry?.deliveryAddress || "",
        notes: entry?.notes || "",
        source,
        status,
        raw: entry,
      };
      const priority: Record<CustomerStatus, number> = {
        contracted: 4,
        "not-contracted": 3,
        inspections: 2,
        customers: 1,
      };
      if (!existing) map.set(k, obj);
      else if (priority[status] > priority[existing.status]) map.set(k, obj);
    };

    (customerRecords || []).forEach((c) =>
      push(c.phone, c, "customers", "customers"),
    );
    (inspections || []).forEach((i) =>
      push(i.phone, i, "inspections", "inspections"),
    );
    (contractedCustomers || []).forEach((c) =>
      push(c.phone, c, "contracted", "contracted"),
    );
    (notContractedCustomers || []).forEach((c) =>
      push(c.phone, c, "not-contracted", "not-contracted"),
    );

    return Array.from(map.values());
  }, [
    customerRecords,
    inspections,
    contractedCustomers,
    notContractedCustomers,
  ]);

  const getStatusBadge = (status: string) => {
    if (status === "contracted")
      return {
        label: lang === "ar" ? "متعاقد" : "Contracted",
        cls: "bg-emerald-100 text-emerald-700",
      };
    if (status === "not-contracted")
      return {
        label: lang === "ar" ? "غير متعاقد" : "Not contracted",
        cls: "bg-red-100 text-red-700",
      };
    if (status === "inspections")
      return {
        label: lang === "ar" ? "معاينات" : "Inspection",
        cls: "bg-yellow-100 text-yellow-700",
      };
    return {
      label: lang === "ar" ? "عميل" : "Customer",
      cls: "bg-zinc-100 text-zinc-700",
    };
  };

  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [inspectionStep, setInspectionStep] = useState(1);
  const [inspectionFormData, setInspectionFormData] = useState<
    Partial<Inspection>
  >({
    customerName: "",
    address: "",
    deliveryAddress: "",
    phone: "",
    governorate: "",
    visitDate: "",
    notes: "",
    rooms: 0,
    room_types: [],
    room_aro_veneer: {},
    room_aro_veneer_price: {},
    pieces: [],
    totalAmount: 0,
  });

  const [stages, setStages] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [quoteDrafts, setQuoteDrafts] = useState<RoomDraft[]>([]);
  const [customPieceName, setCustomPieceName] = useState("");
  const [customPieceQty, setCustomPieceQty] = useState(1);
  const [customPiecePrice, setCustomPiecePrice] = useState("");
  const [customPieceRoomLabel, setCustomPieceRoomLabel] = useState("");
  const [customPieceRoomInstanceId, setCustomPieceRoomInstanceId] = useState<
    string | undefined
  >(undefined);
  const [recentlyClickedItem, setRecentlyClickedItem] = useState<string | null>(
    null,
  );

  // Contract upload states
  const [isContractUploadOpen, setIsContractUploadOpen] = useState(false);
  const [pendingContractInspection, setPendingContractInspection] =
    useState<Inspection | null>(null);
  const [contractUploadLoading, setContractUploadLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const CONTRACT_BUCKET =
    import.meta.env.VITE_SUPABASE_CONTRACTS_BUCKET?.trim() || "contracts";

  // Check if inspection form has unsaved changes
  const inspectionFormHasChanges = () => {
    return (
      (inspectionFormData.customerName?.trim() || "") !== "" ||
      (inspectionFormData.phone?.trim() || "") !== "" ||
      (inspectionFormData.address?.trim() || "") !== "" ||
      (inspectionFormData.deliveryAddress?.trim() || "") !== "" ||
      (inspectionFormData.governorate?.trim() || "") !== "" ||
      (inspectionFormData.visitDate || "") !== "" ||
      (inspectionFormData.notes?.trim() || "") !== "" ||
      (inspectionFormData.rooms || 0) !== 0 ||
      (inspectionFormData.pieces?.length || 0) > 0 ||
      (inspectionFormData.totalAmount || 0) !== 0 ||
      (inspectionFormData.deliveryDate || "") !== "" ||
      (inspectionFormData.pickupDate || "") !== "" ||
      (inspectionFormData.portfolioDate || "") !== "" ||
      (inspectionFormData.contractDate || "") !== "" ||
      (inspectionFormData.portfolio?.trim() || "") !== ""
    );
  };

  // Safe close handler with unsaved changes warning
  const handleCloseInspectionModal = () => {
    if (inspectionFormHasChanges()) {
      const confirmClose = window.confirm(
        lang === "ar"
          ? "هناك بيانات غير محفوظة. هل تريد إغلاق النافذة؟"
          : "You have unsaved changes. Are you sure you want to close?",
      );
      if (!confirmClose) return;
    }

    setIsInspectionModalOpen(false);
    setEditingCollection(null);
    setEditingId(null);
    setInspectionStep(1);
    setInspectionFormData({
      customerName: "",
      address: "",
      deliveryAddress: "",
      phone: "",
      governorate: "",
      visitDate: "",
      notes: "",
      rooms: 0,
      pieces: [],
      totalAmount: 0,
      deliveryDate: "",
      pickupDate: "",
      portfolioDate: "",
      contractDate: "",
      portfolio: "",
    });
  };

  const quoteItemTotal = (item: RoomDraftItem) =>
    Number(item.price || 0) * Number(item.quantity || 1) +
    (item.aro_veneer_addon ? Number(item.aro_surcharge || 0) : 0);
  const quoteRoomSubtotal = (room: RoomDraft) => {
    const itemsTotal = room.items.reduce(
      (sum, item) => sum + quoteItemTotal(item),
      0,
    );
    const veneerPrice = Number(room.aro_veneer_price || 0);
    return itemsTotal + veneerPrice;
  };
  const quoteTotal = () =>
    quoteDrafts.reduce((sum, r) => sum + quoteRoomSubtotal(r), 0);

  const normalizeRoomType = (roomType?: string) => {
    const value =
      typeof roomType === "string"
        ? roomType.trim()
        : roomType
          ? String(roomType).trim()
          : "";
    if (!value || value.toLowerCase() === "other") return "unassigned";
    return value;
  };

  const getRoomTypeKey = (roomType?: string) => {
    const normalized = normalizeRoomType(roomType);
    if (
      ROOM_TYPES.some((r) => r.key.toLowerCase() === normalized.toLowerCase())
    )
      return normalized.toLowerCase();
    const mapped = ROOM_TYPES.find(
      (r) =>
        r.ar.toLowerCase() === normalized.toLowerCase() ||
        r.en.toLowerCase() === normalized.toLowerCase(),
    );
    return mapped?.key || normalized.toLowerCase();
  };

  const findMatchingRoomKey = (
    roomType?: string,
    source?: Record<string, any>,
  ) => {
    if (!roomType || !source) return undefined;
    const normalized = getRoomTypeKey(roomType);
    const sourceKey = Object.keys(source).find(
      (key) => getRoomTypeKey(key) === normalized,
    );
    return sourceKey ?? undefined;
  };

  const getSelectedRecordRoomAroVeneerPrice = (roomType?: string) => {
    const priceSource = parseRecordSource<number>(
      selectedRecord?.room_aro_veneer_price ||
        selectedRecord?.roomAroVeneerPrice,
    );
    const key = findMatchingRoomKey(roomType, priceSource);
    return Number(key ? priceSource[key] : 0);
  };

  const getSelectedRecordRoomAroVeneerEnabled = (roomType?: string) => {
    const enabledSource = parseRecordSource<boolean>(
      selectedRecord?.room_aro_veneer || selectedRecord?.roomAroVeneer,
    );
    const key = findMatchingRoomKey(roomType, enabledSource);
    const enabledValue = Boolean(key ? enabledSource[key] : false);
    return enabledValue || getSelectedRecordRoomAroVeneerPrice(roomType) > 0;
  };

  const getRoomLabel = (roomType: string) => {
    const normalized = normalizeRoomType(roomType);
    const room = ROOM_TYPES.find((r) => r.key === normalized);
    if (room) return room.ar;
    if (normalized === "unassigned")
      return lang === "ar" ? "غير محددة" : "Unassigned";
    const match = normalized.match(/^room_(\d+)$/);
    if (match) return lang === "ar" ? `غرفة ${match[1]}` : `Room ${match[1]}`;
    return normalized;
  };

  const getCustomRoomLabel = (roomInstanceId?: string) => {
    if (!roomInstanceId) return null;
    const match = String(roomInstanceId).match(/:custom:(.+)$/);
    return match ? decodeURIComponent(match[1]).replace(/_/g, " ") : null;
  };

  const getRoomDisplayName = (roomType: string, roomIndex?: number) => {
    const baseLabel = getRoomLabel(roomType);
    if (typeof roomIndex === "number") {
      return lang === "ar"
        ? `${baseLabel} ${roomIndex + 1}`
        : `${baseLabel} ${roomIndex + 1}`;
    }
    return baseLabel;
  };

  const buildQuoteDraftItem = (p: any): RoomDraftItem => ({
    item_name: p.name || p.item_name || "",
    custom_item: p.custom_item || false,
    quantity: Number(p.quantity || 1),
    dimensions: p.details || p.dimensions || "",
    price: Number(p.price || 0),
    notes: p.notes || "",
    aro_veneer_addon: Boolean(p.aro_veneer_addon),
    aro_surcharge: Number(p.aro_surcharge || 0),
  });

  const groupQuoteDrafts = (
    pieces: FurniturePiece[],
    roomTypes?: string[],
  ): RoomDraft[] => {
    const roomAroVeneerSource = parseRecordSource<boolean>(
      selectedRecord?.room_aro_veneer || selectedRecord?.roomAroVeneer,
    );
    const roomAroVeneerPriceSource = parseRecordSource<number>(
      selectedRecord?.room_aro_veneer_price ||
        selectedRecord?.roomAroVeneerPrice,
    );
    const roomDrafts = new Map<string, RoomDraft>();

    const createRoomDraft = (
      id: string,
      room_type: string,
      customLabel: string | null = null,
    ): RoomDraft => ({
      id,
      room_type,
      aro_veneer:
        getSelectedRecordRoomAroVeneerEnabled(room_type) ||
        getSelectedRecordRoomAroVeneerPrice(room_type) > 0,
      aro_veneer_price: getSelectedRecordRoomAroVeneerPrice(room_type),
      items: [],
      customLabel,
    });

    const addRoomDraft = (
      id: string,
      room_type: string,
      customLabel: string | null = null,
    ) => {
      if (!roomDrafts.has(id)) {
        roomDrafts.set(id, createRoomDraft(id, room_type, customLabel));
      }
      return roomDrafts.get(id)!;
    };

    const fallbackRoomTypes = Array.isArray(roomTypes) && roomTypes.length > 0
      ? roomTypes
      : [];

    fallbackRoomTypes.forEach((room_type, index) => {
      addRoomDraft(`${getRoomTypeKey(room_type)}:${index + 1}`, getRoomTypeKey(room_type));
    });

    Object.keys(roomAroVeneerSource).forEach((room_type) => {
      addRoomDraft(`${getRoomTypeKey(room_type)}:1`, getRoomTypeKey(room_type));
    });
    Object.keys(roomAroVeneerPriceSource).forEach((room_type) => {
      addRoomDraft(`${getRoomTypeKey(room_type)}:1`, getRoomTypeKey(room_type));
    });

    pieces.forEach((piece, index) => {
      const roomTypeKey = getRoomTypeKey(piece.room_type);
      const instanceId = piece.room_instance_id || `${roomTypeKey}:${index + 1}`;
      const customLabel = getCustomRoomLabel(instanceId);
      const roomDraft = addRoomDraft(instanceId, roomTypeKey, customLabel);
      roomDraft.items.push(buildQuoteDraftItem(piece));
    });

    return Array.from(roomDrafts.values());
  };

  useEffect(() => {
    if (!selectedRecord) {
      setQuoteDrafts([]);
      return;
    }

    const pieces = Array.isArray(selectedRecord.pieces)
      ? selectedRecord.pieces
      : [];
    const drafts = groupQuoteDrafts(pieces, selectedRecord.room_types);
    if (drafts.length > 0) {
      setQuoteDrafts(drafts);
      return;
    }

    const defaultRoomTypes =
      Array.isArray(selectedRecord.room_types) &&
      selectedRecord.room_types.length > 0
        ? selectedRecord.room_types
        : Array.from(
            { length: Number(selectedRecord.rooms || 0) },
            (_, idx) => `room_${idx + 1}`,
          );

    const defaultRooms = defaultRoomTypes.map((room_type: string, index: number) => ({
      id: `${getRoomTypeKey(room_type)}:${index + 1}`,
      room_type,
      aro_veneer: false,
      aro_veneer_price: 0,
      items: [] as RoomDraftItem[],
      customLabel: null,
    }));

    setQuoteDrafts(defaultRooms);
  }, [selectedRecord]);

  const setRoomField = (
    roomIndex: number,
    field: keyof RoomDraft,
    value: any,
  ) => {
    setQuoteDrafts((prev) =>
      prev.map((room, index) =>
        index === roomIndex ? { ...room, [field]: value } : room,
      ),
    );
  };

  const setRoomLabel = (roomIndex: number, label: string) => {
    setQuoteDrafts((prev) =>
      prev.map((room, index) => {
        if (index !== roomIndex) return room;
        const trimmed = label.trim();
        const typeKey = getRoomTypeKey(room.room_type);
        if (!trimmed) {
          const defaultId = room.id || `${typeKey}:${roomIndex + 1}`;
          return {
            ...room,
            id: defaultId,
            customLabel: null,
          };
        }
        const customId = `${typeKey}:custom:${encodeURIComponent(
          trimmed.replace(/\s+/g, "_"),
        )}`;
        return {
          ...room,
          id: customId,
          customLabel: trimmed,
        };
      }),
    );
  };

  const setRoomItemField = (
    roomIndex: number,
    itemIndex: number,
    field: keyof RoomDraftItem,
    value: any,
  ) => {
    setQuoteDrafts((prev) =>
      prev.map((room, index) => {
        if (index !== roomIndex) return room;
        return {
          ...room,
          items: room.items.map((item, itemIdx) =>
            itemIdx === itemIndex ? { ...item, [field]: value } : item,
          ),
        };
      }),
    );
  };

  const addRoom = (type: string) =>
    setQuoteDrafts((prev) => [
      ...prev,
      { room_type: type, aro_veneer: false, items: [] },
    ]);
  const removeRoom = (roomIndex: number) =>
    setQuoteDrafts((prev) => prev.filter((_, i) => i !== roomIndex));
  const addDefaultItem = (roomIndex: number, itemName: string) =>
    setQuoteDrafts((prev) =>
      prev.map((room, index) =>
        index === roomIndex
          ? {
              ...room,
              items: [
                ...room.items,
                {
                  item_name: itemName,
                  custom_item: false,
                  quantity: 1,
                  dimensions: "",
                  price: 0,
                  notes: "",
                  aro_veneer_addon: false,
                  aro_surcharge: 0,
                },
              ],
            }
          : room,
      ),
    );
  const addCustomItem = (roomIndex: number) =>
    setQuoteDrafts((prev) =>
      prev.map((room, index) =>
        index === roomIndex
          ? {
              ...room,
              items: [
                ...room.items,
                {
                  item_name: "",
                  custom_item: true,
                  quantity: 1,
                  dimensions: "",
                  price: 0,
                  notes: "",
                  aro_veneer_addon: false,
                  aro_surcharge: 0,
                },
              ],
            }
          : room,
      ),
    );
  const removeRoomItem = (roomIndex: number, itemIndex: number) =>
    setQuoteDrafts((prev) =>
      prev.map((room, index) =>
        index === roomIndex
          ? { ...room, items: room.items.filter((_, idx) => idx !== itemIndex) }
          : room,
      ),
    );

  const handleSaveQuote = async () => {
    if (!selectedRecord) return;
    if (!isAdminUser) {
      toast.error(t.noPermission || "Admin only");
      return;
    }
    try {
      setIsLoading(true);
      const pieces = quoteDrafts.flatMap((r) =>
        r.items.map((it) => ({
          name: it.item_name,
          quantity: it.quantity,
          price: it.price,
          details: it.dimensions || it.notes || "",
          room_type: r.room_type,
          room_instance_id: r.id,
          aro_veneer_addon: it.aro_veneer_addon,
          aro_surcharge: it.aro_surcharge,
        })),
      );
      const totalAmount = quoteTotal();
      const roomAroVeneer = parseRecordSource<boolean>(
        selectedRecord?.room_aro_veneer || selectedRecord?.roomAroVeneer,
      );
      const roomAroVeneerPrice = parseRecordSource<number>(
        selectedRecord?.room_aro_veneer_price ||
          selectedRecord?.roomAroVeneerPrice,
      );
      const updates = {
        pieces,
        total_amount: totalAmount,
        rooms: quoteDrafts.length,
        room_aro_veneer: roomAroVeneer,
        room_aro_veneer_price: roomAroVeneerPrice,
      };
      // Optimistic UI: update locally and queue sync
      await OrderService.updateInspection(selectedRecord.id, updates);
      toast.success(lang === "ar" ? "تم حفظ العرض" : "Quote saved");
      await refreshAllData();
      // refresh selectedRecord
      const refreshed = (
        await supabase
          .from("inspections")
          .select("*")
          .eq("id", selectedRecord.id)
          .single()
      ).data;
      setSelectedRecord(
        refreshed ? mapInspectionFromDB(refreshed) : selectedRecord,
      );
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message ||
          (lang === "ar" ? "فشل حفظ العرض" : "Failed saving quote"),
      );
    }
    setIsLoading(false);
  };
  const [searchQuery, setSearchQuery] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ title: "", message: "", onConfirm: () => {} });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    setConfirmModalConfig({ title, message, onConfirm });
    setIsConfirmModalOpen(true);
  };

  const [isEditCatalogModalOpen, setIsEditCatalogModalOpen] = useState(false);
  const [editingCatalogRow, setEditingCatalogRow] = useState<{
    sheetId: string;
    rowIndex: number;
    data: any;
  } | null>(null);
  const [expandedPieceDetails, setExpandedPieceDetails] = useState<number[]>(
    [],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);

    if (adminSubView === "inspections") {
      setSearchQuery("");
      setGovernorateFilter("all");
    }
  }, [adminSubView]);

  const selectedSheet = catalogs.find(
    (c: CatalogSheet) => c.id === selectedSheetId,
  );

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    phones: [""],
    pickupDate: "",
    address: "",
    governorate: "",
  });

  const normalizePhoneList = (rawPhone: string | undefined) => {
    const cleaned = String(rawPhone || "")
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : [""];
  };

  const clearDashboardData = () => {
    setCatalogs([]);
    setCustomerRecords([]);
    setInspections([]);
    setContractedCustomers([]);
    setNotContractedCustomers([]);
    setSelectedSheetId(null);
  };

  const ensureAdminAccess = () => {
    if (!isAdminUser) {
      toast.error(
        lang === "ar"
          ? "هذه العملية متاحة للمسؤول فقط"
          : "This action is available to the admin only",
      );
      return false;
    }

    return true;
  };

  const refreshAllData = async (preferredSheetId?: string | null) => {
    // Phase 1: Load instantly from IndexedDB
    const localCatalogs = await ProductService.getCatalogs();
    const sheets = localCatalogs.map((r: any) => ({
      ...r,
      createdAt: toTimestamp(r.created_at),
    })) as CatalogSheet[];
    setCatalogs(sheets);
    setSelectedSheetId((prev) => {
      const nextSelectedId = preferredSheetId ?? prev;
      if (nextSelectedId && sheets.some((sheet) => sheet.id === nextSelectedId))
        return nextSelectedId;
      return sheets[0]?.id ?? null;
    });

    const localCustomers = await CustomerService.getAll();
    setCustomerRecords(
      localCustomers.map(mapCustomerFromDB).filter((c) => !isTestCustomer(c)),
    );

    const localInspections = await OrderService.getInspections();
    setInspections(localInspections.map(mapInspectionFromDB));

    const localContracted = await OrderService.getContracted();
    setContractedCustomers(
      sortContractedRecordsByContractDate(
        localContracted.map(mapInspectionFromDB),
      ),
    );

    const localNonContracted = await OrderService.getNonContracted();
    setNotContractedCustomers(localNonContracted.map(mapInspectionFromDB));

    const localStages = await StageService.getStages();
    setStages(localStages);

    const localSettings = await SettingsService.getSettings();
    setSettings(localSettings);

    const localPayments = await InvoiceService.getPayments();
    setAllPayments(
      localPayments.map((p: any) => ({
        id: p.id,
        amount: p.amount,
        paid_at: p.paid_at,
        installment: p.installment ?? null,
        note: p.note ?? null,
      })),
    );

    // Phase 2: If online, fetch fresh data from Supabase in the background
    if (navigator.onLine) {
      try {
        const [
          { data: catData },
          { data: custData },
          { data: inspData },
          { data: contrData },
          { data: nonContrData },
          { data: stagesData },
          { data: settingsData },
          { data: paymentsData },
          { data: clientsData },
        ] = await Promise.all([
          supabase
            .from("catalogs")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("customers")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("inspections")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("contracted_customers")
            .select("*")
            .order("finalized_at", { ascending: false }),
          supabase
            .from("non_contracted_customers")
            .select("*")
            .order("finalized_at", { ascending: false }),
          supabase.from("production_stages").select("*"),
          supabase.from("app_settings").select("*"),
          supabase
            .from("payments")
            .select("id, amount, paid_at, installment, note")
            .order("paid_at", { ascending: false }),
          supabase.from("clients").select("*"),
        ]);

        // Phase 3: Update IndexedDB with conflict resolution
        // Filter out known test/sample records from remote data to avoid reintroducing them
        const filteredCatData = catData || [];
        const filteredCustData = (custData || []).filter((r: any) => {
          try {
            return !isTestCustomer(mapCustomerFromDB(r));
          } catch {
            return true;
          }
        });
        const filteredInspData = (inspData || []).filter((r: any) => {
          try {
            return !isTestCustomer(mapInspectionFromDB(r));
          } catch {
            return true;
          }
        });
        const filteredContrData = (contrData || []).filter((r: any) => {
          try {
            return !isTestCustomer(mapInspectionFromDB(r));
          } catch {
            return true;
          }
        });
        const filteredNonContrData = (nonContrData || []).filter((r: any) => {
          try {
            return !isTestCustomer(mapInspectionFromDB(r));
          } catch {
            return true;
          }
        });
        const updatePromises: Promise<boolean>[] = [];
        if (filteredCatData)
          filteredCatData.forEach((r: any) =>
            updatePromises.push(SyncManager.resolveConflict("catalogs", r)),
          );
        if (filteredCustData)
          filteredCustData.forEach((r: any) =>
            updatePromises.push(SyncManager.resolveConflict("customers", r)),
          );
        if (filteredInspData)
          filteredInspData.forEach((r: any) =>
            updatePromises.push(SyncManager.resolveConflict("inspections", r)),
          );
        if (filteredContrData)
          filteredContrData.forEach((r: any) =>
            updatePromises.push(
              SyncManager.resolveConflict("contracted_customers", r),
            ),
          );
        if (filteredNonContrData)
          filteredNonContrData.forEach((r: any) =>
            updatePromises.push(
              SyncManager.resolveConflict("non_contracted_customers", r),
            ),
          );
        if (stagesData)
          stagesData.forEach((r: any) =>
            updatePromises.push(
              SyncManager.resolveConflict("production_stages", r),
            ),
          );
        if (settingsData)
          settingsData.forEach((r: any) =>
            updatePromises.push(SyncManager.resolveConflict("app_settings", r)),
          );
        if (paymentsData)
          paymentsData.forEach((r: any) =>
            updatePromises.push(SyncManager.resolveConflict("payments", r)),
          );
        if (clientsData)
          clientsData.forEach((r: any) =>
            updatePromises.push(SyncManager.resolveConflict("clients", r)),
          );

        await Promise.all(updatePromises);

        // Phase 4: Reload from IndexedDB to show fresh synced data and update UI
        const syncedCatalogs = await ProductService.getCatalogs();
        const syncedSheets = syncedCatalogs.map((r: any) => ({
          ...r,
          createdAt: toTimestamp(r.created_at),
        })) as CatalogSheet[];
        setCatalogs(syncedSheets);

        const syncedCustomers = await CustomerService.getAll();
        setCustomerRecords(
          syncedCustomers.map(mapCustomerFromDB).filter((c) => !isTestCustomer(c)),
        );

        const syncedInspections = await OrderService.getInspections();
        setInspections(syncedInspections.map(mapInspectionFromDB));

        const syncedContracted = await OrderService.getContracted();
        setContractedCustomers(
          sortContractedRecordsByContractDate(
            syncedContracted.map(mapInspectionFromDB),
          ),
        );

        const syncedNonContracted = await OrderService.getNonContracted();
        setNotContractedCustomers(syncedNonContracted.map(mapInspectionFromDB));

        const syncedStages = await StageService.getStages();
        setStages(syncedStages);

        const syncedSettings = await SettingsService.getSettings();
        setSettings(syncedSettings);

        const syncedPayments = await InvoiceService.getPayments();
        setAllPayments(
          syncedPayments.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paid_at: p.paid_at,
            installment: p.installment ?? null,
            note: p.note ?? null,
          })),
        );
      } catch (err) {
        console.error("Background sync fetch failed:", err);
      }
    }
  };

  const isLegacyInspectionStatusConstraintError = (error: any) => {
    const raw = [error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return raw.includes("inspections_status_check");
  };

  const isMissingRoomAroVeneerColumnError = (error: any) => {
    const raw = [error?.code, error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (raw.includes("room_aro_veneer") ||
        raw.includes("room_aro_veneer_price")) &&
      (raw.includes("schema cache") ||
        raw.includes("could not find") ||
        raw.includes("column") ||
        raw.includes("pgrst204"))
    );
  };

  const withoutRoomAroVeneer = (payload: Record<string, any>) => {
    const { room_aro_veneer, room_aro_veneer_price, ...rest } = payload;
    return rest;
  };

  const insertInspectionRecord = async (
    inspectionDbData: Record<string, any>,
  ) => {
    const id = inspectionDbData.id || crypto.randomUUID();
    const record = {
      ...inspectionDbData,
      id,
      created_at: inspectionDbData.created_at || new Date().toISOString(),
      last_modified: Date.now(),
    };
    await OrderService.insertInspection(record);
    return id;
  };

  const updateRecordWithOptionalRoomTypes = async (
    tableName:
      | "inspections"
      | "contracted_customers"
      | "non_contracted_customers",
    payload: Record<string, any>,
    id: string,
  ) => {
    if (tableName === "inspections") {
      await OrderService.updateInspection(id, payload);
      return;
    }
    if (tableName === "contracted_customers") {
      await OrderService.updateContracted(id, payload);
      return;
    }
    if (tableName === "non_contracted_customers") {
      await OrderService.updateNonContracted(id, payload);
      return;
    }
  };

  const insertRecordWithOptionalRoomTypes = async (
    tableName: "contracted_customers" | "non_contracted_customers",
    payload: Record<string, any>,
  ) => {
    const id = payload.id || crypto.randomUUID();
    const record = {
      ...payload,
      id,
      created_at: payload.created_at || new Date().toISOString(),
      last_modified: Date.now(),
    };
    if (tableName === "contracted_customers") {
      await OrderService.insertContracted(record);
      return;
    }
    if (tableName === "non_contracted_customers") {
      await OrderService.insertNonContracted(record);
      return;
    }
  };

  const deleteRecordById = async (
    table:
      | "catalogs"
      | "customers"
      | "inspections"
      | "contracted_customers"
      | "non_contracted_customers",
    id: string,
  ) => {
    // Optimistic UI: delete locally first, then queue remote sync
    switch (table) {
      case "catalogs":
        await ProductService.delete(id);
        break;
      case "customers":
        await CustomerService.delete(id);
        break;
      case "inspections":
        await OrderService.deleteInspection(id);
        break;
      case "contracted_customers":
        await OrderService.deleteContracted(id);
        break;
      case "non_contracted_customers":
        await OrderService.deleteNonContracted(id);
        break;
    }
  };

  const sendWhatsAppMessage = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("2")
      ? cleanPhone
      : `2${cleanPhone}`;
    window.open(
      `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const handleStageUpdate = async (stageId: string, status: string) => {
    if (!ensureAdminAccess()) return;
    const updates: any = { status };
    if (status === "done") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
    // Optimistic UI: update locally & queue sync
    await StageService.updateStatus(stageId, updates.status);
    if (updates.completed_at !== undefined) {
      const stageRecord = await db.production_stages.get(stageId);
      if (stageRecord) {
        await db.production_stages.put({
          ...stageRecord,
          completed_at: updates.completed_at || undefined,
          last_modified: Date.now(),
        });
        await SyncManager.queueOperation(
          "UPDATE",
          "production_stages",
          stageId,
          { completed_at: updates.completed_at },
        );
      }
    }
    const currentStage = stages.find((s) => s.id === stageId);
    if (status === "done" && currentStage) {
      const currentIdx = STAGE_ORDER.findIndex(
        (s) => s.key === currentStage.stage,
      );
      const nextStage = STAGE_ORDER[currentIdx + 1];
      if (nextStage) {
        const nextStageRecord = stages.find(
          (s) =>
            s.client_id === currentStage.client_id && s.stage === nextStage.key,
        );
        if (nextStageRecord && nextStageRecord.status === "not_started") {
          // Optimistic: update next stage locally & queue sync
          await StageService.updateStatus(nextStageRecord.id, "in_progress");
        }
      }
      // Read client data from local IndexedDB
      const clientData = currentStage.client_id
        ? await db.clients.get(currentStage.client_id)
        : null;
      if (clientData) {
        const stageName =
          lang === "ar"
            ? STAGE_ORDER.find((s) => s.key === currentStage.stage)?.ar
            : STAGE_ORDER.find((s) => s.key === currentStage.stage)?.en;
        const message =
          lang === "ar"
            ? `تم الانتهاء من مرحلة "${stageName}" في مصنع العماري للأثاث. شكراً لثقتكم.`
            : `The "${stageName}" stage has been completed at El-Amary Furniture. Thank you for your trust.`;
        const phone = clientData.phones?.[0];
        if (phone) await sendWhatsAppMessage(phone, message);
      }
    }
    await refreshAllData();
    toast.success(lang === "ar" ? "تم تحديث المرحلة" : "Stage updated");
  };

  const handleDeleteInspection = async (id: string) => {
    if (!ensureAdminAccess()) return;

    try {
      const rec = inspections.find((i) => i.id === id);
      await deleteRecordById("inspections", id);
      await refreshAllData();
      void playSound("delete");
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      await logActivity(
        "delete",
        `${lang === "ar" ? "حذف معاينة" : "Deleted inspection"} ${rec?.customerName || id}`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  useEffect(() => {
    SyncManager.init((online) => {
      setIsOnline(online);
      if (online) {
        void refreshAllData();
      }
    });

    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    const syncAuthorizedUser = async (user: User | null) => {
      setCurrentUser(user);
      setIsAuthChecking(false);

      if (user && allowedEmails.includes(user.email ?? "")) {
        try {
          if (navigator.onLine) {
            await SyncManager.triggerSync();
          }
          await refreshAllData();
        } catch (error) {
          console.error("Failed to sync dashboard data", error);
          toast.error(
            lang === "ar" ? "تعذر تحديث البيانات" : "Failed to refresh data",
          );
        }
      } else {
        clearDashboardData();
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: any } }) => {
        void syncAuthorizedUser(session?.user ?? null);
      });

    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      void syncAuthorizedUser(session?.user ?? null);
    });

    // Start polling every 30s for reliability (replaces realtime channels)
    const pollingId = setInterval(() => {
      const u = currentUserRef.current;
      if (u && allowedEmails.includes(u.email ?? "")) {
        void refreshAllData();
      }
    }, 30000);

    return () => {
      authListener.unsubscribe();
      clearInterval(pollingId);
    };
  }, []);

  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    if (!ensureAdminAccess()) {
      e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length === 0) return toast.error("File is empty");
        const title = prompt(
          lang === "ar" ? "أدخل اسم الملف:" : "Enter sheet title:",
          file.name.split(".")[0],
        );
        if (!title) return;
        setIsLoading(true);
        const newCatId = crypto.randomUUID();
        const newCat = {
          id: newCatId,
          title,
          data,
          created_at: new Date().toISOString(),
        };
        // Optimistic UI: save locally & queue sync
        await ProductService.insert(newCat);
        await refreshAllData(newCatId);
        void playSound("success");
        toast.success(
          lang === "ar" ? "تم النشر بنجاح" : "Sheet published successfully",
        );
        await logActivity(
          "upload_sheet",
          `${lang === "ar" ? "نشر ملف" : "Published sheet"} "${title}"`,
        );
      } catch (error) {
        toast.error("Failed to parse Excel file");
      }
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const deleteCatalogSection = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === "ar" ? "حذف الملف" : "Delete Sheet",
      lang === "ar"
        ? "هل أنت متأكد من حذف هذا الملف؟"
        : "Are you sure you want to delete this sheet?",
      async () => {
        try {
          const rec = catalogs.find((c) => c.id === id);
          await deleteRecordById("catalogs", id);
          await refreshAllData();
          void playSound("delete");
          toast.success(lang === "ar" ? "تم الحذف" : "Sheet deleted");
          await logActivity(
            "delete_sheet",
            `${lang === "ar" ? "حذف ملف" : "Deleted sheet"} ${rec?.title || id}`,
          );
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete");
        }
      },
    );
  };

  const handleEditCatalogRow = (
    sheetId: string,
    rowIndex: number,
    rowData: any,
  ) => {
    setEditingCatalogRow({ sheetId, rowIndex, data: { ...rowData } });
    setIsEditCatalogModalOpen(true);
  };

  const handleSaveCatalogRow = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAdminAccess()) return;
    if (!editingCatalogRow) return;

    setIsLoading(true);
    try {
      const sheet = catalogs.find(
        (c: CatalogSheet) => c.id === editingCatalogRow.sheetId,
      );
      if (!sheet) throw new Error("Sheet not found");

      const newData = [...sheet.data];
      newData[editingCatalogRow.rowIndex] = editingCatalogRow.data;

      // Optimistic UI: update locally & queue sync
      await ProductService.update(editingCatalogRow.sheetId, { data: newData });
      await refreshAllData(editingCatalogRow.sheetId);
      void playSound("success");
      toast.success(lang === "ar" ? "تم تحديث البيانات" : "Data updated");
      await logActivity(
        "edit_sheet",
        `${lang === "ar" ? "تعديل ملف" : "Edited sheet"} ${sheet?.title || editingCatalogRow.sheetId}`,
      );
      setIsEditCatalogModalOpen(false);
      setEditingCatalogRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsLoading(false);
  };

  const logActivity = async (
    type: string,
    message: string,
    details?: Record<string, any>,
  ) => {
    try {
      // Offline-first: store locally and queue for sync
      await ActivityLogService.insert({
        id: crypto.randomUUID(),
        type,
        message,
        success: true,
        details: details || null,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const targetEmail = formData.username.toLowerCase().trim();
    const targetPassword = formData.password;

    if (!targetEmail || !targetPassword) {
      toast.error(
        lang === "ar"
          ? "الرجاء إدخال البريد الإلكتروني وكلمة المرور"
          : "Please enter email and password",
      );
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });
      if (error) throw error;
      const user = data.session?.user ?? null;
      setCurrentUser(user);
      setIsAuthChecking(false);
      toast.success(
        lang === "ar" ? "تم تسجيل الدخول" : "Logged in successfully",
      );
      setFormData({ ...formData, username: "", password: "" });
      await logActivity(
        "login",
        `${targetEmail} ${lang === "ar" ? "سجل دخول" : "logged in"}`,
      );
    } catch (error: any) {
      console.error("Supabase sign-in error:", error);
      const rawMessage =
        error?.message || error?.msg || error?.error_description || null;
      const message =
        typeof rawMessage === "string" &&
        rawMessage.toLowerCase().includes("invalid api key")
          ? lang === "ar"
            ? "مفتاح Supabase في Vercel غير صحيح. افتح إعدادات Vercel وأضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY بالقيم الصحيحة من Supabase بدون علامات تنصيص، ثم أعد النشر."
            : "This Vercel deployment has an invalid Supabase key. In Vercel, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the exact values from Supabase without quotes, then redeploy."
          : rawMessage;
      toast.error(
        message || (lang === "ar" ? "بيانات غير صالحة" : "Invalid credentials"),
      );
    }
    setIsLoading(false);
  };

  const handleDeleteCustomer = async (id: string, confirmed?: boolean) => {
    if (!ensureAdminAccess()) return;
    if (!confirmed) {
      triggerConfirm(
        lang === "ar" ? "حذف العميل" : "Remove Customer",
        lang === "ar" ? "هل أنت متأكد؟" : "Are you sure?",
        () => handleDeleteCustomer(id, true),
      );
      return;
    }
    try {
      const rec = customerRecords.find((c) => c.id === id);
      await deleteRecordById("customers", id);
      await refreshAllData();
      void playSound("delete");
      toast.success(lang === "ar" ? "تم حذف العميل" : "Customer removed");
      await logActivity(
        "delete",
        `${lang === "ar" ? "حذف عميل" : "Deleted customer"} ${rec?.name || id}`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Unauthorized");
    }
  };

  const handleMoveCustomerToNonContracted = async (
    customer: CustomerRecord,
  ) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === "ar"
        ? "نقل العميل إلى غير المتعاقدين"
        : "Move customer to Non-Contracted",
      lang === "ar"
        ? "هل تريد نقل هذا العميل إلى قائمة العملاء غير المتعاقدين؟"
        : "Do you want to move this customer to the non-contracted list?",
      async () => {
        try {
          const id = crypto.randomUUID();
          const record = {
            id,
            customer_name: customer.name?.trim(),
            address: customer.address?.trim() || null,
            delivery_address: customer.deliveryAddress?.trim() || null,
            phone: customer.phone?.trim(),
            visit_date: customer.visitDate || null,
            notes: customer.notes || null,
            rooms: 0,
            pieces: [],
            total_amount: 0,
            status: "refused",
            finalized_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            last_modified: Date.now(),
          };
          await OrderService.insertNonContracted(record);
          await CustomerService.delete(customer.id);

          await refreshAllData();
          void playSound("delete");
          toast.success(
            lang === "ar"
              ? "تم نقل العميل إلى العملاء غير المتعاقدين"
              : "Customer moved to non-contracted customers",
          );
          await logActivity(
            "refuse",
            `${lang === "ar" ? "نقل إلى غير متعاقدين" : "Moved to non-contracted"} ${customer.name}`,
          );
        } catch (err: any) {
          console.error(err);
          toast.error(
            err?.message || (lang === "ar" ? "فشل النقل" : "Move failed"),
          );
        }
      },
    );
  };

  const handleLogout = async () => {
    await logActivity(
      "logout",
      `${currentUser?.email || "Unknown"} ${lang === "ar" ? "سجل خروج" : "logged out"}`,
    );
    await supabase.auth.signOut();
    toast.success("Logged out");
  };

  const handleExportExcel = (data: any[], fileName: string) => {
    try {
      const exportData = data.map((r) => ({
        [t.customerName]: r.customerName || r.name,
        [t.phoneNumber]: r.phone,
        ...(r.address ? { [t.address]: r.address } : {}),
        ...(r.deliveryAddress
          ? { [t.deliveryAddress]: r.deliveryAddress }
          : {}),
        ...(r.visitDate ? { [t.visitDate]: r.visitDate } : {}),
        ...(r.deliveryDate ? { [t.deliveryDate]: r.deliveryDate } : {}),
        ...(r.pickupDate ? { [t.pickupDate]: r.pickupDate } : {}),
        ...(r.contractDate ? { [t.contractDate]: r.contractDate } : {}),
        ...(r.portfolioDate ? { [t.portfolioDate]: r.portfolioDate } : {}),
        ...(r.notes ? { [t.notes]: r.notes } : {}),
        ...(r.totalAmount ? { [t.total]: r.totalAmount } : {}),
        [t.loginDate]: r.createdAt
          ? format(r.createdAt.toDate(), "yyyy/MM/dd HH:mm")
          : "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      toast.success(lang === "ar" ? "تم تصدير الملف" : "Excel exported");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    }
  };

  const handleInspectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAdminAccess()) return;

    if (inspectionStep === 1) {
      setIsLoading(true);
      try {
        if (inspectionFormData.id) {
          const tableName =
            editingCollection && editingCollection !== "customers"
              ? editingCollection
              : "inspections";
          const isInspectionsTable = tableName === "inspections";
          const baseUpdateData: Record<string, any> = {
            customer_name: inspectionFormData.customerName?.trim(),
            address: inspectionFormData.address?.trim(),
            delivery_address: inspectionFormData.deliveryAddress?.trim(),
            governorate: inspectionFormData.governorate || null,
            phone: inspectionFormData.phone?.trim(),
            visit_date: inspectionFormData.visitDate,
            notes: inspectionFormData.notes,
            rooms: inspectionFormData.rooms || 0,
            pieces: inspectionFormData.pieces || [],
            total_amount: inspectionFormData.totalAmount || 0,
            delivery_date: inspectionFormData.deliveryDate || null,
            pickup_date: inspectionFormData.pickupDate || null,
            portfolio_date: inspectionFormData.portfolio_date || null,
            contract_date: inspectionFormData.contractDate || null,
            portfolio: inspectionFormData.portfolio || null,
          };
          // room_types does NOT exist in the inspections table, only in finalized tables
          if (!isInspectionsTable) {
            baseUpdateData.room_types = inspectionFormData.room_types || [];
          }
          await updateRecordWithOptionalRoomTypes(
            tableName,
            baseUpdateData,
            inspectionFormData.id,
          );
        } else if (editingId) {
          await CustomerService.update(editingId, {
            name: inspectionFormData.customerName?.trim(),
            phone: inspectionFormData.phone?.trim(),
            address: inspectionFormData.address?.trim(),
            delivery_address: inspectionFormData.deliveryAddress?.trim(),
            governorate: inspectionFormData.governorate || null,
            visit_date: inspectionFormData.visitDate,
            notes: inspectionFormData.notes,
            pickup_date: inspectionFormData.pickupDate || null,
            portfolio_date: inspectionFormData.portfolio_date || null,
          });
        }
        await refreshAllData();
        void playSound("success");
        toast.success(lang === "ar" ? "تم الحفظ بنجاح" : "Saved successfully");

        // Notify customer about visit date when step 1 is saved
        if (inspectionFormData.phone && inspectionFormData.visitDate) {
          const dateStr = new Date(
            inspectionFormData.visitDate,
          ).toLocaleDateString("ar-EG");
          const msg =
            lang === "ar"
              ? `السلام عليكم، تم تحديد معاد معاينتك يوم ${dateStr} لمصنع العماري للأثاث. برجاء التكرم بالحضور في المعاد المحدد. شكراً لثقتكم.`
              : `Hello, your inspection appointment has been scheduled for ${dateStr} at El-Amary Furniture. Please attend on the specified date. Thank you for your trust.`;
          sendWhatsAppMessage(inspectionFormData.phone, msg);
        }
        // Notify customer about portfolio date when set for contracted customers
        if (
          editingCollection === "contracted_customers" &&
          inspectionFormData.phone &&
          inspectionFormData.portfolioDate
        ) {
          const dateStr = new Date(
            inspectionFormData.portfolioDate,
          ).toLocaleDateString("ar-EG");
          const msg =
            lang === "ar"
              ? `السلام عليكم، تم تحديد معاد البورتفوليو يوم ${dateStr} لمصنع العماري للأثاث. برجاء التكرم بالحضور في المعاد المحدد. شكراً لثقتكم.`
              : `Hello, your portfolio appointment has been scheduled for ${dateStr} at El-Amary Furniture. Please attend on the specified date. Thank you for your trust.`;
          sendWhatsAppMessage(inspectionFormData.phone, msg);
        }

        // If editing a customer or contracted customer, move to step 2 for pieces
        if (
          editingCollection === "customers" ||
          editingCollection === "contracted_customers" ||
          !inspectionFormData.id
        ) {
          setInspectionStep(2);
        } else {
          // If editing other finalized records, close modal
          setIsInspectionModalOpen(false);
          setInspectionStep(1);
          setEditingId(null);
          setEditingCollection(null);
        }
      } catch (err: any) {
        toast.error(err.message);
      }
      setIsLoading(false);
      return;
    }

    // Step 2+: save rooms, pieces, total
    setIsLoading(true);
    try {
      if (editingCollection && editingCollection !== "customers") {
        const inspectionId = inspectionFormData.id;
        if (!inspectionId) throw new Error("Missing inspection id");
        // Editing inspections / contracted / non-contracted - update pieces/rooms/total
        const step2Payload: Record<string, any> = {
          rooms: inspectionFormData.rooms || 0,
          pieces: inspectionFormData.pieces || [],
          total_amount: inspectionFormData.totalAmount || 0,
          portfolio: inspectionFormData.portfolio || null,
          portfolio_date: inspectionFormData.portfolioDate || null,
          room_aro_veneer: inspectionFormData.room_aro_veneer || {},
          room_aro_veneer_price: inspectionFormData.room_aro_veneer_price || {},
        };
        // room_types only exists on contracted_customers / non_contracted_customers, NOT on inspections
        if (editingCollection !== "inspections") {
          step2Payload.room_types = inspectionFormData.room_types || [];
        }
        await updateRecordWithOptionalRoomTypes(
          editingCollection,
          step2Payload,
          inspectionId,
        );
        await refreshAllData();
        void playSound("success");
        toast.success(lang === "ar" ? "تم الحفظ بنجاح" : "Saved successfully");
        await logActivity(
          editingCollection === "contracted_customers"
            ? "update_contract"
            : "update_inspection",
          `${lang === "ar" ? "تحديث بيانات" : "Updated"} ${inspectionFormData.customerName}`,
        );
        setIsInspectionModalOpen(false);
        setInspectionStep(1);
        setEditingId(null);
        setEditingCollection(null);
        setInspectionFormData({
          customerName: "",
          address: "",
          deliveryAddress: "",
          phone: "",
          visitDate: "",
          notes: "",
          rooms: 0,
          pieces: [],
          totalAmount: 0,
          deliveryDate: "",
          pickupDate: "",
          portfolioDate: "",
          contractDate: "",
          portfolio: "",
        });
        setIsLoading(false);
        return;
      }

      // NOTE: The 'inspections' table does NOT have a 'room_types' column.
      // rooms, pieces, total_amount DO exist in inspections.
      const inspectionDbData = {
        customer_name: inspectionFormData.customerName?.trim(),
        address: inspectionFormData.address?.trim(),
        delivery_address: inspectionFormData.deliveryAddress?.trim(),
        governorate: inspectionFormData.governorate || null,
        phone: inspectionFormData.phone?.trim(),
        visit_date: inspectionFormData.visitDate,
        rooms: inspectionFormData.rooms || 0,
        pieces: inspectionFormData.pieces || [],
        total_amount: inspectionFormData.totalAmount || 0,
        portfolio: inspectionFormData.portfolio || null,
        room_aro_veneer: inspectionFormData.room_aro_veneer || {},
        room_aro_veneer_price: inspectionFormData.room_aro_veneer_price || {},
        pickup_date: inspectionFormData.pickupDate || null,
        portfolio_date: inspectionFormData.portfolioDate || null,
        contract_date: inspectionFormData.contractDate || null,
      };

      if (inspectionFormData.id) {
        // Update existing inspection record via service
        await OrderService.updateInspection(
          inspectionFormData.id,
          inspectionDbData,
        );
      } else {
        // Create new inspection and remove from customers
        const newId = await insertInspectionRecord(inspectionDbData);
        if (editingCollection === "customers" && newId) {
          setInspectionFormData((prev) => ({ ...prev, id: newId }));
          setEditingCollection(null);
          setEditingId(null);
          await refreshAllData();
          void playSound("success");
          toast.success(
            lang === "ar"
              ? "تم نقل العميل إلى المعاينات"
              : "Customer moved to Inspections",
          );
          await logActivity(
            "move_to_inspection",
            `${lang === "ar" ? "نقل" : "Moved"} ${inspectionFormData.customerName} ${lang === "ar" ? "إلى المعاينات" : "to inspections"}`,
          );
          setIsInspectionModalOpen(false);
          setInspectionStep(1);
          setIsLoading(false);
          return;
        }
      }

      await refreshAllData();
      void playSound("success");
      toast.success(
        lang === "ar" ? "تم حفظ بيانات المعاينة" : "Inspection data saved",
      );
      await logActivity(
        "create_inspection",
        `${lang === "ar" ? "إنشاء معاينة لـ" : "Created inspection for"} ${inspectionFormData.customerName}`,
      );
      setIsInspectionModalOpen(false);
      setInspectionStep(1);
      setEditingId(null);
      setEditingCollection(null);
      setInspectionFormData({
        customerName: "",
        address: "",
        deliveryAddress: "",
        phone: "",
        visitDate: "",
        notes: "",
        rooms: 0,
        room_types: [],
        pieces: [],
        totalAmount: 0,
        deliveryDate: "",
        pickupDate: "",
        portfolioDate: "",
        contractDate: "",
        portfolio: "",
      });
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsLoading(false);
  };

  // Image compression utility function
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");

          let width = img.width;
          let height = img.height;
          const maxWidth = 1600;
          const maxHeight = 1600;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to compress image"));
              }
            },
            "image/jpeg",
            0.82,
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  };

  const handleContractUpload = async (file: File) => {
    if (!pendingContractInspection) return;
    if (!file.type.startsWith("image/")) {
      toast.error(
        lang === "ar"
          ? "يرجى اختيار صورة صالحة للعقد"
          : "Please choose a valid contract image",
      );
      return;
    }

    setContractUploadLoading(true);
    let toastId: string | undefined;
    try {
      toastId = toast.loading(
        lang === "ar" ? "جاري ضغط الصورة..." : "Compressing image...",
      );
      const compressedBlob = await compressImage(file);

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const fileName = `contract_${pendingContractInspection.id}_${timestamp}_${randomId}.jpg`;

      toast.loading(
        lang === "ar" ? "جاري رفع العقد..." : "Uploading contract...",
        {
          id: toastId,
        },
      );
      let uploadResult = await supabase.storage
        .from(CONTRACT_BUCKET)
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (
        uploadResult.error &&
        (uploadResult.error.message?.includes("Invalid key") ||
          uploadResult.error.message?.includes("row-level security"))
      ) {
        uploadResult = await supabase.storage
          .from(CONTRACT_BUCKET)
          .upload(fileName, compressedBlob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });
      }

      if (uploadResult.error) {
        const errorMsg = uploadResult.error.message || "Storage upload failed";
        if (errorMsg.includes("row-level security")) {
          throw new Error(
            lang === "ar"
              ? "فشل رفع العقد: إعدادات أمان Supabase تمنع رفع الملفات. تحقق من صلاحيات bucket في Supabase Storage أو استخدم مفاتيح خدمة صحيحة."
              : "Contract upload blocked by Supabase row-level security. Check your Storage bucket policies or use the correct service key.",
          );
        }
        if (errorMsg.includes("Bucket not found")) {
          throw new Error(
            lang === "ar"
              ? `فشل رفع العقد: لم يتم العثور على bucket باسم ${CONTRACT_BUCKET}. تحقق من وجوده في Supabase Storage.`
              : `Contract upload failed: bucket not found: ${CONTRACT_BUCKET}.`,
          );
        }
        throw uploadResult.error;
      }

      const publicUrlData = supabase.storage
        .from(CONTRACT_BUCKET)
        .getPublicUrl(fileName);
      if (publicUrlData.error) throw publicUrlData.error;
      const contractUrl = publicUrlData.data?.publicUrl;
      if (!contractUrl) throw new Error("Unable to build contract URL");

      toast.loading(
        lang === "ar" ? "جاري حفظ البيانات..." : "Saving order...",
        {
          id: toastId,
        },
      );
      await handleFinalizeInspection(
        "contracted",
        pendingContractInspection,
        contractUrl,
      );

      setIsContractUploadOpen(false);
      setPendingContractInspection(null);
      toast.success(
        lang === "ar"
          ? "تم تحميل العقد بنجاح ✓"
          : "Contract uploaded successfully",
        { id: toastId },
      );
    } catch (err: any) {
      console.error("Contract upload error:", err);
      const message =
        err?.message ||
        (lang === "ar"
          ? "فشل رفع العقد: حدث خطأ غير متوقع"
          : "Contract upload failed: unexpected error");
      toast.error(message, { id: toastId });
    } finally {
      setContractUploadLoading(false);
    }
  };

  const handleContractInputSelection = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleContractUpload(file);
    event.target.value = "";
  };

  const handleFinalizeInspection = async (
    status: "contracted" | "refused",
    directRecord?: Inspection,
    contractUrl?: string,
  ) => {
    if (!ensureAdminAccess()) return;

    setIsLoading(true);
    try {
      const recordToSave = directRecord || inspectionFormData;
      const tableName =
        status === "contracted"
          ? "contracted_customers"
          : "non_contracted_customers";

      const dbData = {
        customer_name: recordToSave.customerName?.trim(),
        address: recordToSave.address?.trim(),
        delivery_address: recordToSave.deliveryAddress?.trim(),
        governorate: recordToSave.governorate || null,
        phone: recordToSave.phone?.trim(),
        visit_date: recordToSave.visitDate,
        notes: recordToSave.notes,
        rooms: recordToSave.rooms || 0,
        room_types: recordToSave.room_types || [],
        pieces: recordToSave.pieces || [],
        total_amount: recordToSave.totalAmount || 0,
        room_aro_veneer: recordToSave.room_aro_veneer || {},
        room_aro_veneer_price: recordToSave.room_aro_veneer_price || {},
        status,
        portfolio: recordToSave.portfolio || null,
        delivery_date: recordToSave.deliveryDate || null,
        pickup_date: recordToSave.pickupDate || recordToSave.address || null,
        portfolio_date: recordToSave.portfolioDate || null,
        contract_date: recordToSave.contractDate || null,
        contract_url: contractUrl || null,
        finalized_at: new Date().toISOString(),
      };
      await insertRecordWithOptionalRoomTypes(tableName, dbData);
      const inspectionId = directRecord?.id || inspectionFormData.id;
      if (inspectionId) {
        // Optimistic UI: delete inspection locally & queue sync
        await OrderService.deleteInspection(inspectionId);
      }
      if (status === "contracted") {
        const phone = recordToSave.phone?.trim();
        const name = recordToSave.customerName?.trim();
        if (phone) {
          // Check local clients first
          let localClient = await CustomerService.getClientByPhone(phone);
          let clientId = localClient?.id || null;
          if (!clientId) {
            clientId = crypto.randomUUID();
            await CustomerService.saveClient({
              id: clientId,
              name: name || phone,
              phones: [phone],
            });
          }
          if (clientId) {
            const stagesPayload = STAGE_ORDER.map((stage) => ({
              id: crypto.randomUUID(),
              client_id: clientId,
              visit_id: null,
              stage: stage.key,
              status: "not_started",
              created_at: new Date().toISOString(),
            }));
            // Optimistic UI: insert stages locally & queue sync
            await StageService.insertMultiple(stagesPayload);
          }
        }
      }
      await refreshAllData();
      if (status === "contracted" && recordToSave.phone) {
        const msg =
          lang === "ar"
            ? `السلام عليكم، تم التعاقد مع مصنع العماري للأثاث. سيتم التواصل معكم قريباً لترتيب معاد البورتفوليو وتجهيز طلبكم. شكراً لثقتكم.`
            : `Hello, the contract has been signed with El-Amary Furniture. We will contact you soon to arrange a portfolio appointment and prepare your order. Thank you for your trust.`;
        sendWhatsAppMessage(recordToSave.phone, msg);
      }
      void playSound("success");
      toast.success(lang === "ar" ? "تمت العملية بنجاح" : "Process completed");
      await logActivity(
        status === "contracted" ? "contract" : "refuse",
        `${status === "contracted" ? (lang === "ar" ? "تعاقد مع" : "Contracted with") : lang === "ar" ? "رفض" : "Refused"} ${recordToSave.customerName}`,
      );
      setIsInspectionModalOpen(false);
      setInspectionStep(1);
      setEditingId(null);
      setEditingCollection(null);
      setInspectionFormData({
        customerName: "",
        address: "",
        phone: "",
        visitDate: "",
        notes: "",
        rooms: 0,
        room_types: [],
        pieces: [],
        totalAmount: 0,
        deliveryAddress: "",
        governorate: "",
      });
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsLoading(false);
  };

  const handleDeleteContracted = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === "ar" ? "حذف السجل" : "Delete Record",
      lang === "ar" ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure?",
      async () => {
        try {
          const rec = contractedCustomers.find((c) => c.id === id);
          if (rec) {
            const existingCustomer = await CustomerService.getAll();
            const hasCustomer = existingCustomer.some(
              (c) => c.phone === rec.phone || c.name === rec.customerName,
            );
            if (!hasCustomer) {
              await CustomerService.insert({
                id: crypto.randomUUID(),
                name: rec.customerName || rec.phone || "",
                phone: rec.phone || "",
                address: rec.address || "",
                delivery_address: rec.deliveryAddress || "",
                visit_date: rec.visitDate || null,
                notes: rec.notes || null,
                governorate: rec.governorate || null,
                created_at: new Date().toISOString(),
              });
            }
          }
          await deleteRecordById("contracted_customers", id);
          await refreshAllData();
          void playSound("delete");
          toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
          await logActivity(
            "delete",
            `${lang === "ar" ? "حذف متعاقد" : "Deleted contracted"} ${rec?.customerName || id}`,
          );
        } catch (err: any) {
          toast.error(err?.message || "Unauthorized");
        }
      },
    );
  };

  const handleDeleteNonContracted = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === "ar" ? "حذف السجل" : "Delete Record",
      lang === "ar" ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure?",
      async () => {
        try {
          const rec = notContractedCustomers.find((c) => c.id === id);
          if (rec) {
            const existingCustomer = await CustomerService.getAll();
            const hasCustomer = existingCustomer.some(
              (c) => c.phone === rec.phone || c.name === rec.customerName,
            );
            if (!hasCustomer) {
              await CustomerService.insert({
                id: crypto.randomUUID(),
                name: rec.customerName || rec.phone || "",
                phone: rec.phone || "",
                address: rec.address || "",
                delivery_address: rec.deliveryAddress || "",
                visit_date: rec.visitDate || null,
                notes: rec.notes || null,
                governorate: rec.governorate || null,
                created_at: new Date().toISOString(),
              });
            }
          }
          await deleteRecordById("non_contracted_customers", id);
          await refreshAllData();
          void playSound("delete");
          toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
          await logActivity(
            "delete",
            `${lang === "ar" ? "حذف غير متعاقد" : "Deleted non-contracted"} ${rec?.customerName || id}`,
          );
        } catch (err: any) {
          toast.error(err?.message || "Unauthorized");
        }
      },
    );
  };

  const handleMoveNonContractedToContracted = async (r: Inspection) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === "ar" ? "نقل للمتعاقدين" : "Move to Contracted",
      lang === "ar"
        ? "هل أنت متأكد من نقل العميل إلى المتعاقدين؟"
        : "Are you sure you want to move this customer to contracted?",
      async () => {
        setIsLoading(true);
        try {
          const dbData = {
            customer_name: r.customerName?.trim(),
            address: r.address?.trim(),
            delivery_address: r.deliveryAddress?.trim(),
            governorate: r.governorate || null,
            phone: r.phone?.trim(),
            visit_date: r.visitDate,
            notes: r.notes,
            rooms: r.rooms || 0,
            room_types: r.room_types || [],
            pieces: r.pieces || [],
            total_amount: r.totalAmount || 0,
            room_aro_veneer: r.room_aro_veneer || {},
            room_aro_veneer_price: r.room_aro_veneer_price || {},
            status: "contracted",
            portfolio: r.portfolio || null,
            delivery_date: r.deliveryDate || null,
            pickup_date: r.pickupDate || r.address || null,
            portfolio_date: r.portfolioDate || null,
            contract_date: r.contractDate || null,
            finalized_at: new Date().toISOString(),
          };

          await insertRecordWithOptionalRoomTypes(
            "contracted_customers",
            dbData,
          );
          await deleteRecordById("non_contracted_customers", r.id);

          const phone = r.phone?.trim();
          const name = r.customerName?.trim();
          if (phone) {
            let localClient = await CustomerService.getClientByPhone(phone);
            let clientId = localClient?.id || null;
            if (!clientId) {
              clientId = crypto.randomUUID();
              await CustomerService.saveClient({
                id: clientId,
                name: name || phone,
                phones: [phone],
              });
            }
            if (clientId) {
              const stagesPayload = STAGE_ORDER.map((stage) => ({
                id: crypto.randomUUID(),
                client_id: clientId,
                visit_id: null,
                stage: stage.key,
                status: "not_started",
                created_at: new Date().toISOString(),
              }));
              await StageService.insertMultiple(stagesPayload);
            }
          }

          await refreshAllData();
          if (r.phone) {
            const msg =
              lang === "ar"
                ? `السلام عليكم، تم التعاقد مع مصنع العماري للأثاث. سيتم التواصل معكم قريباً لترتيب معاد البورتفوليو وتجهيز طلبكم. شكراً لثقتكم.`
                : `Hello, the contract has been signed with El-Amary Furniture. We will contact you soon to arrange a portfolio appointment and prepare your order. Thank you for your trust.`;
            sendWhatsAppMessage(r.phone, msg);
          }
          void playSound("success");
          toast.success(
            lang === "ar" ? "تم النقل للمتعاقدين" : "Moved to Contracted",
          );
          await logActivity(
            "status_change",
            `نقل غير متعاقد للمتعاقدين ${name || r.id}`,
          );
        } catch (err: any) {
          toast.error(err?.message || "Error");
        } finally {
          setIsLoading(false);
        }
      },
    );
  };

  const computeInspectionTotalAmount = (pieces: FurniturePiece[]) => {
    return pieces.reduce((sum, p) => sum + pieceTotal(p), 0);
  };

  const getRoomInstanceKey = (roomType: string, roomIndex: number) =>
    `${roomType}:${roomIndex + 1}`;

  const pieceMatchesRoomInstance = (
    piece: FurniturePiece,
    roomType: string,
    roomInstanceId: string,
    roomIndex: number,
  ) => {
    if (piece.room_instance_id) {
      return piece.room_instance_id === roomInstanceId;
    }
    return (piece.room_type || "other") === roomType && roomIndex === 0;
  };

  const addPiece = (
    name: string,
    roomType?: string,
    roomInstanceId?: string,
  ) => {
    const resolvedRoomType =
      roomType || inspectionFormData.room_types?.[0] || "other";
    const resolvedInstanceId =
      roomInstanceId || getRoomInstanceKey(resolvedRoomType, 0);

    setInspectionFormData((prev) => {
      const pieces = [...(prev.pieces || [])];
      const existingIndex = pieces.findIndex(
        (p) =>
          p.name === name &&
          pieceMatchesRoomInstance(
            p,
            resolvedRoomType,
            resolvedInstanceId,
            0,
          ),
      );

      if (existingIndex >= 0) {
        pieces[existingIndex].quantity =
          (pieces[existingIndex].quantity || 1) + 1;
      } else {
        pieces.push({
          name,
          price: 0,
          quantity: 1,
          room_type: resolvedRoomType,
          room_instance_id: resolvedInstanceId,
          aro_veneer_addon: false,
          aro_surcharge: 0,
        });
      }

      return {
        ...prev,
        pieces,
        totalAmount: computeInspectionTotalAmount(pieces),
      };
    });
  };

  const getRoomTypeCount = (roomKey: string) =>
    (inspectionFormData.room_types || []).filter((key) => key === roomKey)
      .length;

  const syncRoomCount = (roomTypes: string[]) => Math.max(0, roomTypes.length);

  const buildRoomTypeState = (
    nextRoomTypes: string[],
    pieces: FurniturePiece[] = inspectionFormData.pieces || [],
  ) => ({
    room_types: nextRoomTypes,
    rooms: syncRoomCount(nextRoomTypes),
    totalAmount: computeInspectionTotalAmount(pieces),
  });

  const toggleRoomType = (roomKey: string) => {
    setInspectionFormData((prev) => {
      const roomTypes = prev.room_types || [];
      const selectedIndex = roomTypes.indexOf(roomKey);
      const nextRoomTypes =
        selectedIndex >= 0
          ? roomTypes.filter((_, index) => index !== selectedIndex)
          : [...roomTypes, roomKey];
      return {
        ...prev,
        ...buildRoomTypeState(nextRoomTypes, prev.pieces || []),
      };
    });
  };

  const addRoomTypeInstance = (roomKey: string) => {
    setInspectionFormData((prev) => {
      const roomTypes = prev.room_types || [];
      const nextRoomTypes = [...roomTypes, roomKey];
      return {
        ...prev,
        ...buildRoomTypeState(nextRoomTypes, prev.pieces || []),
      };
    });
  };

  const removeRoomTypeInstance = (roomKey: string, roomIndex?: number) => {
    setInspectionFormData((prev) => {
      const roomTypes = prev.room_types || [];
      if (!roomTypes.length) return prev;
      const indexToRemove =
        typeof roomIndex === "number" && roomIndex >= 0
          ? roomIndex
          : roomTypes.findIndex((key) => key === roomKey);
      if (indexToRemove < 0) return prev;
      const nextRoomTypes = roomTypes.filter(
        (_, index) => index !== indexToRemove,
      );
      return {
        ...prev,
        ...buildRoomTypeState(nextRoomTypes, prev.pieces || []),
      };
    });
  };

  const updatePiece = (index: number, field: string, value: any) => {
    setInspectionFormData((prev) => {
      const pieces = [...(prev.pieces || [])];
      pieces[index] = { ...pieces[index], [field]: value };
      return {
        ...prev,
        pieces,
        totalAmount: computeInspectionTotalAmount(pieces),
      };
    });
  };

  const pieceTotal = (piece: FurniturePiece) =>
    Number(piece.price || 0) * Number(piece.quantity || 1) +
    (piece.aro_veneer_addon ? Number(piece.aro_surcharge || 0) : 0);
  const inspectionRoomSubtotal = (
    roomType: string,
    roomInstanceId: string,
    roomIndex: number,
  ) =>
    (inspectionFormData.pieces || [])
      .filter((p) => pieceMatchesRoomInstance(p, roomType, roomInstanceId, roomIndex))
      .reduce((sum, p) => sum + pieceTotal(p), 0);
  const availableRoomTypes = inspectionFormData.room_types?.length
    ? inspectionFormData.room_types
    : ["other"];

  const updatePiecePrice = (index: number, price: number) => {
    setInspectionFormData((prev) => {
      const pieces = [...(prev.pieces || [])];
      pieces[index].price = price;
      return {
        ...prev,
        pieces,
        totalAmount: computeInspectionTotalAmount(pieces),
      };
    });
  };

  const removePiece = (index: number) => {
    setInspectionFormData((prev) => {
      const pieces =
        prev.pieces?.filter((_: any, i: number) => i !== index) || [];
      return {
        ...prev,
        pieces,
        totalAmount: computeInspectionTotalAmount(pieces),
      };
    });
  };

  const handleOpenAddModal = () => {
    setFormData({
      ...formData,
      name: "",
      phone: "",
      phones: [""],
      pickupDate: "",
      address: "",
      governorate: "",
    });
    setModalMode("add");
    setEditingCollection(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: any) => {
    const phones = normalizePhoneList(record.phone);
    setFormData({
      ...formData,
      name: record.name,
      phone: phones[0] || "",
      phones,
      pickupDate: record.pickupDate || "",
      address: record.address || record.pickupDate || "",
      governorate: record.governorate || "",
    });
    setEditingId(record.id);
    setEditingCollection("customers");
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const [governorateFilter, setGovernorateFilter] = useState<
    "all" | "القاهرة" | "الاسكندرية"
  >("all");
  const [phonebookStatusFilter, setPhonebookStatusFilter] = useState<
    "all" | "contracted" | "not-contracted" | "customers" | "inspections"
  >("all");

  const matchesFilters = (r: any) => {
    const searchMatch =
      !searchQuery ||
      String(r.name || r.customerName || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      String(r.phone || "").includes(searchQuery);
    const govMatch =
      governorateFilter === "all" ||
      (r.governorate || "") === governorateFilter;
    return searchMatch && govMatch;
  };

  const isPhonebookEntryVisible = (sources: string[]) => {
    if (phonebookStatusFilter === "all") return true;
    if (phonebookStatusFilter === "contracted")
      return sources.includes("contracted");
    if (phonebookStatusFilter === "not-contracted")
      return sources.includes("not-contracted");
    if (phonebookStatusFilter === "customers")
      return sources.includes("customers");
    if (phonebookStatusFilter === "inspections")
      return sources.includes("inspections");
    return true;
  };

  const openEditFinalizedRecord = (
    record: Inspection,
    collection: "contracted_customers" | "non_contracted_customers",
  ) => {
    setInspectionFormData({ ...record });
    setEditingId(record.id);
    setEditingCollection(collection);
    setInspectionStep(1);
    setIsInspectionModalOpen(true);
  };

  const handlePortfolioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error(
        lang === "ar" ? "يجب اختيار ملف PDF" : "Please select a PDF file",
      );
      return;
    }
    try {
      // Sanitize filename: remove non-ASCII characters and spaces
      // Create a URL-safe storage key
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 11);
      const safeFileName = `portfolio-${timestamp}-${randomId}.pdf`;

      console.log("Original file name:", file.name);
      console.log("Safe storage key:", safeFileName);

      // Use Supabase client storage API
      let uploadResult = await supabase.storage
        .from("portfolios")
        .upload(safeFileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      // If upload fails with invalid key error, try with upsert=true
      if (
        uploadResult.error &&
        (uploadResult.error.message?.includes("Invalid key") ||
          uploadResult.error.message?.includes("row-level security"))
      ) {
        console.warn(
          "Initial upload failed; retrying with upsert flag...",
          uploadResult.error,
        );
        uploadResult = await supabase.storage
          .from("portfolios")
          .upload(safeFileName, file, {
            cacheControl: "3600",
            upsert: true,
          });
      }

      if (uploadResult.error) {
        console.error("Supabase storage error:", uploadResult.error);
        throw new Error(uploadResult.error.message || "Failed to upload file");
      }

      if (uploadResult.data) {
        const publicUrl = supabase.storage
          .from("portfolios")
          .getPublicUrl(safeFileName).data.publicUrl;

        setInspectionFormData((prev) => ({ ...prev, portfolio: publicUrl }));
        toast.success(
          lang === "ar" ? "تم رفع البورتفوليو" : "Portfolio uploaded",
        );
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      const errorMsg =
        err.message || (lang === "ar" ? "فشل رفع الملف" : "Upload failed");
      toast.error(
        lang === "ar"
          ? `فشل رفع الملف: ${errorMsg}`
          : `Upload failed: ${errorMsg}`,
      );
    }
  };

  const handleSaveRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAdminAccess()) return;
    const phones = (formData.phones || [])
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (!formData.name.trim() || phones.length === 0)
      return toast.error("Please enter data");
    const combinedPhone = phones.join(", ");
    setIsLoading(true);
    try {
      if (modalMode === "add") {
        // Check local IndexedDB for existing record first
        const localExisting = await db.customers
          .filter((c) => c.phone === combinedPhone)
          .first();

        if (localExisting) {
          toast.error("Already registered");
          setIsLoading(false);
          return;
        }

        const newCustomer = {
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          phone: combinedPhone,
          address: formData.address || null,
          pickup_date: formData.pickupDate || null,
          governorate: formData.governorate || null,
          created_at: new Date().toISOString(),
        };
        // Optimistic UI: save locally & queue sync
        await CustomerService.insert(newCustomer);
        await refreshAllData();
        void playSound("success");
        toast.success("Added success");
      } else {
        const updates = {
          name: formData.name.trim(),
          phone: combinedPhone,
          address: formData.address || null,
          pickup_date: formData.pickupDate || null,
          governorate: formData.governorate || null,
        };
        // Optimistic UI: update locally & queue sync
        await CustomerService.update(editingId!, updates);
        await refreshAllData();
        void playSound("success");
        toast.success("Updated success");
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
    setIsLoading(false);
  };

  if (isAuthChecking)
    return (
      <div className="min-h-screen bg-[#f2eee8] flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center mb-8">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Armchair className="w-10 h-10 text-[#d4a373]" />
            </motion.div>
          </div>
          <div className="skeleton h-8 w-3/4 mx-auto" />
          <div className="skeleton h-4 w-1/2 mx-auto" />
          <div className="space-y-3 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
          <div className="space-y-2 mt-4">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        </div>
      </div>
    );

  return (
    <div
      className={`min-h-screen bg-[#f2eee8] text-zinc-800 font-sans selection:bg-[#d4a373] selection:text-white flex flex-col w-full`}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <Toaster position="bottom-center" />

      {/* Premium Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div
          className="bg-blob bg-[#d4a373]/20 top-[-10%] left-[-5%]"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="bg-blob bg-[#a5a58d]/15 bottom-[5%] right-[-5%]"
          style={{ animationDelay: "-5s" }}
        />
        <div
          className="bg-blob bg-white/30 top-[30%] right-[15%]"
          style={{ animationDelay: "-10s", width: "300px", height: "300px" }}
        />
      </div>
      <Armchair
        style={{
          position: "fixed",
          width: "500px",
          height: "500px",
          top: "-10%",
          right: "-8%",
          transform: "rotate(15deg)",
          opacity: 0.12,
          pointerEvents: "none",
          zIndex: -1,
          color: "#d4a373",
        }}
      />
      <Armchair
        style={{
          position: "fixed",
          width: "320px",
          height: "320px",
          top: "-5%",
          left: "-5%",
          transform: "rotate(-25deg)",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: -1,
          color: "#a5a58d",
        }}
      />
      <Armchair
        style={{
          position: "fixed",
          width: "400px",
          height: "400px",
          bottom: "-10%",
          right: "5%",
          transform: "rotate(-15deg)",
          opacity: 0.1,
          pointerEvents: "none",
          zIndex: -1,
          color: "#d4a373",
        }}
      />
      <Armchair
        style={{
          position: "fixed",
          width: "280px",
          height: "280px",
          bottom: "-5%",
          left: "-5%",
          transform: "rotate(20deg)",
          opacity: 0.09,
          pointerEvents: "none",
          zIndex: -1,
          color: "#a5a58d",
        }}
      />
      <Armchair
        className="hidden lg:block"
        style={{
          position: "fixed",
          width: "180px",
          height: "180px",
          top: "30%",
          left: "10%",
          transform: "rotate(40deg)",
          opacity: 0.07,
          pointerEvents: "none",
          zIndex: -1,
          color: "#d4a373",
        }}
      />
      <Armchair
        className="hidden lg:block"
        style={{
          position: "fixed",
          width: "150px",
          height: "150px",
          top: "60%",
          right: "5%",
          transform: "rotate(-30deg)",
          opacity: 0.06,
          pointerEvents: "none",
          zIndex: -1,
          color: "#a5a58d",
        }}
      />
      <Armchair
        className="hidden md:block"
        style={{
          position: "fixed",
          width: "100px",
          height: "100px",
          top: "50%",
          left: "50%",
          transform: "rotate(10deg)",
          opacity: 0.04,
          pointerEvents: "none",
          zIndex: -1,
          color: "#d4a373",
        }}
      />

      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            className="min-h-screen flex items-center justify-center p-6 text-center space-y-12 w-full"
          >
            <div className="max-w-2xl w-full">
              <div className="flex justify-center mb-8">
                <button
                  onClick={() => setLang(lang === "en" ? "ar" : "en")}
                  className="flex items-center gap-3 px-6 py-3 rounded-2xl glass btn-3d btn-3d-glass hover:bg-white/40 transition-all text-sm font-bold shadow-sm"
                >
                  <Languages className="w-4 h-4 text-accent-tan" />{" "}
                  {lang === "en" ? "العربية" : "English"}
                </button>
              </div>
              <Armchair className="w-20 h-20 text-accent-tan mx-auto mb-8 animate-pulse" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-zinc-900 mb-4">
                {t.brand}
              </h1>
              <p className="text-xl text-zinc-500 font-medium">
                {t.welcomeDesc}
              </p>
              <motion.button
                onClick={() => setShowSplash(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-12 px-12 py-6 bg-zinc-900 text-white rounded-[2rem] text-xl font-bold uppercase tracking-[0.2em] btn-3d btn-3d-zinc"
              >
                {t.start}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col md:flex-row w-full min-h-screen"
          >
            {/* Mobile Header Bar */}
            {currentUser && isAuthorizedUser && (
              <div className="md:hidden sticky top-0 w-full z-40 glass-dark flex items-center justify-between p-4 border-b border-black/5">
                <div className="logo border-b-2 border-accent-tan pb-0.5 text-lg font-bold tracking-widest uppercase">
                  {t.brand}
                </div>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-xl hover:bg-black/5 transition-all"
                  id="mobile-menu-toggle"
                >
                  {sidebarOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}

            {/* Mobile Navigation Drawer */}
            <AnimatePresence>
              {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSidebarOpen(false)}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  />
                  {/* Drawer Panel */}
                  <motion.aside
                    initial={{ x: lang === "ar" ? "100%" : "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: lang === "ar" ? "100%" : "-100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 220 }}
                    className="absolute top-0 bottom-0 right-0 rtl:right-0 ltr:left-0 ltr:right-auto w-72 max-w-full bg-[#f2eee8]/95 backdrop-blur-md border-x border-black/5 h-full flex flex-col p-6 shadow-2xl z-10"
                    dir={lang === "ar" ? "rtl" : "ltr"}
                  >
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/5">
                      <div className="logo border-b-2 border-accent-tan pb-1 text-xl font-bold tracking-widest uppercase">
                        {t.brand}
                      </div>
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 rounded-xl hover:bg-black/5 transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <nav className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar">
                      {currentUser && isAuthorizedUser ? (
                        <>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "dashboard" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("dashboard");
                              setSidebarOpen(false);
                            }}
                          >
                            <LayoutDashboard className="w-4 h-4" />{" "}
                            {t.dashboard}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "customers" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("customers");
                              setSidebarOpen(false);
                            }}
                          >
                            <UserIcon className="w-4 h-4" /> {t.customers}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "inspections" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("inspections");
                              setSidebarOpen(false);
                            }}
                          >
                            <ClipboardList className="w-4 h-4" />{" "}
                            {t.inspections}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "contracted" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("contracted");
                              setSidebarOpen(false);
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4" /> {t.contracted}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "not-contracted" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("not-contracted");
                              setSidebarOpen(false);
                            }}
                          >
                            <X className="w-4 h-4" /> {t.notContracted}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "production" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("production");
                              setSidebarOpen(false);
                            }}
                          >
                            <Wrench className="w-4 h-4" /> {t.production}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "payments" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("payments");
                              setSidebarOpen(false);
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4" /> {t.payments}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "activities" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("activities");
                              setSidebarOpen(false);
                            }}
                          >
                            <Activity className="w-4 h-4" /> {t.activities}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "catalogs" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("catalogs");
                              setSidebarOpen(false);
                            }}
                          >
                            <FileSpreadsheet className="w-4 h-4" />{" "}
                            {t.publishedSheets}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "phonebook" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("phonebook");
                              setSidebarOpen(false);
                            }}
                          >
                            <PhoneCall className="w-4 h-4" /> {t.phonebook}
                          </div>
                          <div
                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 transition-all ${adminSubView === "settings" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                            onClick={() => {
                              setAdminSubView("settings");
                              setSidebarOpen(false);
                            }}
                          >
                            <Settings className="w-4 h-4" /> {t.settings}
                          </div>
                        </>
                      ) : null}
                      {currentUser && (
                        <button
                          onClick={() => {
                            handleLogout();
                            setSidebarOpen(false);
                          }}
                          className="mt-auto flex items-center justify-center gap-2 text-xs font-bold uppercase text-danger pt-4 btn-3d btn-3d-glass py-3.5 px-4 rounded-xl border-danger/20"
                        >
                          <LogOut className="w-4 h-4" /> {t.signOut}
                        </button>
                      )}
                    </nav>
                  </motion.aside>
                </div>
              )}
            </AnimatePresence>

            {/* Desktop Sidebar (hidden on mobile) */}
            <aside className="hidden md:flex w-64 glass-dark shrink-0 flex-col md:h-screen md:sticky md:top-0 z-40">
              <div className="flex items-center justify-between p-6 md:p-8">
                <div className="logo border-b-2 border-accent-tan pb-1 text-xl font-bold tracking-widest uppercase">
                  {t.brand}
                </div>
              </div>
              <nav className="flex flex-col gap-3 px-6 md:px-8 pb-6 md:pb-8 flex-1">
                {currentUser && isAuthorizedUser ? (
                  <>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "dashboard" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("dashboard")}
                    >
                      <LayoutDashboard className="w-4 h-4" /> {t.dashboard}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "customers" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("customers")}
                    >
                      <UserIcon className="w-4 h-4" /> {t.customers}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "inspections" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("inspections")}
                    >
                      <ClipboardList className="w-4 h-4" /> {t.inspections}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "contracted" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("contracted")}
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t.contracted}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "not-contracted" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("not-contracted")}
                    >
                      <X className="w-4 h-4" /> {t.notContracted}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "production" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("production")}
                    >
                      <Wrench className="w-4 h-4" /> {t.production}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "payments" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("payments")}
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t.payments}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "activities" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("activities")}
                    >
                      <Activity className="w-4 h-4" /> {t.activities}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "catalogs" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("catalogs")}
                    >
                      <FileSpreadsheet className="w-4 h-4" />{" "}
                      {t.publishedSheets}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "phonebook" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("phonebook")}
                    >
                      <PhoneCall className="w-4 h-4" /> {t.phonebook}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === "settings" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white/30"}`}
                      onClick={() => setAdminSubView("settings")}
                    >
                      <Settings className="w-4 h-4" /> {t.settings}
                    </div>
                  </>
                ) : null}
                {currentUser && (
                  <button
                    onClick={handleLogout}
                    className="mt-auto flex items-center gap-2 text-xs font-bold uppercase text-danger pt-4 btn-3d btn-3d-glass py-3 px-4 rounded-xl border-danger/20"
                  >
                    <LogOut className="w-4 h-4" /> {t.signOut}
                  </button>
                )}
              </nav>
            </aside>

            <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
              <AnimatePresence mode="wait">
                {currentUser && isAuthorizedUser ? (
                  <motion.div
                    key={adminSubView}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {adminSubView !== "production" &&
                      adminSubView !== "payments" &&
                      adminSubView !== "activities" &&
                      adminSubView !== "settings" &&
                      adminSubView !== "dashboard" && (
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                          <div>
                            <span
                              className={`text-[10px] font-bold ${isAdminUser ? "bg-zinc-800" : "bg-accent-sage"} text-white px-2 py-1 rounded inline-block uppercase tracking-wider mb-1`}
                            >
                              {isAdminUser ? t.editor : t.viewOnly}
                            </span>
                            <h1 className="text-3xl md:text-4xl font-light">
                              {adminSubView === "customers"
                                ? t.customers
                                : adminSubView === "inspections"
                                  ? t.inspections
                                  : adminSubView === "contracted"
                                    ? t.contracted
                                    : adminSubView === "not-contracted"
                                      ? t.notContracted
                                      : adminSubView === "phonebook"
                                        ? t.phonebook
                                        : t.publishedSheets}
                            </h1>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(adminSubView === "customers" ||
                                adminSubView === "contracted" ||
                                adminSubView === "not-contracted") &&
                                currentUser?.email === ADMIN_EMAIL && (
                                  <button
                                    onClick={handleOpenAddModal}
                                    className="btn-3d btn-3d-glass px-5 py-3.5 rounded-2xl flex items-center gap-2 font-bold text-xs uppercase"
                                  >
                                    <Plus className="w-4 h-4" />{" "}
                                    {t.addCustomerBtn}
                                  </button>
                                )}
                              {adminSubView === "contracted" && (
                                <button
                                  onClick={() =>
                                    handleExportExcel(
                                      contractedCustomers,
                                      `العملاء_المتعاقدين_${format(new Date(), "yyyy-MM-dd")}`,
                                    )
                                  }
                                  className="btn-3d btn-3d-glass px-5 py-3.5 rounded-2xl flex items-center gap-2 font-bold text-xs uppercase text-accent-tan"
                                >
                                  <Download className="w-4 h-4" />{" "}
                                  {t.exportExcel}
                                </button>
                              )}
                              {adminSubView !== "catalogs" && (
                                <button
                                  onClick={() => window.print()}
                                  className="btn-3d btn-3d-glass px-5 py-3.5 rounded-2xl flex items-center gap-2 font-bold text-xs uppercase"
                                >
                                  <Printer className="w-4 h-4" />
                                  {lang === "ar" ? "طباعة" : "Print"}
                                </button>
                              )}
                              {adminSubView === "catalogs" &&
                                currentUser?.email === ADMIN_EMAIL && (
                                  <label className="btn-3d btn-3d-glass px-5 py-3.5 rounded-2xl flex items-center gap-2 font-bold text-xs uppercase cursor-pointer">
                                    <Upload className="w-4 h-4" /> {t.uploadNew}{" "}
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept=".xlsx,.xls,.csv"
                                      onChange={handleImportExcel}
                                    />
                                  </label>
                                )}
                            </div>

                            {adminSubView !== "phonebook" && (
                              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <div className="relative group w-full sm:w-auto">
                                  <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-zinc-700 transition-colors pointer-events-none z-10" />
                                  <input
                                    type="text"
                                    placeholder={
                                      lang === "ar" ? "بحث..." : "Search..."
                                    }
                                    value={searchQuery}
                                    onChange={(e) =>
                                      setSearchQuery(e.target.value)
                                    }
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
                                {adminSubView !== "inspections" && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                      onClick={() =>
                                        setGovernorateFilter("all")
                                      }
                                      className={`filter-chip ${governorateFilter === "all" ? "filter-chip-active" : "filter-chip-inactive"}`}
                                    >
                                      الكل
                                    </button>
                                    <button
                                      onClick={() =>
                                        setGovernorateFilter("القاهرة")
                                      }
                                      className={`filter-chip ${governorateFilter === "القاهرة" ? "filter-chip-active" : "filter-chip-inactive"}`}
                                    >
                                      القاهرة
                                    </button>
                                    <button
                                      onClick={() =>
                                        setGovernorateFilter("الاسكندرية")
                                      }
                                      className={`filter-chip ${governorateFilter === "الاسكندرية" ? "filter-chip-active" : "filter-chip-inactive"}`}
                                    >
                                      الاسكندرية
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="glass px-4 py-3 rounded-2xl min-w-[90px]">
                              <div className="text-[10px] uppercase font-bold text-zinc-400">
                                {adminSubView === "customers"
                                  ? t.totalCustomers
                                  : adminSubView === "inspections"
                                    ? t.inspections
                                    : adminSubView === "contracted"
                                      ? t.contracted
                                      : adminSubView === "not-contracted"
                                        ? t.notContracted
                                        : adminSubView === "phonebook"
                                          ? lang === "ar"
                                            ? "الأرقام"
                                            : "Numbers"
                                          : t.publishedSheets}
                              </div>
                              <div className="text-2xl font-semibold">
                                {adminSubView === "customers"
                                  ? unifiedCustomers.filter((r) =>
                                      matchesFilters(r),
                                    ).length
                                  : adminSubView === "inspections"
                                    ? inspections.filter((r) =>
                                        matchesFilters(r),
                                      ).length
                                    : adminSubView === "contracted"
                                      ? contractedCustomers.filter((r) =>
                                          matchesFilters(r),
                                        ).length
                                      : adminSubView === "not-contracted"
                                        ? notContractedCustomers.filter((r) =>
                                            matchesFilters(r),
                                          ).length
                                        : adminSubView === "phonebook"
                                          ? new Set(
                                              [
                                                ...customerRecords,
                                                ...inspections,
                                                ...contractedCustomers,
                                                ...notContractedCustomers,
                                              ]
                                                .map((r) => r.phone)
                                                .filter(Boolean),
                                            ).size
                                          : catalogs.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    {adminSubView === "phonebook" ? (
                      <div className="space-y-6">
                        <div className="glass rounded-[2.5rem] p-6 md:p-10 shadow-xl border border-white/40 glass-table">
                          <div className="flex flex-col gap-4 mb-6">
                            <div className="flex items-center gap-3">
                              <PhoneCall className="w-6 h-6 text-accent-tan" />
                              <h2 className="text-2xl font-bold text-zinc-900">
                                {t.phonebook}
                              </h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(
                                [
                                  {
                                    key: "all",
                                    label: lang === "ar" ? "الكل" : "All",
                                  },
                                  {
                                    key: "contracted",
                                    label:
                                      lang === "ar" ? "متعاقد" : "Contracted",
                                  },
                                  {
                                    key: "not-contracted",
                                    label:
                                      lang === "ar"
                                        ? "غير متعاقد"
                                        : "Not contracted",
                                  },
                                  {
                                    key: "customers",
                                    label: lang === "ar" ? "عميل" : "Customer",
                                  },
                                  {
                                    key: "inspections",
                                    label:
                                      lang === "ar" ? "معاينات" : "Inspections",
                                  },
                                ] as const
                              ).map((filter) => (
                                <button
                                  key={filter.key}
                                  type="button"
                                  onClick={() =>
                                    setPhonebookStatusFilter(filter.key)
                                  }
                                  className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
                                    phonebookStatusFilter === filter.key
                                      ? "bg-zinc-900 text-white"
                                      : "bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-300"
                                  }`}
                                >
                                  {filter.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {(() => {
                            const allNumbers = [
                              ...customerRecords.map((r) => ({
                                name: r.name,
                                phone: r.phone,
                                source: "customers" as const,
                              })),
                              ...inspections.map((r) => ({
                                name: r.customerName,
                                phone: r.phone,
                                source: "inspections" as const,
                              })),
                              ...contractedCustomers.map((r) => ({
                                name: r.customerName,
                                phone: r.phone,
                                source: "contracted" as const,
                              })),
                              ...notContractedCustomers.map((r) => ({
                                name: r.customerName,
                                phone: r.phone,
                                source: "not-contracted" as const,
                              })),
                            ];
                            const phoneMap = new Map<
                              string,
                              {
                                name: string;
                                phones: string[];
                                sources: string[];
                              }
                            >();
                            allNumbers.forEach((entry) => {
                              const key = entry.phone?.trim();
                              if (!key) return;
                              const existing = phoneMap.get(key);
                              if (existing) {
                                if (!existing.phones.includes(entry.phone))
                                  existing.phones.push(entry.phone);
                                if (!existing.sources.includes(entry.source))
                                  existing.sources.push(entry.source);
                              } else {
                                phoneMap.set(key, {
                                  name: entry.name,
                                  phones: [entry.phone],
                                  sources: [entry.source],
                                });
                              }
                            });
                            const statusPriority: Record<string, number> = {
                              contracted: 1,
                              "not-contracted": 2,
                              customers: 3,
                              inspections: 4,
                            };
                            const sortedEntries = Array.from(phoneMap.entries())
                              .filter(([phone, data]) =>
                                isPhonebookEntryVisible(data.sources),
                              )
                              .sort((a, b) => {
                                const aStatus = a[1].sources.includes(
                                  "contracted",
                                )
                                  ? "contracted"
                                  : a[1].sources.includes("not-contracted")
                                    ? "not-contracted"
                                    : a[1].sources.includes("customers")
                                      ? "customers"
                                      : "inspections";
                                const bStatus = b[1].sources.includes(
                                  "contracted",
                                )
                                  ? "contracted"
                                  : b[1].sources.includes("not-contracted")
                                    ? "not-contracted"
                                    : b[1].sources.includes("customers")
                                      ? "customers"
                                      : "inspections";
                                const statusDiff =
                                  statusPriority[aStatus] -
                                  statusPriority[bStatus];
                                if (statusDiff !== 0) return statusDiff;
                                return a[1].name.localeCompare(b[1].name, "ar");
                              });
                            return sortedEntries.length > 0 ? (
                              <div className="space-y-2">
                                {sortedEntries.map(([phone, data]) => {
                                  const waNumber = phone.replace(/^0+/, "20");
                                  const sourceLabel = data.sources.includes(
                                    "contracted",
                                  )
                                    ? lang === "ar"
                                      ? "متعاقد"
                                      : "Contracted"
                                    : data.sources.includes("not-contracted")
                                      ? lang === "ar"
                                        ? "غير متعاقد"
                                        : "Not Contracted"
                                      : data.sources.includes("customers")
                                        ? lang === "ar"
                                          ? "عميل"
                                          : "Customer"
                                        : lang === "ar"
                                          ? "معاينة"
                                          : "Inspection";
                                  return (
                                    <div
                                      key={phone}
                                      className="flex items-center justify-between bg-white/60 p-4 rounded-2xl border border-white/80 hover:bg-white/90 transition-all gap-3"
                                    >
                                      <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-accent-tan/10 flex items-center justify-center shrink-0">
                                          <PhoneCall className="w-5 h-5 text-accent-tan" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-zinc-900 truncate">
                                            {data.name}
                                          </p>
                                          <p
                                            className="text-sm font-mono text-zinc-500"
                                            dir="ltr"
                                          >
                                            {phone}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-lg">
                                          {sourceLabel}
                                        </span>
                                        <a
                                          href={`https://wa.me/${waNumber}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="btn-3d flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold uppercase text-white bg-[#25D366] hover:bg-[#1da851] transition-all shadow-md hover:shadow-lg"
                                        >
                                          <MessageCircle className="w-4 h-4" />
                                          <span className="hidden sm:inline">
                                            {t.openWhatsApp}
                                          </span>
                                        </a>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="py-16 text-center">
                                <PhoneCall className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                                <p className="text-zinc-400 font-semibold">
                                  {t.noRecords}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : adminSubView === "catalogs" ? (
                      <div className="space-y-8">
                        {catalogs.length > 0 ? (
                          <>
                            <div className="flex gap-2 p-1 bg-black/5 rounded-2xl overflow-x-auto">
                              {catalogs.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => setSelectedSheetId(s.id)}
                                  className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all btn-3d ${selectedSheetId === s.id ? "btn-3d-primary text-white shadow-sm" : "text-zinc-400 bg-black/5 hover:bg-black/10"}`}
                                >
                                  {s.title}
                                </button>
                              ))}
                            </div>
                            {selectedSheet &&
                              (() => {
                                const filteredData = selectedSheet.data.filter(
                                  (row) =>
                                    !searchQuery ||
                                    Object.values(row).some((v) =>
                                      String(v)
                                        .toLowerCase()
                                        .includes(searchQuery.toLowerCase()),
                                    ),
                                );

                                const allKeys = Array.from(
                                  new Set(
                                    selectedSheet.data.flatMap((row) =>
                                      Object.keys(row),
                                    ),
                                  ),
                                ).filter((h) => !h.startsWith("__EMPTY"));

                                return (
                                  <div className="glass rounded-[2.5rem] overflow-hidden p-0 border border-white/40 shadow-2xl space-y-0">
                                    <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white/30 backdrop-blur-sm">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-accent-tan/10 flex items-center justify-center">
                                          <FileSpreadsheet className="w-6 h-6 text-accent-tan" />
                                        </div>
                                        <div>
                                          <h3 className="text-xl font-bold text-zinc-900">
                                            {selectedSheet.title}
                                          </h3>
                                          <div className="text-xs text-zinc-500 font-mono">
                                            {format(
                                              selectedSheet.createdAt.toDate(),
                                              "yyyy-MM-dd HH:mm",
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      {isAdminUser && (
                                        <button
                                          onClick={() =>
                                            deleteCatalogSection(
                                              selectedSheet.id,
                                            )
                                          }
                                          className="btn-3d btn-3d-glass px-4 py-2.5 rounded-xl text-danger flex items-center gap-2 font-bold text-[10px] uppercase hover:bg-red-50 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />{" "}
                                          {t.deleteSheet}
                                        </button>
                                      )}
                                    </div>

                                    {filteredData.length > 0 ? (
                                      <>
                                        <div className="hidden md:block overflow-x-auto max-h-[600px] custom-scrollbar">
                                          <table className="w-full text-right border-collapse">
                                            <thead className="sticky top-0 z-10">
                                              <tr className="bg-zinc-50/80 backdrop-blur-md border-b border-black/5">
                                                {allKeys.map((h) => (
                                                  <th
                                                    key={h}
                                                    className="px-6 py-5 font-bold text-zinc-500 uppercase text-[10px] tracking-widest border-l border-black/5 last:border-l-0 min-w-[200px]"
                                                  >
                                                    {h}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/5 bg-white/20">
                                              {filteredData.map((row, i) => {
                                                // Find original index for editing
                                                const originalIndex =
                                                  selectedSheet.data.indexOf(
                                                    row,
                                                  );
                                                return (
                                                  <tr
                                                    key={i}
                                                    className="hover:bg-accent-tan/5 transition-colors group"
                                                  >
                                                    {allKeys.map((k, j) => (
                                                      <td
                                                        key={j}
                                                        className="px-6 py-5 text-zinc-700 text-sm font-medium border-l border-black/5 last:border-l-0 group-hover:text-zinc-900"
                                                      >
                                                        {formatCellValue(
                                                          row[k],
                                                        )}
                                                      </td>
                                                    ))}
                                                    {isAdminUser && (
                                                      <td className="px-4 py-5 text-left sticky left-0 bg-white/50 backdrop-blur-md group-hover:bg-white transition-colors">
                                                        <button
                                                          onClick={() =>
                                                            handleEditCatalogRow(
                                                              selectedSheet.id,
                                                              originalIndex,
                                                              row,
                                                            )
                                                          }
                                                          className="p-2 text-zinc-400 hover:text-accent-tan transition-all"
                                                        >
                                                          <Edit2 className="w-4 h-4" />
                                                        </button>
                                                      </td>
                                                    )}
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        <div className="grid grid-cols-1 gap-6 p-6 md:hidden">
                                          {filteredData.map((row, i) => {
                                            const originalIndex =
                                              selectedSheet.data.indexOf(row);
                                            return (
                                              <div
                                                key={i}
                                                className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] space-y-4 border border-white/60 shadow-lg relative overflow-hidden group"
                                              >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-accent-tan/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-accent-tan/10 transition-colors" />
                                                <div className="flex justify-between items-center relative z-10">
                                                  <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 font-bold">
                                                    #{i + 1}
                                                  </div>
                                                  {isAdminUser && (
                                                    <button
                                                      onClick={() =>
                                                        handleEditCatalogRow(
                                                          selectedSheet.id,
                                                          originalIndex,
                                                          row,
                                                        )
                                                      }
                                                      className="p-3 bg-white border border-zinc-100 rounded-2xl text-accent-tan shadow-sm hover:shadow-md transition-all"
                                                    >
                                                      <Edit2 className="w-4 h-4" />
                                                    </button>
                                                  )}
                                                </div>
                                                {allKeys.map((key) => (
                                                  <div
                                                    key={key}
                                                    className="flex flex-col gap-1 relative z-10 border-b border-black/5 pb-3 last:border-0 last:pb-0"
                                                  >
                                                    <span className="font-bold text-zinc-400 text-[9px] uppercase tracking-widest">
                                                      {key}
                                                    </span>
                                                    <span className="text-zinc-800 font-bold text-sm">
                                                      {formatCellValue(
                                                        row[key],
                                                      )}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="py-20 text-center">
                                        <Search className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                                        <p className="text-zinc-400 font-semibold">
                                          {lang === "ar"
                                            ? "لا توجد نتائج تطابق بحثك"
                                            : "No results matching your search"}
                                        </p>
                                      </div>
                                    )}

                                    {selectedSheet.data.length === 0 && (
                                      <div className="py-20 text-center">
                                        <FileSpreadsheet className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                                        <p className="text-zinc-400 font-semibold">
                                          {lang === "ar"
                                            ? "هذا الملف فارغ"
                                            : "This sheet is empty"}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                          </>
                        ) : (
                          <div className="glass rounded-[2rem] py-20 text-center">
                            <Upload className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                            <p className="text-zinc-400 font-semibold mb-2">
                              {t.noSheets}
                            </p>
                            {currentUser?.email === ADMIN_EMAIL && (
                              <label className="btn-3d btn-3d-glass px-6 py-3 rounded-2xl text-xs font-bold uppercase cursor-pointer inline-flex items-center gap-2">
                                <Upload className="w-4 h-4" /> {t.uploadNew}{" "}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".xlsx,.xls,.csv"
                                  onChange={handleImportExcel}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    ) : adminSubView === "inspections" ? (
                      <div className="space-y-8">
                        {inspections.filter(
                          (ins) =>
                            !searchQuery ||
                            ins.customerName
                              ?.toLowerCase()
                              .includes(searchQuery.toLowerCase()) ||
                            ins.phone?.includes(searchQuery),
                        ).length > 0 ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {inspections
                                .filter(
                                  (ins) =>
                                    !searchQuery ||
                                    ins.customerName
                                      ?.toLowerCase()
                                      .includes(searchQuery.toLowerCase()) ||
                                    ins.phone?.includes(searchQuery),
                                )
                                .map((ins) => (
                                  <div
                                    id={`inspection-${ins.id}`}
                                    key={ins.id}
                                    className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] flex flex-col gap-6 border border-white/50 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden card-accent"
                                  >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent-tan/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-accent-tan/10 transition-colors" />
                                    <Armchair className="absolute bottom-2 left-2 text-accent-tan/5 w-16 h-16 -rotate-12 pointer-events-none" />

                                    <div className="flex justify-between items-start relative z-10">
                                      <div>
                                        <h4 className="text-2xl font-bold text-zinc-900 mb-1">
                                          {ins.customerName}
                                        </h4>
                                        <p className="text-zinc-500 font-mono tracking-wider">
                                          {ins.phone}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1.5">
                                        <div
                                          className={`status-badge ${ins.status === "pending" ? "status-badge-pending" : ins.status === "contracted" ? "status-badge-contracted" : "status-badge-refused"}`}
                                        >
                                          {ins.status === "pending"
                                            ? lang === "ar"
                                              ? "معلق"
                                              : "Pending"
                                            : ins.status === "contracted"
                                              ? lang === "ar"
                                                ? "متعاقد"
                                                : "Contracted"
                                              : lang === "ar"
                                                ? "مرفوض"
                                                : "Refused"}
                                        </div>
                                        <div className="flex items-center gap-2 bg-zinc-100/80 px-3 py-1.5 rounded-xl text-[10px] font-bold text-zinc-600 uppercase">
                                          <Calendar className="w-3 h-3" />
                                          {ins.visitDate}
                                        </div>
                                      </div>
                                    </div>

                                    {isAdminUser && (
                                      <div className="grid grid-cols-2 gap-3 relative z-10">
                                        <button
                                          onClick={() => {
                                            setPendingContractInspection(ins);
                                            setIsContractUploadOpen(true);
                                          }}
                                          className="btn-3d btn-3d-glass flex flex-col items-center justify-center gap-2 bg-white border border-zinc-100 text-zinc-400 p-4 rounded-3xl font-bold uppercase transition-all hover:scale-[1.02] active:scale-95 hover:text-emerald-600 hover:border-emerald-200"
                                        >
                                          <CheckCircle2 className="w-5 h-5" />
                                          <span className="text-[11px] tracking-widest">
                                            {t.contractedBtn}
                                          </span>
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleFinalizeInspection(
                                              "refused",
                                              ins,
                                            )
                                          }
                                          className="btn-3d btn-3d-red flex flex-col items-center justify-center gap-2 bg-red-50 text-red-500 p-4 rounded-3xl font-bold uppercase transition-all hover:bg-red-100 active:scale-95 border border-red-100"
                                        >
                                          <X className="w-5 h-5" />
                                          <span className="text-[11px] tracking-widest">
                                            {t.refusedBtn}
                                          </span>
                                        </button>
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center pt-4 border-t border-zinc-100 relative z-10">
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setSelectedRecord(ins);
                                            setIsDetailModalOpen(true);
                                          }}
                                          className="p-3 bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-100 hover:text-zinc-600 transition-all"
                                        >
                                          <Eye className="w-5 h-5" />
                                        </button>
                                        {isAdminUser && (
                                          <button
                                            onClick={() =>
                                              triggerConfirm(
                                                lang === "ar"
                                                  ? "حذف"
                                                  : "Delete",
                                                lang === "ar"
                                                  ? "حذف؟"
                                                  : "Delete?",
                                                async () => {
                                                  await handleDeleteInspection(
                                                    ins.id,
                                                  );
                                                },
                                              )
                                            }
                                            className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-100 transition-all"
                                          >
                                            <Trash2 className="w-5 h-5" />
                                          </button>
                                        )}
                                      </div>
                                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tighter">
                                        ID: {ins.id.slice(0, 8)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <div className="glass rounded-[2rem] py-20 text-center">
                            <ClipboardList className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                            <p className="text-zinc-400 font-semibold">
                              {lang === "ar"
                                ? "لا توجد معاينات معلقة"
                                : "No pending inspections"}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : adminSubView === "dashboard" ? (
                      <div className="space-y-6 md:space-y-8">
                        {/* Header */}
                        <div className="relative overflow-hidden glass rounded-xl md:rounded-[3rem] p-4 md:p-8 lg:p-14 shadow-2xl border border-white/40 bg-gradient-to-br from-zinc-50 via-white to-accent-tan/5">
                          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.06),transparent_60%)]" />
                          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-6">
                            <div className="space-y-1 md:space-y-2">
                              <div className="flex items-center gap-2 md:gap-3">
                                <span className="text-[9px] md:text-[11px] font-bold uppercase tracking-widest bg-accent-tan/10 text-accent-tan px-2 py-0.5 md:px-3 md:py-1.5 rounded-full">
                                  {isAdminUser ? t.editor : t.viewOnly}
                                </span>
                                <span className="text-[9px] md:text-[11px] text-zinc-400 font-medium">
                                  {new Date().toLocaleDateString(
                                    lang === "ar" ? "ar-EG" : "en-US",
                                  )}
                                </span>
                              </div>
                              <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold text-zinc-900 tracking-tight">
                                {lang === "ar" ? "الرئيسية" : "Dashboard"}
                              </h1>
                              <p className="text-[11px] md:text-sm lg:text-base text-zinc-500">
                                {lang === "ar"
                                  ? "نظرة عامة على جميع العمليات"
                                  : "Overview of all operations"}
                              </p>
                            </div>
                            <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                              <button
                                onClick={() => setAdminSubView("inspections")}
                                className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2.5 md:px-6 lg:px-8 md:py-3 lg:py-4 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-xl"
                              >
                                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                {lang === "ar" ? "معاينات" : "Inspections"}
                              </button>
                              <button
                                onClick={() => setAdminSubView("production")}
                                className="flex-1 md:flex-none glass border border-white/40 px-3 py-2.5 md:px-6 lg:px-8 md:py-3 lg:py-4 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-xl"
                              >
                                <Wrench className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                {lang === "ar" ? "الإنتاج" : "Production"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid gap-3 md:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                          {[
                            {
                              label:
                                lang === "ar"
                                  ? "إجمالي العملاء"
                                  : "Total Customers",
                              value: unifiedCustomers.length,
                              icon: "Users",
                              color: "text-blue-600",
                              bg: "bg-blue-100",
                              hover: "rgba(37,99,235,0.06)",
                              borderHover: "hover:border-blue-200/50",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "المعاينات المعلقة"
                                  : "Pending Inspections",
                              value: inspections.filter(
                                (i) => i.status === "pending",
                              ).length,
                              icon: "Calendar",
                              color: "text-amber-600",
                              bg: "bg-amber-100",
                              hover: "rgba(217,119,6,0.06)",
                              borderHover: "hover:border-amber-200/50",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "العملاء المتعاقدين"
                                  : "Contracted",
                              value: contractedCustomers.length,
                              icon: "CheckCircle2",
                              color: "text-emerald-600",
                              bg: "bg-emerald-100",
                              hover: "rgba(5,150,105,0.06)",
                              borderHover: "hover:border-emerald-200/50",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "غير متعاقدين"
                                  : "Non-Contracted",
                              value: notContractedCustomers.length,
                              icon: "X",
                              color: "text-rose-600",
                              bg: "bg-rose-100",
                              hover: "rgba(225,29,72,0.06)",
                              borderHover: "hover:border-rose-200/50",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "أرقام الدليل"
                                  : "Phonebook Numbers",
                              value: new Set(
                                [
                                  ...customerRecords,
                                  ...inspections,
                                  ...contractedCustomers,
                                  ...notContractedCustomers,
                                ]
                                  .map((r) => r.phone)
                                  .filter(Boolean),
                              ).size,
                              icon: "PhoneCall",
                              color: "text-violet-600",
                              bg: "bg-violet-100",
                              hover: "rgba(124,58,237,0.06)",
                              borderHover: "hover:border-violet-200/50",
                            },
                            {
                              label:
                                lang === "ar"
                                  ? "الملفات المنشورة"
                                  : "Published Sheets",
                              value: catalogs.length,
                              icon: "FileSpreadsheet",
                              color: "text-teal-600",
                              bg: "bg-teal-100",
                              hover: "rgba(13,148,136,0.06)",
                              borderHover: "hover:border-teal-200/50",
                            },
                          ].map((card) => (
                            <div
                              key={card.label}
                              className={`group relative glass rounded-xl md:rounded-2xl lg:rounded-[2rem] p-4 md:p-6 lg:p-10 shadow-md md:shadow-lg lg:shadow-xl border border-white/40 ${card.borderHover} hover:shadow-lg md:hover:shadow-xl lg:hover:shadow-2xl hover:-translate-y-0.5 md:hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
                            >
                              <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl md:rounded-2xl lg:rounded-[2rem]"
                                style={{
                                  background: `linear-gradient(135deg, transparent, ${card.hover})`,
                                }}
                              />
                              <div className="relative flex items-center gap-4 md:gap-5 lg:gap-8">
                                <div
                                  className={`w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-xl md:rounded-2xl lg:rounded-3xl ${card.bg} ${card.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}
                                >
                                  {card.icon === "Users" && (
                                    <Users className="w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9" />
                                  )}
                                  {card.icon === "Calendar" && (
                                    <Calendar className="w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9" />
                                  )}
                                  {card.icon === "CheckCircle2" && (
                                    <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9" />
                                  )}
                                  {card.icon === "X" && (
                                    <X className="w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9" />
                                  )}
                                  {card.icon === "PhoneCall" && (
                                    <PhoneCall className="w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9" />
                                  )}
                                  {card.icon === "FileSpreadsheet" && (
                                    <FileSpreadsheet className="w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9" />
                                  )}
                                </div>
                                <div>
                                  <div className="relative text-2xl md:text-4xl lg:text-5xl font-bold text-zinc-900 mb-0.5 md:mb-1">
                                    {card.value}
                                  </div>
                                  <div className="relative text-[11px] md:text-base lg:text-lg text-zinc-500">
                                    {card.label}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Welcome */}
                        <div className="relative overflow-hidden glass rounded-xl md:rounded-[3rem] p-4 md:p-8 shadow-2xl border border-white/40 bg-gradient-to-br from-accent-tan/5 via-white to-accent-sage/5">
                          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.04),transparent_50%)]" />
                          <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
                            <div className="space-y-0.5 md:space-y-1 text-center md:text-right">
                              <h2 className="text-base md:text-2xl lg:text-3xl font-bold text-zinc-900">
                                {lang === "ar"
                                  ? "لوحة تحكم العماري"
                                  : "EL3mmary Dashboard"}
                              </h2>
                              <p className="text-[11px] md:text-sm lg:text-base text-zinc-500">
                                {lang === "ar"
                                  ? "يمكنك متابعة العملاء والإنتاج والمدفوعات من هنا"
                                  : "Track customers, production, and payments from here"}
                              </p>
                            </div>
                            <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                              <button
                                onClick={() => setAdminSubView("inspections")}
                                className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 md:px-6 lg:px-8 md:py-3 lg:py-3.5 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-lg"
                              >
                                {lang === "ar" ? "المعاينات" : "Inspections"}
                              </button>
                              <button
                                onClick={() => setAdminSubView("production")}
                                className="flex-1 md:flex-none glass border border-white/40 px-3 py-2 md:px-6 lg:px-8 md:py-3 lg:py-3.5 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-lg hover:shadow-xl"
                              >
                                <Wrench className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                {lang === "ar" ? "الإنتاج" : "Production"}
                              </button>
                              <button
                                onClick={() => setAdminSubView("settings")}
                                className="flex-1 md:flex-none glass border border-white/40 px-3 py-2 md:px-6 lg:px-8 md:py-3 lg:py-3.5 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-lg hover:shadow-xl"
                              >
                                <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                {lang === "ar" ? "الإعدادات" : "Settings"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : adminSubView === "production" ? (
                      <ProductionPage
                        contractedCustomers={contractedCustomers}
                        inspections={inspections}
                        lang={lang}
                        isAdmin={isAdminUser}
                        t={t}
                        stages={stages}
                        onStageUpdate={handleStageUpdate}
                      />
                    ) : adminSubView === "payments" ? (
                      <PaymentsPage
                        contractedCustomers={contractedCustomers}
                        lang={lang}
                        isAdmin={isAdminUser}
                        t={t}
                        onRefresh={refreshAllData}
                        onSendWhatsApp={sendWhatsAppMessage}
                      />
                    ) : adminSubView === "activities" ? (
                      <ActivitiesPage
                        lang={lang}
                        t={t}
                        settings={settings}
                        isAdmin={isAdminUser}
                      />
                    ) : adminSubView === "settings" ? (
                      <SettingsPage
                        lang={lang}
                        setLang={setLang}
                        isAdmin={isAdminUser}
                        t={t}
                        settings={settings}
                        currentUserEmail={currentUser?.email}
                        onSyncTrigger={refreshAllData}
                      />
                    ) : adminSubView === "customers" ? (
                      <div className="space-y-8">
                        <div className="hidden md:block glass glass-table rounded-[2.5rem] overflow-hidden p-6 md:p-10 shadow-xl border border-white/40">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left table-zebra">
                              <thead>
                                <tr className="border-b border-black/5 text-[10px] font-bold uppercase text-zinc-400 tracking-widest">
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    {t.userName}
                                  </th>
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    {t.phoneNumber}
                                  </th>
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    المحافظة
                                  </th>
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    الحالة
                                  </th>
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    {t.actions}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {unifiedCustomers
                                  .filter((r) => matchesFilters(r))
                                  .map((r) => (
                                    <tr
                                      key={r.id}
                                      className="group hover:bg-black/5 transition-colors"
                                    >
                                      <td className="px-4 py-6 font-bold text-zinc-900 text-center">
                                        {r.name}
                                      </td>
                                      <td className="px-4 py-6 text-center">
                                        <span className="bg-zinc-100 px-3 py-1.5 rounded-xl font-mono text-xs text-zinc-600 group-hover:bg-white transition-colors ">
                                          {r.phone}
                                        </span>
                                      </td>
                                      <td className="px-4 py-6 text-center text-sm text-zinc-600">
                                        {r.governorate || "-"}
                                      </td>
                                      <td className="px-4 py-6 text-center">
                                        <span
                                          className={`inline-flex items-center justify-center px-3 py-2 rounded-full text-sm font-semibold ${getStatusBadge(r.status).cls}`}
                                        >
                                          {getStatusBadge(r.status).label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="flex gap-4 justify-between items-center w-full">
                                          {isAdminUser && (
                                            <>
                                              <button
                                                onClick={() =>
                                                  handleOpenEditModal(
                                                    r.raw || r,
                                                  )
                                                }
                                                className="flex items-center gap-2 bg-zinc-800 text-white px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 active:scale-95 transition-all duration-200 shadow-md shadow-zinc-200 hover:shadow-lg"
                                              >
                                                <Edit2 className="w-4 h-4" />
                                                <span>
                                                  {lang === "ar"
                                                    ? "تعديل"
                                                    : "Edit"}
                                                </span>
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setAdminSubView(
                                                    "inspections",
                                                  );
                                                  const custRec =
                                                    customerRecords.find(
                                                      (c) =>
                                                        c.phone === r.phone,
                                                    );
                                                  const actualId =
                                                    custRec?.id || r.raw?.id;
                                                  setTimeout(() => {
                                                    setInspectionFormData({
                                                      customerName: r.name,
                                                      phone: r.phone,
                                                      id: undefined,
                                                      address:
                                                        r.address ||
                                                        r.pickupDate ||
                                                        "",
                                                      deliveryAddress:
                                                        r.deliveryAddress || "",
                                                      pickupDate:
                                                        r.pickupDate ||
                                                        r.address ||
                                                        "",
                                                      visitDate:
                                                        r.visitDate || "",
                                                      visitDateTo:
                                                        r.visitDateTo || "",
                                                      notes: r.notes || "",
                                                      governorate:
                                                        r.governorate || "",
                                                      rooms: 0,
                                                      pieces: [],
                                                      totalAmount: 0,
                                                    });
                                                    setEditingCollection(
                                                      "customers",
                                                    );
                                                    setEditingId(
                                                      actualId ?? null,
                                                    );
                                                    setInspectionStep(1);
                                                    setIsInspectionModalOpen(
                                                      true,
                                                    );
                                                    const el =
                                                      document.getElementById(
                                                        `inspection-${r.id ?? ""}`,
                                                      );
                                                    if (el)
                                                      el.scrollIntoView({
                                                        behavior: "smooth",
                                                        block: "center",
                                                      });
                                                  }, 120);
                                                }}
                                                className="ml-2 flex items-center gap-2 bg-accent-tan text-white px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-accent-tan/90 active:scale-95 transition-all duration-200 shadow-md"
                                              >
                                                <Eye className="w-4 h-4" />
                                                <span>
                                                  {lang === "ar"
                                                    ? "بدء المعاينة"
                                                    : "Start Visit"}
                                                </span>
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const id = r.id || r.raw?.id;
                                                  if (!id) return;
                                                  if (r.status === "customers" || !r.status)
                                                    handleDeleteCustomer(id);
                                                  else if (r.status === "inspections")
                                                    void handleDeleteInspection(id);
                                                  else if (r.status === "contracted")
                                                    handleDeleteContracted(id);
                                                  else if (r.status === "not-contracted")
                                                    handleDeleteNonContracted(id);
                                                }}
                                                className="btn-3d btn-3d-danger flex items-center gap-2 bg-white-50 text-white-500 border border-white-100 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-white-500 hover:text-white active:scale-95 transition-all duration-200 hover:shadow-lg hover:shadow-white-100"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                                <span>{t.delete}</span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                {unifiedCustomers.filter((r) => matchesFilters(r)).length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="py-20 text-center"
                                    >
                                      <Users className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                                      <p className="text-zinc-400 font-semibold">
                                        {t.noRecords}
                                      </p>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:hidden">
                          {unifiedCustomers
                            .filter((r) => matchesFilters(r))
                            .map((r) => (
                              <div
                                key={r.phone || r.id}
                                className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] flex flex-col gap-4 border border-white/50 shadow-lg relative overflow-hidden group card-accent"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="text-xl font-bold text-zinc-900 mb-1">
                                      {r.name}
                                    </h4>
                                    <p className="text-zinc-500 font-mono text-sm">
                                      {r.phone}
                                    </p>
                                    <p className="text-zinc-500 font-mono text-xs">
                                      {r.governorate || ""}
                                    </p>
                                  </div>
                                  <span
                                    className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusBadge(r.status).cls}`}
                                  >
                                    {getStatusBadge(r.status).label}
                                  </span>
                                </div>
                                {isAdminUser && (
                                  <div className="flex gap-2 pt-4 border-t border-zinc-100 flex-wrap">
                                    <button
                                      onClick={() =>
                                        handleOpenEditModal(r.raw || r)
                                      }
                                      className="flex-1 min-w-[80px] flex items-center justify-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 active:scale-95 transition-all shadow-md"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                      <span>
                                        {lang === "ar" ? "تعديل" : "Edit"}
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminSubView("inspections");
                                        const custRec = customerRecords.find(
                                          (c) => c.phone === r.phone,
                                        );
                                        const actualId =
                                          custRec?.id || r.raw?.id;
                                        setTimeout(() => {
                                          setInspectionFormData({
                                            customerName: r.name,
                                            phone: r.phone,
                                            id: undefined,
                                            address:
                                              r.address || r.pickupDate || "",
                                            deliveryAddress:
                                              r.deliveryAddress || "",
                                            pickupDate:
                                              r.pickupDate || r.address || "",
                                            visitDate: r.visitDate || "",
                                            visitDateTo: r.visitDateTo || "",
                                            notes: r.notes || "",
                                            governorate: r.governorate || "",
                                            rooms: 0,
                                            pieces: [],
                                            totalAmount: 0,
                                          });
                                          setEditingCollection("customers");
                                          setEditingId(actualId ?? null);
                                          setInspectionStep(1);
                                          setIsInspectionModalOpen(true);
                                        }, 120);
                                      }}
                                      className="flex-1 min-w-[100px] flex items-center justify-center gap-2 bg-accent-tan text-white px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-accent-tan/90 active:scale-95 transition-all shadow-md"
                                    >
                                      <Eye className="w-4 h-4" />
                                      <span>
                                        {lang === "ar"
                                          ? "بدء المعاينة"
                                          : "Start Visit"}
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        const id = r.raw?.id;
                                        if (!id) return;
                                        if (r.status === "customers")
                                          handleDeleteCustomer(id);
                                        else if (r.status === "inspections")
                                          void handleDeleteInspection(id);
                                        else if (r.status === "contracted")
                                          handleDeleteContracted(id);
                                        else if (r.status === "not-contracted")
                                          handleDeleteNonContracted(id);
                                      }}
                                      className="flex items-center justify-center gap-2 bg-red-50 text-red-500 border border-red-100 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white active:scale-95 transition-all shadow-md"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          {unifiedCustomers.filter((r) => matchesFilters(r)).length === 0 && (
                            <div className="py-20 text-center">
                              <Users className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                              <p className="text-zinc-400 font-semibold">
                                {t.noRecords}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="hidden md:block glass glass-table rounded-3xl overflow-hidden p-4 md:p-8">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left table-zebra">
                              <thead>
                                <tr className="border-b border-black/5">
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    {t.customerName}
                                  </th>
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    {t.phoneNumber}
                                  </th>
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                    المحافظة
                                  </th>
                                  {isContractedView && (
                                    <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                      {t.deliveryDate}
                                    </th>
                                  )}
                                  {isContractedView && (
                                    <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center">
                                      {t.contractDate}
                                    </th>
                                  )}
                                  <th className="px-6 py-5 font-bold text-zinc-500 uppercase text-[13px] text-center w-px whitespace-nowrap">
                                    {t.actions}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/5">
                                {activeRecords
                                  .filter((r) => matchesFilters(r))
                                  .map((r) => (
                                    <tr
                                      key={r.id}
                                      className="transition-colors"
                                    >
                                      <td className="px-6 py-6 font-semibold text-center">
                                        {r.customerName}
                                      </td>
                                      <td className="px-6 py-6 text-center">
                                        <span className="bg-black/5 px-2 py-1 rounded font-mono text-sm inline-block">
                                          {r.phone}
                                        </span>
                                      </td>
                                      <td className="px-6 py-6 text-center text-sm text-zinc-600">
                                        {r.governorate || "-"}
                                      </td>
                                      {isContractedView && (
                                        <td className="px-6 py-6 text-sm text-zinc-500 text-center">
                                          {r.deliveryDate || "-"}
                                        </td>
                                      )}
                                      {isContractedView && (
                                        <td className="px-6 py-6 text-sm text-zinc-500 text-center">
                                          {r.contractDate || "-"}
                                        </td>
                                      )}
                                      {isInspectionView && (
                                        <td className="px-4 py-6 text-sm text-zinc-500 text-center">
                                          {r.visitDate}
                                        </td>
                                      )}
                                      <td className="px-4 py-6 text-center flex gap-3 justify-center">
                                        {isInspectionView &&
                                          currentUser?.email ===
                                            ADMIN_EMAIL && (
                                            <button
                                              onClick={() => {
                                                setInspectionFormData(r);
                                                setInspectionStep(2);
                                                setIsInspectionModalOpen(true);
                                              }}
                                              className="text-zinc-600 border border-zinc-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all"
                                            >
                                              {t.step2}
                                            </button>
                                          )}
                                        {currentUser?.email === ADMIN_EMAIL &&
                                          !isInspectionView && (
                                            <button
                                              onClick={() =>
                                                openEditFinalizedRecord(
                                                  r,
                                                  isContractedView
                                                    ? "contracted_customers"
                                                    : "non_contracted_customers",
                                                )
                                              }
                                              className="text-zinc-600 border border-zinc-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                          )}
                                        {currentUser?.email === ADMIN_EMAIL &&
                                          adminSubView === "not-contracted" && (
                                            <button
                                              onClick={() =>
                                                handleMoveNonContractedToContracted(
                                                  r,
                                                )
                                              }
                                              className="text-emerald-600 border border-emerald-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-emerald-600 hover:text-white transition-all"
                                              title={
                                                lang === "ar"
                                                  ? "نقل للمتعاقدين"
                                                  : "Move to Contracted"
                                              }
                                            >
                                              <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                          )}
                                        <button
                                          onClick={() => {
                                            setSelectedRecord(r);
                                            setIsDetailModalOpen(true);
                                          }}
                                          className="text-zinc-400 border border-zinc-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        {currentUser?.email === ADMIN_EMAIL && (
                                          <button
                                            onClick={() => {
                                              if (isContractedView)
                                                handleDeleteContracted(r.id);
                                              else if (
                                                adminSubView ===
                                                "not-contracted"
                                              )
                                                handleDeleteNonContracted(r.id);
                                              else if (isInspectionView)
                                                void handleDeleteInspection(
                                                  r.id,
                                                );
                                            }}
                                            className="text-red-500 border border-red-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                {activeRecords.length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="py-20 text-center"
                                    >
                                      <Users className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                                      <p className="text-zinc-400 font-semibold">
                                        {t.noRecords}
                                      </p>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:hidden">
                          {activeRecords
                            .filter((r) => matchesFilters(r))
                            .map((r) => (
                              <div
                                key={r.id}
                                className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] flex flex-col gap-4 border border-white/50 shadow-lg relative overflow-hidden group card-accent"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="text-xl font-bold text-zinc-900 mb-1">
                                      {r.customerName}
                                    </h4>
                                    <p className="text-zinc-500 font-mono text-sm">
                                      {r.phone}
                                    </p>
                                    <p className="text-zinc-500 font-mono text-sm">
                                      {r.governorate || ""}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    {isContractedView && (
                                      <span className="text-[10px] text-zinc-400 font-mono block mb-1">
                                        {t.deliveryDate}
                                      </span>
                                    )}
                                    {isContractedView && (
                                      <span className="text-xs font-bold text-zinc-600 block mb-2">
                                        {r.deliveryDate || "-"}
                                      </span>
                                    )}
                                    {isContractedView && (
                                      <span className="text-[10px] text-zinc-400 font-mono block mb-1">
                                        {t.contractDate}
                                      </span>
                                    )}
                                    {isContractedView && (
                                      <span className="text-xs font-bold text-zinc-600">
                                        {r.contractDate || "-"}
                                      </span>
                                    )}
                                    {isInspectionView && (
                                      <span className="text-[10px] text-zinc-400 font-mono block mb-1">
                                        {t.visitDate}
                                      </span>
                                    )}
                                    {isInspectionView && (
                                      <span className="text-xs font-bold text-zinc-600">
                                        {r.visitDate}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-4 border-t border-zinc-100 justify-end flex-wrap">
                                  {isInspectionView &&
                                    currentUser?.email === ADMIN_EMAIL && (
                                      <button
                                        onClick={() => {
                                          setInspectionFormData(r);
                                          setInspectionStep(2);
                                          setIsInspectionModalOpen(true);
                                        }}
                                        className="flex-1 min-w-[120px] flex items-center justify-center text-zinc-600 border border-zinc-200 px-4 py-3 rounded-2xl text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
                                      >
                                        {t.step2}
                                      </button>
                                    )}
                                  {currentUser?.email === ADMIN_EMAIL &&
                                    !isInspectionView && (
                                      <button
                                        onClick={() =>
                                          openEditFinalizedRecord(
                                            r,
                                            isContractedView
                                              ? "contracted_customers"
                                              : "non_contracted_customers",
                                          )
                                        }
                                        className="flex-1 min-w-[70px] flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 border border-zinc-200 px-4 py-3 rounded-2xl text-xs font-bold uppercase hover:bg-zinc-200 transition-all shadow-sm"
                                      >
                                        <Edit2 className="w-4 h-4" />{" "}
                                        {lang === "ar" ? "تعديل" : "Edit"}
                                      </button>
                                    )}
                                  {currentUser?.email === ADMIN_EMAIL &&
                                    adminSubView === "not-contracted" && (
                                      <button
                                        onClick={() =>
                                          handleMoveNonContractedToContracted(r)
                                        }
                                        className="flex-1 min-w-[70px] flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-3 rounded-2xl text-xs font-bold uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />{" "}
                                        {lang === "ar" ? "تعاقد" : "Contract"}
                                      </button>
                                    )}
                                  <button
                                    onClick={() => {
                                      setSelectedRecord(r);
                                      setIsDetailModalOpen(true);
                                    }}
                                    className="flex-1 min-w-[70px] flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 px-4 py-3 rounded-2xl text-xs font-bold uppercase hover:bg-zinc-200 transition-all shadow-sm btn-3d btn-3d-glass"
                                  >
                                    <Eye className="w-4 h-4" />{" "}
                                    {lang === "ar" ? "عرض" : "View"}
                                  </button>
                                  {currentUser?.email === ADMIN_EMAIL && (
                                    <button
                                      onClick={() => {
                                        if (isContractedView)
                                          handleDeleteContracted(r.id);
                                        else if (
                                          adminSubView === "not-contracted"
                                        )
                                          handleDeleteNonContracted(r.id);
                                        else if (isInspectionView)
                                          void handleDeleteInspection(r.id);
                                      }}
                                      className="flex items-center justify-center gap-2 bg-red-50 text-red-500 border border-red-100 px-4 py-3 rounded-2xl text-xs font-bold uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          {activeRecords.length === 0 && (
                            <div className="py-20 text-center">
                              <Users className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                              <p className="text-zinc-400 font-semibold">
                                {t.noRecords}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : currentUser && !isAuthorizedUser ? (
                  <motion.div
                    key="unauthorized"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8"
                  >
                    <div className="glass rounded-[2.5rem] p-12 shadow-2xl text-center">
                      <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" />
                      <h2 className="heading-accent text-4xl md:text-5xl font-light mb-4">
                        {lang === "ar"
                          ? "لا تملك صلاحية الدخول"
                          : "Access not authorized"}
                      </h2>
                      <p className="text-zinc-500 text-base md:text-lg mb-8">
                        {lang === "ar"
                          ? "تم تسجيل الدخول ولكن هذا الحساب غير مصرح له باستخدام لوحة التحكم."
                          : "You are signed in, but this account is not authorized to access the admin portal."}
                      </p>
                      <button
                        onClick={handleLogout}
                        className="bg-zinc-900 text-white py-4 px-8 rounded-3xl font-bold uppercase tracking-widest btn-3d btn-3d-zinc"
                      >
                        {lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                      <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" />
                      <h2 className="heading-accent text-4xl md:text-5xl font-light">
                        {t.welcome}
                      </h2>
                      <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-2xl mx-auto">
                        {t.enterCreds}
                      </p>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, y: 24, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="glass rounded-[2.5rem] p-10 md:p-12 shadow-2xl login-panel"
                    >
                      <motion.form
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onSubmit={handleAdminLogin}
                        className="space-y-8"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">
                            {t.adminUser}
                          </label>
                          <input
                            required
                            className="w-full px-6 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm"
                            value={formData.username}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                username: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">
                            {t.passphrase}
                          </label>
                          <div className="relative">
                            <input
                              required
                              type={showPassword ? "text" : "password"}
                              className="w-full ps-12 pe-5 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm"
                              value={formData.password}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  password: e.target.value,
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                            >
                              {showPassword ? (
                                <EyeOff className="w-6 h-6" />
                              ) : (
                                <Eye className="w-6 h-6" />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          disabled={isLoading}
                          type="submit"
                          className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-lg btn-3d btn-3d-zinc"
                        >
                          {isLoading ? t.authenticating : t.adminAccess}{" "}
                          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                      </motion.form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isContractUploadOpen && pendingContractInspection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsContractUploadOpen(false);
                setPendingContractInspection(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 shadow-2xl relative z-10 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setIsContractUploadOpen(false);
                  setPendingContractInspection(null);
                }}
                className="absolute top-6 right-6 rtl:right-auto rtl:left-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-90 hover:scale-110 shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-4 mb-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {lang === "ar"
                      ? "رفع العقد الموقع"
                      : "Upload signed contract"}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                    {lang === "ar"
                      ? "لا يمكن المتابعة إلى المرحلة التالية إلا بعد رفع صورة العقد الموقع بنجاح."
                      : "The order cannot move forward until a signed contract image is uploaded successfully."}
                  </p>
                </div>
                <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                  {pendingContractInspection.customerName}
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={contractUploadLoading}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-bold text-zinc-700 shadow-sm transition-all hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-60"
                >
                  <Camera className="h-5 w-5" />
                  {lang === "ar"
                    ? "التقاط صورة بالكاميرا"
                    : "Take photo with camera"}
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={contractUploadLoading}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-bold text-zinc-700 shadow-sm transition-all hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-60"
                >
                  <ImageIcon className="h-5 w-5" />
                  {lang === "ar"
                    ? "اختيار صورة من المعرض"
                    : "Choose from gallery"}
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleContractInputSelection}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleContractInputSelection}
              />

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {lang === "ar"
                  ? "سيتم ضغط الصورة تلقائياً قبل الرفع لتقليل الحجم مع الحفاظ على وضوح النص."
                  : "The image will be compressed automatically before upload to reduce size while keeping the text readable."}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isInspectionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseInspectionModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={handleCloseInspectionModal}
                className="absolute top-6 right-6 rtl:right-auto rtl:left-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-90 hover:scale-110 shadow-sm group"
              >
                <X className="w-4 h-4 transition-transform duration-300" />
              </button>

              <div className="flex gap-4 mb-8">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 flex-1 rounded-full ${inspectionStep >= s ? "bg-zinc-900" : "bg-zinc-100"}`}
                  />
                ))}
              </div>

              <h2 className="text-3xl font-light mb-8 pe-12">
                {inspectionStep === 1 ? t.step1 : t.step2}
              </h2>

              <form onSubmit={handleInspectionSubmit} className="space-y-6">
                {inspectionStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {t.customerName}
                      </label>
                      <input
                        required
                        className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                        value={inspectionFormData.customerName}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            customerName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {t.address}
                      </label>
                      <input
                        required
                        className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                        value={inspectionFormData.address}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            address: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {t.phoneNumber}
                      </label>
                      <input
                        required
                        type="tel"
                        minLength={11}
                        maxLength={11}
                        pattern="[0-9]{11}"
                        title={
                          lang === "ar"
                            ? "يجب أن يكون رقم الهاتف 11 رقماً بالضبط"
                            : "Phone number must be exactly 11 digits"
                        }
                        className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                        value={inspectionFormData.phone}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            phone: normalizePhone(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {lang === "ar" ? "المحافظة" : "Governorate"}
                      </label>
                      <select
                        value={inspectionFormData.governorate || ""}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            governorate: e.target.value,
                          })
                        }
                        className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                      >
                        <option value="">
                          {lang === "ar"
                            ? "اختر المحافظة"
                            : "Select governorate"}
                        </option>
                        <option value="القاهرة">القاهرة</option>
                        <option value="الاسكندرية">الاسكندرية</option>
                      </select>
                    </div>

                    {editingCollection === "contracted_customers" && (
                      <div className="space-y-4 bg-accent-tan/5 p-4 rounded-2xl border border-accent-tan/10">
                        <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">
                          {lang === "ar" ? "بيانات التعاقد" : "Contract Data"}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                              {t.deliveryAddress}
                            </label>
                            <input
                              className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                              value={inspectionFormData.deliveryAddress || ""}
                              onChange={(e) =>
                                setInspectionFormData({
                                  ...inspectionFormData,
                                  deliveryAddress: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                              {t.deliveryDate}
                            </label>
                            <input
                              type="date"
                              className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                              value={inspectionFormData.deliveryDate || ""}
                              onChange={(e) =>
                                setInspectionFormData({
                                  ...inspectionFormData,
                                  deliveryDate: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                              {t.pickupDate}
                            </label>
                            <input
                              type="date"
                              className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                              value={inspectionFormData.pickupDate || ""}
                              onChange={(e) =>
                                setInspectionFormData({
                                  ...inspectionFormData,
                                  pickupDate: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                              {t.contractDate}
                            </label>
                            <input
                              type="date"
                              className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                              value={inspectionFormData.contractDate || ""}
                              onChange={(e) =>
                                setInspectionFormData({
                                  ...inspectionFormData,
                                  contractDate: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                              {t.portfolio}
                            </label>
                            {inspectionFormData.portfolio ? (
                              <div className="flex items-center gap-2">
                                <span className="flex-1 truncate text-sm px-5 py-4 bg-black/5 border border-black/5 rounded-2xl">
                                  {inspectionFormData.portfolio
                                    .split("/")
                                    .pop() || inspectionFormData.portfolio}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInspectionFormData({
                                      ...inspectionFormData,
                                      portfolio: "",
                                    })
                                  }
                                  className="p-4 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".pdf"
                                  onChange={handlePortfolioUpload}
                                  className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl file:mr-4 file:py-2 file:px-4 file:rounded-2xl file:border-0 file:bg-zinc-900 file:text-white file:text-xs file:font-bold cursor-pointer"
                                />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                              {t.portfolioDate}
                            </label>
                            <input
                              type="date"
                              className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                              value={inspectionFormData.portfolioDate || ""}
                              onChange={(e) =>
                                setInspectionFormData({
                                  ...inspectionFormData,
                                  portfolioDate: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {t.visitDate}
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                        value={inspectionFormData.visitDate}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            visitDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {t.notes}
                      </label>
                      <textarea
                        className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                        rows={3}
                        value={inspectionFormData.notes}
                        onChange={(e) =>
                          setInspectionFormData({
                            ...inspectionFormData,
                            notes: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {inspectionStep === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                        {t.rooms}
                      </label>
                      <input
                        readOnly
                        type="number"
                        className="w-full px-5 py-4 bg-black/10 border border-black/10 rounded-2xl text-zinc-500"
                        value={inspectionFormData.room_types?.length || 0}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-black/10 bg-[#faf7f1] p-4">
                        <div className="text-sm font-semibold mb-3">
                          {lang === "ar" ? "فئات الغرف" : "Room categories"}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {ROOM_TYPES.map((room) => {
                            const count = getRoomTypeCount(room.key);
                            return (
                              <button
                                key={room.key}
                                type="button"
                                onClick={() => toggleRoomType(room.key)}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-3xl text-sm font-bold transition-all ${count > 0 ? "bg-zinc-900 text-white" : "bg-white border border-black/10 text-zinc-700 hover:bg-zinc-100"}`}
                              >
                                <span>{room.ar}</span>
                                {count > 0 ? (
                                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white text-[10px] font-black text-zinc-900 px-1">
                                    {count}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        {inspectionFormData.room_types?.length ? (
                          <div className="text-xs text-zinc-500 mt-3">
                            {lang === "ar"
                              ? "الغرف المحددة:"
                              : "Selected rooms:"}{" "}
                            {inspectionFormData.room_types
                              .map(
                                (key) =>
                                  ROOM_TYPES.find((room) => room.key === key)
                                    ?.ar || key,
                              )
                              .join(", ")}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 mt-3">
                            {lang === "ar"
                              ? "اختر الفئات التي ستشملها المعاينة."
                              : "Pick the room categories to include in this visit."}
                          </div>
                        )}
                      </div>

                      {inspectionFormData.room_types?.length ? (
                        <div className="rounded-3xl border border-black/10 bg-white p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                            <div className="text-sm font-semibold">
                              {lang === "ar"
                                ? "القائمة الافتراضية لكل غرفة"
                                : "Default checklist per room"}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const firstRoomType = inspectionFormData.room_types?.[0];
                                if (firstRoomType) {
                                  addRoomTypeInstance(firstRoomType);
                                }
                              }}
                              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
                            >
                              {lang === "ar" ? "إضافة غرفة جديدة" : "Add new room"}
                            </button>
                          </div>
                          <div className="space-y-4">
                            {inspectionFormData.room_types.map((roomKey, roomIndex) => {
                              const room = ROOM_TYPES.find(
                                (r) => r.key === roomKey,
                              );
                              if (!room) return null;
                              const roomCount = getRoomTypeCount(roomKey);
                              const roomInstanceId = getRoomInstanceKey(roomKey, roomIndex);
                              return (
                                <div
                                  key={`${roomKey}-${roomIndex}`}
                                  className="rounded-3xl border border-black/10 p-4 bg-[#faf7f1]"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                    <div>
                                      <div className="text-base font-semibold">
                                        {getRoomDisplayName(room.key, roomIndex)}
                                      </div>
                                      <div className="text-[11px] text-zinc-500">
                                        {room.en}
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                                        <span>
                                          {lang === "ar" ? "عدد" : "Count"}: {roomCount}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            addRoomTypeInstance(room.key)
                                          }
                                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                                        >
                                          {lang === "ar"
                                            ? "إضافة نفس النوع"
                                            : "Add same type"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeRoomTypeInstance(room.key, roomIndex)
                                          }
                                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
                                        >
                                          {lang === "ar"
                                            ? "إزالة غرفة"
                                            : "Remove room"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {room.defaults.map((itemName) => {
                                      const isHighlighted =
                                        recentlyClickedItem === itemName;
                                      return (
                                        <button
                                          key={itemName}
                                          type="button"
                                          onClick={() => {
                                            addPiece(itemName, roomKey, roomInstanceId);
                                            setRecentlyClickedItem(itemName);
                                            setTimeout(
                                              () =>
                                                setRecentlyClickedItem(null),
                                              300,
                                            );
                                          }}
                                          className={`rounded-full px-3 py-2 text-xs font-bold transition-all ${
                                            isHighlighted
                                              ? "bg-zinc-900 text-white"
                                              : "border border-black/10 bg-white text-zinc-700 hover:bg-zinc-100"
                                          }`}
                                        >
                                          {itemName}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-3xl border border-black/10 bg-white p-4">
                        <div className="text-sm font-semibold mb-3">
                          {lang === "ar" ? "عنصر مخصص" : "Custom item"}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
                          <input
                            value={customPieceName}
                            onChange={(e) => setCustomPieceName(e.target.value)}
                            placeholder={
                              lang === "ar" ? "اسم العنصر" : "Item name"
                            }
                            className="rounded-3xl border border-black/10 px-4 py-3"
                          />
                          <input
                            type="number"
                            min={1}
                            value={customPieceQty}
                            onChange={(e) =>
                              setCustomPieceQty(Number(e.target.value))
                            }
                            placeholder={lang === "ar" ? "الكمية" : "Qty"}
                            className="rounded-3xl border border-black/10 px-4 py-3"
                          />
                        </div>
                        <div className="grid gap-3 mt-3">
                          <select
                            value={customPieceRoomInstanceId || ""}
                            onChange={(e) =>
                              setCustomPieceRoomInstanceId(
                                e.target.value || undefined,
                              )
                            }
                            className="rounded-3xl border border-black/10 px-4 py-3 bg-white"
                          >
                            <option value="">
                              {lang === "ar"
                                ? "اختر غرفة موجودة (اختياري)"
                                : "Choose existing room (optional)"}
                            </option>
                            {(inspectionFormData.room_types || []).map(
                              (roomKey, roomIndex) => {
                                const roomInstanceId = getRoomInstanceKey(
                                  roomKey,
                                  roomIndex,
                                );
                                return (
                                  <option
                                    key={roomInstanceId}
                                    value={roomInstanceId}
                                  >
                                    {getRoomDisplayName(roomKey, roomIndex)}
                                  </option>
                                );
                              },
                            )}
                          </select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_120px] mt-3">
                          <input
                            value={customPieceRoomLabel}
                            onChange={(e) => setCustomPieceRoomLabel(e.target.value)}
                            placeholder={lang === "ar" ? "اسم الغرفة (اختياري)" : "Room name (optional)"}
                            className="rounded-3xl border border-black/10 px-4 py-3"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!customPieceName.trim()) return;
                              const name = customPieceName.trim();
                              const qty = Math.max(1, customPieceQty);
                              const price = Number(customPiecePrice) || 0;
                              const selectedRoomInstanceId =
                                customPieceRoomInstanceId?.trim();
                              const roomType = selectedRoomInstanceId
                                ? selectedRoomInstanceId.split(":")[0]
                                : inspectionFormData.room_types?.[0] ||
                                  "other";

                              const roomInstanceId =
                                customPieceRoomLabel && customPieceRoomLabel.trim()
                                  ? `${getRoomTypeKey(roomType)}:custom:${encodeURIComponent(
                                      customPieceRoomLabel
                                        .trim()
                                        .replace(/\s+/g, "_"),
                                    )}`
                                  : selectedRoomInstanceId ||
                                    getRoomInstanceKey(roomType, 0);

                              // ensure pieces is based on latest state
                              setInspectionFormData((prev) => {
                                const pieces = [...(prev.pieces || [])];
                                const existingIndex = pieces.findIndex(
                                  (p) =>
                                    p.name === name &&
                                    pieceMatchesRoomInstance(
                                      p,
                                      roomType,
                                      roomInstanceId,
                                      0,
                                    ),
                                );
                                if (existingIndex >= 0) {
                                  pieces[existingIndex].quantity =
                                    (pieces[existingIndex].quantity || 1) + qty;
                                  pieces[existingIndex].price = price;
                                } else {
                                  pieces.push({
                                    name,
                                    quantity: qty,
                                    price,
                                    details: "",
                                    room_type: roomType,
                                    room_instance_id: roomInstanceId,
                                  });
                                }
                                return {
                                  ...prev,
                                  pieces,
                                  totalAmount: computeInspectionTotalAmount(pieces),
                                };
                              });

                              setCustomPieceName("");
                              setCustomPieceQty(1);
                              setCustomPiecePrice("");
                              setCustomPieceRoomLabel("");
                              setCustomPieceRoomInstanceId(undefined);
                            }}
                            className="rounded-3xl bg-zinc-900 text-white px-4 py-3 text-sm font-bold hover:bg-zinc-800 transition-all"
                          >
                            {lang === "ar" ? "أضف" : "Add"}
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const pieces = inspectionFormData.pieces || [];

                        // base instances from selected room types
                        const baseInstances = (inspectionFormData.room_types || ["other"]).map(
                          (roomKey, roomIndex) => {
                            const roomInstanceId = getRoomInstanceKey(roomKey, roomIndex);
                            const room = ROOM_TYPES.find((r) => r.key === roomKey);
                            const items = pieces
                              .map((p, idx) => ({ ...p, idx }))
                              .filter((p) =>
                                pieceMatchesRoomInstance(
                                  p,
                                  roomKey,
                                  roomInstanceId,
                                  roomIndex,
                                ),
                              );
                            return { roomKey, roomInstanceId, room, items, customLabel: null as string | null };
                          },
                        );

                        // include any custom room_instance_id that are not part of baseInstances
                        const existingIds = new Set(baseInstances.map((r) => r.roomInstanceId));
                        const extraMap = new Map<string, { roomKey: string; roomInstanceId: string; room: any; items: any[]; customLabel: string | null }>();
                        pieces.forEach((p, idx) => {
                          if (p.room_instance_id && !existingIds.has(p.room_instance_id)) {
                            if (!extraMap.has(p.room_instance_id)) {
                              const roomKey = getRoomTypeKey(p.room_type);
                              const room = ROOM_TYPES.find((r) => r.key === roomKey);
                              // decode custom label encoded as key:custom:label
                              const m = String(p.room_instance_id).match(/:custom:(.+)$/);
                              const customLabel = m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null;
                              extraMap.set(p.room_instance_id, { roomKey, roomInstanceId: p.room_instance_id, room, items: [], customLabel });
                            }
                            const entry = extraMap.get(p.room_instance_id)!;
                            entry.items.push({ ...p, idx });
                          }
                        });

                        const roomInstances = [...baseInstances, ...Array.from(extraMap.values())];

                        return (
                          <div className="space-y-4">
                            {roomInstances.map(({ roomKey, roomInstanceId, room, items, customLabel }, roomIdx) => {
                              if (!items.length) return null;
                              const subtotal = inspectionRoomSubtotal(
                                roomKey,
                                roomInstanceId,
                                roomIdx,
                              );
                              return (
                                <div
                                  key={roomInstanceId}
                                  className="rounded-3xl border border-black/10 bg-white p-4"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <div>
                                      <div className="text-base font-semibold">
                                        {customLabel
                                          ? customLabel
                                          : `${getRoomDisplayName(roomKey, roomIdx)}`}
                                      </div>
                                      <div className="text-[11px] text-zinc-500">
                                        {lang === "ar"
                                          ? "إجمالي هذه الغرفة"
                                          : "Room subtotal"}
                                      </div>
                                    </div>
                                    <div className="text-xl font-bold">
                                      {subtotal.toLocaleString()} EGP
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    {items.map((p) => (
                                      <div
                                        key={p.idx}
                                        className="flex flex-col gap-3 rounded-3xl border border-black/10 bg-[#faf7f1] p-4"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                          <div className="space-y-1">
                                            <div className="font-bold text-lg text-zinc-800">
                                              {p.name}
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                              {lang === "ar"
                                                ? "الغرفة"
                                                : "Room"}
                                              : {room?.ar || roomKey}
                                            </div>
                                          </div>
                                          <div className="grid gap-2 sm:grid-cols-[auto_auto] items-center">
                                            <div className="relative rounded-3xl bg-white px-4 py-3 text-sm font-bold text-zinc-800">
                                              <span className="text-[10px] text-zinc-400 block mb-1">
                                                {lang === "ar"
                                                  ? "العدد"
                                                  : "Qty"}
                                              </span>
                                              <input
                                                type="number"
                                                value={p.quantity || ""}
                                                onChange={(e) =>
                                                  updatePiece(
                                                    p.idx,
                                                    "quantity",
                                                    e.target.value === ""
                                                      ? ""
                                                      : Number(e.target.value),
                                                  )
                                                }
                                                onBlur={(e) => {
                                                  const val = Number(
                                                    e.target.value,
                                                  );
                                                  if (isNaN(val) || val < 1) {
                                                    updatePiece(
                                                      p.idx,
                                                      "quantity",
                                                      1,
                                                    );
                                                  }
                                                }}
                                                className="w-20 bg-transparent outline-none text-right"
                                              />
                                            </div>
                                            <div className="relative rounded-3xl bg-white px-4 py-3 text-sm font-bold text-zinc-800">
                                              <span className="text-[10px] text-zinc-400 block mb-1">
                                                EGP
                                              </span>
                                              <input
                                                type="number"
                                                min={0}
                                                value={p.price || ""}
                                                onChange={(e) =>
                                                  updatePiece(
                                                    p.idx,
                                                    "price",
                                                    Number(e.target.value),
                                                  )
                                                }
                                                className="w-24 bg-transparent outline-none text-right"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="grid gap-3">
                                          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                                            <label className="inline-flex items-center gap-2 rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(
                                                  p.aro_veneer_addon,
                                                )}
                                                onChange={(e) =>
                                                  updatePiece(
                                                    p.idx,
                                                    "aro_veneer_addon",
                                                    e.target.checked,
                                                  )
                                                }
                                                className="accent-[#d4a373]"
                                              />
                                              <span>
                                                {lang === "ar"
                                                  ? "قشرة أرو"
                                                  : "Aro veneer"}
                                              </span>
                                            </label>
                                            <div className="rounded-3xl border border-black/10 bg-white px-4 py-3">
                                              <label className="text-[10px] text-zinc-400 block mb-1">
                                                {lang === "ar"
                                                  ? "سعر القشرة"
                                                  : "Veneer surcharge"}
                                              </label>
                                              <input
                                                type="number"
                                                min={0}
                                                value={p.aro_surcharge || ""}
                                                onChange={(e) =>
                                                  updatePiece(
                                                    p.idx,
                                                    "aro_surcharge",
                                                    Number(e.target.value),
                                                  )
                                                }
                                                className="w-full bg-transparent outline-none text-right"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
                                            <div>
                                              <label className="text-[10px] font-bold uppercase text-zinc-400">
                                                {lang === "ar"
                                                  ? "التفاصيل"
                                                  : "Details"}
                                              </label>
                                              <textarea
                                                placeholder={
                                                  lang === "ar"
                                                    ? "أضف تفاصيل للالمنتج..."
                                                    : "Add product details..."
                                                }
                                                rows={2}
                                                value={p.details || ""}
                                                onChange={(e) =>
                                                  updatePiece(
                                                    p.idx,
                                                    "details",
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full px-4 py-3 bg-white border border-black/5 rounded-xl text-sm text-zinc-700 placeholder:text-zinc-300 outline-none focus:border-accent-tan/40 transition-all resize-none"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setInspectionFormData((prev) => {
                                                  const pieces =
                                                    prev.pieces?.filter(
                                                      (_, i) => i !== p.idx,
                                                    ) || [];
                                                  return {
                                                    ...prev,
                                                    pieces,
                                                    totalAmount: computeInspectionTotalAmount(pieces),
                                                  };
                                                });
                                                setExpandedPieceDetails(
                                                  (prev) =>
                                                    prev
                                                      .filter(
                                                        (i) => i !== p.idx,
                                                      )
                                                      .map((i) =>
                                                        i > p.idx ? i - 1 : i,
                                                      ),
                                                );
                                              }}
                                              className="min-w-[56px] p-3 bg-white border border-red-200 text-red-600 rounded-3xl shadow-[0_12px_24px_rgba(239,68,68,0.12)] hover:bg-red-50 transition-all duration-200 flex items-center justify-center"
                                            >
                                              <Trash2 className="w-5 h-5" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <div className="pt-4 border-t border-black/5 flex justify-between items-center">
                        <span className="font-bold text-lg">{t.total}:</span>
                        <span className="text-2xl font-bold text-accent-tan">
                          {(
                            inspectionFormData.totalAmount || 0
                          ).toLocaleString()}{" "}
                          EGP
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {inspectionStep < 3 && !editingCollection && (
                  <div className="flex gap-4 pt-4">
                    {inspectionStep === 2 && (
                      <button
                        type="button"
                        onClick={() => setInspectionStep((prev) => prev - 1)}
                        className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest btn-3d btn-3d-glass"
                      >
                        {lang === "ar" ? "السابق" : "Back"}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl btn-3d btn-3d-zinc"
                    >
                      {isLoading
                        ? t.processing
                        : inspectionStep === 1
                          ? lang === "ar"
                            ? "حفظ"
                            : "Save"
                          : lang === "ar"
                            ? "حفظ"
                            : "Save"}
                    </button>
                    {inspectionStep === 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectionStep(2);
                        }}
                        className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest btn-3d btn-3d-glass"
                      >
                        {lang === "ar" ? "التالي ←" : "Next →"}
                      </button>
                    )}
                  </div>
                )}
                {inspectionStep < 3 && editingCollection && (
                  <div className="flex gap-4 pt-4">
                    {inspectionStep === 2 && (
                      <button
                        type="button"
                        onClick={() => setInspectionStep((prev) => prev - 1)}
                        className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest btn-3d btn-3d-glass"
                      >
                        {lang === "ar" ? "السابق" : "Back"}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl btn-3d btn-3d-zinc"
                    >
                      {isLoading
                        ? t.processing
                        : inspectionStep === 1
                          ? lang === "ar"
                            ? "حفظ وانتقال"
                            : "Save & Next"
                          : lang === "ar"
                            ? "حفظ"
                            : "Save"}
                    </button>
                    {inspectionStep === 1 && (
                      <button
                        type="button"
                        onClick={() => setInspectionStep(2)}
                        className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest btn-3d btn-3d-glass"
                      >
                        {lang === "ar" ? "التالي ←" : "Next →"}
                      </button>
                    )}
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailModalOpen && selectedRecord && (
          // ... (existing detail modal)
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="absolute top-6 right-6 rtl:right-auto rtl:left-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-90 hover:scale-110 shadow-sm"
              >
                <X className="w-4 h-4 transition-transform duration-300" />
              </button>

              <h2 className="text-3xl font-light mb-8 pe-12">
                {selectedRecord.customerName || selectedRecord.name}
              </h2>

              <div className="space-y-8 pb-8">
                {/* Section: Contact Information */}
                <div className="bg-zinc-50/50 rounded-3xl p-6 border border-zinc-100/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2">
                        <UserIcon className="w-3 h-3" /> {t.userName}
                      </label>
                      <p className="text-lg font-bold text-zinc-900">
                        {selectedRecord.customerName || selectedRecord.name}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2">
                        <Users className="w-3 h-3" /> {t.phoneNumber}
                      </label>
                      <p className="text-lg font-bold text-zinc-900 font-mono tracking-wider">
                        {selectedRecord.phone}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2 mb-2">
                        <Languages className="w-3 h-3" /> {t.address}
                      </label>
                      <p className="text-zinc-700 leading-relaxed font-semibold">
                        {selectedRecord.address || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2 mb-2">
                        <Languages className="w-3 h-3 text-accent-tan" />{" "}
                        {t.deliveryAddress}
                      </label>
                      <p className="text-zinc-700 leading-relaxed font-semibold">
                        {selectedRecord.deliveryAddress || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Dates & Inspection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-3 block">
                      {t.visitDate}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-tan/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-accent-tan" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900">
                          {selectedRecord.visitDate || "-"}
                        </p>
                        {selectedRecord.visitDateTo && (
                          <p className="text-[10px] text-zinc-400">
                            إلى {selectedRecord.visitDateTo}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-3 block">
                      {t.rooms}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                        <Armchair className="w-5 h-5 text-zinc-500" />
                      </div>
                      <p className="text-xl font-bold text-zinc-900">
                        {selectedRecord.rooms || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Logistics & Financials */}
                <div className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <div className="relative z-10 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest">
                          {t.deliveryDate}
                        </label>
                        <p className="font-bold text-lg">
                          {selectedRecord.deliveryDate || "-"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest">
                          {t.pickupDate}
                        </label>
                        <p className="font-bold text-lg">
                          {selectedRecord.pickupDate || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-8 items-end">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest">
                          {t.contractDate}
                        </label>
                        <p className="font-bold text-lg">
                          {selectedRecord.contractDate || "-"}
                        </p>
                      </div>
                      <div className="text-right rtl:text-left">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest block mb-1">
                          {t.total}
                        </label>
                        <p className="text-3xl font-black text-accent-tan">
                          {(selectedRecord.totalAmount || 0).toLocaleString()}{" "}
                          <span className="text-xs font-bold opacity-60">
                            EGP
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Portfolio */}
                {selectedRecord.portfolio && (
                  <div className="bg-white border-2 border-dashed border-zinc-100 rounded-3xl p-6">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-4 block">
                      {t.portfolio}
                    </label>
                    <div className="flex items-center gap-4 bg-zinc-50 p-4 rounded-2xl">
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <FileSpreadsheet className="w-6 h-6 text-accent-tan" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate mb-0.5">
                          {selectedRecord.portfolio}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {t.portfolioDate}:{" "}
                          {selectedRecord.portfolioDate || "-"}
                        </p>
                      </div>
                      <a
                        href={selectedRecord.portfolio}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-zinc-900 text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                      >
                        <Eye className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                )}

                {selectedRecord.contractUrl && (
                  <div className="bg-white border-2 border-dashed border-zinc-100 rounded-3xl p-6">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-4 block">
                      {lang === "ar" ? "صورة العقد" : "Contract image"}
                    </label>
                    <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
                      <img
                        src={selectedRecord.contractUrl}
                        alt={lang === "ar" ? "صورة العقد" : "Contract image"}
                        className="w-full max-h-80 object-contain bg-white"
                      />
                    </div>
                    <a
                      href={selectedRecord.contractUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {lang === "ar" ? "فتح الصورة" : "Open image"}
                    </a>
                  </div>
                )}

                {/* Section: Items */}
                {/* Section: Quote Builder */}
                <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">
                      {lang === "ar" ? "منشئ العرض" : "Quote builder"}
                    </h3>
                    <button
                      onClick={handleSaveQuote}
                      className="rounded-full bg-[#18181b] text-white px-4 py-2 text-sm"
                    >
                      {lang === "ar" ? "حفظ العرض" : "Save quote"}
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-black/10 p-4 bg-[#faf7f1]">
                      <div className="text-sm font-semibold mb-2">
                        {lang === "ar" ? "الإجمالي الكلي" : "Grand total"}
                      </div>
                      <div className="text-3xl font-bold">
                        {quoteTotal().toLocaleString()} جنيه
                      </div>
                    </div>
                    <div className="rounded-3xl border border-black/10 p-4 bg-[#faf7f1]">
                      <div className="text-sm font-semibold mb-2">
                        {lang === "ar" ? "إجمالي كل غرفة" : "Room totals"}
                      </div>
                      <div className="space-y-2">
                        {quoteDrafts.length === 0 ? (
                          <div className="text-zinc-500">
                            {lang === "ar" ? "لا توجد غرف بعد" : "No rooms yet"}
                          </div>
                        ) : (
                          quoteDrafts.map((room, roomIndex) => (
                            <div
                              key={`${room.room_type}-${roomIndex}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>
                                {room.customLabel ?? getRoomDisplayName(room.room_type, roomIndex)}
                              </span>
                              <span className="font-semibold">
                                {quoteRoomSubtotal(room).toLocaleString()} جنيه
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-3xl border border-black/10 bg-[#f8f4ec] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-600">
                      {lang === "ar"
                        ? "اضغط حفظ لحفظ أي تغييرات في العرض"
                        : "Press Save to persist any changes in the quote."}
                    </p>
                    <button
                      onClick={handleSaveQuote}
                      className="rounded-full bg-[#18181b] text-white px-5 py-3 text-sm shadow-xl hover:bg-zinc-800 transition"
                    >
                      {lang === "ar" ? "حفظ العرض" : "Save quote"}
                    </button>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold mb-3">
                      {lang === "ar" ? "ملخص الغرف" : "Rooms summary"}
                    </div>
                    {quoteDrafts.length === 0 ? (
                      <div className="text-zinc-500">
                        {lang === "ar" ? "لا توجد غرف بعد" : "No rooms yet"}
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {quoteDrafts.map((room, roomIndex) => (
                          <div
                            key={`${room.room_type}-${roomIndex}-summary`}
                            className="rounded-3xl border border-black/10 bg-[#faf7f1] p-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                              <div className="space-y-2">
                                <input
                                  value={
                                    room.customLabel ??
                                    getRoomDisplayName(room.room_type, roomIndex)
                                  }
                                  onChange={(e) =>
                                    setRoomLabel(roomIndex, e.target.value)
                                  }
                                  placeholder={
                                    lang === "ar" ? "اسم الغرفة" : "Room name"
                                  }
                                  className="w-full rounded-3xl border border-black/10 bg-white px-4 py-3 text-lg font-semibold text-zinc-900 outline-none"
                                />
                                <div className="text-xs text-zinc-500">
                                  {room.items.length}{" "}
                                  {lang === "ar" ? "عنصر" : "items"}
                                </div>
                                {room.aro_veneer && room.aro_veneer_price ? (
                                  <div className="text-xs text-zinc-500 mt-1">
                                    {lang === "ar"
                                      ? "قشرة أرو بالغرفة:"
                                      : "Room veneer:"}{" "}
                                    {Number(
                                      room.aro_veneer_price,
                                    ).toLocaleString()}{" "}
                                    جنيه
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-sm font-bold">
                                {quoteRoomSubtotal(room).toLocaleString()} جنيه
                              </div>
                            </div>
                            <div className="space-y-3">
                              {room.items.length === 0 ? (
                                <div className="rounded-3xl bg-white p-4 text-zinc-500">
                                  {lang === "ar"
                                    ? "لا توجد عناصر في هذه الغرفة"
                                    : "No items in this room"}
                                </div>
                              ) : (
                                room.items.map((item, itemIndex) => (
                                  <div
                                    key={`${roomIndex}-${itemIndex}`}
                                    className="rounded-3xl border border-black/10 bg-white p-4"
                                  >
                                    <div className="grid gap-3">
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                        <div className="space-y-2 w-full">
                                          <input
                                            type="text"
                                            value={item.item_name}
                                            onChange={(e) =>
                                              setRoomItemField(
                                                roomIndex,
                                                itemIndex,
                                                "item_name",
                                                e.target.value,
                                              )
                                            }
                                            placeholder={
                                              lang === "ar"
                                                ? "اسم العنصر"
                                                : "Item name"
                                            }
                                            className="w-full rounded-3xl border border-black/10 px-4 py-3 text-sm text-zinc-800"
                                          />
                                          <div className="text-xs text-zinc-500">
                                            {lang === "ar" ? "الإجمالي" : "Total"}: {quoteItemTotal(item).toLocaleString()} جنيه
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeRoomItem(roomIndex, itemIndex)
                                          }
                                          className="inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                        >
                                          <Trash2 className="w-5 h-5" />
                                        </button>
                                      </div>
                                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                                        <div className="rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-zinc-800">
                                          <label className="text-[10px] text-zinc-400 block mb-1">
                                            {lang === "ar" ? "الكمية" : "Qty"}
                                          </label>
                                          <input
                                            type="number"
                                            min={1}
                                            value={item.quantity}
                                            onChange={(e) =>
                                              setRoomItemField(
                                                roomIndex,
                                                itemIndex,
                                                "quantity",
                                                Number(e.target.value) || 1,
                                              )
                                            }
                                            className="w-full bg-transparent outline-none text-right"
                                          />
                                        </div>
                                        <div className="rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-zinc-800">
                                          <label className="text-[10px] text-zinc-400 block mb-1">
                                            {lang === "ar" ? "السعر" : "Price"}
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            value={item.price}
                                            onChange={(e) =>
                                              setRoomItemField(
                                                roomIndex,
                                                itemIndex,
                                                "price",
                                                Number(e.target.value) || 0,
                                              )
                                            }
                                            className="w-full bg-transparent outline-none text-right"
                                          />
                                        </div>
                                      </div>
                                      <textarea
                                        value={item.notes}
                                        onChange={(e) =>
                                          setRoomItemField(
                                            roomIndex,
                                            itemIndex,
                                            "notes",
                                            e.target.value,
                                          )
                                        }
                                        placeholder={
                                          lang === "ar"
                                            ? "ملاحظات (اختياري)"
                                            : "Notes (optional)"
                                        }
                                        rows={2}
                                        className="w-full rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-800 outline-none"
                                      />
                                      <div className="flex flex-wrap gap-2 items-center">
                                        <label className="inline-flex items-center gap-2 rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-700">
                                          <input
                                            type="checkbox"
                                            checked={item.aro_veneer_addon}
                                            onChange={(e) =>
                                              setRoomItemField(
                                                roomIndex,
                                                itemIndex,
                                                "aro_veneer_addon",
                                                e.target.checked,
                                              )
                                            }
                                            className="accent-[#d4a373]"
                                          />
                                          {lang === "ar" ? "قشرة أرو" : "Aro veneer"}
                                        </label>
                                        {item.aro_veneer_addon && (
                                          <div className="rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-zinc-800">
                                            <label className="text-[10px] text-zinc-400 block mb-1">
                                              {lang === "ar"
                                                ? "سعر القشرة"
                                                : "Veneer surcharge"}
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              value={item.aro_surcharge}
                                              onChange={(e) =>
                                                setRoomItemField(
                                                  roomIndex,
                                                  itemIndex,
                                                  "aro_surcharge",
                                                  Number(e.target.value) || 0,
                                                )
                                              }
                                              className="w-full bg-transparent outline-none text-right"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {selectedRecord.pieces && selectedRecord.pieces.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                      {t.pieces}
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedRecord.pieces.map((p: any, i: number) => (
                        <div
                          key={i}
                          className="group bg-white border border-zinc-100 hover:border-accent-tan/30 p-5 rounded-3xl transition-all hover:shadow-md"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                            <div>
                              <span className="font-bold text-zinc-900">
                                {p.name}{" "}
                                {p.quantity > 1 ? (
                                  <span className="text-accent-tan ml-1">
                                    × {p.quantity}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </span>
                              <div className="text-[11px] text-zinc-500">
                                {getRoomLabel(p.room_type || "unassigned")}
                              </div>
                            </div>
                            <span className="font-black text-zinc-900">
                              {(p.price * (p.quantity || 1)).toLocaleString()}{" "}
                              EGP
                            </span>
                          </div>
                          {p.details && (
                            <p className="text-xs text-zinc-500 leading-relaxed italic mt-2 bg-zinc-50 p-3 rounded-xl border-l-2 border-accent-tan/30">
                              {p.details}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section: Notes */}
                <div className="pt-6 border-t border-zinc-100">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 mb-2 block">
                    {t.notes}
                  </label>
                  <div className="bg-zinc-50/50 p-5 rounded-3xl italic text-zinc-600 leading-relaxed">
                    {selectedRecord.notes ||
                      (lang === "ar"
                        ? "لا توجد ملاحظات"
                        : "No notes available")}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 rtl:right-auto rtl:left-8 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-3xl font-light mb-8 pe-12">
                {modalMode === "add" ? t.addCustomer : t.editCustomer}
              </h2>
              <form onSubmit={handleSaveRecord} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                    {t.fullName}
                  </label>
                  <input
                    required
                    className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                    {t.phoneNumber}
                  </label>
                  <div className="space-y-3">
                    {(formData.phones || [""]).map((phone, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          required={index === 0}
                          type="tel"
                          minLength={11}
                          maxLength={11}
                          pattern="[0-9]{11}"
                          title={
                            lang === "ar"
                              ? "يجب أن يكون رقم الهاتف 11 رقماً بالضبط"
                              : "Phone number must be exactly 11 digits"
                          }
                          className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                          value={phone}
                          onChange={(e) => {
                            const phones = [...(formData.phones || [])];
                            phones[index] = normalizePhone(e.target.value);
                            setFormData({ ...formData, phones });
                          }}
                        />
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const phones = (formData.phones || []).filter(
                                (_: any, i: number) => i !== index,
                              );
                              setFormData({
                                ...formData,
                                phones: phones.length > 0 ? phones : [""],
                              });
                            }}
                            className="px-4 rounded-2xl border border-red-200 text-red-500 bg-red-50"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          phones: [...(formData.phones || []), ""],
                        })
                      }
                      className="text-sm font-semibold text-accent-tan hover:underline"
                    >
                      {lang === "ar" ? "إضافة رقم آخر" : "Add another number"}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                    {lang === "ar" ? "المحافظة" : "Governorate"}
                  </label>
                  <select
                    value={formData.governorate || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, governorate: e.target.value })
                    }
                    className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                  >
                    <option value="">
                      {lang === "ar" ? "اختر المحافظة" : "Select governorate"}
                    </option>
                    <option value="القاهرة">القاهرة</option>
                    <option value="الاسكندرية">الاسكندرية</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">
                    {lang === "ar" ? "عنوان المعاينة" : "Inspection Address"}
                  </label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl"
                    value={formData.address || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>
                <button
                  disabled={isLoading}
                  type="submit"
                  className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl btn-3d btn-3d-zinc"
                >
                  {isLoading ? t.processing : t.save}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Catalog Row Modal */}
      <AnimatePresence>
        {isEditCatalogModalOpen && editingCatalogRow && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditCatalogModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white/50">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {lang === "ar" ? "تعديل السجل" : "Edit Row"}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    {lang === "ar"
                      ? "تعديل بيانات السجل المختار في الملف"
                      : "Update the data for the selected record"}
                  </p>
                </div>
                <button
                  onClick={() => setIsEditCatalogModalOpen(false)}
                  className="p-3 bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveCatalogRow}
                className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(editingCatalogRow.data)
                    .filter((k) => !k.startsWith("__EMPTY"))
                    .map((key) => {
                      const isLargeField =
                        key === "نوع الغرفة المطلوب تجديدها وعدد القطع" ||
                        key === "العنوان الاستلام والتسليم";
                      return (
                        <div
                          key={key}
                          className={`space-y-2 ${isLargeField ? "md:col-span-2" : ""}`}
                        >
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                            {key}
                          </label>
                          {isLargeField ? (
                            <textarea
                              rows={3}
                              value={editingCatalogRow.data[key] || ""}
                              onChange={(e) =>
                                setEditingCatalogRow({
                                  ...editingCatalogRow,
                                  data: {
                                    ...editingCatalogRow.data,
                                    [key]: e.target.value,
                                  },
                                })
                              }
                              className="w-full bg-zinc-50 border border-zinc-100 px-5 py-4 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-accent-tan/20 focus:border-accent-tan outline-none transition-all placeholder:text-zinc-300 resize-none"
                            />
                          ) : (
                            <input
                              type="text"
                              value={editingCatalogRow.data[key] || ""}
                              onChange={(e) =>
                                setEditingCatalogRow({
                                  ...editingCatalogRow,
                                  data: {
                                    ...editingCatalogRow.data,
                                    [key]: e.target.value,
                                  },
                                })
                              }
                              className="w-full bg-zinc-50 border border-zinc-100 px-5 py-3.5 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-accent-tan/20 focus:border-accent-tan outline-none transition-all placeholder:text-zinc-300"
                            />
                          )}
                        </div>
                      );
                    })}
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 btn-3d btn-3d-zinc bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isLoading
                      ? t.processing
                      : lang === "ar"
                        ? "حفظ التعديلات"
                        : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditCatalogModalOpen(false)}
                    className="px-8 btn-3d btn-3d-glass bg-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl relative z-10 overflow-hidden text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">
                {confirmModalConfig.title}
              </h2>
              <p className="text-zinc-500 mb-10 leading-relaxed">
                {confirmModalConfig.message}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-zinc-50 transition-all active:scale-95 btn-3d btn-3d-glass"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={() => {
                    confirmModalConfig.onConfirm();
                    setIsConfirmModalOpen(false);
                  }}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-200 btn-3d btn-3d-danger"
                >
                  {lang === "ar" ? "تأكيد" : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
