/// <reference types="react" />
import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

interface FakeTimestamp {
  toDate: () => Date;
}
const toTimestamp = (isoString: string | null | undefined): FakeTimestamp => {
  const d = isoString ? new Date(isoString) : new Date();
  return {
    toDate: () => d
  };
};

type Timestamp = FakeTimestamp;
import toast, { Toaster } from 'react-hot-toast';
import { format } from 'date-fns';

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
  // Extra fields saved at Step 1
  address?: string;
  deliveryAddress?: string;
  visitDate?: string;
  visitDateTo?: string;
  notes?: string;
  deliveryDate?: string;
  pickupDate?: string;
  portfolioDate?: string;
}

interface FurniturePiece {
  name: string;
  price: number;
  quantity: number;
  details?: string;
}

interface Inspection {
  id: string;
  customerName: string;
  phone: string;
  address?: string;
  deliveryAddress?: string;
  visitDate: string;
  visitDateTo?: string;
  notes: string;
  rooms: number;
  pieces: FurniturePiece[];
  totalAmount: number;
  status: 'pending' | 'contracted' | 'refused';
  createdAt: Timestamp;
  // Contracting details
  portfolio?: string;
  deliveryDate?: string;
  pickupDate?: string;
  portfolioDate?: string;
  portfolio_date?: string;
  contractDate?: string;
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com") as string;
const VIEWER_EMAIL = (process.env.VIEWER_EMAIL || "view@gmail.com") as string;

const FURNITURE_OPTIONS = [
  "سرير كبير", "دولاب", "كومود", "سراحة", "شفونيرة",
  "سرير أطفال", "دولاب أطفال", "كومود أطفال",
  "ترابيزة سفرة", "كرسي سفرة", "بوفيه", "نيش",
  "مطبخ", "كنبة", "ركنة", "صالون"
];

const translations: Record<'en' | 'ar', Record<string, string>> = {
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
    address: "Pickup Address",
    deliveryAddress: "Delivery Address",
    visitDate: "Visit Date (From)",
    visitDateTo: "Visit Date (To)",
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
    contractImg: "Contract Image",
    viewOnly: "Viewer (Read Only)",
    editor: "Editor (Full Access)",
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
    address: "عنوان الاستلام",
    deliveryAddress: "عنوان التسليم",
    visitDate: "تاريخ المعاينة (من)",
    visitDateTo: "تاريخ المعاينة (إلى)",
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
    pickupDate: "عنوان المعاينة",
    portfolioDate: "تاريخ البورتفوليو",
    contractImg: "صورة العقد",
    viewOnly: "مشاهد فقط",
    editor: "مسؤول (صلاحية كاملة)",
    quantity: "العدد",
  }
};

const normalizePhone = (p: any) => {
  if (!p) return "";
  const s = String(p);
  return s.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
          .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
          .replace(/\D/g, '');
};

const formatCellValue = (v: any) => {
  if (v === null || v === undefined) return "";
  
  // Handle Excel Serial Dates (approx range for 1900-2100)
  if (typeof v === 'number' && v > 30000 && v < 60000) {
    const date = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'numeric', 
        day: 'numeric' 
      });
    }
  }
  
  return String(v);
};

const mapCustomerFromDB = (dbCust: any): CustomerRecord => ({
  id: dbCust.id,
  name: dbCust.name,
  phone: dbCust.phone,
  address: dbCust.address,
  deliveryAddress: dbCust.delivery_address,
  visitDate: dbCust.visit_date,
  visitDateTo: dbCust.visit_date_to,
  notes: dbCust.notes,
  deliveryDate: dbCust.delivery_date,
  pickupDate: dbCust.pickup_date,
  portfolioDate: dbCust.portfolio_date,
  createdAt: toTimestamp(dbCust.created_at)
});

const mapInspectionFromDB = (dbInsp: any): Inspection => ({
  id: dbInsp.id,
  customerName: dbInsp.customer_name,
  phone: dbInsp.phone,
  address: dbInsp.address,
  deliveryAddress: dbInsp.delivery_address,
  visitDate: dbInsp.visit_date,
  visitDateTo: dbInsp.visit_date_to,
  notes: dbInsp.notes,
  rooms: dbInsp.rooms,
  pieces: dbInsp.pieces || [],
  totalAmount: Number(dbInsp.total_amount || 0),
  status: dbInsp.status,
  portfolio: dbInsp.portfolio,
  deliveryDate: dbInsp.delivery_date,
  pickupDate: dbInsp.pickup_date,
  portfolioDate: dbInsp.portfolio_date,
  contractDate: dbInsp.contract_date,
  createdAt: toTimestamp(dbInsp.created_at),
  ...((dbInsp as any).finalized_at ? { finalizedAt: toTimestamp((dbInsp as any).finalized_at) } : {})
} as Inspection);

