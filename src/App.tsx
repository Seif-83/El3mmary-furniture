import React, { useState, useEffect } from 'react';
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
  where,
  limit,
  serverTimestamp,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
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
  }
};

const normalizePhone = (p: any) => {
  if (!p) return "";
  const s = String(p);
  return s.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
          .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
          .replace(/\D/g, '');
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const t = translations[lang];
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [adminSubView, setAdminSubView] = useState<'customers' | 'catalogs'>('customers');
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
    let unsubscribeCatalogs: (() => void) | undefined;
    let unsubscribeCustomers: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthChecking(false);
      
      if (user && user.email === ADMIN_EMAIL) {
        const qCatalogs = query(collection(db, 'catalogs'), orderBy('createdAt', 'desc'));
        unsubscribeCatalogs = onSnapshot(qCatalogs, (snapshot) => {
          const sheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CatalogSheet[];
          setCatalogs(sheets);
          if (sheets.length > 0 && !selectedSheetId) setSelectedSheetId(sheets[0].id);
        });

        const qCustomers = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
        unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
          const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CustomerRecord[];
          setCustomerRecords(records);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCatalogs) unsubscribeCatalogs();
      if (unsubscribeCustomers) unsubscribeCustomers();
    };
  }, []);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const docRef = await addDoc(collection(db, 'catalogs'), { title, data, createdAt: serverTimestamp() });
        setSelectedSheetId(docRef.id);
        toast.success(lang === 'ar' ? "تم النشر بنجاح" : "Sheet published successfully");
      } catch (error) { toast.error("Failed to parse Excel file"); }
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const deleteCatalogSection = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد من حذف هذا الملف؟" : "Are you sure you want to delete this sheet?")) return;
    try {
      await deleteDoc(doc(db, 'catalogs', id));
      if (selectedSheetId === id) setSelectedSheetId(null);
      toast.success(lang === 'ar' ? "تم الحذف" : "Sheet deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const expectedEmail = ADMIN_EMAIL;
    const expectedPass = "admin123";
    if (formData.username.toLowerCase() === expectedEmail.toLowerCase() && formData.password === expectedPass) {
      try {
        try { await signInWithEmailAndPassword(auth, expectedEmail, expectedPass); }
        catch (authError: any) {
          if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') await createUserWithEmailAndPassword(auth, expectedEmail, expectedPass);
          else throw authError;
        }
        toast.success(lang === 'ar' ? "تم التحقق" : "Administrator Verified");
        setFormData({ ...formData, username: '', password: '' });
      } catch (error: any) { toast.error(error.message); }
    } else toast.error(lang === 'ar' ? "بيانات غير صالحة" : "Invalid credentials");
    setIsLoading(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد؟" : "Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success(lang === 'ar' ? "تم حذف العميل" : "Customer removed");
    } catch { toast.error("Unauthorized"); }
  };

  const handleLogout = () => { signOut(auth); toast.success("Logged out"); };

  const handleOpenAddModal = () => { setFormData({ ...formData, name: '', phone: '' }); setModalMode('add'); setIsModalOpen(true); };

  const handleOpenEditModal = (record: any) => { setFormData({ ...formData, name: record.name, phone: record.phone }); setEditingId(record.id); setModalMode('edit'); setIsModalOpen(true); };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return toast.error("Please enter data");
    setIsLoading(true);
    try {
      const target = 'customers';
      if (modalMode === 'add') {
        const q = query(collection(db, target), where('phone', '==', formData.phone.trim()), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) { toast.error("Already registered"); setIsLoading(false); return; }
        await addDoc(collection(db, target), { name: formData.name.trim(), phone: formData.phone.trim(), createdAt: serverTimestamp() });
        toast.success("Added success");
      } else {
        await updateDoc(doc(db, target, editingId!), { name: formData.name.trim(), phone: formData.phone.trim() });
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
      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div key="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }} className="min-h-screen flex items-center justify-center p-6 text-center space-y-12 w-full">
            <div className="max-w-2xl w-full">
              <div className="flex justify-center mb-8">
                <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex items-center gap-3 px-6 py-3 rounded-2xl glass hover:bg-white/40 transition-all text-sm font-bold shadow-sm">
                  <Languages className="w-4 h-4 text-accent-tan" /> {lang === 'en' ? 'العربية' : 'English'}
                </button>
              </div>
              <Armchair className="w-20 h-20 text-accent-tan mx-auto mb-8 animate-pulse" />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-zinc-900 mb-4">{t.brand}</h1>
              <p className="text-xl text-zinc-500 font-medium">{t.welcomeDesc}</p>
              <motion.button onClick={() => setShowSplash(false)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mt-12 px-12 py-6 bg-zinc-900 text-white rounded-[2rem] text-xl font-bold uppercase tracking-[0.2em] shadow-2xl">
                {t.start}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col md:flex-row w-full min-h-screen">
            <aside className="w-full md:w-64 glass-dark shrink-0 flex flex-col p-8 gap-8 md:h-screen md:sticky md:top-0 z-50">
              <div className="logo border-b-2 border-accent-tan pb-1 text-xl font-bold tracking-widest uppercase">{t.brand}</div>
              <nav className="flex flex-col gap-4 flex-1">
                {currentUser && currentUser.email === ADMIN_EMAIL ? (
                  <>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'customers' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('customers')}>
                      <UserIcon className="w-4 h-4" /> {t.customers}
                    </div>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'catalogs' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('catalogs')}>
                      <FileSpreadsheet className="w-4 h-4" /> {t.publishedSheets}
                    </div>
                  </>
                ) : null}
                {currentUser && (
                  <button onClick={handleLogout} className="mt-auto flex items-center gap-2 text-sm font-bold uppercase text-danger pt-4">
                    <LogOut className="w-4 h-4" /> {t.signOut}
                  </button>
                )}
              </nav>
            </aside>

            <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
              <AnimatePresence mode="wait">
                {currentUser && currentUser.email === ADMIN_EMAIL ? (
                  <motion.div key={adminSubView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                      <div>
                        <span className="text-[10px] font-bold bg-zinc-800 text-white px-2 py-1 rounded inline-block uppercase tracking-wider mb-1">{t.masterAdmin}</span>
                        <h1 className="text-3xl md:text-4xl font-light">{adminSubView === 'customers' ? t.customers : t.publishedSheets}</h1>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {adminSubView !== 'catalogs' ? (
                          <button onClick={handleOpenAddModal} className="glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase"><Plus className="w-4 h-4" /> {t.addCustomerBtn}</button>
                        ) : (
                          <label className="glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase cursor-pointer"><Upload className="w-4 h-4" /> {t.uploadNew} <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} /></label>
                        )}
                        <div className="glass p-5 rounded-2xl min-w-[140px]">
                          <div className="text-[11px] uppercase font-bold text-zinc-400 mb-1">{adminSubView === 'customers' ? t.totalCustomers : t.publishedSheets}</div>
                          <div className="text-3xl font-semibold">{adminSubView === 'customers' ? customerRecords.length : catalogs.length}</div>
                        </div>
                      </div>
                    </div>

                    {adminSubView === 'catalogs' ? (
                      <div className="space-y-8">
                        {catalogs.length > 0 ? (
                          <>
                            <div className="flex gap-2 p-1 bg-black/5 rounded-2xl overflow-x-auto">
                              {catalogs.map(s => (
                                <button key={s.id} onClick={() => setSelectedSheetId(s.id)} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all ${selectedSheetId === s.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}>{s.title}</button>
                              ))}
                            </div>
                            {selectedSheet && (
                              <div className="glass rounded-3xl overflow-hidden p-6 space-y-4">
                                <div className="flex justify-between items-center"><div className="text-xs text-zinc-500">{format(selectedSheet.createdAt.toDate(), 'yyyy-MM-dd HH:mm')}</div><button onClick={() => deleteCatalogSection(selectedSheet.id)} className="text-danger flex items-center gap-2 font-bold text-[10px] uppercase"><Trash2 className="w-4 h-4" /> {t.deleteSheet}</button></div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm">
                                    <thead><tr className="border-b border-black/5">{selectedSheet.data.length > 0 && Object.keys(selectedSheet.data[0]).map(h => <th key={h} className="px-4 py-4 font-bold text-zinc-500 uppercase text-[10px]">{h}</th>)}</tr></thead>
                                    <tbody className="divide-y divide-black/5">{selectedSheet.data.map((row, i) => <tr key={i} className="hover:bg-black/5 transition-colors">{Object.values(row).map((v: any, j) => <td key={j} className="px-4 py-4 text-zinc-700">{v?.toString()}</td>)}</tr>)}</tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </>
                        ) : <div className="glass rounded-[2rem] p-20 text-center text-zinc-400 italic">{t.noSheets}</div>}
                      </div>
                    ) : (
                      <div className="glass rounded-3xl overflow-hidden p-4 md:p-8">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead><tr className="border-b border-black/5"><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.userName}</th><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.phoneNumber}</th><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.loginDate}</th><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px] text-right">{t.actions}</th></tr></thead>
                            <tbody className="divide-y divide-black/5">
                              {customerRecords.length > 0 ? customerRecords.map(r => (
                                <tr key={r.id} className="hover:bg-black/5 transition-colors">
                                  <td className="px-4 py-6 font-semibold">{r.name}</td>
                                  <td className="px-4 py-6"><span className="bg-black/5 px-2 py-1 rounded font-mono text-sm">{r.phone}</span></td>
                                  <td className="px-4 py-6 text-sm text-zinc-500 font-mono">{r.createdAt ? format(r.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '...'}</td>
                                  <td className="px-4 py-6 text-right flex gap-3 justify-end">
                                    <button onClick={() => handleOpenEditModal(r)} className="text-zinc-600 border border-zinc-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-zinc-800 hover:text-white transition-all"><Edit2 className="w-3 h-3" /> {lang === 'ar' ? 'تعديل' : 'Edit'}</button>
                                    <button onClick={() => handleDeleteCustomer(r.id)} className="text-danger border border-danger/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-danger hover:text-white transition-all">{t.delete}</button>
                                  </td>
                                </tr>
                              )) : <tr><td colSpan={4} className="py-20 text-center italic text-zinc-400">{t.noRecords}</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12"><Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" /><h2 className="text-4xl md:text-5xl font-light">{t.welcome}</h2><p className="text-zinc-500 text-base md:text-lg mt-3 max-w-2xl mx-auto">{t.enterCreds}</p></div>
                    <div className="glass rounded-[2.5rem] p-10 md:p-12 shadow-2xl">
                      <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleAdminLogin} className="space-y-8">
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">{t.adminUser}</label><input required className="w-full px-6 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">{t.passphrase}</label><div className="relative"><input required type={showPassword ? "text" : "password"} className="w-full ps-12 pe-5 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">{showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}</button></div></div>
                        <button disabled={isLoading} type="submit" className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-lg">{isLoading ? t.authenticating : t.adminAccess} <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" /></button>
                      </motion.form>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
              <h2 className="text-3xl font-light mb-8">{modalMode === 'add' ? t.addCustomer : t.editCustomer}</h2>
              <form onSubmit={handleSaveRecord} className="space-y-6">
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.fullName}</label><input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl focus:ring-4 focus:ring-accent-tan/10 transition-all font-semibold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.phoneNumber}</label><input required type="tel" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl font-mono font-semibold" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <button disabled={isLoading} type="submit" className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">{isLoading ? t.processing : t.save}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
