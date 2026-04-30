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

interface FurniturePiece {
  name: string;
  price: number;
}

interface Inspection {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  visitDate: string;
  notes: string;
  rooms: number;
  pieces: FurniturePiece[];
  totalAmount: number;
  status: 'pending' | 'contracted' | 'refused';
  createdAt: Timestamp;
  // Contracting details
  portfolio?: string;
  deliveryDate?: string;
  contractDate?: string;
}

const ADMIN_EMAIL = "admin@gmail.com";
const VIEWER_EMAIL = "viewer@gmail.com";

const FURNITURE_OPTIONS = [
  "Sofa (كنبة)", "Bed (سرير)", "Wardrobe (دولاب)", "Table (ترابيزة)", 
  "Chair (كرسي)", "Dressing (دريسنج)", "Kitchen (مطبخ)", "Office (مكتب)"
];

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
    inspections: "Inspections",
    contracted: "Contracted Customers",
    notContracted: "Not Contracted",
    addInspection: "New Inspection",
    step1: "Pre-Visit",
    step2: "During Visit",
    step3: "Contracting",
    customerName: "Customer Name",
    address: "Delivery Address",
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
    step1: "قبل المعاينة",
    step2: "أثناء المعاينة",
    step3: "التعاقد",
    customerName: "اسم العميل",
    address: "عنوان الاستلام",
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
    contractImg: "صورة العقد",
    viewOnly: "مشاهد فقط",
    editor: "مسؤول (صلاحية كاملة)",
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
  
  const [adminSubView, setAdminSubView] = useState<'customers' | 'catalogs' | 'inspections' | 'contracted' | 'not-contracted'>('customers');
  const [catalogs, setCatalogs] = useState<CatalogSheet[]>([]);
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [contractedCustomers, setContractedCustomers] = useState<Inspection[]>([]);
  const [notContractedCustomers, setNotContractedCustomers] = useState<Inspection[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [inspectionStep, setInspectionStep] = useState(1);
  const [inspectionFormData, setInspectionFormData] = useState<Partial<Inspection>>({
    customerName: '',
    address: '',
    phone: '',
    visitDate: '',
    notes: '',
    rooms: 0,
    pieces: [],
    totalAmount: 0
  });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  
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

        // Real-time listeners for new collections
        onSnapshot(query(collection(db, 'inspections'), orderBy('createdAt', 'desc')), (snap) => {
          setInspections(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Inspection[]);
        });
        onSnapshot(query(collection(db, 'contracted_customers'), orderBy('finalizedAt', 'desc')), (snap) => {
          setContractedCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Inspection[]);
        });
        onSnapshot(query(collection(db, 'non_contracted_customers'), orderBy('finalizedAt', 'desc')), (snap) => {
          setNotContractedCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Inspection[]);
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
    const viewerEmail = VIEWER_EMAIL;
    const expectedPass = "admin123";
    
    const isMaster = formData.username.toLowerCase() === expectedEmail.toLowerCase();
    const isViewer = formData.username.toLowerCase() === viewerEmail.toLowerCase();

    if ((isMaster || isViewer) && formData.password === expectedPass) {
      try {
        const targetEmail = isMaster ? expectedEmail : viewerEmail;
        try { await signInWithEmailAndPassword(auth, targetEmail, expectedPass); }
        catch (authError: any) {
          if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') await createUserWithEmailAndPassword(auth, targetEmail, expectedPass);
          else throw authError;
        }
        toast.success(lang === 'ar' ? "تم التحقق" : "Verified");
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

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inspectionStep < 3) {
      setInspectionStep(prev => prev + 1);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = {
        ...inspectionFormData,
        createdAt: serverTimestamp()
      };
      
      if (inspectionFormData.id) {
        // Update existing inspection (e.g. finalizing from Step 2/3)
        await updateDoc(doc(db, 'inspections', inspectionFormData.id), data);
      } else {
        // New inspection
        await addDoc(collection(db, 'inspections'), { ...data, status: 'pending' });
      }
      
      toast.success(lang === 'ar' ? "تم حفظ المعاينة" : "Inspection saved");
      setIsInspectionModalOpen(false);
      setInspectionStep(1);
      setInspectionFormData({ customerName: '', address: '', phone: '', visitDate: '', notes: '', rooms: 0, pieces: [], totalAmount: 0 });
    } catch (err: any) { toast.error(err.message); }
    setIsLoading(false);
  };

  const handleFinalizeInspection = async (status: 'contracted' | 'refused') => {
    setIsLoading(true);
    try {
      const collectionName = status === 'contracted' ? 'contracted_customers' : 'non_contracted_customers';
      const data = {
        ...inspectionFormData,
        status,
        finalizedAt: serverTimestamp(),
        createdAt: inspectionFormData.createdAt || serverTimestamp()
      };
      
      await addDoc(collection(db, collectionName), data);
      
      if (inspectionFormData.id) {
        await deleteDoc(doc(db, 'inspections', inspectionFormData.id));
      }
      
      toast.success(lang === 'ar' ? "تمت العملية بنجاح" : "Process completed");
      setIsInspectionModalOpen(false);
      setInspectionStep(1);
      setInspectionFormData({ customerName: '', address: '', phone: '', visitDate: '', notes: '', rooms: 0, pieces: [], totalAmount: 0 });
    } catch (err: any) { 
      toast.error(err.message); 
    }
    setIsLoading(false);
  };

  const handleDeleteContracted = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'contracted_customers', id));
      toast.success(lang === 'ar' ? "تم الحذف" : "Deleted");
    } catch { toast.error("Unauthorized"); }
  };

  const handleDeleteNonContracted = async (id: string) => {
    if (!confirm(lang === 'ar' ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'non_contracted_customers', id));
      toast.success(lang === 'ar' ? "تم الحذف" : "Deleted");
    } catch { toast.error("Unauthorized"); }
  };

  const addPiece = (name: string) => {
    const pieces = [...(inspectionFormData.pieces || []), { name, price: 0 }];
    setInspectionFormData({ ...inspectionFormData, pieces });
  };

  const updatePiecePrice = (index: number, price: number) => {
    const pieces = [...(inspectionFormData.pieces || [])];
    pieces[index].price = price;
    const totalAmount = pieces.reduce((acc, curr) => acc + curr.price, 0);
    setInspectionFormData({ ...inspectionFormData, pieces, totalAmount });
  };

  const removePiece = (index: number) => {
    const pieces = inspectionFormData.pieces?.filter((_, i) => i !== index) || [];
    const totalAmount = pieces.reduce((acc, curr) => acc + curr.price, 0);
    setInspectionFormData({ ...inspectionFormData, pieces, totalAmount });
  };

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
                {currentUser && (currentUser.email === ADMIN_EMAIL || currentUser.email === VIEWER_EMAIL) ? (
                  <>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'customers' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('customers')}>
                      <UserIcon className="w-4 h-4" /> {t.customers}
                    </div>
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer flex items-center gap-3 ${adminSubView === 'inspections' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setAdminSubView('inspections')}>
                      <Eye className="w-4 h-4" /> {t.inspections}
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
                        <span className={`text-[10px] font-bold ${currentUser?.email === ADMIN_EMAIL ? 'bg-zinc-800' : 'bg-accent-sage'} text-white px-2 py-1 rounded inline-block uppercase tracking-wider mb-1`}>
                          {currentUser?.email === ADMIN_EMAIL ? t.editor : t.viewOnly}
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
                        {adminSubView === 'customers' && currentUser?.email === ADMIN_EMAIL && (
                          <button onClick={handleOpenAddModal} className="glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase"><Plus className="w-4 h-4" /> {t.addCustomerBtn}</button>
                        )}
                        {adminSubView === 'inspections' && currentUser?.email === ADMIN_EMAIL && (
                          <button onClick={() => setIsInspectionModalOpen(true)} className="glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase"><Plus className="w-4 h-4" /> {t.addInspection}</button>
                        )}
                        {adminSubView === 'catalogs' && currentUser?.email === ADMIN_EMAIL && (
                          <label className="glass px-6 py-4 rounded-2xl flex items-center gap-3 font-bold text-xs uppercase cursor-pointer"><Upload className="w-4 h-4" /> {t.uploadNew} <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} /></label>
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
                                <button key={s.id} onClick={() => setSelectedSheetId(s.id)} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all ${selectedSheetId === s.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}>{s.title}</button>
                              ))}
                            </div>
                            {selectedSheet && (
                              <div className="glass rounded-3xl overflow-hidden p-6 space-y-4">
                                <div className="flex justify-between items-center"><div className="text-xs text-zinc-500">{format(selectedSheet.createdAt.toDate(), 'yyyy-MM-dd HH:mm')}</div>{currentUser?.email === ADMIN_EMAIL && <button onClick={() => deleteCatalogSection(selectedSheet.id)} className="text-danger flex items-center gap-2 font-bold text-[10px] uppercase"><Trash2 className="w-4 h-4" /> {t.deleteSheet}</button>}</div>
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
                    ) : adminSubView === 'customers' ? (
                      <div className="glass rounded-3xl overflow-hidden p-4 md:p-8">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead><tr className="border-b border-black/5"><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.userName}</th><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.phoneNumber}</th><th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.loginDate}</th>{currentUser?.email === ADMIN_EMAIL && <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px] text-right">{t.actions}</th>}</tr></thead>
                            <tbody className="divide-y divide-black/5">
                              {customerRecords.length > 0 ? customerRecords.map(r => (
                                <tr key={r.id} className="hover:bg-black/5 transition-colors">
                                  <td className="px-4 py-6 font-semibold">{r.name}</td>
                                  <td className="px-4 py-6"><span className="bg-black/5 px-2 py-1 rounded font-mono text-sm">{r.phone}</span></td>
                                  <td className="px-4 py-6 text-sm text-zinc-500 font-mono">{r.createdAt ? format(r.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '...'}</td>
                                  {currentUser?.email === ADMIN_EMAIL && (
                                    <td className="px-4 py-6 text-right flex gap-3 justify-end">
                                      <button onClick={() => handleOpenEditModal(r)} className="text-zinc-600 border border-zinc-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-zinc-800 hover:text-white transition-all"><Edit2 className="w-3 h-3" /> {lang === 'ar' ? 'تعديل' : 'Edit'}</button>
                                      <button onClick={() => handleDeleteCustomer(r.id)} className="text-danger border border-danger/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-danger hover:text-white transition-all">{t.delete}</button>
                                    </td>
                                  )}
                                </tr>
                              )) : <tr><td colSpan={4} className="py-20 text-center italic text-zinc-400">{t.noRecords}</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="glass rounded-3xl overflow-hidden p-4 md:p-8">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-black/5">
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.customerName}</th>
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.phoneNumber}</th>
                                {adminSubView === 'contracted' && <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.deliveryDate}</th>}
                                {adminSubView === 'inspections' && <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px]">{t.visitDate}</th>}
                                <th className="px-4 py-5 font-bold text-zinc-500 uppercase text-[10px] text-right">{t.actions}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {(adminSubView === 'inspections' ? inspections : 
                                adminSubView === 'contracted' ? contractedCustomers : 
                                notContractedCustomers).map(r => (
                                <tr key={r.id} className="hover:bg-black/5 transition-colors">
                                  <td className="px-4 py-6 font-semibold">{r.customerName}</td>
                                  <td className="px-4 py-6"><span className="bg-black/5 px-2 py-1 rounded font-mono text-sm">{r.phone}</span></td>
                                  {adminSubView === 'contracted' && <td className="px-4 py-6 text-sm text-zinc-500">{r.deliveryDate}</td>}
                                  {adminSubView === 'inspections' && <td className="px-4 py-6 text-sm text-zinc-500">{r.visitDate}</td>}
                                  <td className="px-4 py-6 text-right flex gap-3 justify-end">
                                    {adminSubView === 'inspections' && currentUser?.email === ADMIN_EMAIL && (
                                      <button onClick={() => { setInspectionFormData(r); setInspectionStep(2); setIsInspectionModalOpen(true); }} className="text-zinc-600 border border-zinc-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all">{t.step2}</button>
                                    )}
                                    <button onClick={() => { setSelectedRecord(r); setIsDetailModalOpen(true); }} className="text-zinc-400 border border-zinc-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-zinc-800 hover:text-white transition-all"><Eye className="w-3 h-3" /></button>
                                    {currentUser?.email === ADMIN_EMAIL && (
                                      <button onClick={() => {
                                        if (adminSubView === 'contracted') handleDeleteContracted(r.id);
                                        else if (adminSubView === 'not-contracted') handleDeleteNonContracted(r.id);
                                        else if (adminSubView === 'inspections') deleteDoc(doc(db, 'inspections', r.id));
                                      }} className="text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {(adminSubView === 'inspections' ? inspections : adminSubView === 'contracted' ? contractedCustomers : notContractedCustomers).length === 0 && (
                                <tr><td colSpan={5} className="py-20 text-center italic text-zinc-400">{t.noRecords}</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12"><Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" /><h2 className="heading-accent text-4xl md:text-5xl font-light">{t.welcome}</h2><p className="text-zinc-500 text-base md:text-lg mt-3 max-w-2xl mx-auto">{t.enterCreds}</p></div>
                    <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="glass rounded-[2.5rem] p-10 md:p-12 shadow-2xl login-panel">
                      <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleAdminLogin} className="space-y-8">
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">{t.adminUser}</label><input required className="w-full px-6 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                        <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">{t.passphrase}</label><div className="relative"><input required type={showPassword ? "text" : "password"} className="w-full ps-12 pe-5 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">{showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}</button></div></div>
                        <button disabled={isLoading} type="submit" className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-lg">{isLoading ? t.authenticating : t.adminAccess} <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" /></button>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInspectionModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsInspectionModalOpen(false)} className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
              
              <div className="flex gap-4 mb-8">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-2 flex-1 rounded-full ${inspectionStep >= s ? 'bg-zinc-900' : 'bg-zinc-100'}`} />
                ))}
              </div>

              <h2 className="text-3xl font-light mb-8">{inspectionStep === 1 ? t.step1 : inspectionStep === 2 ? t.step2 : t.step3}</h2>

              <form onSubmit={handleInspectionSubmit} className="space-y-6">
                {inspectionStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.customerName}</label><input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.customerName} onChange={e => setInspectionFormData({ ...inspectionFormData, customerName: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.address}</label><input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.address} onChange={e => setInspectionFormData({ ...inspectionFormData, address: e.target.value })} /></div>
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.phoneNumber}</label><input required type="tel" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.phone} onChange={e => setInspectionFormData({ ...inspectionFormData, phone: e.target.value })} /></div>
                      <div className="flex-1 space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.visitDate}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.visitDate} onChange={e => setInspectionFormData({ ...inspectionFormData, visitDate: e.target.value })} /></div>
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
                          <button key={opt} type="button" onClick={() => addPiece(opt)} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-xs font-bold transition-all">{opt}</button>
                        ))}
                      </div>
                      
                      <div className="space-y-3">
                        {inspectionFormData.pieces?.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-4 bg-black/5 p-4 rounded-2xl">
                            <div className="flex-1 font-semibold">{p.name}</div>
                            <div className="w-32"><input required type="number" placeholder={t.price} className="w-full px-3 py-2 bg-white rounded-xl text-sm" value={p.price || ''} onChange={e => updatePiecePrice(idx, parseFloat(e.target.value))} /></div>
                            <button type="button" onClick={() => removePiece(idx)} className="text-danger"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-4 border-t border-black/5 flex justify-between items-center">
                        <span className="font-bold text-lg">{t.total}:</span>
                        <span className="text-2xl font-bold text-accent-tan">{inspectionFormData.totalAmount?.toLocaleString()} EGP</span>
                      </div>
                    </div>
                  </div>
                )}

                {inspectionStep === 3 && (
                  <div className="space-y-6">
                    {!inspectionFormData.status ? (
                      <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setInspectionFormData({ ...inspectionFormData, status: 'contracted' })} className="flex flex-col items-center gap-4 p-8 bg-zinc-900 text-white rounded-[2rem] hover:scale-105 transition-all group">
                          <CheckCircle2 className="w-12 h-12" />
                          <span className="font-bold uppercase tracking-widest">{t.contractedBtn}</span>
                        </button>
                        <button type="button" onClick={() => handleFinalizeInspection('refused')} className="flex flex-col items-center gap-4 p-8 bg-white border-2 border-zinc-100 rounded-[2rem] hover:scale-105 transition-all">
                          <X className="w-12 h-12 text-danger" />
                          <span className="font-bold uppercase tracking-widest text-zinc-400">{t.refusedBtn}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.portfolio} (Google Drive Link)</label>
                          <input required className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" placeholder="https://drive.google.com/..." value={inspectionFormData.portfolio || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, portfolio: e.target.value })} />
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{t.deliveryDate}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.deliveryDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, deliveryDate: e.target.value })} /></div>
                          <div className="flex-1 space-y-1"><label className="text-[10px] font-bold uppercase text-zinc-400 px-1">{lang === 'ar' ? 'تاريخ العقد' : 'Contract Date'}</label><input required type="date" className="w-full px-5 py-4 bg-black/5 border border-black/5 rounded-2xl" value={inspectionFormData.contractDate || ''} onChange={e => setInspectionFormData({ ...inspectionFormData, contractDate: e.target.value })} /></div>
                        </div>
                        <button disabled={isLoading} type="button" onClick={() => handleFinalizeInspection('contracted')} className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3">
                          {t.save}
                        </button>
                        <button type="button" onClick={() => { setInspectionFormData({ ...inspectionFormData, status: undefined }); }} className="w-full text-zinc-400 text-xs font-bold uppercase">{t.cancel}</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  {inspectionStep > 1 && (
                    <button type="button" onClick={() => setInspectionStep(prev => prev - 1)} className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase tracking-widest">{lang === 'ar' ? 'السابق' : 'Back'}</button>
                  )}
                  {inspectionStep < 3 && (
                    <button type="submit" className="flex-1 bg-zinc-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl">{lang === 'ar' ? 'التالي' : 'Next'}</button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailModalOpen && selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDetailModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 md:p-12 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsDetailModalOpen(false)} className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
              
              <h2 className="text-3xl font-light mb-8">{selectedRecord.customerName || selectedRecord.name}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-bold uppercase text-zinc-400">{t.phoneNumber}</label><p className="font-semibold">{selectedRecord.phone}</p></div>
                  <div><label className="text-[10px] font-bold uppercase text-zinc-400">{t.address}</label><p className="font-semibold">{selectedRecord.address || '-'}</p></div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-bold uppercase text-zinc-400">{t.rooms}</label><p className="font-semibold">{selectedRecord.rooms || 0}</p></div>
                  <div><label className="text-[10px] font-bold uppercase text-zinc-400">{t.total}</label><p className="font-bold text-accent-tan">{(selectedRecord.totalAmount || 0).toLocaleString()} EGP</p></div>
                </div>

                {selectedRecord.pieces && selectedRecord.pieces.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-400">{t.pieces}</label>
                    <div className="mt-2 space-y-2">
                      {selectedRecord.pieces.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between bg-black/5 px-4 py-2 rounded-xl text-sm">
                          <span>{p.name}</span>
                          <span className="font-bold">{p.price.toLocaleString()} EGP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecord.portfolio && (
                  <div className="pt-4 border-t border-black/5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">{t.portfolio}</label>
                    <div className="mt-2 flex items-center gap-4 bg-black/5 p-4 rounded-2xl">
                      <FileSpreadsheet className="w-6 h-6 text-zinc-400" />
                      <div className="flex-1 truncate text-sm font-semibold">{selectedRecord.portfolio}</div>
                      <a href={selectedRecord.portfolio} target="_blank" rel="noreferrer" className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2"><Download className="w-4 h-4" /> {lang === 'ar' ? 'تحميل' : 'View'}</a>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-black/5">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">{t.notes}</label>
                  <p className="text-sm text-zinc-600 italic">{selectedRecord.notes || 'No notes'}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