export default function App() {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const t = translations[lang];
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const allowedEmails = [ADMIN_EMAIL, VIEWER_EMAIL];
  const isAdminUser = currentUser?.email === ADMIN_EMAIL;
  const isAuthorizedUser = currentUser !== null && allowedEmails.includes(currentUser.email ?? '');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<'customers' | 'inspections' | 'contracted_customers' | 'non_contracted_customers' | null>(null);
  
  const [adminSubView, setAdminSubView] = useState<'customers' | 'catalogs' | 'contracted' | 'not-contracted' | 'inspections'>('customers');
  const [catalogs, setCatalogs] = useState<CatalogSheet[]>([]);
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [contractedCustomers, setContractedCustomers] = useState<Inspection[]>([]);
  const [notContractedCustomers, setNotContractedCustomers] = useState<Inspection[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const isInspectionView = adminSubView === 'inspections';
  const isContractedView = adminSubView === 'contracted';
  const activeRecords = isInspectionView ? inspections : isContractedView ? contractedCustomers : notContractedCustomers;
  
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [inspectionStep, setInspectionStep] = useState(1);
  const [inspectionFormData, setInspectionFormData] = useState<Partial<Inspection>>({
    customerName: '',
    address: '',
    deliveryAddress: '',
    phone: '',
    visitDate: '',
    visitDateTo: '',
    notes: '',
    rooms: 0,
    pieces: [],
    totalAmount: 0
  });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ title: '', message: '', onConfirm: () => {} });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalConfig({ title, message, onConfirm });
    setIsConfirmModalOpen(true);
  };
  
  const [isEditCatalogModalOpen, setIsEditCatalogModalOpen] = useState(false);
  const [editingCatalogRow, setEditingCatalogRow] = useState<{sheetId: string, rowIndex: number, data: any} | null>(null);
  const [expandedPieceDetails, setExpandedPieceDetails] = useState<number[]>([]);

  const selectedSheet = catalogs.find((c: CatalogSheet) => c.id === selectedSheetId);

  const [formData, setFormData] = useState({
    username: '', 
    password: '',
    name: '',
    phone: '',
    pickupDate: ''
  });

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
      toast.error(lang === 'ar' ? "هذه العملية متاحة للمسؤول فقط" : "This action is available to the admin only");
      return false;
    }

    return true;
  };

  const refreshAllData = async (preferredSheetId?: string | null) => {
    const { data: catData, error: catError } = await supabase.from('catalogs').select('*').order('created_at', { ascending: false });
    if (catError) throw catError;
    const sheets = (catData || []).map(r => ({ ...r, createdAt: toTimestamp(r.created_at) })) as CatalogSheet[];
    setCatalogs(sheets);
    setSelectedSheetId(prev => {
      const nextSelectedId = preferredSheetId ?? prev;
      if (nextSelectedId && sheets.some(sheet => sheet.id === nextSelectedId)) return nextSelectedId;
      return sheets[0]?.id ?? null;
    });

    const { data: custData, error: custError } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (custError) throw custError;
    setCustomerRecords((custData || []).map(mapCustomerFromDB));

    const { data: inspData, error: inspError } = await supabase.from('inspections').select('*').order('created_at', { ascending: false });
    if (inspError) throw inspError;
    setInspections((inspData || []).map(mapInspectionFromDB));

    const { data: contrData, error: contrError } = await supabase.from('contracted_customers').select('*').order('finalized_at', { ascending: false });
    if (contrError) throw contrError;
    setContractedCustomers((contrData || []).map(mapInspectionFromDB));

    const { data: nonContrData, error: nonContrError } = await supabase.from('non_contracted_customers').select('*').order('finalized_at', { ascending: false });
    if (nonContrError) throw nonContrError;
    setNotContractedCustomers((nonContrData || []).map(mapInspectionFromDB));
  };

  const isLegacyInspectionStatusConstraintError = (error: any) => {
    const raw = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
    return raw.includes('inspections_status_check');
  };

  const insertInspectionRecord = async (inspectionDbData: Record<string, any>) => {
    const { error } = await supabase.from('inspections').insert(inspectionDbData);

    if (!error) return;

    if (isLegacyInspectionStatusConstraintError(error)) {
      const { error: legacyInsertError } = await supabase.from('inspections').insert({
        ...inspectionDbData,
        status: 'scheduled',
      });

      if (!legacyInsertError) return;
      throw legacyInsertError;
    }

    throw error;
  };

  const handleDeleteInspection = async (id: string) => {
    if (!ensureAdminAccess()) return;

    try {
      const { error } = await supabase.from('inspections').delete().eq('id', id);
      if (error) throw error;
      await refreshAllData();
      toast.success(lang === 'ar' ? "تم الحذف" : "Deleted");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  useEffect(() => {
    let channels: any[] = [];

    const unsubscribeChannels = () => {
      channels.forEach(channel => channel.unsubscribe());
      channels = [];
    };

    const subscribeToRealtime = () => {
      unsubscribeChannels();
      const tableNames = ['catalogs', 'customers', 'inspections', 'contracted_customers', 'non_contracted_customers'] as const;

      channels = tableNames.map((tableName) =>
        supabase.channel(`public:${tableName}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
            void refreshAllData();
          })
          .subscribe()
      );
    };

    const syncAuthorizedUser = async (user: User | null) => {
      setCurrentUser(user);
      setIsAuthChecking(false);

      if (user && allowedEmails.includes(user.email ?? '')) {
        try {
          await refreshAllData();
          subscribeToRealtime();
        } catch (error) {
          console.error('Failed to sync dashboard data', error);
          toast.error(lang === 'ar' ? "تعذر تحديث البيانات" : "Failed to refresh data");
        }
      } else {
        unsubscribeChannels();
        clearDashboardData();
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthorizedUser(session?.user ?? null);
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthorizedUser(session?.user ?? null);
    });

    return () => {
      authListener.unsubscribe();
      unsubscribeChannels();
    };
  }, []);

  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    if (!ensureAdminAccess()) {
      e.target.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length === 0) return toast.error("File is empty");
        const title = prompt(lang === 'ar' ? "أدخل اسم الملف:" : "Enter sheet title:", file.name.split('.')[0]);
        if (!title) return;
        setIsLoading(true);
        const { data: newCat, error } = await supabase.from('catalogs').insert({ title, data }).select().single();
        if (error) throw error;
        await refreshAllData(newCat.id);
        toast.success(lang === 'ar' ? "تم النشر بنجاح" : "Sheet published successfully");
      } catch (error) { toast.error("Failed to parse Excel file"); }
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const deleteCatalogSection = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === 'ar' ? "حذف الملف" : "Delete Sheet",
      lang === 'ar' ? "هل أنت متأكد من حذف هذا الملف؟" : "Are you sure you want to delete this sheet?",
      async () => {
        try {
          const { error } = await supabase.from('catalogs').delete().eq('id', id);
          if (error) throw error;
          await refreshAllData();
          toast.success(lang === 'ar' ? "تم الحذف" : "Sheet deleted");
        } catch { toast.error("Failed to delete"); }
      }
    );
  };

  const handleEditCatalogRow = (sheetId: string, rowIndex: number, rowData: any) => {
    setEditingCatalogRow({ sheetId, rowIndex, data: { ...rowData } });
    setIsEditCatalogModalOpen(true);
  };

  const handleSaveCatalogRow = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAdminAccess()) return;
    if (!editingCatalogRow) return;
    
    setIsLoading(true);
    try {
      const sheet = catalogs.find((c: CatalogSheet) => c.id === editingCatalogRow.sheetId);
      if (!sheet) throw new Error("Sheet not found");
      
      const newData = [...sheet.data];
      newData[editingCatalogRow.rowIndex] = editingCatalogRow.data;
      
      const { error } = await supabase.from('catalogs').update({ data: newData }).eq('id', editingCatalogRow.sheetId);
      if (error) throw error;
      await refreshAllData(editingCatalogRow.sheetId);
      toast.success(lang === 'ar' ? "تم تحديث البيانات" : "Data updated");
      setIsEditCatalogModalOpen(false);
      setEditingCatalogRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsLoading(false);
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const targetEmail = formData.username.toLowerCase().trim();
    const targetPassword = formData.password;

    if (!targetEmail || !targetPassword) {
      toast.error(lang === 'ar' ? "الرجاء إدخال البريد الإلكتروني وكلمة المرور" : "Please enter email and password");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword
      });
      if (error) throw error;
      const user = data.session?.user ?? null;
      setCurrentUser(user);
      setIsAuthChecking(false);
      toast.success(lang === 'ar' ? "تم تسجيل الدخول" : "Logged in successfully");
      setFormData({ ...formData, username: '', password: '' });
    } catch (error: any) {
      console.error('Supabase sign-in error:', error);
      const rawMessage = error?.message || error?.msg || error?.error_description || null;
      const message = typeof rawMessage === 'string' && rawMessage.toLowerCase().includes('invalid api key')
        ? (lang === 'ar'
            ? "مفتاح Supabase في Vercel غير صحيح. افتح إعدادات Vercel وأضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY بالقيم الصحيحة من Supabase بدون علامات تنصيص، ثم أعد النشر."
            : "This Vercel deployment has an invalid Supabase key. In Vercel, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the exact values from Supabase without quotes, then redeploy.")
        : rawMessage;
      toast.error(message || (lang === 'ar' ? "بيانات غير صالحة" : "Invalid credentials"));
    }
    setIsLoading(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === 'ar' ? "حذف العميل" : "Remove Customer",
      lang === 'ar' ? "هل أنت متأكد؟" : "Are you sure?",
      async () => {
        try {
          const { error } = await supabase.from('customers').delete().eq('id', id);
          if (error) throw error;
          await refreshAllData();
          toast.success(lang === 'ar' ? "تم حذف العميل" : "Customer removed");
        } catch { toast.error("Unauthorized"); }
      }
    );
  };

  const handleMoveCustomerToNonContracted = async (customer: CustomerRecord) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === 'ar' ? "نقل العميل إلى غير المتعاقدين" : "Move customer to Non-Contracted",
      lang === 'ar' ? "هل تريد نقل هذا العميل إلى قائمة العملاء غير المتعاقدين؟" : "Do you want to move this customer to the non-contracted list?",
      async () => {
        try {
          const { error } = await supabase.from('non_contracted_customers').insert({
            customer_name: customer.name?.trim(),
            address: customer.address?.trim() || null,
            delivery_address: customer.deliveryAddress?.trim() || null,
            phone: customer.phone?.trim(),
            visit_date: customer.visitDate || null,
            visit_date_to: customer.visitDateTo || null,
            notes: customer.notes || null,
            rooms: 0,
            pieces: [],
            total_amount: 0,
            status: 'refused',
            finalized_at: new Date().toISOString()
          });
          if (error) throw error;

          const { error: deleteError } = await supabase.from('customers').delete().eq('id', customer.id);
          if (deleteError) throw deleteError;

          await refreshAllData();
          toast.success(lang === 'ar' ? "تم نقل العميل إلى العملاء غير المتعاقدين" : "Customer moved to non-contracted customers");
        } catch (err: any) {
          console.error(err);
          toast.error(err?.message || (lang === 'ar' ? "فشل النقل" : "Move failed"));
        }
      }
    );
  };

  const handleLogout = async () => { await supabase.auth.signOut(); toast.success("Logged out"); };
  
  const handleExportExcel = (data: any[], fileName: string) => {
    try {
      const exportData = data.map(r => ({
        [t.customerName]: r.customerName || r.name,
        [t.phoneNumber]: r.phone,
        ...(r.address ? { [t.address]: r.address } : {}),
        ...(r.deliveryAddress ? { [t.deliveryAddress]: r.deliveryAddress } : {}),
        ...(r.visitDate ? { [t.visitDate]: r.visitDate } : {}),
        ...(r.deliveryDate ? { [t.deliveryDate]: r.deliveryDate } : {}),
        ...(r.pickupDate ? { [t.pickupDate]: r.pickupDate } : {}),
        ...(r.portfolioDate ? { [t.portfolioDate]: r.portfolioDate } : {}),
        ...(r.notes ? { [t.notes]: r.notes } : {}),
        ...(r.totalAmount ? { [t.total]: r.totalAmount } : {}),
        [t.loginDate]: r.createdAt ? format(r.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      toast.success(lang === 'ar' ? "تم تصدير الملف" : "Excel exported");
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
          const tableName = editingCollection || 'inspections';
          const { error } = await supabase.from(tableName).update({
            customer_name: inspectionFormData.customerName?.trim(),
            address: inspectionFormData.address?.trim(),
            delivery_address: inspectionFormData.deliveryAddress?.trim(),
            phone: inspectionFormData.phone?.trim(),
            visit_date: inspectionFormData.visitDate,
            visit_date_to: inspectionFormData.visitDateTo,
            notes: inspectionFormData.notes,
            rooms: inspectionFormData.rooms || 0,
            pieces: inspectionFormData.pieces || [],
            total_amount: inspectionFormData.totalAmount || 0,
            delivery_date: inspectionFormData.deliveryDate || null,
            pickup_date: inspectionFormData.pickupDate || null,
            portfolio_date: inspectionFormData.portfolio_date || null,
            contract_date: inspectionFormData.contractDate || null,
            portfolio: inspectionFormData.portfolio || null,
          }).eq('id', inspectionFormData.id);
          if (error) throw error;
        } else if (editingId) {
          const { error } = await supabase.from('customers').update({
            name: inspectionFormData.customerName?.trim(),
            phone: inspectionFormData.phone?.trim(),
            address: inspectionFormData.address?.trim(),
            delivery_address: inspectionFormData.deliveryAddress?.trim(),
            visit_date: inspectionFormData.visitDate,
            visit_date_to: inspectionFormData.visitDateTo,
            notes: inspectionFormData.notes,
            pickup_date: inspectionFormData.pickupDate || null,
            portfolio_date: inspectionFormData.portfolio_date || null,
          }).eq('id', editingId);
          if (error) throw error;
        }
        await refreshAllData();
        toast.success(lang === 'ar' ? "تم الحفظ بنجاح" : "Saved successfully");
        setIsInspectionModalOpen(false);
        setInspectionStep(1);
        setEditingId(null);
        setEditingCollection(null);
        setInspectionFormData({ 
          customerName: '', address: '', deliveryAddress: '', phone: '', visitDate: '', visitDateTo: '', 
          notes: '', rooms: 0, pieces: [], totalAmount: 0, deliveryDate: '', pickupDate: '', 
          portfolioDate: '', contractDate: '', portfolio: '' 
        });
      } catch (err: any) { toast.error(err.message); }
      setIsLoading(false);
      return;
    }

    // Step 2+: Move customer to 'inspections' table and remove from 'customers'
    setIsLoading(true);
    try {
      const inspectionDbData = {
        customer_name: inspectionFormData.customerName?.trim(),
        address: inspectionFormData.address?.trim(),
        delivery_address: inspectionFormData.deliveryAddress?.trim(),
        phone: inspectionFormData.phone?.trim(),
        visit_date: inspectionFormData.visitDate,
        visit_date_to: inspectionFormData.visitDateTo,
        notes: inspectionFormData.notes,
        rooms: inspectionFormData.rooms || 0,
        pieces: inspectionFormData.pieces || [],
        total_amount: inspectionFormData.totalAmount || 0,
        portfolio: inspectionFormData.portfolio || null,
        delivery_date: inspectionFormData.deliveryDate || null,
        pickup_date: inspectionFormData.pickupDate || null,
        portfolio_date: inspectionFormData.portfolio_date || null,
        contract_date: inspectionFormData.contractDate || null
      };
      
      if (inspectionFormData.id) {
        // Update existing inspection record
        const { error } = await supabase.from('inspections').update(inspectionDbData).eq('id', inspectionFormData.id);
        if (error) throw error;
      } else {
        // Create new inspection and remove from customers
        await insertInspectionRecord(inspectionDbData);
        if (editingId) {
          try {
            const { error: deleteError } = await supabase.from('customers').delete().eq('id', editingId);
            if (deleteError) throw deleteError;
          } catch (err) { console.error("Failed to remove customer after creating inspection", err); }
        }
      }
      
      await refreshAllData();
      toast.success(lang === 'ar' ? "تم نقل العميل إلى المعاينات" : "Customer moved to Inspections");
      setIsInspectionModalOpen(false);
      setInspectionStep(1);
      setEditingId(null);
      setInspectionFormData({ 
        customerName: '', address: '', deliveryAddress: '', phone: '', visitDate: '', visitDateTo: '', 
        notes: '', rooms: 0, pieces: [], totalAmount: 0, deliveryDate: '', pickupDate: '', 
        portfolioDate: '', contractDate: '', portfolio: '' 
      });
    } catch (err: any) { toast.error(err.message); }
    setIsLoading(false);
  };

  const handleFinalizeInspection = async (status: 'contracted' | 'refused', directRecord?: Inspection) => {
    if (!ensureAdminAccess()) return;

    setIsLoading(true);
    try {
      const recordToSave = directRecord || inspectionFormData;
      const tableName = status === 'contracted' ? 'contracted_customers' : 'non_contracted_customers';
      
      const dbData = {
        customer_name: recordToSave.customerName?.trim(),
        address: recordToSave.address?.trim(),
        delivery_address: recordToSave.deliveryAddress?.trim(),
        phone: recordToSave.phone?.trim(),
        visit_date: recordToSave.visitDate,
        visit_date_to: recordToSave.visitDateTo,
        notes: recordToSave.notes,
        rooms: recordToSave.rooms || 0,
        pieces: recordToSave.pieces || [],
        total_amount: recordToSave.totalAmount || 0,
        status,
        portfolio: recordToSave.portfolio || null,
        delivery_date: recordToSave.deliveryDate || null,
        pickup_date: recordToSave.pickupDate || null,
        portfolio_date: recordToSave.portfolio_date || null,
        contract_date: recordToSave.contractDate || null,
        finalized_at: new Date().toISOString()
      };
      
      const { error: insertError } = await supabase.from(tableName).insert(dbData);
      if (insertError) throw insertError;
      
      // If this was a pending inspection, remove it
      if (recordToSave.id) {
        const { error: deleteError } = await supabase.from('inspections').delete().eq('id', recordToSave.id);
        if (deleteError) throw deleteError;
      }
      
      await refreshAllData();
      toast.success(lang === 'ar' ? "تمت العملية بنجاح" : "Process completed");
      setIsInspectionModalOpen(false);
      setInspectionStep(1);
      setInspectionFormData({ customerName: '', address: '', phone: '', visitDate: '', visitDateTo: '', notes: '', rooms: 0, pieces: [], totalAmount: 0 });
    } catch (err: any) { 
      toast.error(err.message); 
    }
    setIsLoading(false);
  };

  const handleDeleteContracted = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === 'ar' ? "حذف السجل" : "Delete Record",
      lang === 'ar' ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure?",
      async () => {
        try {
          const { error } = await supabase.from('contracted_customers').delete().eq('id', id);
          if (error) throw error;
          await refreshAllData();
          toast.success(lang === 'ar' ? "تم الحذف" : "Deleted");
        } catch { toast.error("Unauthorized"); }
      }
    );
  };

  const handleDeleteNonContracted = async (id: string) => {
    if (!ensureAdminAccess()) return;

    triggerConfirm(
      lang === 'ar' ? "حذف السجل" : "Delete Record",
      lang === 'ar' ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure?",
      async () => {
        try {
          const { error } = await supabase.from('non_contracted_customers').delete().eq('id', id);
          if (error) throw error;
          await refreshAllData();
          toast.success(lang === 'ar' ? "تم الحذف" : "Deleted");
        } catch { toast.error("Unauthorized"); }
      }
    );
  };

  const addPiece = (name: string) => {
    const pieces = [...(inspectionFormData.pieces || [])];
    const existingIndex = pieces.findIndex(p => p.name === name);
    
    if (existingIndex >= 0) {
      pieces[existingIndex].quantity = (pieces[existingIndex].quantity || 1) + 1;
    } else {
      pieces.push({ name, price: 0, quantity: 1 });
    }
    
    const totalAmount = pieces.reduce((sum, p) => sum + (Number(p.price || 0) * Number(p.quantity || 1)), 0);
    setInspectionFormData({ ...inspectionFormData, pieces, totalAmount });
  };

  const updatePiece = (index: number, field: string, value: any) => {
    const pieces = [...(inspectionFormData.pieces || [])];
    pieces[index] = { ...pieces[index], [field]: value };
    const total = pieces.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity || 1)), 0);
    setInspectionFormData({ ...inspectionFormData, pieces, totalAmount: total });
  };

  const updatePiecePrice = (index: number, price: number) => {
    const pieces = [...(inspectionFormData.pieces || [])];
    pieces[index].price = price;
    const totalAmount = pieces.reduce((acc, curr) => acc + curr.price, 0);
    setInspectionFormData({ ...inspectionFormData, pieces, totalAmount });
  };

  const removePiece = (index: number) => {
    const pieces = inspectionFormData.pieces?.filter((_: any, i: number) => i !== index) || [];
    const totalAmount = pieces.reduce((acc: number, curr: FurniturePiece) => acc + curr.price, 0);
    setInspectionFormData({ ...inspectionFormData, pieces, totalAmount });
  };

  const handleOpenAddModal = () => { setFormData({ ...formData, name: '', phone: '', pickupDate: '' }); setModalMode('add'); setEditingCollection(null); setIsModalOpen(true); };

  const handleOpenEditModal = (record: any) => { setFormData({ ...formData, name: record.name, phone: record.phone, pickupDate: record.pickupDate || '' }); setEditingId(record.id); setEditingCollection('customers'); setModalMode('edit'); setIsModalOpen(true); };

  const openEditFinalizedRecord = (record: Inspection, collection: 'contracted_customers' | 'non_contracted_customers') => {
    setInspectionFormData({ ...record });
    setEditingId(record.id);
    setEditingCollection(collection);
    setInspectionStep(1);
    setIsInspectionModalOpen(true);
  };

  const handleSaveRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAdminAccess()) return;
    if (!formData.name.trim() || !formData.phone.trim()) return toast.error("Please enter data");
    setIsLoading(true);
    try {
      if (modalMode === 'add') {
        const { data: existing, error: checkError } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', formData.phone.trim())
          .limit(1);
        
        if (checkError) throw checkError;
        if (existing && existing.length > 0) {
          toast.error("Already registered");
          setIsLoading(false);
          return;
        }
        
        const { error: insertError } = await supabase.from('customers').insert({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          pickup_date: formData.pickupDate || null
        });
        if (insertError) throw insertError;
        await refreshAllData();
        toast.success("Added success");
      } else {
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            pickup_date: formData.pickupDate || null
          })
          .eq('id', editingId!);
        if (updateError) throw updateError;
        await refreshAllData();
        toast.success("Updated success");
      }
      setIsModalOpen(false);
    } catch (error: any) { toast.error(error.message); }
    setIsLoading(false);
  };

  if (isAuthChecking) return (
    <div className="min-h-screen bg-[#f2eee8] flex items-center justify-center">
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
        <Armchair className="w-12 h-12 text-[#d4a373]" />
      </motion.div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#f2eee8] text-zinc-800 font-sans selection:bg-[#d4a373] selection:text-white flex flex-col w-full`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Toaster position="bottom-center" />
      
      {/* Premium Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="bg-blob bg-[#d4a373]/20 top-[-10%] left-[-5%]" style={{ animationDelay: '0s' }} />
        <div className="bg-blob bg-[#a5a58d]/15 bottom-[5%] right-[-5%]" style={{ animationDelay: '-5s' }} />
        <div className="bg-blob bg-white/30 top-[30%] right-[15%]" style={{ animationDelay: '-10s', width: '300px', height: '300px' }} />
      </div>

      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div key="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }} className="min-h-screen flex items-center justify-center p-6 text-center space-y-12 w-full">
            <div className="max-w-2xl w-full">
              <div className="flex justify-center mb-8">
                <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex items-center gap-3 px-6 py-3 rounded-2xl glass btn-3d btn-3d-glass hover:bg-white/40 transition-all text-sm font-bold shadow-sm">
                  <Languages className="w-4 h-4 text-accent-tan" /> {lang === 'en' ? 'العربية' : 'English'}
                </button>
              </div>
              <Armchair className="w-20 h-20 text-accent-tan mx-auto mb-8 animate-pulse" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-zinc-900 mb-4">{t.brand}</h1>
              <p className="text-xl text-zinc-500 font-medium">{t.welcomeDesc}</p>
              <motion.button onClick={() => setShowSplash(false)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mt-12 px-12 py-6 bg-zinc-900 text-white rounded-[2rem] text-xl font-bold uppercase tracking-[0.2em] btn-3d btn-3d-zinc">
                {t.start}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col md:flex-row w-full min-h-screen">
            <aside className="w-full md:w-64 glass-dark shrink-0 flex flex-col p-8 gap-8 md:h-screen md:sticky md:top-0 z-50">
              <div className="logo border-b-2 border-accent-tan pb-1 text-xl font-bold tracking-widest uppercase">{t.brand}</div>
              <nav className="flex flex-col gap-4 flex-1">
                {currentUser && isAuthorizedUser ? (
                  <>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'customers' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('customers')}>
                      <UserIcon className="w-4 h-4" /> {t.customers}
                    </div>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'inspections' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('inspections')}>
                      <ClipboardList className="w-4 h-4" /> {t.inspections}
                    </div>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'contracted' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('contracted')}>
                      <CheckCircle2 className="w-4 h-4" /> {t.contracted}
                    </div>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'not-contracted' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('not-contracted')}>
                      <X className="w-4 h-4" /> {t.notContracted}
                    </div>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'catalogs' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('catalogs')}>
                      <FileSpreadsheet className="w-4 h-4" /> {t.publishedSheets}
                    </div>
                  </>
                ) : null}
                {currentUser && (
                  <button onClick={handleLogout} className="mt-auto flex items-center gap-2 text-xs font-bold uppercase text-danger pt-4 btn-3d btn-3d-glass py-3 px-4 rounded-xl border-danger/20">
                    <LogOut className="w-4 h-4" /> {t.signOut}
                  </button>
                )}
              </nav>
            </aside>

            <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
              <AnimatePresence mode="wait">
                {currentUser && isAuthorizedUser ? (
                  <motion.div key={adminSubView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                      <div>
                        <span className={`text-[10px] font-bold ${isAdminUser ? 'bg-zinc-800' : 'bg-accent-sage'} text-white px-2 py-1 rounded inline-block uppercase tracking-wider mb-1`}>
                          {isAdminUser ? t.editor : t.viewOnly}
                        </span>
                        <h1 className="text-3xl md:text-4xl font-light">
                          {adminSubView === 'customers' ? t.customers : 
                           adminSubView === 'inspections' ? t.inspections :
                           adminSubView === 'contracted' ? t.contracted :
                           adminSubView === 'not-contracted' ? t.notContracted :
                           t.publishedSheets}
                        </h1>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {(adminSubView === 'customers' || adminSubView === 'contracted' || adminSubView === 'not-contracted') && currentUser?.email === ADMIN_EMAIL && (
                          <div className="flex gap-2">
                            <button onClick={handleOpenAddModal} className="btn-3d btn-3d-glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase"><Plus className="w-4 h-4" /> {t.addCustomerBtn}</button>
                            {adminSubView === 'contracted' && (
                              <button 
                                onClick={() => handleExportExcel(contractedCustomers, `العملاء_المتعاقدين_${format(new Date(), 'yyyy-MM-dd')}`)} 
                                className="btn-3d btn-3d-glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase text-accent-tan"
                              >
                                <Download className="w-4 h-4" /> {t.exportExcel}
                              </button>
                            )}
                          </div>
                        )}

                        <div className="relative flex items-center">
                          <div className="relative group">
                            <Search className="absolute top-1/2 -translate-y-1/2 right-4 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-700 transition-colors pointer-events-none z-10" />
                            <input
                              type="text"
                              placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              className="bg-white/70 backdrop-blur-md border border-white/80 shadow-md pr-11 pl-10 py-3.5 rounded-2xl text-sm font-medium outline-none w-56 focus:w-72 focus:shadow-xl focus:border-zinc-300 transition-all duration-300 placeholder:text-zinc-400 text-zinc-800"
                            />
                            {searchQuery && (
                              <button
                                onClick={() => setSearchQuery('')}
                                className="absolute top-1/2 -translate-y-1/2 left-3 w-5 h-5 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-500 transition-all"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {adminSubView === 'catalogs' && currentUser?.email === ADMIN_EMAIL && (
                          <label className="btn-3d btn-3d-glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase cursor-pointer"><Upload className="w-4 h-4" /> {t.uploadNew} <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} /></label>
                        )}
                        <div className="glass p-5 rounded-2xl min-w-[140px]">
                          <div className="text-[11px] uppercase font-bold text-zinc-400 mb-1">
                            {adminSubView === 'customers' ? t.totalCustomers : 
                             adminSubView === 'inspections' ? t.inspections :
                             adminSubView === 'contracted' ? t.contracted :
                             adminSubView === 'not-contracted' ? t.notContracted :
                             t.publishedSheets}
                          </div>
                          <div className="text-3xl font-semibold">
                            {adminSubView === 'customers' ? customerRecords.length : 
                             adminSubView === 'inspections' ? inspections.length :
                             adminSubView === 'contracted' ? contractedCustomers.length :
                             adminSubView === 'not-contracted' ? notContractedCustomers.length :
                             catalogs.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {adminSubView === 'catalogs' ? (
                      <div className="space-y-8">
                        {catalogs.length > 0 ? (
                          <>
                            <div className="flex gap-2 p-1 bg-black/5 rounded-2xl overflow-x-auto">
                              {catalogs.map(s => (
                                <button key={s.id} onClick={() => setSelectedSheetId(s.id)} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all btn-3d ${selectedSheetId === s.id ? 'btn-3d-primary text-white shadow-sm' : 'text-zinc-400 bg-black/5 hover:bg-black/10'}`}>{s.title}</button>
                              ))}
                            </div>
                            {selectedSheet && (() => {
                              const filteredData = selectedSheet.data.filter(row => 
                                !searchQuery || Object.values(row).some(v => 
                                  String(v).toLowerCase().includes(searchQuery.toLowerCase())
                                )
                              );
                              
                              const allKeys = Array.from(new Set(selectedSheet.data.flatMap(row => Object.keys(row))))
                                .filter(h => !h.startsWith('__EMPTY'));

                              return (
                                <div className="glass rounded-[2.5rem] overflow-hidden p-0 border border-white/40 shadow-2xl space-y-0">
                                  <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white/30 backdrop-blur-sm">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 rounded-2xl bg-accent-tan/10 flex items-center justify-center">
                                        <FileSpreadsheet className="w-6 h-6 text-accent-tan" />
                                      </div>
                                      <div>
                                        <h3 className="text-xl font-bold text-zinc-900">{selectedSheet.title}</h3>
                                        <div className="text-xs text-zinc-500 font-mono">{format(selectedSheet.createdAt.toDate(), 'yyyy-MM-dd HH:mm')}</div>
                                      </div>
                                    </div>
                                    {isAdminUser && (
                                      <button 
                                        onClick={() => deleteCatalogSection(selectedSheet.id)} 
                                        className="btn-3d btn-3d-glass px-4 py-2.5 rounded-xl text-danger flex items-center gap-2 font-bold text-[10px] uppercase hover:bg-red-50 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> {t.deleteSheet}
                                      </button>
                                    )}
                                  </div>

                                  {filteredData.length > 0 ? (
                                    <>
                                      <div className="hidden md:block overflow-x-auto max-h-[600px] custom-scrollbar">
                                        <table className="w-full text-right border-collapse">
                                          <thead className="sticky top-0 z-10">
                                            <tr className="bg-zinc-50/80 backdrop-blur-md border-b border-black/5">
                                              {allKeys.map(h => (
                                                <th key={h} className="px-6 py-5 font-bold text-zinc-500 uppercase text-[10px] tracking-widest border-l border-black/5 last:border-l-0 min-w-[200px]">
                                                  {h}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-black/5 bg-white/20">
                                            {filteredData.map((row, i) => {
                                              // Find original index for editing
                                              const originalIndex = selectedSheet.data.indexOf(row);
                                              return (
                                                <tr key={i} className="hover:bg-accent-tan/5 transition-colors group">
                                                  {allKeys.map((k, j) => (
                                                    <td key={j} className="px-6 py-5 text-zinc-700 text-sm font-medium border-l border-black/5 last:border-l-0 group-hover:text-zinc-900">
                                                      {formatCellValue(row[k])}
                                                    </td>
                                                  ))}
                                                  {isAdminUser && (
                                                    <td className="px-4 py-5 text-left sticky left-0 bg-white/50 backdrop-blur-md group-hover:bg-white transition-colors">
                                                      <button 
                                                        onClick={() => handleEditCatalogRow(selectedSheet.id, originalIndex, row)}
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
                                          const originalIndex = selectedSheet.data.indexOf(row);
                                          return (
                                            <div key={i} className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] space-y-4 border border-white/60 shadow-lg relative overflow-hidden group">
                                              <div className="absolute top-0 right-0 w-24 h-24 bg-accent-tan/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-accent-tan/10 transition-colors" />
                                              <div className="flex justify-between items-center relative z-10">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 font-bold">#{i+1}</div>
                                                {isAdminUser && (
                                                  <button 
                                                    onClick={() => handleEditCatalogRow(selectedSheet.id, originalIndex, row)}
                                                    className="p-3 bg-white border border-zinc-100 rounded-2xl text-accent-tan shadow-sm hover:shadow-md transition-all"
                                                  >
                                                    <Edit2 className="w-4 h-4" />
                                                  </button>
                                                )}
                                              </div>
                                              {allKeys.map((key) => (
                                                <div key={key} className="flex flex-col gap-1 relative z-10 border-b border-black/5 pb-3 last:border-0 last:pb-0">
                                                  <span className="font-bold text-zinc-400 text-[9px] uppercase tracking-widest">{key}</span>
                                                  <span className="text-zinc-800 font-bold text-sm">{formatCellValue(row[key])}</span>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="p-20 text-center text-zinc-400 italic">
                                      {lang === 'ar' ? 'لا توجد نتائج تطابق بحثك' : 'No results matching your search'}
                                    </div>
                                  )}
                                  
                                  {selectedSheet.data.length === 0 && (
                                    <div className="p-20 text-center text-zinc-400 italic">
                                      {lang === 'ar' ? 'هذا الملف فارغ' : 'This sheet is empty'}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        ) : <div className="glass rounded-[2rem] p-20 text-center text-zinc-400 italic">{t.noSheets}</div>}
                      </div>
                    ) : adminSubView === 'inspections' ? (
                    <div className="space-y-8">
                      {inspections.filter(ins => !searchQuery || ins.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || ins.phone?.includes(searchQuery)).length > 0 ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {inspections.filter(ins => !searchQuery || ins.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || ins.phone?.includes(searchQuery)).map(ins => (
                              <div id={`inspection-${ins.id}`} key={ins.id} className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] flex flex-col gap-6 border border-white/50 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-tan/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-accent-tan/10 transition-colors" />
                                
                                <div className="flex justify-between items-start relative z-10">
                                  <div>
                                    <h4 className="text-2xl font-bold text-zinc-900 mb-1">{ins.customerName}</h4>
                                    <p className="text-zinc-500 font-mono tracking-wider">{ins.phone}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 bg-zinc-100/80 px-3 py-1.5 rounded-xl text-[10px] font-bold text-zinc-600 uppercase">
                                      <Calendar className="w-3 h-3" />
                                      {ins.visitDate}
                                    </div>
                                    {ins.visitDateTo && (
                                      <div className="text-[10px] font-bold text-zinc-400 mr-2">لـ {ins.visitDateTo}</div>
                                    )}
                                  </div>
                                </div>

                                {isAdminUser && (
                                  <div className="grid grid-cols-2 gap-3 relative z-10">
                                    <button onClick={async () => {
                                      await handleFinalizeInspection('contracted', ins);
                                      setAdminSubView('contracted');
                                    }} className="btn-3d btn-3d-glass flex flex-col items-center justify-center gap-2 bg-white border border-zinc-100 text-zinc-400 p-4 rounded-3xl font-bold uppercase transition-all hover:scale-[1.02] active:scale-95 hover:text-danger hover:border-danger/20">
                                      <CheckCircle2 className="w-5 h-5" />
                                      <span className="text-[11px] tracking-widest">{t.contractedBtn}</span>
                                    </button>
                                    <button onClick={() => handleFinalizeInspection('refused', ins)} className="btn-3d btn-3d-red flex flex-col items-center justify-center gap-2 bg-red-50 text-red-500 p-4 rounded-3xl font-bold uppercase transition-all hover:bg-red-100 active:scale-95 border border-red-100">
                                      <X className="w-5 h-5" />
                                      <span className="text-[11px] tracking-widest">{t.refusedBtn}</span>
                                    </button>
                                  </div>
                                )}

                                <div className="flex justify-between items-center pt-4 border-t border-zinc-100 relative z-10">
                                  <div className="flex gap-2">
                                    <button onClick={() => { setSelectedRecord(ins); setIsDetailModalOpen(true); }} className="p-3 bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-100 hover:text-zinc-600 transition-all"><Eye className="w-5 h-5" /></button>
                                    {isAdminUser && (
                                      <button onClick={() => triggerConfirm(lang === 'ar' ? "حذف" : "Delete", lang === 'ar' ? "حذف؟" : "Delete?", async () => { await handleDeleteInspection(ins.id); })} className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-100 transition-all"><Trash2 className="w-5 h-5" /></button>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tighter">ID: {ins.id.slice(0,8)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : <div className="glass rounded-[2rem] p-20 text-center text-zinc-400 italic">{lang === 'ar' ? 'لا توجد تعاقدات معلقة' : 'No pending contracts'}</div>}
                    </div>
                    ) : adminSubView === 'customers' ? (
                    <div className="space-y-8">
                      <div className="hidden md:block glass rounded-[2.5rem] overflow-hidden p-6 md:p-10 shadow-xl border border-white/40">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-black/5 text-[10px] font-bold uppercase text-zinc-400 tracking-widest">
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.userName}</th>
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.phoneNumber}</th>
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.pickupDate}</th>
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.loginDate}</th>
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.actions}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {customerRecords.filter(r => !searchQuery || r.name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone?.includes(searchQuery)).map((r) => (
                                <tr key={r.id} className="group hover:bg-black/5 transition-colors">
                                  <td className="px-4 py-6 font-bold text-zinc-900 text-center">{r.name}</td>
                                  <td className="px-4 py-6 text-center">
                                    <span className="bg-zinc-100 px-3 py-1.5 rounded-xl font-mono text-xs text-zinc-600 group-hover:bg-white transition-colors ">{r.phone}</span>
                                  </td>
                                  <td className="px-4 py-6 text-sm text-zinc-500 text-center">{r.pickupDate || '-'}</td>
                                  <td className="px-4 py-6 text-sm text-zinc-500 font-mono text-center">{r.createdAt ? format(r.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '...'}</td>
                                  <td className="px-4 py-4">
                                    <div className="flex gap-4 justify-between items-center w-full">
                                      {isAdminUser && (
                                        <>
                                          <button onClick={() => handleOpenEditModal(r)} className="flex items-center gap-2 bg-zinc-800 text-white px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 active:scale-95 transition-all duration-200 shadow-md shadow-zinc-200 hover:shadow-lg">
                                            <Edit2 className="w-4 h-4" />
                                            <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                                          </button>
                                          <button onClick={() => {
                                            // Navigate to inspections view and prefill the inspection form for this customer,
                                            // then open the inspection modal and smoothly scroll to the card.
                                            setAdminSubView('inspections');
                                            // Delay to allow inspections view to render
                                            setTimeout(() => {
                                              setInspectionFormData({
                                                customerName: r.name,
                                                phone: r.phone,
                                                id: undefined,
                                                address: (r as any).address || '',
                                                visitDate: (r as any).visitDate || '',
                                                visitDateTo: (r as any).visitDateTo || '',
                                                notes: (r as any).notes || '',
                                                rooms: 0, pieces: [], totalAmount: 0
                                              });
                                              setEditingId(r.id);
                                              setInspectionStep(1);
                                              setIsInspectionModalOpen(true);
                                              const el = document.getElementById(`inspection-${r.id}`);
                                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 120);
                                          }} className="ml-2 flex items-center gap-2 bg-accent-tan text-white px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-accent-tan/90 active:scale-95 transition-all duration-200 shadow-md">
                                            <Eye className="w-4 h-4" />
                                            <span>{lang === 'ar' ? 'بدء المعاينة' : 'Start Visit'}</span>
                                          </button>
                                        <button onClick={() => handleDeleteCustomer(r.id)} className="btn-3d btn-3d-danger flex items-center gap-2 bg-white-50 text-white-500 border border-white-100 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-white-500 hover:text-white active:scale-95 transition-all duration-200 hover:shadow-lg hover:shadow-white-100">
                                          <Trash2 className="w-4 h-4" />
                                          <span>{t.delete}</span>
                                        </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {customerRecords.length === 0 && <tr><td colSpan={5} className="py-20 text-center italic text-zinc-400">{t.noRecords}</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:hidden">
                        {customerRecords.filter(r => !searchQuery || r.name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone?.includes(searchQuery)).map((r) => (
                          <div key={r.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] flex flex-col gap-4 border border-white/50 shadow-lg relative overflow-hidden group">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xl font-bold text-zinc-900 mb-1">{r.name}</h4>
                                <p className="text-zinc-500 font-mono">{r.phone}</p>
                              </div>
                              <span className="text-[10px] text-zinc-400 font-mono">{r.createdAt ? format(r.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '...'}</span>
                            </div>
                            <div className="flex gap-2 pt-4 border-t border-zinc-100">
                              {isAdminUser && (
                                <>
                                <button onClick={() => {
                                  setInspectionFormData({ 
                                    customerName: r.name, 
                                    phone: r.phone,
                                    id: undefined,
                                    address: (r as any).address || '',
                                    visitDate: (r as any).visitDate || '',
                                    visitDateTo: (r as any).visitDateTo || '',
                                    notes: (r as any).notes || '',
                                    rooms: 0, pieces: [], totalAmount: 0 
                                  });
                                  setEditingId(r.id);
                                  setInspectionStep(1);
                                  setIsInspectionModalOpen(true);
                                }} className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 active:scale-95 transition-all shadow-md">
                                  <Edit2 className="w-4 h-4" />
                                  <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                                </button>
                                <button onClick={() => {
                                  setAdminSubView('inspections');
                                  // Delay to allow inspections view to render
                                  setTimeout(() => {
                                    setInspectionFormData({
                                      customerName: r.name,
                                      phone: r.phone,
                                      id: undefined,
                                      address: (r as any).address || '',
                                      visitDate: (r as any).visitDate || '',
                                      visitDateTo: (r as any).visitDateTo || '',
                                      notes: (r as any).notes || '',
                                      rooms: 0, pieces: [], totalAmount: 0
                                    });
                                    setEditingId(r.id);
                                    setInspectionStep(1);
                                    setIsInspectionModalOpen(true);
                                    const el = document.getElementById(`inspection-${r.id}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 120);
                                }} className="ml-2 flex items-center justify-center gap-2 bg-accent-tan text-white px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-accent-tan/90 active:scale-95 transition-all shadow-md">
                                  <Eye className="w-4 h-4" />
                                  <span>{lang === 'ar' ? 'بدء المعاينة' : 'Start Visit'}</span>
                                </button>
                                <button onClick={() => handleDeleteCustomer(r.id)} className="flex items-center justify-center gap-2 bg-red-50 text-red-500 border border-red-100 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white active:scale-95 transition-all shadow-md">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {customerRecords.length === 0 && <div className="py-20 text-center italic text-zinc-400">{t.noRecords}</div>}
                      </div>
                    </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="hidden md:block glass rounded-3xl overflow-hidden p-4 md:p-8">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-black/5">
                                  <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.customerName}</th>
                                  <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.phoneNumber}</th>
                                  {isContractedView && <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.deliveryDate}</th>}
                                  {isContractedView && <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center">{t.pickupDate}</th>}
                                  <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[18px] text-center w-px whitespace-nowrap">{t.actions}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/5">
                                {activeRecords.filter(r => !searchQuery || r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone?.includes(searchQuery)).map(r => (
                                  <tr key={r.id} className="hover:bg-black/5 transition-colors">
                                    <td className="px-4 py-6 font-semibold text-center">{r.customerName}</td>
                                    <td className="px-4 py-6 text-center"><span className="bg-black/5 px-2 py-1 rounded font-mono text-sm inline-block">{r.phone}</span></td>
                                    {isContractedView && <td className="px-4 py-6 text-sm text-zinc-500 text-center">{r.deliveryDate}</td>}
                                    {isContractedView && <td className="px-4 py-6 text-sm text-zinc-500 text-center">{r.pickupDate || '-'}</td>}
                                    {isInspectionView && <td className="px-4 py-6 text-sm text-zinc-500 text-center">{r.visitDate}</td>}
                                    <td className="px-4 py-6 text-center flex gap-3 justify-center">
                                      {isInspectionView && currentUser?.email === ADMIN_EMAIL && (
                                        <button onClick={() => { setInspectionFormData(r); setInspectionStep(2); setIsInspectionModalOpen(true); }} className="text-zinc-600 border border-zinc-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all">{t.step2}</button>
                                      )}
                                      {currentUser?.email === ADMIN_EMAIL && !isInspectionView && (
                                        <button onClick={() => openEditFinalizedRecord(r, isContractedView ? 'contracted_customers' : 'non_contracted_customers')} className="text-zinc-600 border border-zinc-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all">
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button onClick={() => { setSelectedRecord(r); setIsDetailModalOpen(true); }} className="text-zinc-400 border border-zinc-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all"><Eye className="w-4 h-4" /></button>
                                      {currentUser?.email === ADMIN_EMAIL && (
                                        <button onClick={() => {
                                          if (isContractedView) handleDeleteContracted(r.id);
                                          else if (adminSubView === 'not-contracted') handleDeleteNonContracted(r.id);
                                          else if (isInspectionView) void handleDeleteInspection(r.id);
                                        }} className="text-red-500 border border-red-200 px-5 py-3 rounded-lg text-xs font-bold uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {activeRecords.length === 0 && (
                                  <tr><td colSpan={5} className="py-20 text-center italic text-zinc-400">{t.noRecords}</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:hidden">
                          {activeRecords.filter(r => !searchQuery || r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone?.includes(searchQuery)).map(r => (
                            <div key={r.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] flex flex-col gap-4 border border-white/50 shadow-lg relative overflow-hidden group">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-xl font-bold text-zinc-900 mb-1">{r.customerName}</h4>
                                  <p className="text-zinc-500 font-mono text-sm">{r.phone}</p>
                                </div>
                                <div className="text-right">
                                  {isContractedView && <span className="text-[10px] text-zinc-400 font-mono block mb-1">{t.deliveryDate}</span>}
                                  {isContractedView && <span className="text-xs font-bold text-zinc-600">{r.deliveryDate}</span>}
                                  {isInspectionView && <span className="text-[10px] text-zinc-400 font-mono block mb-1">{t.visitDate}</span>}
                                  {isInspectionView && <span className="text-xs font-bold text-zinc-600">{r.visitDate}</span>}
                                </div>
                              </div>
                              <div className="flex gap-2 pt-4 border-t border-zinc-100 justify-end">
                                {isInspectionView && currentUser?.email === ADMIN_EMAIL && (
                                  <button onClick={() => { setInspectionFormData(r); setInspectionStep(2); setIsInspectionModalOpen(true); }} className="flex-1 flex items-center justify-center text-zinc-600 border border-zinc-200 px-6 py-4 rounded-2xl text-sm font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all shadow-sm">{t.step2}</button>
                                )}
                                {currentUser?.email === ADMIN_EMAIL && !isInspectionView && (
                                  <button onClick={() => openEditFinalizedRecord(r, isContractedView ? 'contracted_customers' : 'non_contracted_customers')} className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 border border-zinc-200 px-6 py-4 rounded-2xl text-sm font-bold uppercase hover:bg-zinc-200 transition-all shadow-sm">
                                    <Edit2 className="w-5 h-5" /> {lang === 'ar' ? 'تعديل' : 'Edit'}
                                  </button>
                                )}
                                <button onClick={() => { setSelectedRecord(r); setIsDetailModalOpen(true); }} className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 px-6 py-4 rounded-2xl text-sm font-bold uppercase hover:bg-zinc-200 transition-all shadow-sm btn-3d btn-3d-glass"><Eye className="w-5 h-5" /> {lang === 'ar' ? 'عرض' : 'View'}</button>
                                {currentUser?.email === ADMIN_EMAIL && (
                                  <button onClick={() => {
                                    if (isContractedView) handleDeleteContracted(r.id);
                                    else if (adminSubView === 'not-contracted') handleDeleteNonContracted(r.id);
                                    else if (isInspectionView) void handleDeleteInspection(r.id);
                                  }} className="flex items-center justify-center gap-2 bg-red-50 text-red-500 border border-red-100 px-6 py-4 rounded-2xl text-sm font-bold uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {activeRecords.length === 0 && (
                            <div className="py-20 text-center italic text-zinc-400">{t.noRecords}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : currentUser && !isAuthorizedUser ? (
                  <motion.div key="unauthorized" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                    <div className="glass rounded-[2.5rem] p-12 shadow-2xl text-center">
                      <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" />
                      <h2 className="heading-accent text-4xl md:text-5xl font-light mb-4">{lang === 'ar' ? 'لا تملك صلاحية الدخول' : 'Access not authorized'}</h2>
                      <p className="text-zinc-500 text-base md:text-lg mb-8">{lang === 'ar' ? 'تم تسجيل الدخول ولكن هذا الحساب غير مصرح له باستخدام لوحة التحكم.' : 'You are signed in, but this account is not authorized to access the admin portal.'}</p>
                      <button onClick={handleLogout} className="bg-zinc-900 text-white py-4 px-8 rounded-3xl font-bold uppercase tracking-widest btn-3d btn-3d-zinc">{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12"><Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" /><h2 className="heading-accent text-4xl md:text-5xl font-light">{t.welcome}</h2><p className="text-zinc-500 text-base md:text-lg mt-3 max-w-2xl mx-auto">{t.enterCreds}</p></div>
                    <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="glass rounded-[2.5rem] p-10 md:p-12 shadow-2xl login-panel">
                      <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleAdminLogin} className="space-y-8">
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">{t.adminUser}</label><input required className="w-full px-6 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">{t.passphrase}</label><div className="relative"><input required type={showPassword ? "text" : "password"} className="w-full ps-12 pe-5 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">{showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}</button></div></div>
                        <button disabled={isLoading} type="submit" className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-lg btn-3d btn-3d-zinc">{isLoading ? t.authenticating : t.adminAccess} <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" /></button>
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
        {isInspectionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsInspectionModalOpen(false); setEditingCollection(null); setEditingId(null); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setIsInspectionModalOpen(false); setEditingCollection(null); setEditingId(null); }} className="absolute top-6 right-6 rtl:right-auto rtl:left-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-90 hover:scale-110 shadow-sm group">
                <X className="w-4 h-4 transition-transform duration-300" />
              </button>
              
              <div className="flex gap-4 mb-8">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-2 flex-1 rounded-full ${inspectionStep >= s ? 'bg-zinc-900' : 'bg-zinc-100'}`} />
                ))}
              </div>

              <h2 className="text-3xl font-light mb-8 pe-12 rtl:pe-0 rtl:ps-12">{inspectionStep === 1 ? t.step1 : inspectionStep === 2 ? t.step2 : t.step3}</h2>

              <form onSubmit={handleInspectionSubmit} className="space-y-6">
                {inspectionStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.customerName}</label><input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.customerName} onChange={e => setInspectionFormData({ ...inspectionFormData, customerName: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.address}</label><input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.address} onChange={e => setInspectionFormData({ ...inspectionFormData, address: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.deliveryAddress}</label><input className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.deliveryAddress || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, deliveryAddress: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.phoneNumber}</label><input required type="tel" minLength={11} maxLength={11} pattern="[0-9]{11}" title={lang === 'ar' ? 'يجب أن يكون رقم الهاتف 11 رقماً بالضبط' : 'Phone number must be exactly 11 digits'} className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.phone} onChange={e => setInspectionFormData({ ...inspectionFormData, phone: e.target.value })} /></div>
                     {(editingCollection === 'contracted_customers' || editingCollection === 'customers') && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.pickupDate}</label><input type="text" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.pickupDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, pickupDate: e.target.value })} /></div>
                         {(editingCollection === 'contracted_customers') && <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.deliveryDate}</label><input type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.deliveryDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, deliveryDate: e.target.value })} /></div>}
                       </div>
                     )}
                     {editingCollection === 'contracted_customers' && <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{lang === 'ar' ? 'تاريخ العقد' : 'Contract Date'}</label><input type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.contractDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, contractDate: e.target.value })} /></div>}
                    {editingCollection === 'contracted_customers' && (
                      <div className="space-y-4">
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.portfolio}</label><input className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" placeholder="https://drive.google.com/..." value={inspectionFormData.portfolio || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, portfolio: e.target.value })} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.portfolioDate}</label><input type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.portfolioDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, portfolioDate: e.target.value })} /></div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.visitDate}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.visitDate} onChange={e => setInspectionFormData({ ...inspectionFormData, visitDate: e.target.value })} /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.visitDateTo}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.visitDateTo || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, visitDateTo: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.notes}</label><textarea className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" rows={3} value={inspectionFormData.notes} onChange={e => setInspectionFormData({ ...inspectionFormData, notes: e.target.value })} /></div>
                  </div>
                )}

                {inspectionStep === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.rooms}</label><input required type="number" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.rooms} onChange={e => setInspectionFormData({ ...inspectionFormData, rooms: parseInt(e.target.value) })} /></div>
                    
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.pieces}</label>
                      <div className="flex flex-wrap gap-2">
                        {FURNITURE_OPTIONS.map(opt => (
                          <button key={opt} type="button" onClick={() => addPiece(opt)} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all btn-3d btn-3d-glass">{opt}</button>
                        ))}
                      </div>
                      
                      <div className="space-y-3">
                        {inspectionFormData.pieces?.map((p, idx) => (
                          <div key={idx} className="flex flex-col gap-2 bg-black/5 p-4 rounded-2xl border border-black/5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                              <div className="flex-1 font-bold text-lg text-zinc-800">{p.name}</div>
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="relative">
                                  <span className="absolute top-1/2 -translate-y-1/2 left-3 text-[10px] font-bold text-zinc-400">العدد</span>
                                  <input required type="number" min="1" className="w-20 pl-10 pr-3 py-3 bg-white border border-black/5 rounded-xl text-sm text-center font-bold shadow-sm" value={p.quantity || 1} onChange={e => updatePiece(idx, 'quantity', Number(e.target.value))} />
                                </div>
                                <div className="relative flex-1 sm:w-32">
                                  <span className="absolute top-1/2 -translate-y-1/2 left-3 text-[10px] font-bold text-zinc-400">EGP</span>
                                  <input required type="number" min="0" placeholder={t.price} className="w-full pl-10 pr-3 py-3 bg-white border border-black/5 rounded-xl text-sm text-center font-bold shadow-sm" value={p.price || ''} onChange={e => updatePiece(idx, 'price', Number(e.target.value))} />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPieceDetails(prev =>
                                    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                  )}
                                  className={`px-3 py-3 rounded-xl text-[10px] font-bold uppercase transition-all btn-3d ${expandedPieceDetails.includes(idx) || p.details ? 'bg-accent-tan/20 text-accent-tan border border-accent-tan/30' : 'bg-white border border-black/5 text-zinc-400 hover:text-zinc-600'}`}
                                >
                                  تفاصيل
                                </button>
                                <button type="button" onClick={() => {
                                  const pieces = inspectionFormData.pieces?.filter((_, i) => i !== idx);
                                  const total = pieces?.reduce((sum, p) => sum + (Number(p.price) * (p.quantity || 1)), 0);
                                  setInspectionFormData({ ...inspectionFormData, pieces, totalAmount: total });
                                  setExpandedPieceDetails(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
                                }} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors shadow-sm btn-3d btn-3d-danger"><Trash2 className="w-5 h-5" /></button>
                              </div>
                            </div>
                            {(expandedPieceDetails.includes(idx) || p.details) && (
                              <textarea
                                placeholder={lang === 'ar' ? 'أضف تفاصيل للمنتج...' : 'Add product details...'}
                                rows={2}
                                value={p.details || ''}
                                onChange={e => updatePiece(idx, 'details', e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-black/5 rounded-xl text-sm text-zinc-700 placeholder:text-zinc-300 outline-none focus:border-accent-tan/40 transition-all resize-none"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-4 border-t border-black/5 flex justify-between items-center">
                        <span className="font-bold text-lg">{t.total}:</span>
                        <span className="text-2xl font-bold text-accent-tan">{(inspectionFormData.totalAmount || 0).toLocaleString()} EGP</span>
                      </div>
                    </div>
                  </div>
                )}

                {inspectionStep === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.portfolio} (Google Drive Link)</label>
                        <input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" placeholder="https://drive.google.com/..." value={inspectionFormData.portfolio || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, portfolio: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.deliveryDate}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.deliveryDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, deliveryDate: e.target.value })} /></div>
                        <div className="flex-1 space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{lang === 'ar' ? 'تاريخ العقد' : 'Contract Date'}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.contractDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, contractDate: e.target.value })} /></div>
                      </div>
                      <button disabled={isLoading} type="button" onClick={() => handleFinalizeInspection('contracted')} className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 btn-3d btn-3d-zinc">
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}

                {inspectionStep < 3 && !editingCollection && (
                  <div className="flex gap-4 pt-4">
                    {inspectionStep === 2 && (
                      <button type="button" onClick={() => setInspectionStep(prev => prev - 1)} className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest btn-3d btn-3d-glass">{lang === 'ar' ? 'السابق' : 'Back'}</button>
                    )}
                    <button type="submit" disabled={isLoading} className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl btn-3d btn-3d-zinc">
                      {isLoading ? t.processing : (inspectionStep === 1 ? (lang === 'ar' ? 'حفظ' : 'Save') : (lang === 'ar' ? 'حفظ' : 'Save'))}
                    </button>
                    {inspectionStep === 1 && (
                      <button type="button" onClick={() => { setInspectionStep(2); }} className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest btn-3d btn-3d-glass">{lang === 'ar' ? 'التالي ←' : 'Next →'}</button>
                    )}
                  </div>
                )}
                {inspectionStep < 3 && editingCollection && (
                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={isLoading} className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl btn-3d btn-3d-zinc">
                      {isLoading ? t.processing : (lang === 'ar' ? 'حفظ' : 'Save')}
                    </button>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDetailModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsDetailModalOpen(false)} className="absolute top-6 right-6 rtl:right-auto rtl:left-6 w-10 h-10 flex items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-90 hover:scale-110 shadow-sm">
                <X className="w-4 h-4 transition-transform duration-300" />
              </button>
              
              <h2 className="text-3xl font-light mb-8 pe-12 rtl:pe-0 rtl:ps-12">{selectedRecord.customerName || selectedRecord.name}</h2>
              
              <div className="space-y-8 pb-8">
                {/* Section: Contact Information */}
                <div className="bg-zinc-50/50 rounded-3xl p-6 border border-zinc-100/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2">
                        <UserIcon className="w-3 h-3" /> {t.userName}
                      </label>
                      <p className="text-lg font-bold text-zinc-900">{selectedRecord.customerName || selectedRecord.name}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2">
                        <Users className="w-3 h-3" /> {t.phoneNumber}
                      </label>
                      <p className="text-lg font-bold text-zinc-900 font-mono tracking-wider">{selectedRecord.phone}</p>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2 mb-2">
                        <Languages className="w-3 h-3" /> {t.address}
                      </label>
                      <p className="text-zinc-700 leading-relaxed font-semibold">{selectedRecord.address || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-2 mb-2">
                        <Languages className="w-3 h-3 text-accent-tan" /> {t.deliveryAddress}
                      </label>
                      <p className="text-zinc-700 leading-relaxed font-semibold">{selectedRecord.deliveryAddress || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Section: Dates & Inspection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-3 block">{t.visitDate}</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-tan/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-accent-tan" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{selectedRecord.visitDate || '-'}</p>
                        {selectedRecord.visitDateTo && <p className="text-[10px] text-zinc-400">إلى {selectedRecord.visitDateTo}</p>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-zinc-100 rounded-3xl p-5 shadow-sm">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-3 block">{t.rooms}</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                        <Armchair className="w-5 h-5 text-zinc-500" />
                      </div>
                      <p className="text-xl font-bold text-zinc-900">{selectedRecord.rooms || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Section: Logistics & Financials */}
                <div className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <div className="relative z-10 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest">{t.deliveryDate}</label>
                        <p className="font-bold text-lg">{selectedRecord.deliveryDate || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest">{t.pickupDate}</label>
                        <p className="font-bold text-lg">{selectedRecord.pickupDate || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-8 items-end">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest">{lang === 'ar' ? 'تاريخ العقد' : 'Contract Date'}</label>
                        <p className="font-bold text-lg">{selectedRecord.contractDate || '-'}</p>
                      </div>
                      <div className="text-right rtl:text-left">
                        <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-widest block mb-1">{t.total}</label>
                        <p className="text-3xl font-black text-accent-tan">{(selectedRecord.totalAmount || 0).toLocaleString()} <span className="text-xs font-bold opacity-60">EGP</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Portfolio */}
                {selectedRecord.portfolio && (
                  <div className="bg-white border-2 border-dashed border-zinc-100 rounded-3xl p-6">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 mb-4 block">{t.portfolio}</label>
                    <div className="flex items-center gap-4 bg-zinc-50 p-4 rounded-2xl">
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        <FileSpreadsheet className="w-6 h-6 text-accent-tan" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate mb-0.5">{selectedRecord.portfolio}</p>
                        <p className="text-[10px] text-zinc-400">{t.portfolioDate}: {selectedRecord.portfolioDate || '-'}</p>
                      </div>
                      <a href={selectedRecord.portfolio} target="_blank" rel="noreferrer" className="bg-zinc-900 text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"><Eye className="w-5 h-5" /></a>
                    </div>
                  </div>
                )}

                {/* Section: Items */}
                {selectedRecord.pieces && selectedRecord.pieces.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.pieces}</label>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedRecord.pieces.map((p: any, i: number) => (
                        <div key={i} className="group bg-white border border-zinc-100 hover:border-accent-tan/30 p-5 rounded-3xl transition-all hover:shadow-md">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-zinc-900">{p.name} {p.quantity > 1 ? <span className="text-accent-tan ml-1">× {p.quantity}</span> : ''}</span>
                            <span className="font-black text-zinc-900">{(p.price * (p.quantity || 1)).toLocaleString()} EGP</span>
                          </div>
                          {p.details && (
                            <p className="text-xs text-zinc-500 leading-relaxed italic mt-2 bg-zinc-50 p-3 rounded-xl border-l-2 border-accent-tan/30">{p.details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section: Notes */}
                <div className="pt-6 border-t border-zinc-100">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 mb-2 block">{t.notes}</label>
                  <div className="bg-zinc-50/50 p-5 rounded-3xl italic text-zinc-600 leading-relaxed">
                    {selectedRecord.notes || (lang === 'ar' ? 'لا توجد ملاحظات' : 'No notes available')}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 rtl:right-auto rtl:left-8 text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
              <h2 className="text-3xl font-light mb-8 pe-12 rtl:pe-0 rtl:ps-12">{modalMode === 'add' ? t.addCustomer : t.editCustomer}</h2>
              <form onSubmit={handleSaveRecord} className="space-y-6">
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.fullName}</label><input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.phoneNumber}</label><input required type="tel" minLength={11} maxLength={11} pattern="[0-9]{11}" title={lang === 'ar' ? 'يجب أن يكون رقم الهاتف 11 رقماً بالضبط' : 'Phone number must be exactly 11 digits'} className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.pickupDate}</label><input type="text" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={formData.pickupDate || ''} onChange={e => setFormData({ ...formData, pickupDate: e.target.value })} /></div>
                <button disabled={isLoading} type="submit" className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl btn-3d btn-3d-zinc">{isLoading ? t.processing : t.save}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Catalog Row Modal */}
      <AnimatePresence>
        {isEditCatalogModalOpen && editingCatalogRow && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditCatalogModalOpen(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white/50">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">{lang === 'ar' ? 'تعديل السجل' : 'Edit Row'}</h2>
                  <p className="text-sm text-zinc-500">{lang === 'ar' ? 'تعديل بيانات السجل المختار في الملف' : 'Update the data for the selected record'}</p>
                </div>
                <button onClick={() => setIsEditCatalogModalOpen(false)} className="p-3 bg-zinc-50 text-zinc-400 rounded-2xl hover:bg-zinc-100 transition-all"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSaveCatalogRow} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.keys(editingCatalogRow.data)
                    .filter(k => !k.startsWith('__EMPTY'))
                    .map(key => {
                      const isLargeField = key === 'نوع الغرفة المطلوب تجديدها وعدد القطع' || key === 'العنوان الاستلام والتسليم';
                      return (
                        <div key={key} className={`space-y-2 ${isLargeField ? 'md:col-span-2' : ''}`}>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{key}</label>
                          {isLargeField ? (
                            <textarea
                              rows={3}
                              value={editingCatalogRow.data[key] || ''}
                              onChange={(e) => setEditingCatalogRow({
                                ...editingCatalogRow,
                                data: { ...editingCatalogRow.data, [key]: e.target.value }
                              })}
                              className="w-full bg-zinc-50 border border-zinc-100 px-5 py-4 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-accent-tan/20 focus:border-accent-tan outline-none transition-all placeholder:text-zinc-300 resize-none"
                            />
                          ) : (
                            <input
                              type="text"
                              value={editingCatalogRow.data[key] || ''}
                              onChange={(e) => setEditingCatalogRow({
                                ...editingCatalogRow,
                                data: { ...editingCatalogRow.data, [key]: e.target.value }
                              })}
                              className="w-full bg-zinc-50 border border-zinc-100 px-5 py-3.5 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-accent-tan/20 focus:border-accent-tan outline-none transition-all placeholder:text-zinc-300"
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button type="submit" disabled={isLoading} className="flex-1 btn-3d btn-3d-zinc bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                    {isLoading ? t.processing : (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                  </button>
                  <button type="button" onClick={() => setIsEditCatalogModalOpen(false)} className="px-8 btn-3d btn-3d-glass bg-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs">
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConfirmModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl relative z-10 overflow-hidden text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">{confirmModalConfig.title}</h2>
              <p className="text-zinc-500 mb-10 leading-relaxed">{confirmModalConfig.message}</p>
              <div className="flex gap-4">
                <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-zinc-50 transition-all active:scale-95 btn-3d btn-3d-glass">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={() => { confirmModalConfig.onConfirm(); setIsConfirmModalOpen(false); }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-200 btn-3d btn-3d-danger">{lang === 'ar' ? 'تأكيد' : 'Confirm'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
