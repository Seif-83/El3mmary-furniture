import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Armchair, 
  Users, 
  LogIn, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  Phone, 
  User as UserIcon,
  ShieldCheck,
  CheckCircle2,
  Table as TableIcon,
  Languages,
  Eye,
  EyeOff,
  Download,
  Plus,
  Edit2,
  X,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  onSnapshot,
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import { format } from 'date-fns';

interface LoginRecord {
  id: string;
  name: string;
  phone: string;
  loginAt: Timestamp;
}

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
}

const ADMIN_EMAIL = "admin@gmail.com";

const translations = {
  en: {
    brand: "Welcome to EL3mmary",
    userDatabase: "User Database",
    signOut: "Sign Out",
    masterAdmin: "Master Administrator",
    userManagement: "User Management",
    totalUsers: "Total Users",
    loginsToday: "Logins Today",
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
    validating: "Validating...",
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
    viewSheet: "View Data",
    logins: "Logins",
    catalog: "Catalog",
    customers: "Customers",
    totalCustomers: "Total Customers",
    addCustomerBtn: "Add Customer",
  },
  ar: {
    brand: "مرحبا بكم في العماري",
    userDatabase: "قاعدة البيانات",
    signOut: "تسجيل الخروج",
    masterAdmin: "المسؤول الرئيسي",
    userManagement: "إدارة المستخدمين",
    totalUsers: "إجمالي المستخدمين",
    loginsToday: "تسجيلات اليوم",
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
    validating: "جاري التحقق...",
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
    viewSheet: "عرض البيانات",
    logins: "تسجيلات الدخول",
    catalog: "الكتالوج",
    customers: "العملاء",
    totalCustomers: "إجمالي العملاء",
    addCustomerBtn: "إضافة عميل",
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const t = translations[lang];
  
  const [activeTab, setActiveTab] = useState<'user' | 'employee'>('user');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginRecords, setLoginRecords] = useState<LoginRecord[]>([]);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [adminSubView, setAdminSubView] = useState<'logins' | 'catalogs' | 'customers'>('logins');
  const [catalogs, setCatalogs] = useState<CatalogSheet[]>([]);
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  
  const selectedSheet = catalogs.find(c => c.id === selectedSheetId);

  const [formData, setFormData] = useState({
    username: '', 
    password: '',
    name: '',
    phone: ''
  });

  useEffect(() => {
    let unsubscribeLogins: (() => void) | undefined;
    let unsubscribeCatalogs: (() => void) | undefined;
    let unsubscribeCustomers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthChecking(false);
      
      if (user && user.email === ADMIN_EMAIL) {
        // Real-time Logins
        const qLogins = query(collection(db, 'logins'), orderBy('loginAt', 'desc'));
        unsubscribeLogins = onSnapshot(qLogins, (snapshot) => {
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as LoginRecord[];
          setLoginRecords(records);
        }, (error) => {
          console.error("Logins snapshot error:", error);
        });

        // Real-time Catalogs
        const qCatalogs = query(collection(db, 'catalogs'), orderBy('createdAt', 'desc'));
        unsubscribeCatalogs = onSnapshot(qCatalogs, (snapshot) => {
          const catalogSheets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CatalogSheet[];
          
          setCatalogs(catalogSheets);
          
          // Auto-select newest sheet if none selected
          if (catalogSheets.length > 0 && !selectedSheetId) {
            setSelectedSheetId(catalogSheets[0].id);
          }
        }, (error) => {
          console.error("Catalogs snapshot error:", error);
        });

        // Real-time Customers
        const qCustomers = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
        unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CustomerRecord[];
          setCustomerRecords(records);
        }, (error) => {
          console.error("Customers snapshot error:", error);
        });
      } else {
        if (unsubscribeLogins) unsubscribeLogins();
        if (unsubscribeCatalogs) unsubscribeCatalogs();
        if (unsubscribeCustomers) unsubscribeCustomers();
        setLoginRecords([]);
        setCatalogs([]);
        setCustomerRecords([]);
        setSelectedSheetId(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeLogins) unsubscribeLogins();
      if (unsubscribeCatalogs) unsubscribeCatalogs();
      if (unsubscribeCustomers) unsubscribeCustomers();
    };
  }, []);

  // Removed fetchRecords and fetchCatalogs as we now use onSnapshot

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          return toast.error("File is empty");
        }

        const title = prompt(lang === 'ar' ? "أدخل اسم الملف:" : "Enter sheet title:", file.name.split('.')[0]);
        if (!title) return;

        setIsLoading(true);
        const docRef = await addDoc(collection(db, 'catalogs'), {
          title,
          data,
          createdAt: serverTimestamp()
        });
        
        // Switch to the new sheet immediately
        setSelectedSheetId(docRef.id);
        
        toast.success(lang === 'ar' ? "تم النشر بنجاح" : "Sheet published successfully");
      } catch (error) {
        console.error("Excel import error:", error);
        toast.error("Failed to parse Excel file");
      }
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const deleteCatalogSection = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد من حذف هذا الملف؟" : "Are you sure you want to delete this sheet?")) return;
    try {
      await deleteDoc(doc(db, 'catalogs', id));
      if (selectedSheetId === id) {
        setSelectedSheetId(null);
      }
      toast.success(lang === 'ar' ? "تم الحذف" : "Sheet deleted");
    } catch (error) {
      toast.error("Failed to delete sheet");
    }
  };

  const handleExportExcel = () => {
    try {
      const data = loginRecords.map(record => ({
        [t.userName]: record.name,
        [t.phoneNumber]: record.phone,
        [t.loginDate]: record.loginAt ? format(record.loginAt.toDate(), 'yyyy-MM-dd HH:mm') : ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Logins");
      XLSX.writeFile(workbook, "El3mmary_User_Logins.xlsx");
      toast.success(lang === 'ar' ? "تم تصدير الملف" : "Excel file exported");
    } catch (error) {
      console.error("Export error:", error);
      toast.error(lang === 'ar' ? "فشل التصدير" : "Export failed");
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const expectedEmail = process.env.ADMIN_EMAIL || ADMIN_EMAIL;
    const expectedPass = process.env.ADMIN_PASSWORD || "admin123";

    if (formData.username.toLowerCase() === expectedEmail.toLowerCase() && formData.password === expectedPass) {
      try {
        try {
          await signInWithEmailAndPassword(auth, expectedEmail, expectedPass);
        } catch (authError: any) {
          if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential' || authError.code === 'auth/invalid-email') {
            await createUserWithEmailAndPassword(auth, expectedEmail, expectedPass);
          } else {
            throw authError;
          }
        }
        toast.success(lang === 'ar' ? "تم التحقق من المسؤول" : "Administrator Verified");
        setFormData({ ...formData, username: '', password: '' });
      } catch (error: any) {
        console.error(error);
        toast.error(error.message);
      }
    } else {
      toast.error(lang === 'ar' ? "بيانات إعتماد غير صالحة" : "Invalid administrator credentials");
    }
    setIsLoading(false);
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      return toast.error(lang === 'ar' ? "يرجى إدخال البيانات" : "Please enter your data");
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return toast.error(t.phoneError);
    }
    
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'logins'), {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        loginAt: serverTimestamp()
      });
      setUserLoggedIn(true);
      setFormData({ ...formData, name: '', phone: '' });
      toast.success(lang === 'ar' ? "تم التسجيل بنجاح" : "Login logged successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
    setIsLoading(false);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد؟" : "Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'logins', id));
      toast.success(lang === 'ar' ? "تم الحذف" : "Record removed");
    } catch (error) {
      toast.error(lang === 'ar' ? "غير مصرح" : "Unauthorized");
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد؟" : "Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success(lang === 'ar' ? "تم حذف العميل" : "Customer removed");
    } catch (error) {
      toast.error(lang === 'ar' ? "غير مصرح" : "Unauthorized");
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setLoginRecords([]);
    setUserLoggedIn(false);
    toast.success(lang === 'ar' ? "تم تسجيل الخروج" : "Logged out");
  };

  const handleOpenAddModal = () => {
    setFormData({ ...formData, name: '', phone: '' });
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: LoginRecord) => {
    setFormData({ ...formData, name: record.name, phone: record.phone });
    setEditingId(record.id);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      return toast.error(lang === 'ar' ? "يرجى إدخال البيانات" : "Please enter your data");
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return toast.error(t.phoneError);
    }

    setIsLoading(true);
    try {
      if (modalMode === 'add') {
        const targetCollection = adminSubView === 'customers' ? 'customers' : 'logins';
        await addDoc(collection(db, targetCollection), {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          [adminSubView === 'customers' ? 'createdAt' : 'loginAt']: serverTimestamp()
        });
        toast.success(lang === 'ar' ? "تمت الإضافة بنجاح" : "Record added successfully");
      } else if (modalMode === 'edit' && editingId) {
        const targetCollection = adminSubView === 'customers' ? 'customers' : 'logins';
        await updateDoc(doc(db, targetCollection, editingId), {
          name: formData.name.trim(),
          phone: formData.phone.trim()
        });
        toast.success(lang === 'ar' ? "تم التعديل بنجاح" : "Record updated successfully");
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
    setIsLoading(false);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#f2eee8] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Armchair className="w-12 h-12 text-[#d4a373]" />
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <motion.div 
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-[#f2eee8] flex items-center justify-center p-6 w-full"
        >
          <div className="max-w-2xl w-full text-center space-y-12">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex justify-center mb-8">
                <button 
                  onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                  className="flex items-center gap-3 px-6 py-3 rounded-2xl glass hover:bg-white/40 transition-all text-sm font-bold shadow-sm"
                >
                  <Languages className="w-4 h-4 text-accent-tan" />
                  {lang === 'en' ? 'العربية' : 'English'}
                </button>
              </div>
              <Armchair className="w-20 h-20 text-accent-tan mx-auto mb-8 animate-pulse" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-zinc-900 mb-4">
                {t.brand}
              </h1>
              <p className="text-xl text-zinc-500 font-medium">
                {t.welcomeDesc}
              </p>
            </motion.div>

            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSplash(false)}
              className="group relative inline-flex items-center justify-center px-12 py-6 bg-zinc-900 text-white rounded-[2rem] text-xl font-bold uppercase tracking-[0.2em] overflow-hidden transition-all shadow-2xl hover:shadow-zinc-900/40"
            >
              <div className="absolute inset-0 bg-accent-tan opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative z-10">{t.start}</span>
              <ChevronRight className={`relative z-10 w-6 h-6 ml-3 transition-transform group-hover:translate-x-2 ${lang === 'ar' ? 'rotate-180 group-hover:-translate-x-2' : ''}`} />
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="app"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className={`min-h-screen text-zinc-800 font-sans selection:bg-[#d4a373] selection:text-white flex flex-col md:flex-row w-full ${lang === 'ar' ? 'font-sans' : ''}`}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
      <Toaster position={lang === 'ar' ? 'bottom-left' : 'bottom-right'} />
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-dark shrink-0 flex flex-col p-8 gap-10 md:h-screen md:sticky md:top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="logo border-b-2 border-accent-tan pb-1 text-xl font-bold tracking-widest uppercase">
            {t.brand}
          </div>
        </div>

        <button 
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-3 px-4 py-3 rounded-xl glass hover:bg-white/40 transition-all text-sm font-bold"
        >
          <Languages className="w-4 h-4 text-accent-tan" />
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
        
        <nav className="flex flex-col gap-4 flex-1">
          {currentUser && currentUser.email === ADMIN_EMAIL ? (
            <>
              <div 
                className={`px-4 py-3 rounded-xl text-sm font-semibold glass transition-all cursor-pointer flex items-center gap-3 ${adminSubView === 'logins' ? 'text-zinc-900 shadow-sm border border-black/5 bg-white' : 'text-zinc-500 opacity-70 hover:opacity-100 hover:bg-white/30'}`} 
                onClick={() => setAdminSubView('logins')}
              >
                <Users className="w-4 h-4" />
                {t.logins}
              </div>
              <div 
                className={`px-4 py-3 rounded-xl text-sm font-semibold glass transition-all cursor-pointer flex items-center gap-3 ${adminSubView === 'customers' ? 'text-zinc-900 shadow-sm border border-black/5 bg-white' : 'text-zinc-500 opacity-70 hover:opacity-100 hover:bg-white/30'}`} 
                onClick={() => setAdminSubView('customers')}
              >
                <UserIcon className="w-4 h-4" />
                {t.customers}
              </div>
              <div 
                className={`px-4 py-3 rounded-xl text-sm font-semibold glass transition-all cursor-pointer flex items-center gap-3 ${adminSubView === 'catalogs' ? 'text-zinc-900 shadow-sm border border-black/5 bg-white' : 'text-zinc-500 opacity-70 hover:opacity-100 hover:bg-white/30'}`} 
                onClick={() => setAdminSubView('catalogs')}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {t.publishedSheets}
              </div>
            </>
          ) : (
            <div className={`px-4 py-3 rounded-xl text-sm font-semibold glass transition-all cursor-pointer ${activeTab === 'user' ? 'text-zinc-900 shadow-sm' : 'text-zinc-500 opacity-70'}`} onClick={() => !currentUser && !userLoggedIn && setActiveTab('user')}>
              {t.userDatabase}
            </div>
          )}
          
          {currentUser && (
            <button 
              onClick={handleLogout}
              className="mt-auto flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-danger hover:opacity-80 transition-opacity pt-4"
            >
              <LogOut className="w-4 h-4" />
              {t.signOut}
            </button>
          )}
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {currentUser && currentUser.email === ADMIN_EMAIL ? (
            <AnimatePresence mode="wait">
              {adminSubView === 'logins' ? (
                <motion.div
                  key="admin-dash-logins"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="header flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <span className="text-[10px] font-bold bg-zinc-800 text-white px-2 py-1 rounded mb-1 inline-block uppercase tracking-wider">{t.masterAdmin}</span>
                      <h1 className="text-3xl md:text-4xl font-light text-zinc-800">{t.userManagement}</h1>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                      <button 
                        onClick={handleOpenAddModal}
                        className="glass px-6 py-4 rounded-2xl flex items-center gap-3 hover:bg-white/40 transition-all font-bold text-xs uppercase tracking-widest text-zinc-800 group"
                      >
                        <Plus className="w-4 h-4 text-accent-tan transition-transform group-hover:rotate-90" />
                        {t.addCustomer}
                      </button>
                      <button 
                        onClick={handleExportExcel}
                        className="glass px-6 py-4 rounded-2xl flex items-center gap-3 hover:bg-white/40 transition-all font-bold text-xs uppercase tracking-widest text-[#d4a373] group"
                      >
                        <Download className="w-4 h-4 group-hover:bounce" />
                        {t.exportExcel}
                      </button>
                      <div className="glass p-5 rounded-2xl min-w-[140px]">
                        <div className="text-[11px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">{t.totalUsers}</div>
                        <div className="text-3xl font-semibold">{loginRecords.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass rounded-3xl overflow-hidden shadow-2xl shadow-black/5 p-4 md:p-8">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-black/5">
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t.userName}</th>
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t.phoneNumber}</th>
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t.loginDate}</th>
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-left' : 'text-right'}`}>{t.actions}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {loginRecords.length > 0 ? loginRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-white/30 transition-colors group">
                              <td className="px-4 py-6">
                                <span className="font-semibold text-zinc-800">{record.name}</span>
                              </td>
                              <td className="px-4 py-6">
                                <span className="font-mono text-sm bg-black/5 px-2 py-1 rounded text-zinc-600">
                                  {record.phone}
                                </span>
                              </td>
                              <td className="px-4 py-6 text-sm text-zinc-500 font-mono">
                                {record.loginAt ? format(record.loginAt.toDate(), lang === 'ar' ? 'yyyy/MM/dd HH:mm' : 'MMM dd, yyyy · HH:mm') : '...'}
                              </td>
                              <td className={`px-4 py-6 ${lang === 'ar' ? 'text-left' : 'text-right'} flex gap-2 justify-end`}>
                                <button 
                                  onClick={() => handleOpenEditModal(record)}
                                  className="text-zinc-600 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white hover:border-zinc-800 transition-all flex items-center gap-2"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  {lang === 'ar' ? 'تعديل' : 'Edit'}
                                </button>
                                <button 
                                  onClick={() => handleDeleteRecord(record.id)}
                                  className="text-danger border border-danger/40 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-danger hover:text-white transition-all"
                                >
                                  {t.delete}
                                </button>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-16 text-center text-zinc-400 italic font-medium">
                                {t.noRecords}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              ) : adminSubView === 'customers' ? (
                <motion.div
                  key="admin-dash-customers"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="header flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <span className="text-[10px] font-bold bg-zinc-800 text-white px-2 py-1 rounded mb-1 inline-block uppercase tracking-wider">{t.masterAdmin}</span>
                      <h1 className="text-3xl md:text-4xl font-light text-zinc-800">{t.customers}</h1>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                      <button 
                        onClick={handleOpenAddModal}
                        className="glass px-6 py-4 rounded-2xl flex items-center gap-3 hover:bg-white/40 transition-all font-bold text-xs uppercase tracking-widest text-zinc-800 group"
                      >
                        <Plus className="w-4 h-4 text-accent-tan transition-transform group-hover:rotate-90" />
                        {t.addCustomerBtn}
                      </button>
                      <div className="glass p-5 rounded-2xl min-w-[140px]">
                        <div className="text-[11px] uppercase font-bold text-zinc-500 mb-1 tracking-wider">{t.totalCustomers}</div>
                        <div className="text-3xl font-semibold">{customerRecords.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass rounded-3xl overflow-hidden shadow-2xl shadow-black/5 p-4 md:p-8">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-black/5">
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t.userName}</th>
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t.phoneNumber}</th>
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{t.loginDate}</th>
                            <th className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-left' : 'text-right'}`}>{t.actions}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {customerRecords.length > 0 ? customerRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-white/30 transition-colors group">
                              <td className="px-4 py-6">
                                <span className="font-semibold text-zinc-800">{record.name}</span>
                              </td>
                              <td className="px-4 py-6">
                                <span className="font-mono text-sm bg-black/5 px-2 py-1 rounded text-zinc-600">
                                  {record.phone}
                                </span>
                              </td>
                              <td className="px-4 py-6 text-sm text-zinc-500 font-mono">
                                {record.createdAt ? format(record.createdAt.toDate(), lang === 'ar' ? 'yyyy/MM/dd HH:mm' : 'MMM dd, yyyy · HH:mm') : '...'}
                              </td>
                              <td className={`px-4 py-6 ${lang === 'ar' ? 'text-left' : 'text-right'} flex gap-2 justify-end`}>
                                <button 
                                  onClick={() => handleOpenEditModal(record)}
                                  className="text-zinc-600 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-zinc-800 hover:text-white hover:border-zinc-800 transition-all flex items-center gap-2"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  {lang === 'ar' ? 'تعديل' : 'Edit'}
                                </button>
                                <button 
                                  onClick={() => handleDeleteCustomer(record.id)}
                                  className="text-danger border border-danger/40 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-danger hover:text-white transition-all"
                                >
                                  {t.delete}
                                </button>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-16 text-center text-zinc-400 italic font-medium">
                                {t.noRecords}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="admin-dash-catalogs"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="header flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <span className="text-[10px] font-bold bg-zinc-800 text-white px-2 py-1 rounded mb-1 inline-block uppercase tracking-wider">{t.catalog}</span>
                      <h1 className="text-3xl md:text-4xl font-light text-zinc-800">{t.publishedSheets}</h1>
                    </div>
                    
                    <div className="flex gap-4">
                      <label 
                        className="glass px-6 py-4 rounded-2xl flex items-center gap-3 hover:bg-white/40 transition-all font-bold text-xs uppercase tracking-widest text-zinc-800 cursor-pointer group"
                      >
                        <Upload className="w-4 h-4 text-accent-tan transition-transform group-hover:-translate-y-1" />
                        {t.uploadNew}
                        <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} />
                      </label>
                    </div>
                  </div>

                  {catalogs.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8">
                      <div className="flex gap-2 p-1 bg-black/5 rounded-2xl w-full max-w-4xl overflow-x-auto whitespace-nowrap scrollbar-hide">
                        {catalogs.map(sheet => (
                          <button
                            key={sheet.id}
                            onClick={() => setSelectedSheetId(sheet.id)}
                            className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${
                              selectedSheetId === sheet.id 
                                ? 'bg-white text-zinc-900 shadow-md border border-black/5' 
                                : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                          >
                            {sheet.title}
                          </button>
                        ))}
                      </div>

                      {selectedSheet && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                             <div className="text-sm text-zinc-500">
                                {t.loginDate}: {selectedSheet.createdAt ? format(selectedSheet.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '...'}
                             </div>
                             <button 
                               onClick={() => deleteCatalogSection(selectedSheet.id)}
                               className="flex items-center gap-2 text-danger text-[11px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity"
                             >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t.deleteSheet}
                             </button>
                          </div>
                          
                          <div className="glass rounded-3xl overflow-hidden shadow-2xl shadow-black/5 p-4 md:p-8">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-black/5">
                                    {selectedSheet.data.length > 0 && Object.keys(selectedSheet.data[0]).map((header) => (
                                      <th key={header} className={`px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5">
                                  {selectedSheet.data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white/30 transition-colors group">
                                      {Object.values(row).map((val: any, vidx) => (
                                        <td key={vidx} className="px-4 py-6 text-sm text-zinc-800">
                                          {val?.toString()}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass rounded-[2.5rem] p-20 text-center space-y-4 flex flex-col items-center">
                      <div className="bg-zinc-100 p-6 rounded-full inline-block">
                        <FileSpreadsheet className="w-12 h-12 text-zinc-300" />
                      </div>
                      <p className="text-zinc-400 italic">{t.noSheets}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          ) : userLoggedIn ? (
            <div className="min-h-[80vh] flex items-center justify-center relative">
               <motion.div
                key="user-success"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-success text-white p-8 md:p-12 rounded-[2rem] shadow-2xl flex items-center gap-8 relative overflow-hidden"
              >
                <div className={`absolute top-0 opacity-10 ${lang === 'ar' ? 'left-0' : 'right-0'} p-8`}>
                   <CheckCircle2 className="w-32 h-32" />
                </div>
                <div className="w-3 h-3 bg-white rounded-full animate-pulse shadow-glow shadow-white/50 shrink-0" />
                <div>
                  <h1 className="text-2xl font-bold">{t.successMsg}</h1>
                  <p className="text-white/80 text-sm mt-1">{t.portalSoon}</p>
                  <button 
                    onClick={() => setUserLoggedIn(false)}
                    className="mt-6 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    {t.return}
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-md mx-auto py-12">
              <div className="text-center mb-12">
                <Armchair className="w-12 h-12 text-accent-tan mx-auto mb-4" />
                <h2 className="text-3xl font-light tracking-tight text-zinc-800">{t.welcome}</h2>
                <p className="text-zinc-500 text-sm mt-2 font-medium">{t.enterCreds}</p>
              </div>

              <div className="glass rounded-[2rem] p-8 shadow-2xl shadow-black/5">
                <div className="flex p-1.5 bg-black/5 rounded-2xl mb-8">
                  <button 
                    onClick={() => setActiveTab('user')}
                    className={`flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                      activeTab === 'user' ? 'bg-white shadow-md text-zinc-900 border border-black/5' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {t.userLogin}
                  </button>
                  <button 
                    onClick={() => setActiveTab('employee')}
                    className={`flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                      activeTab === 'employee' ? 'bg-white shadow-md text-zinc-900 border border-black/5' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {t.adminAccess}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'user' ? (
                    <motion.form
                      key="user-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleUserLogin}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 block px-1">{t.fullName}</label>
                        <input 
                          required
                          type="text"
                          className="w-full px-5 py-4 bg-white/50 border border-black/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent-tan/5 focus:border-accent-tan transition-all"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 block px-1">{t.phoneNumber}</label>
                        <input 
                          required
                          type="tel"
                          className="w-full px-5 py-4 bg-white/50 border border-black/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent-tan/5 focus:border-accent-tan transition-all font-mono"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <button 
                        disabled={isLoading}
                        type="submit"
                        className="w-full bg-accent-tan text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-accent-tan/20 flex items-center justify-center gap-2 group"
                      >
                        {isLoading ? t.processing : t.enterPortal}
                        <ChevronRight className={`w-4 h-4 transition-transform ${lang === 'ar' ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="employee-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleAdminLogin}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 block px-1">{t.adminUser}</label>
                        <input 
                          required
                          type="text"
                          className="w-full px-5 py-4 bg-white/50 border border-black/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent-tan/5 focus:border-accent-tan transition-all"
                          value={formData.username}
                          onChange={(e) => setFormData({...formData, username: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 block px-1">{t.passphrase}</label>
                        <div className="relative">
                          <input 
                            required
                            type={showPassword ? "text" : "password"}
                            className={`w-full py-4 bg-white/50 border border-black/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent-tan/5 focus:border-accent-tan transition-all ${
                              lang === 'ar' ? 'pl-14 pr-5' : 'pr-14 pl-5'
                            }`}
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-600 transition-colors ${
                              lang === 'ar' ? 'left-4' : 'right-4'
                            }`}
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <button 
                        disabled={isLoading}
                        type="submit"
                        className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-black/10"
                      >
                        {isLoading ? t.authenticating : t.adminAccess}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
    )}
    
    {/* User Management Modal */}
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] w-full max-w-lg p-8 md:p-12 shadow-2xl relative overflow-hidden z-10"
          >
            <div className="absolute top-0 right-0 p-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>

            <div className="mb-10 text-center md:text-left">
              <div className="w-12 h-12 bg-accent-tan/10 rounded-2xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                {modalMode === 'add' ? <Plus className="w-6 h-6 text-accent-tan" /> : <Edit2 className="w-6 h-6 text-accent-tan" />}
              </div>
              <h2 className="text-3xl font-light text-zinc-900">
                {modalMode === 'add' ? (adminSubView === 'customers' ? t.addCustomerBtn : t.addCustomer) : t.editCustomer}
              </h2>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 block px-1">{t.fullName}</label>
                <input 
                  required
                  type="text"
                  className="w-full px-5 py-4 bg-white border border-black/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent-tan/5 focus:border-accent-tan transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 block px-1">{t.phoneNumber}</label>
                <input 
                  required
                  type="tel"
                  className="w-full px-5 py-4 bg-white border border-black/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent-tan/5 focus:border-accent-tan transition-all font-mono"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-4">
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-black/10"
                >
                  {isLoading ? t.processing : t.save}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 bg-black/5 text-zinc-600 rounded-2xl font-bold uppercase tracking-widest hover:bg-black/10 transition-all text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </AnimatePresence>
  );
}
