import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Menu, X, Languages, Armchair, Search, Plus, Trash2, Upload, Download, Calendar, CheckCircle2, MessageCircle, ClipboardList } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { User } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from './lib/supabase';
import { format, parseISO } from 'date-fns';

const ROOM_TYPES = [
  { key: 'bedroom', ar: 'غرفة نوم', en: 'Bedroom', defaults: ['سرير', 'كومود', 'دولاب', 'تسريحة', 'شيفونيرة', 'شماعة', 'كرسي/بف'] },
  { key: 'dining', ar: 'سفرة', en: 'Dining room', defaults: ['كرسي', 'سفرة', 'بوفيه', 'نيش'] },
  { key: 'kids', ar: 'أطفال', en: 'Kids room', defaults: ['سرير', 'كومود', 'دولاب', 'تسريحة', 'شيفونيرة', 'شماعة', 'كرسي/بف', 'مكتب'] },
  { key: 'salon', ar: 'صالون', en: 'Salon', defaults: ['كنبة كبيرة', 'كنبة صغيرة', 'كرسي', 'كُوفي تيبل'] },
  { key: 'antrei', ar: 'أنتريه', en: 'Antrei', defaults: ['كنبة كبيرة', 'كنبة صغيرة', 'كرسي', 'كُوفي تيبل'] },
  { key: 'other', ar: 'أخرى', en: 'Other', defaults: ['مكتب', 'مكتبة', 'تي في يونيت'] }
];

const STAGE_ORDER = [
  { key: 'received', ar: 'استلام', en: 'Received' },
  { key: 'carpentry', ar: 'نجارة', en: 'Carpentry' },
  { key: 'finishing', ar: 'تشطيب', en: 'Finishing' },
  { key: 'painting', ar: 'دهان', en: 'Painting' },
  { key: 'upholstery', ar: 'تنجيد', en: 'Upholstery' },
  { key: 'delivery', ar: 'تسليم', en: 'Delivery' }
] as const;

const PAYMENT_MILESTONES = ['عند التعاقد', 'عند انتهاء النجارة واختيار اللون', 'قبل الاستلام بـ 48 ساعة', 'عند استلام الغرفة'];

const GOVERNORATES = ['القاهرة', 'الجيزة', 'الاسكندرية', 'السويس', 'المنصورة', 'الدقهلية', 'الشرقية', 'الغربية', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'أسوان', 'الأقصر'];

const normalizePhone = (value: string) =>
  value
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/\D+/g, '');

const parsePhoneList = (value: string) =>
  value
    .split(/[;,\n]+/)
    .map(item => normalizePhone(item).trim())
    .filter(Boolean);

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'yyyy-MM-dd HH:mm');
  } catch {
    return value;
  }
};

const getGovernorateFromAddress = (address?: string) => {
  if (!address) return '';
  const normalized = address.toLowerCase();
  return GOVERNORATES.find(g => normalized.includes(g.toLowerCase())) || '';
};

type Role = 'admin' | 'viewer';

type Client = {
  id: string;
  name: string;
  phones: string[];
  address?: string;
  governorate?: string;
  created_at: string;
};

type Visit = {
  id: string;
  client_id: string;
  requested_at: string;
  scheduled_at?: string | null;
  status: 'pending' | 'scheduled' | 'completed';
  room_types: string[];
  notes?: string;
  total_amount: number;
  contract_status: 'contracted' | 'not_contracted';
  portfolio_appointment_date?: string | null;
  pickup_date?: string | null;
  pickup_confirmed: boolean;
  delivery_date?: string | null;
  delivery_confirmed: boolean;
  contracted_at?: string | null;
};

type VisitRoom = {
  id: string;
  visit_id: string;
  room_type: string;
  aro_veneer: boolean;
  room_subtotal: number;
};

type VisitRoomItem = {
  id: string;
  room_id: string;
  item_name: string;
  custom_item: boolean;
  quantity: number;
  dimensions?: string;
  price: number;
  notes?: string;
  aro_veneer_addon: boolean;
  aro_surcharge: number;
};

type DocumentRecord = {
  id: string;
  client_id: string;
  visit_id: string;
  type: 'paper_contract' | 'electronic_contract' | 'portfolio_photo';
  label: string;
  file_url: string;
  created_at: string;
};

type Payment = {
  id: string;
  client_id: string;
  visit_id: string;
  amount: number;
  paid_at: string;
  installment?: string;
  note?: string;
};

type ActivityLog = {
  id: string;
  client_id: string;
  visit_id: string;
  type: string;
  message: string;
  success: boolean;
  details?: any;
  created_at: string;
};

const ACTIVITY_LABELS: Record<string, { ar: string; en: string }> = {
  login: { ar: 'تسجيل دخول', en: 'Login' },
  logout: { ar: 'تسجيل خروج', en: 'Logout' },
  delete: { ar: 'حذف', en: 'Delete' },
  delete_sheet: { ar: 'حذف ملف', en: 'Delete Sheet' },
  contract: { ar: 'تعاقد', en: 'Contract' },
  refuse: { ar: 'رفض', en: 'Refuse' },
  create_inspection: { ar: 'معاينة جديدة', en: 'New Inspection' },
  move_to_inspection: { ar: 'نقل لمعاينة', en: 'Move to Inspection' },
  update_inspection: { ar: 'تحديث معاينة', en: 'Update Inspection' },
  update_contract: { ar: 'تحديث تعاقد', en: 'Update Contract' },
  upload_sheet: { ar: 'نشر ملف', en: 'Upload Sheet' },
  edit_sheet: { ar: 'تعديل ملف', en: 'Edit Sheet' },
  status_change: { ar: 'تغيير حالة', en: 'Status Change' },
  whatsapp: { ar: 'رسالة واتساب', en: 'WhatsApp Message' },
};

const getActivityTypeLabel = (type: string | null | undefined, lang: 'en' | 'ar') => {
  if (!type) return lang === 'ar' ? 'نشاط' : 'Activity';
  return ACTIVITY_LABELS[type]?.[lang] || (lang === 'ar' ? 'نشاط غير مصنف' : type.replace(/_/g, ' '));
};

const getArabicActivityMessage = (message: string | null | undefined) => {
  if (!message) return '-';

  return message
    .replace(/^Deleted inspection\s+/i, 'حذف معاينة ')
    .replace(/^Published sheet\s+/i, 'نشر ملف ')
    .replace(/^Deleted sheet\s+/i, 'حذف ملف ')
    .replace(/^Edited sheet\s+/i, 'تعديل ملف ')
    .replace(/^Deleted customer\s+/i, 'حذف عميل ')
    .replace(/^Moved to non-contracted\s+/i, 'نقل إلى غير متعاقدين ')
    .replace(/^Moved non-contracted to contracted\s+/i, 'نقل غير متعاقد للمتعاقدين ')
    .replace(/^Moved\s+(.+)\s+to inspections$/i, 'نقل $1 إلى المعاينات')
    .replace(/^Created inspection for\s+/i, 'إنشاء معاينة لـ ')
    .replace(/^Deleted contracted\s+/i, 'حذف متعاقد ')
    .replace(/^Deleted non-contracted\s+/i, 'حذف غير متعاقد ')
    .replace(/\slogged in$/i, ' سجل دخول')
    .replace(/\slogged out$/i, ' سجل خروج')
    .replace(/\bUnknown\b/g, 'غير معروف')
    .replace(/\bstatus_change\b/g, 'تغيير حالة');
};

type ProductionStage = {
  id: string;
  client_id: string;
  visit_id: string;
  stage: (typeof STAGE_ORDER[number])['key'];
  status: 'not_started' | 'in_progress' | 'done';
  completed_at?: string | null;
};

type RoomDraftItem = {
  id?: string;
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
  items: RoomDraftItem[];
};

type NewAppProps = {
  embedded?: boolean;
  parentUser?: User | null;
  parentIsAdmin?: boolean;
  parentLang?: 'ar' | 'en';
  view?: 'dashboard' | 'leads' | 'visits' | 'contracted' | 'not_contracted' | 'production' | 'payments' | 'activities' | 'settings';
};

const getRoleForUser = async (user: User | null): Promise<Role> => {
  if (!user) return 'viewer';
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_uid', user.id)
    .single();

  if (!error && data?.role) {
    return data.role === 'admin' ? 'admin' : 'viewer';
  }

  const adminEmail = process.env.VITE_ADMIN_EMAIL?.trim();
  if (adminEmail && user.email === adminEmail) return 'admin';
  return 'viewer';
};

const App = ({ embedded = false, parentUser = null, parentIsAdmin = false, parentLang = 'ar', view: initialView }: NewAppProps) => {
  const [lang, setLang] = useState<'ar' | 'en'>(parentLang);
  const [view, setView] = useState<'dashboard' | 'leads' | 'visits' | 'contracted' | 'not_contracted' | 'production' | 'payments' | 'activities' | 'settings'>(initialView ?? 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(parentUser);
  const [role, setRole] = useState<Role>('viewer');
  const [isAuthChecking, setIsAuthChecking] = useState(!embedded);
  const [authTimeoutReached, setAuthTimeoutReached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isAdminUser = embedded ? parentIsAdmin : role === 'admin';

  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [rooms, setRooms] = useState<VisitRoom[]>([]);
  const [items, setItems] = useState<VisitRoomItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({ name: '', phones: '', address: '', governorate: '', requested_at: '', notes: '', room_types: [] as string[] });
  const [quoteDrafts, setQuoteDrafts] = useState<RoomDraft[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [governorateFilter, setGovernorateFilter] = useState('all');
  const [paymentForm, setPaymentForm] = useState({ amount: '', installment: PAYMENT_MILESTONES[0], note: '' });
  const [brokerForm, setBrokerForm] = useState({ apiUrl: '', staffPhones: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const selectedVisit = useMemo(() => visits.find(visit => visit.id === selectedVisitId) ?? null, [visits, selectedVisitId]);
  const selectedClient = useMemo(() => clients.find(client => client.id === selectedVisit?.client_id) ?? null, [clients, selectedVisit]);
  const selectedDocuments = useMemo(() => documents.filter(doc => doc.visit_id === selectedVisitId), [documents, selectedVisitId]);
  const selectedPayments = useMemo(() => payments.filter(payment => payment.visit_id === selectedVisitId), [payments, selectedVisitId]);
  const selectedActivities = useMemo(() => activities.filter(activity => activity.visit_id === selectedVisitId), [activities, selectedVisitId]);
  const selectedStages = useMemo(() => stages.filter(stage => stage.visit_id === selectedVisitId), [stages, selectedVisitId]);
  const canEdit = role === 'admin';

  const statusLabels = {
    pending: lang === 'ar' ? 'معلق' : 'Pending',
    scheduled: lang === 'ar' ? 'مجدول' : 'Scheduled',
    completed: lang === 'ar' ? 'اكتمل' : 'Completed'
  };

  const contractLabels = {
    contracted: lang === 'ar' ? 'متعاقد' : 'Contracted',
    not_contracted: lang === 'ar' ? 'مش متعاقد' : 'Not contracted'
  };

  const stageLabels = STAGE_ORDER.reduce((acc, item) => {
    acc[item.key] = lang === 'ar' ? item.ar : item.en;
    return acc;
  }, {} as Record<string, string>);

  const listCards = useMemo(() => {
    const today = new Date();
    const isToday = (value?: string | null) => {
      if (!value) return false;
      const date = parseISO(value);
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    };

    return {
      pendingLeads: visits.filter(v => v.status === 'pending' && v.contract_status === 'not_contracted').length,
      scheduledToday: visits.filter(v => v.status === 'scheduled' && isToday(v.scheduled_at)).length,
      pickupsToday: visits.filter(v => isToday(v.pickup_date)).length,
      deliveriesToday: visits.filter(v => isToday(v.delivery_date)).length,
      contracted: visits.filter(v => v.contract_status === 'contracted').length,
      notContracted: visits.filter(v => v.contract_status === 'not_contracted').length
    };
  }, [visits]);

  const filteredVisits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = (visit: Visit, client?: Client) => {
      if (!query) return true;
      const name = client?.name || '';
      const phones = client?.phones.join(' ') || '';
      const roomTypes = visit.room_types.join(' ');
      return [name, phones, roomTypes, visit.notes || ''].some(field => field.toLowerCase().includes(query));
    };

    const byVisitType = visits.filter(visit => {
      switch (view) {
        case 'dashboard':
          return true;
        case 'leads':
          return visit.contract_status === 'not_contracted' && visit.status !== 'completed';
        case 'contracted':
          return visit.contract_status === 'contracted';
        case 'not_contracted':
          return visit.contract_status === 'not_contracted';
        case 'production':
          return visit.contract_status === 'contracted';
        case 'payments':
          return visit.contract_status === 'contracted';
        case 'activities':
          return true;
        default:
          return true;
      }
    });

    return byVisitType.filter(visit => {
      if (governorateFilter !== 'all') {
        const client = clients.find(c => c.id === visit.client_id);
        if (client?.governorate !== governorateFilter) return false;
      }
      return matchesSearch(visit, clients.find(c => c.id === visit.client_id));
    });
  }, [visits, view, searchQuery, governorateFilter, clients]);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('app_settings').select('*');
    if (!error && Array.isArray(data)) {
      const map = data.reduce<Record<string,string>>((acc, item: any) => ({ ...acc, [item.key]: item.value }), {});
      setSettings(map);
      setBrokerForm({ apiUrl: map.whatsapp_api_url || '', staffPhones: map.staff_numbers || '' });
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [{ data: clientsData }, { data: visitsData }, { data: roomsData }, { data: itemsData }, { data: docsData }, { data: paymentsData }, { data: activitiesData }, { data: stagesData }] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('visits').select('*').order('requested_at', { ascending: false }),
        supabase.from('visit_rooms').select('*'),
        supabase.from('visit_room_items').select('*'),
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('production_stages').select('*')
      ]);

      setClients((clientsData || []).map((item: any) => ({
        ...item,
        phones: Array.isArray(item.phones) ? item.phones : parsePhoneList(item.phones || ''),
        created_at: item.created_at
      })));

      setVisits((visitsData || []).map((item: any) => ({
        ...item,
        status: item.status,
        room_types: Array.isArray(item.room_types) ? item.room_types : [],
        total_amount: Number(item.total_amount || 0),
        pickup_confirmed: Boolean(item.pickup_confirmed),
        delivery_confirmed: Boolean(item.delivery_confirmed)
      })));

      setRooms((roomsData || []).map((item: any) => ({
        ...item,
        room_subtotal: Number(item.room_subtotal || 0)
      })));

      setItems((itemsData || []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
        aro_surcharge: Number(item.aro_surcharge || 0)
      })));

      setDocuments(docsData || []);
      setPayments((paymentsData || []).map((item: any) => ({
        ...item,
        amount: Number(item.amount || 0)
      })));
      setActivities(activitiesData || []);
      setStages((stagesData || []).map((item: any) => ({
        ...item,
        completed_at: item.completed_at
      })));
      await fetchSettings();
    } catch (error) {
      console.error(error);
      toast.error(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (parentLang) {
      setLang(parentLang);
    }
  }, [parentLang]);

  useEffect(() => {
    if (embedded && initialView) {
      setView(initialView);
    }
  }, [embedded, initialView]);

  useEffect(() => {
    if (embedded) {
      if (parentUser) {
        setCurrentUser(parentUser);
      }
      setIsAuthChecking(false);
      return;
    }

    const init = async () => {
      try {
        console.debug('Supabase client:', typeof supabase !== 'undefined');
        const res = await supabase.auth.getSession();
        console.debug('getSession result', res);
        const session = res?.data?.session ?? null;
        if (session?.user) {
          setCurrentUser(session.user);
          const userRole = await getRoleForUser(session.user);
          setRole(userRole);
        }
        setIsAuthChecking(false);
        if (session?.user) {
          await refreshData();
        }
      } catch (err) {
        console.error('Auth init error', err);
        setIsAuthChecking(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: { user: User | null } | null) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        const userRole = await getRoleForUser(session.user);
        setRole(userRole);
        await refreshData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [embedded, parentUser]);

  useEffect(() => {
    if (!isAuthChecking) return;
    const t = setTimeout(() => {
      console.warn('Auth check timeout reached');
      setAuthTimeoutReached(true);
      setIsAuthChecking(false);
    }, 4000);
    return () => clearTimeout(t);
  }, [isAuthChecking]);

  useEffect(() => {
    if (!selectedVisit) {
      setQuoteDrafts([]);
      return;
    }

    const visitRooms = rooms.filter(room => room.visit_id === selectedVisit.id).map(room => ({
      id: room.id,
      room_type: room.room_type,
      aro_veneer: room.aro_veneer,
      items: items
        .filter(item => item.room_id === room.id)
        .map(item => ({
          id: item.id,
          item_name: item.item_name,
          custom_item: item.custom_item,
          quantity: item.quantity,
          dimensions: item.dimensions || '',
          price: item.price,
          notes: item.notes || '',
          aro_veneer_addon: item.aro_veneer_addon,
          aro_surcharge: item.aro_surcharge
        }))
    }));

    if (visitRooms.length > 0) {
      setQuoteDrafts(visitRooms);
      return;
    }

    const defaultRooms = selectedVisit.room_types.map(type => ({
      room_type: type,
      aro_veneer: false,
      items: [] as RoomDraftItem[]
    }));
    setQuoteDrafts(defaultRooms);
  }, [selectedVisit, rooms, items]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email.trim(),
        password: loginForm.password
      });
      if (error) throw error;
      if (data.session?.user) {
        const userRole = await getRoleForUser(data.session.user);
        setCurrentUser(data.session.user);
        setRole(userRole);
        await refreshData();
      }
      setLoginForm({ email: '', password: '' });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (lang === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed'));
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSelectedVisitId(null);
    setClients([]);
    setVisits([]);
    setRooms([]);
    setItems([]);
    setDocuments([]);
    setPayments([]);
    setActivities([]);
    setStages([]);
    setRole('viewer');
  };

  const requireAdmin = () => {
    if (!canEdit) {
      toast.error(lang === 'ar' ? 'هذه الميزة متاحة للمسؤول فقط' : 'Admin access required');
      return false;
    }
    return true;
  };

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      toast.error(lang === 'ar' ? 'فشل حفظ الإعداد' : 'Failed saving setting');
      return;
    }
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!requireAdmin()) return;
    await saveSetting('whatsapp_api_url', brokerForm.apiUrl);
    await saveSetting('staff_numbers', brokerForm.staffPhones);
    toast.success(lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
  };

  const createLeadVisit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireAdmin()) return;
    const phones = parsePhoneList(leadForm.phones);
    if (!leadForm.name.trim() || phones.length === 0 || leadForm.room_types.length === 0) {
      toast.error(lang === 'ar' ? 'يرجى تعبئة الاسم ورقم الهاتف ونوع الغرفة' : 'Please fill client name, phone and room type');
      return;
    }
    setIsLoading(true);
    try {
      const governorate = leadForm.governorate || getGovernorateFromAddress(leadForm.address);
      const { data: clientData, error: clientError } = await supabase.from('clients').insert({
        name: leadForm.name.trim(),
        phones,
        address: leadForm.address.trim(),
        governorate: governorate || null
      }).select('id').single();
      if (clientError || !clientData) throw clientError || new Error('Client insert failed');
      const { error: visitError } = await supabase.from('visits').insert({
        client_id: clientData.id,
        requested_at: leadForm.requested_at || new Date().toISOString(),
        scheduled_at: null,
        status: 'pending',
        room_types: leadForm.room_types,
        notes: leadForm.notes || null,
        total_amount: 0,
        contract_status: 'not_contracted',
        pickup_confirmed: false,
        delivery_confirmed: false
      });
      if (visitError) throw visitError;
      setLeadForm({ name: '', phones: '', address: '', governorate: '', requested_at: '', notes: '', room_types: [] });
      await refreshData();
      toast.success(lang === 'ar' ? 'تم إنشاء العميل وطلب المعاينة' : 'Lead and visit created');
      setView('leads');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (lang === 'ar' ? 'فشل إنشاء العميل' : 'Failed creating lead'));
    }
    setIsLoading(false);
  };

  const updateVisit = async (visitId: string, updates: Partial<Visit>) => {
    if (!requireAdmin()) return false;
    const { error } = await supabase.from('visits').update(updates).eq('id', visitId);
    if (error) {
      toast.error(lang === 'ar' ? 'فشل حفظ التحديث' : 'Failed updating visit');
      return false;
    }
    await refreshData();
    return true;
  };

  const handleChangeVisitStatus = async (visitId: string, status: Visit['status']) => {
    if (!requireAdmin()) return;
    const success = await updateVisit(visitId, { status });
    if (success) toast.success(lang === 'ar' ? 'تم تحديث حالة المعاينة' : 'Visit status updated');
  };

  const handleContractToggle = async (visitId: string, contract_status: Visit['contract_status']) => {
    if (!requireAdmin()) return;
    const success = await updateVisit(visitId, {
      contract_status,
      contracted_at: contract_status === 'contracted' ? new Date().toISOString() : null
    });
    if (success) {
      if (contract_status === 'contracted') {
        await ensureProductionStages(visitId);
        await sendWhatsAppForContract(visitId);
      }
      toast.success(lang === 'ar' ? 'تم تحديث حالة التعاقد' : 'Contract status updated');
    }
  };

  const ensureProductionStages = async (visitId: string) => {
    const existing = stages.filter(stage => stage.visit_id === visitId);
    if (existing.length > 0) return;
    const visit = visits.find(v => v.id === visitId);
    if (!visit || !selectedClient) return;
    const insertStages = STAGE_ORDER.map(stage => ({
      client_id: visit.client_id,
      visit_id: visitId,
      stage: stage.key,
      status: 'not_started'
    }));
    const { error } = await supabase.from('production_stages').insert(insertStages);
    if (!error) {
      await refreshData();
    }
  };

  const handleSaveQuote = async () => {
    if (!requireAdmin() || !selectedVisit) return;
    setIsLoading(true);
    try {
      const oldRoomIds = rooms.filter(room => room.visit_id === selectedVisit.id).map(room => room.id);
      if (oldRoomIds.length > 0) {
        await supabase.from('visit_room_items').delete().in('room_id', oldRoomIds);
        await supabase.from('visit_rooms').delete().eq('visit_id', selectedVisit.id);
      }
      const insertRooms = quoteDrafts.map(room => ({
        visit_id: selectedVisit.id,
        room_type: room.room_type,
        aro_veneer: room.aro_veneer,
        room_subtotal: room.items.reduce((total, item) => total + item.price * item.quantity + (item.aro_veneer_addon ? item.aro_surcharge : 0), 0)
      }));
      const { data: insertedRooms, error: insertRoomsError } = await supabase.from('visit_rooms').insert(insertRooms).select('id');
      if (insertRoomsError) throw insertRoomsError;
      const allItems: any[] = [];
      insertedRooms?.forEach((newRoom: { id: string }, index: number) => {
        const itemsForRoom = quoteDrafts[index].items;
        itemsForRoom.forEach(item => {
          allItems.push({
            room_id: newRoom.id,
            item_name: item.item_name,
            custom_item: item.custom_item,
            quantity: item.quantity,
            dimensions: item.dimensions || null,
            price: item.price,
            notes: item.notes || null,
            aro_veneer_addon: item.aro_veneer_addon,
            aro_surcharge: item.aro_surcharge
          });
        });
      });
      if (allItems.length > 0) {
        const { error: insertItemsError } = await supabase.from('visit_room_items').insert(allItems);
        if (insertItemsError) throw insertItemsError;
      }
      const totalAmount = quoteDrafts.reduce((sum, room) => sum + room.items.reduce((roomSum, item) => roomSum + item.price * item.quantity + (item.aro_veneer_addon ? item.aro_surcharge : 0), 0), 0);
      await updateVisit(selectedVisit.id, { total_amount: totalAmount, room_types: quoteDrafts.map(room => room.room_type) });
      toast.success(lang === 'ar' ? 'تم حفظ العرض' : 'Quote saved');
      await refreshData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (lang === 'ar' ? 'فشل حفظ العرض' : 'Failed saving quote'));
    }
    setIsLoading(false);
  };

  const setRoomField = (roomIndex: number, field: keyof RoomDraft, value: any) => {
    setQuoteDrafts(prev => prev.map((room, index) => index === roomIndex ? { ...room, [field]: value } : room));
  };

  const setRoomItemField = (roomIndex: number, itemIndex: number, field: keyof RoomDraftItem, value: any) => {
    setQuoteDrafts(prev => prev.map((room, index) => {
      if (index !== roomIndex) return room;
      return {
        ...room,
        items: room.items.map((item, itemIdx) => itemIdx === itemIndex ? { ...item, [field]: value } : item)
      };
    }));
  };

  const addRoom = (type: string) => {
    setQuoteDrafts(prev => [...prev, { room_type: type, aro_veneer: false, items: [] }]);
  };

  const removeRoom = (roomIndex: number) => {
    setQuoteDrafts(prev => prev.filter((_, index) => index !== roomIndex));
  };

  const addDefaultItem = (roomIndex: number, itemName: string) => {
    setQuoteDrafts(prev => prev.map((room, index) => {
      if (index !== roomIndex) return room;
      return {
        ...room,
        items: [...room.items, { item_name: itemName, custom_item: false, quantity: 1, dimensions: '', price: 0, notes: '', aro_veneer_addon: false, aro_surcharge: 0 }]
      };
    }));
  };

  const addCustomItem = (roomIndex: number) => {
    setQuoteDrafts(prev => prev.map((room, index) => {
      if (index !== roomIndex) return room;
      return {
        ...room,
        items: [...room.items, { item_name: '', custom_item: true, quantity: 1, dimensions: '', price: 0, notes: '', aro_veneer_addon: false, aro_surcharge: 0 }]
      };
    }));
  };

  const removeRoomItem = (roomIndex: number, itemIndex: number) => {
    setQuoteDrafts(prev => prev.map((room, index) => {
      if (index !== roomIndex) return room;
      return { ...room, items: room.items.filter((_, idx) => idx !== itemIndex) };
    }));
  };

  const uploadDocument = async (event: ChangeEvent<HTMLInputElement>, type: DocumentRecord['type']) => {
    if (!selectedVisit || !selectedClient) return;
    if (!requireAdmin()) {
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { error } = await supabase.from('documents').insert({
        client_id: selectedClient.id,
        visit_id: selectedVisit.id,
        type,
        label: file.name,
        file_url: dataUrl
      });
      if (error) throw error;
      await refreshData();
      toast.success(lang === 'ar' ? 'تم رفع المستند' : 'Document uploaded');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (lang === 'ar' ? 'فشل رفع المستند' : 'Upload failed'));
    }
    event.target.value = '';
    setIsLoading(false);
  };

  const generateElectronicContract = async () => {
    if (!selectedVisit || !selectedClient) return;
    if (!requireAdmin()) return;
    setIsLoading(true);
    try {
      const lines = [
        'عقد إلكتروني للأماري furniture',
        `اسم العميل: ${selectedClient.name}`,
        `الهاتف: ${selectedClient.phones.join(', ')}`,
        `العنوان: ${selectedClient.address || '—'}`,
        `المحافظة: ${selectedClient.governorate || '—'}`,
        `تاريخ الزيارة: ${formatDate(selectedVisit.requested_at)}`,
        `حالة التعاقد: ${contractLabels[selectedVisit.contract_status]}`,
        '',
        'تفاصيل العرض:'
      ];
      quoteDrafts.forEach(room => {
        lines.push(`- ${ROOM_TYPES.find(type => type.key === room.room_type)?.ar || room.room_type}:`);
        room.items.forEach(item => {
          lines.push(`  • ${item.item_name} x${item.quantity} - ${item.price} جنيه - ${item.dimensions || 'بدون أبعاد'}`);
          if (item.aro_veneer_addon) {
            lines.push(`    - قشرة أرو +${item.aro_surcharge} جنيه`);
          }
        });
      });
      lines.push('', `الإجمالي العام: ${selectedVisit.total_amount} جنيه`);
      const content = lines.join('\n');
      const encoded = btoa(unescape(encodeURIComponent(content)));
      const dataUrl = `data:text/plain;base64,${encoded}`;
      const { error } = await supabase.from('documents').insert({
        client_id: selectedClient.id,
        visit_id: selectedVisit.id,
        type: 'electronic_contract',
        label: `عقد إلكتروني - ${selectedClient.name}`,
        file_url: dataUrl
      });
      if (error) throw error;
      await refreshData();
      toast.success(lang === 'ar' ? 'تم إنشاء العقد الإلكتروني' : 'Electronic contract generated');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (lang === 'ar' ? 'فشل إنشاء العقد' : 'Failed generating contract'));
    }
    setIsLoading(false);
  };

  const sendWhatsAppMessage = async (targetNumbers: string[], message: string, doc?: DocumentRecord) => {
    const apiUrl = settings.whatsapp_api_url || '';
    const payload = {
      numbers: targetNumbers,
      message,
      document: doc ? { label: doc.label, dataUrl: doc.file_url, type: doc.type } : undefined
    };
    let success = false;
    let details: any = { payload };
    if (apiUrl) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await response.json();
        success = response.ok;
        details = json;
      } catch (error) {
        details = { error: String(error) };
      }
    }
    if (!success && !apiUrl) {
      details = { reason: 'No WhatsApp API configured' };
    }
    if (selectedClient && selectedVisit) {
      await supabase.from('activity_logs').insert({
        client_id: selectedClient.id,
        visit_id: selectedVisit.id,
        type: 'whatsapp',
        message,
        success,
        details: JSON.stringify(details)
      });
      await refreshData();
    }

    toast(success ? (lang === 'ar' ? 'تم إرسال رسالة واتساب' : 'WhatsApp message sent') : (lang === 'ar' ? 'لم يتم إرسال رسالة واتساب' : 'WhatsApp send failed'));
  };

  const sendWhatsAppForContract = async (visitId: string) => {
    const visit = visits.find(v => v.id === visitId);
    const client = clients.find(c => c.id === visit?.client_id);
    if (!visit || !client) return;
    const phone = client.phones[0];
    if (!phone) return;
    const message = lang === 'ar' ? `مبروك، تم التعاقد معاكم مع الأماري` : `Congratulations, your contract with El-Amary is confirmed.`;
    await sendWhatsAppMessage([phone], message);
  };

  const handleAddPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireAdmin() || !selectedVisit || !selectedClient) return;
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error(lang === 'ar' ? 'أدخل مبلغًا صالحًا' : 'Enter a valid amount');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.from('payments').insert({
        client_id: selectedClient.id,
        visit_id: selectedVisit.id,
        amount,
        paid_at: new Date().toISOString(),
        installment: paymentForm.installment,
        note: paymentForm.note || null
      });
      if (error) throw error;
      const remaining = selectedVisit.total_amount - selectedPayments.reduce((sum, payment) => sum + payment.amount, 0) - amount;
      const message = lang === 'ar'
        ? `تم تسجيل دفعة جديدة بمبلغ ${amount} جنيه. المتبقي ${remaining} جنيه.`
        : `Payment of ${amount} recorded. Remaining balance ${remaining}.`;
      await sendWhatsAppMessage([selectedClient.phones[0]], message);
      await refreshData();
      setPaymentForm({ amount: '', installment: PAYMENT_MILESTONES[0], note: '' });
      toast.success(lang === 'ar' ? 'تم إضافة الدفعة' : 'Payment recorded');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (lang === 'ar' ? 'فشل تسجيل الدفع' : 'Failed adding payment'));
    }
    setIsLoading(false);
  };

  const handleStageUpdate = async (stageId: string, status: ProductionStage['status']) => {
    if (!requireAdmin()) return;
    const updates: any = { status };
    if (status === 'done') {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
    const { error } = await supabase.from('production_stages').update(updates).eq('id', stageId);
    if (error) {
      toast.error(lang === 'ar' ? 'فشل تحديث المرحلة' : 'Stage update failed');
      return;
    }
    const currentStage = stages.find(s => s.id === stageId);
    if (status === 'done' && currentStage) {
      const currentIdx = STAGE_ORDER.findIndex(s => s.key === currentStage.stage);
      const nextStage = STAGE_ORDER[currentIdx + 1];
      if (nextStage) {
        const nextStageRecord = stages.find(s => s.visit_id === currentStage.visit_id && s.stage === nextStage.key);
        if (nextStageRecord && nextStageRecord.status === 'not_started') {
          await supabase.from('production_stages').update({ status: 'in_progress' }).eq('id', nextStageRecord.id);
        }
      }
      const client = clients.find(c => c.id === currentStage.client_id);
      if (client && client.phones[0]) {
        const stageName = lang === 'ar' ? STAGE_ORDER.find(s => s.key === currentStage.stage)?.ar : STAGE_ORDER.find(s => s.key === currentStage.stage)?.en;
        const message = lang === 'ar'
          ? `تم الانتهاء من مرحلة "${stageName}" في مصنع الأمري للأثاث. شكراً لثقتكم.`
          : `The "${stageName}" stage has been completed at El-Amary Furniture. Thank you for your trust.`;
        await sendWhatsAppMessage([client.phones[0]], message);
      }
    }
    await refreshData();
    toast.success(lang === 'ar' ? 'تم تحديث المرحلة' : 'Stage updated');
  };

  const handleSendDailyStaffReminder = async () => {
    if (!requireAdmin()) return;
    const today = new Date();
    const todayVisits = visits.filter(v => v.scheduled_at && parseISO(v.scheduled_at).toDateString() === today.toDateString());
    const todayPickups = visits.filter(v => v.pickup_date && parseISO(v.pickup_date).toDateString() === today.toDateString());
    const todayDeliveries = visits.filter(v => v.delivery_date && parseISO(v.delivery_date).toDateString() === today.toDateString());
    const summaryLines = [
      lang === 'ar' ? 'تذكير المهام لليوم' : 'Daily reminders',
      `زيارات مجدولة اليوم: ${todayVisits.length}`,
      `استلامات اليوم: ${todayPickups.length}`,
      `تسليمات اليوم: ${todayDeliveries.length}`,
      '',
      ...todayVisits.map(v => `- ${clients.find(c => c.id === v.client_id)?.name || '—'} | ${v.scheduled_at ? formatDate(v.scheduled_at) : '—'}`),
      ...todayPickups.map(v => `- ${clients.find(c => c.id === v.client_id)?.name || '—'} | ${v.pickup_date ? formatDate(v.pickup_date) : '—'}`),
      ...todayDeliveries.map(v => `- ${clients.find(c => c.id === v.client_id)?.name || '—'} | ${v.delivery_date ? formatDate(v.delivery_date) : '—'}`)
    ];
    const message = summaryLines.join('\n');
    const staffNumbers = (settings.staff_numbers || '').split(/[;,\n]+/).map(n => normalizePhone(n)).filter(Boolean);
    if (!staffNumbers.length) {
      toast.error(lang === 'ar' ? 'لم يتم تكوين أرقام الموظفين' : 'No staff numbers configured');
      return;
    }
    await sendWhatsAppMessage(staffNumbers, message);
  };

  const contractTotalPaid = selectedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const contractRemaining = selectedVisit ? Math.max(selectedVisit.total_amount - contractTotalPaid, 0) : 0;

  const quoteItemTotal = (item: RoomDraftItem) => item.price * item.quantity + (item.aro_veneer_addon ? item.aro_surcharge : 0);
  const quoteRoomSubtotal = (room: RoomDraft) => room.items.reduce((sum, item) => sum + quoteItemTotal(item), 0);
  const quoteTotal = quoteDrafts.reduce((sum, room) => sum + quoteRoomSubtotal(room), 0);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2eee8] p-6">
        <div className="rounded-3xl bg-white/90 backdrop-blur-lg border border-black/10 shadow-2xl w-full max-w-lg p-10 text-center">
          <Armchair className="mx-auto mb-6 w-16 h-16 text-[#d4a373] animate-pulse" />
          <div className="h-5 bg-zinc-200 rounded-full mx-auto w-3/4 mb-4 animate-pulse"></div>
          <div className="h-4 bg-zinc-200 rounded-full mx-auto w-1/2 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (embedded) {
      return null;
    }
    return (
      <div className="min-h-screen bg-[#f2eee8] flex items-center justify-center p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <Toaster position="bottom-center" />
        <div className="max-w-xl w-full rounded-[2rem] bg-white/90 backdrop-blur-xl border border-black/10 shadow-2xl p-8 text-center">
          {authTimeoutReached && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-800 p-3 text-sm">
              {lang === 'ar' ? 'فشل التحقق من المصادقة تلقائيًا. تأكد من إعداد المتغيرات البيئية `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` في ملف .env.local ثم أعد التحميل.' : 'Automatic auth check failed. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in your .env.local and reload.'}
            </div>
          )}
          <div className="flex justify-end mb-6">
            <button onClick={() => setLang(prev => (prev === 'ar' ? 'en' : 'ar'))} className="inline-flex items-center gap-2 px-5 py-3 rounded-3xl bg-[#f8f4ec] text-base font-semibold">
              <Languages className="w-4 h-4" /> {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
          <Armchair className="mx-auto mb-6 w-20 h-20 text-[#d4a373]" />
          <h1 className="text-4xl font-bold mb-4">{lang === 'ar' ? 'العماري لإدارة الطلبات' : 'El-Amary Order Hub'}</h1>
          <p className="text-zinc-600 mb-8">{lang === 'ar' ? 'سجل دخولك لتتبع العملاء والمعاينات والإنتاج والمدفوعات.' : 'Sign in to manage leads, visits, production, and payments.'}</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-zinc-700">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" value={loginForm.email} onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-5 py-4 text-base" placeholder={lang === 'ar' ? 'user@example.com' : 'user@example.com'} required />
            </div>
            <div className="grid gap-3">
              <label className="text-sm font-semibold text-zinc-700">{lang === 'ar' ? 'كلمة المرور' : 'Password'}</label>
              <input type="password" value={loginForm.password} onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-5 py-4 text-base" required />
            </div>
            <button type="submit" disabled={isLoading} className="w-full rounded-[2rem] bg-[#18181b] text-white px-6 py-4 text-lg font-bold uppercase tracking-[0.12em] shadow-2xl">
              {isLoading ? (lang === 'ar' ? 'جاري الدخول...' : 'Signing in...') : (lang === 'ar' ? 'دخول' : 'Sign in')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2eee8] text-zinc-900" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Toaster position="bottom-center" />
      {!SUPABASE_CONFIGURED && (
        <div className="fixed z-50 left-1/2 -translate-x-1/2 top-6">
          <div className="rounded-full bg-yellow-100 border border-yellow-200 text-yellow-800 px-6 py-2 shadow">{lang === 'ar' ? 'وضع العرض (بدون Supabase) — قم بتعيين مفاتيح VITE_SUPABASE_* لربط المشروع' : 'Demo mode (no Supabase) — set VITE_SUPABASE_* to connect'}</div>
        </div>
      )}
      <div className={`flex flex-col ${embedded ? '' : 'md:flex-row'} ${embedded ? '' : 'min-h-screen'}`}>
        {!embedded && (
          <aside className={`fixed inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} z-40 w-full md:w-80 bg-white/90 backdrop-blur-xl border ${lang === 'ar' ? 'border-l' : 'border-r'} border-black/10 shadow-2xl md:static transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : lang === 'ar' ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-black/10">
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-zinc-500">{lang === 'ar' ? 'لوحة تحكم' : 'Dashboard'}</div>
              <div className="text-2xl font-bold">{lang === 'ar' ? 'العماري' : 'El-Amary'}</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-xl hover:bg-black/5"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-3xl bg-[#f5f0e8] p-4">
              <div className="text-sm text-zinc-500">{lang === 'ar' ? 'المستخدم' : 'User'}</div>
              <div className="mt-2 font-semibold text-zinc-900">{currentUser.email}</div>
              <div className="text-xs mt-1 text-zinc-500 uppercase tracking-[0.2em]">{role === 'admin' ? (lang === 'ar' ? 'الإدارة' : 'Admin') : (lang === 'ar' ? 'مودريشن / خدمة العملاء' : 'Viewer')}</div>
            </div>
            {['dashboard', 'leads', 'visits', 'contracted', 'not_contracted', 'production', 'payments', 'activities', 'settings'].map(tab => {
              const titles: Record<string, string> = {
                dashboard: lang === 'ar' ? 'الرئيسية' : 'Dashboard',
                leads: lang === 'ar' ? 'العملاء الجدد' : 'Leads',
                visits: lang === 'ar' ? 'المعاينات' : 'Visits',
                contracted: lang === 'ar' ? 'المتعاقدين' : 'Contracted',
                not_contracted: lang === 'ar' ? 'غير المتعاقدين' : 'Not Contracted',
                production: lang === 'ar' ? 'الإنتاج' : 'Production',
                payments: lang === 'ar' ? 'المدفوعات' : 'Payments',
                activities: lang === 'ar' ? 'سجل الأنشطة' : 'Activity Log',
                settings: lang === 'ar' ? 'الإعدادات' : 'Settings'
              };
              return (
                <button key={tab} onClick={() => { setView(tab as any); setSidebarOpen(false); setSelectedVisitId(null); }} className={`w-full text-start rounded-3xl px-4 py-4 transition ${view === tab ? 'bg-[#d4a373] text-white shadow-lg' : 'hover:bg-black/5 text-zinc-700'}`}>
                  {titles[tab]}
                </button>
              );
            })}
            <button onClick={handleLogout} className="w-full rounded-3xl bg-red-500 text-white px-4 py-4 hover:bg-red-600 transition">{lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}</button>
            <button onClick={() => setLang(prev => prev === 'ar' ? 'en' : 'ar')} className="w-full rounded-3xl bg-[#f5f0e8] text-zinc-900 px-4 py-4 hover:bg-[#e9e2d7] transition">{lang === 'ar' ? 'English' : 'العربية'}</button>
          </div>
        </aside>)}

        <main className={`flex-1 ${embedded ? '' : 'md:pl-80'}`}>
          {!embedded && (
            <div className="md:hidden sticky top-0 z-30 bg-[#f2eee8]/90 backdrop-blur-xl border-b border-black/10 p-4 flex items-center justify-between">
              <div className="text-lg font-semibold">{lang === 'ar' ? 'العماري' : 'El-Amary'}</div>
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-white shadow-sm"><Menu className="w-5 h-5" /></button>
            </div>
          )}
          <div className="p-6 space-y-6">
            {embedded && (
              <div className="flex flex-wrap gap-2 p-2.5 bg-white/70 backdrop-blur-md border border-black/5 rounded-[2rem] shadow-sm mb-6">
                {['dashboard', 'leads', 'visits', 'contracted', 'not_contracted', 'production', 'payments', 'activities', 'settings'].map(tab => {
                  const titles: Record<string, string> = {
                    dashboard: lang === 'ar' ? 'الرئيسية' : 'Dashboard',
                    leads: lang === 'ar' ? 'العملاء الجدد' : 'Leads',
                    visits: lang === 'ar' ? 'المعاينات' : 'Visits',
                    contracted: lang === 'ar' ? 'المتعاقدين' : 'Contracted',
                    not_contracted: lang === 'ar' ? 'غير المتعاقدين' : 'Not Contracted',
                    production: lang === 'ar' ? 'الإنتاج' : 'Production',
                    payments: lang === 'ar' ? 'المدفوعات' : 'Payments',
                    activities: lang === 'ar' ? 'سجل الأنشطة' : 'Activity Log',
                    settings: lang === 'ar' ? 'الإعدادات' : 'Settings'
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => { setView(tab as any); setSelectedVisitId(null); }}
                      className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all ${
                        view === tab
                          ? 'bg-[#d4a373] text-white shadow-md'
                          : 'hover:bg-black/5 text-zinc-700'
                      }`}
                    >
                      {titles[tab]}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">{view === 'dashboard' ? (lang === 'ar' ? 'لوحة المتابعة' : 'Operations Dashboard') : ''}</h1>
                <p className="mt-2 text-zinc-600">{view === 'dashboard' ? (lang === 'ar' ? 'تابع العملاء والمعاينات والتعاقدات بسهولة' : 'Track leads, visits, contracts, and production quickly.') : ''}</p>
              </div>
              {view === 'dashboard' && (
                <button onClick={handleSendDailyStaffReminder} disabled={!canEdit || isLoading} className="rounded-[2rem] bg-[#18181b] text-white px-6 py-3 text-sm font-semibold">
                  {lang === 'ar' ? 'إرسال تذكير يومي' : 'Send daily reminder'}
                </button>
              )}
            </div>

            {view === 'dashboard' && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: lang === 'ar' ? 'العملاء الجدد' : 'New leads', value: listCards.pendingLeads },
                  { label: lang === 'ar' ? 'زيارات اليوم' : 'Today visits', value: listCards.scheduledToday },
                  { label: lang === 'ar' ? 'استلامات اليوم' : 'Today pickups', value: listCards.pickupsToday },
                  { label: lang === 'ar' ? 'تسليمات اليوم' : 'Today deliveries', value: listCards.deliveriesToday },
                  { label: lang === 'ar' ? 'المتعاقدين' : 'Contracted', value: listCards.contracted },
                  { label: lang === 'ar' ? 'غير المتعاقدين' : 'Not contracted', value: listCards.notContracted }
                ].map(card => (
                  <div key={card.label} className="rounded-3xl bg-white p-6 shadow-sm border border-black/5">
                    <div className="text-sm text-zinc-500 mb-4">{card.label}</div>
                    <div className="text-4xl font-bold">{card.value}</div>
                  </div>
                ))}
              </div>
            )}

            {view === 'leads' && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{lang === 'ar' ? 'إنشاء عميل جديد وطلب معاينة' : 'Create lead & visit request'}</h2>
                    <p className="text-zinc-600">{lang === 'ar' ? 'سجل بيانات العميل ثم قم بإنشاء طلب المعاينة.' : 'Register a new client and schedule the site visit request.'}</p>
                  </div>
                </div>
                <form onSubmit={createLeadVisit} className="grid gap-4 bg-white rounded-[2rem] p-6 shadow-sm border border-black/5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'اسم العميل' : 'Client name'}</label>
                      <input value={leadForm.name} onChange={e => setLeadForm(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'مثال: محمد علي' : 'e.g. Mohamed Ali'} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'أرقام الهاتف' : 'Phone numbers'}</label>
                      <input value={leadForm.phones} onChange={e => setLeadForm(prev => ({ ...prev, phones: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'رقم واحد أو أكثر مفصول بفواصل' : 'One or more numbers separated by comma'} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'العنوان' : 'Address'}</label>
                      <input value={leadForm.address} onChange={e => setLeadForm(prev => ({ ...prev, address: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'عنوان العميل' : 'Client address'} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'المحافظة' : 'Governorate'}</label>
                      <input value={leadForm.governorate} onChange={e => setLeadForm(prev => ({ ...prev, governorate: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'القاهرة، الجيزة...' : 'Cairo, Giza...'} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'نوع الغرفة' : 'Room type'}</label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ROOM_TYPES.map(room => (
                          <label key={room.key} className="flex items-center gap-2 rounded-3xl border border-black/10 p-3 cursor-pointer bg-[#faf7f1]">
                            <input type="checkbox" checked={leadForm.room_types.includes(room.key)} onChange={e => setLeadForm(prev => {
                              const next = prev.room_types.includes(room.key)
                                ? prev.room_types.filter(value => value !== room.key)
                                : [...prev.room_types, room.key];
                              return { ...prev, room_types: next };
                            })} className="accent-[#d4a373]" />
                            <span>{room.ar}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                      <textarea value={leadForm.notes} onChange={e => setLeadForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3 min-h-[120px]" placeholder={lang === 'ar' ? 'ملاحظات إضافية' : 'Additional notes'} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{lang === 'ar' ? 'تاريخ طلب المعاينة' : 'Requested date'}</label>
                      <input type="datetime-local" value={leadForm.requested_at} onChange={e => setLeadForm(prev => ({ ...prev, requested_at: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3" />
                    </div>
                    <button type="submit" disabled={isLoading} className="rounded-[2rem] bg-[#18181b] text-white px-6 py-4 text-base font-semibold">
                      {lang === 'ar' ? 'حفظ العميل' : 'Save lead'}
                    </button>
                  </div>
                </form>
                <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">{lang === 'ar' ? 'قائمة العملاء الجدد' : 'New leads list'}</h3>
                    <div className="w-full max-w-sm relative">
                      <Search className="absolute top-1/2 -translate-y-1/2 left-4 text-zinc-400" />
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={lang === 'ar' ? 'ابحث بالاسم أو الهاتف' : 'Search by name or phone'} className="w-full rounded-3xl border border-black/10 pl-12 pr-4 py-3" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-zinc-500 uppercase text-xs">
                          <th className="px-4 py-3">{lang === 'ar' ? 'العميل' : 'Client'}</th>
                          <th className="px-4 py-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                          <th className="px-4 py-3">{lang === 'ar' ? 'المحافظة' : 'Governorate'}</th>
                          <th className="px-4 py-3">{lang === 'ar' ? 'نوع الغرفة' : 'Room'}</th>
                          <th className="px-4 py-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                          <th className="px-4 py-3">{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVisits.map(visit => {
                          const client = clients.find(c => c.id === visit.client_id);
                          return (
                            <tr key={visit.id} className="bg-white shadow-sm rounded-[1.5rem] overflow-hidden">
                              <td className="px-4 py-4">{client?.name}</td>
                              <td className="px-4 py-4">{client?.phones.join(', ')}</td>
                              <td className="px-4 py-4">{client?.governorate || '-'}</td>
                              <td className="px-4 py-4">{visit.room_types.map(type => ROOM_TYPES.find(room => room.key === type)?.ar || type).join(', ')}</td>
                              <td className="px-4 py-4"><span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-semibold">{contractLabels[visit.contract_status]}</span></td>
                              <td className="px-4 py-4">
                                <button onClick={() => { setSelectedVisitId(visit.id); setView('visits'); }} className="rounded-full bg-[#18181b] text-white px-4 py-2 text-sm">
                                  {lang === 'ar' ? 'عرض' : 'View'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {(view === 'visits' || view === 'contracted' || view === 'not_contracted' || view === 'production' || view === 'payments' || view === 'activities') && (
              <section className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold">{view === 'visits' ? (lang === 'ar' ? 'قائمة المعاينات' : 'Visits list') : view === 'contracted' ? (lang === 'ar' ? 'العملاء المتعاقدين' : 'Contracted clients') : view === 'not_contracted' ? (lang === 'ar' ? 'العملاء غير المتعاقدين' : 'Not contracted clients') : view === 'production' ? (lang === 'ar' ? 'تتبع الإنتاج' : 'Production tracker') : view === 'payments' ? (lang === 'ar' ? 'قسم المدفوعات' : 'Payments ledger') : (lang === 'ar' ? 'سجل الأنشطة' : 'Activity log')}</h2>
                        <p className="text-zinc-600">{lang === 'ar' ? 'اختر زيارة لعرض التفاصيل والتعديل.' : 'Select any visit to view details and action items.'}</p>
                      </div>
                      <div className="space-y-2">
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={lang === 'ar' ? 'ابحث...' : 'Search...'} className="w-full rounded-3xl border border-black/10 px-4 py-3" />
                        <select value={governorateFilter} onChange={e => setGovernorateFilter(e.target.value)} className="w-full rounded-3xl border border-black/10 px-4 py-3">
                          <option value="all">{lang === 'ar' ? 'كل المحافظات' : 'All governorates'}</option>
                          {GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="overflow-x-auto bg-white rounded-[2rem] border border-black/10 shadow-sm">
                      <table className="min-w-full text-sm text-left border-separate border-spacing-y-3">
                        <thead>
                          <tr className="text-zinc-500 uppercase text-xs">
                            <th className="px-4 py-3">{lang === 'ar' ? 'عميل' : 'Client'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'المحافظة' : 'Gov'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'الزيارة' : 'Visit'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'حالة المعاينة' : 'Visit status'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'حالة التعاقد' : 'Contract status'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'قيمة العقد' : 'Value'}</th>
                            <th className="px-4 py-3">{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredVisits.map(visit => {
                            const client = clients.find(c => c.id === visit.client_id);
                            return (
                              <tr key={visit.id} className="bg-white shadow-sm rounded-[1.5rem] overflow-hidden hover:bg-[#f8f5ee] transition-all">
                                <td className="px-4 py-4 font-semibold">{client?.name}</td>
                                <td className="px-4 py-4">{client?.phones.slice(0, 2).join(', ')}</td>
                                <td className="px-4 py-4">{client?.governorate || '-'}</td>
                                <td className="px-4 py-4">{visit.scheduled_at ? formatDate(visit.scheduled_at) : (lang === 'ar' ? 'غير مجدول' : 'Unscheduled')}</td>
                                <td className="px-4 py-4"><span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-semibold">{statusLabels[visit.status]}</span></td>
                                <td className="px-4 py-4"><span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-semibold">{contractLabels[visit.contract_status]}</span></td>
                                <td className="px-4 py-4">{visit.total_amount.toLocaleString()}</td>
                                <td className="px-4 py-4"><button onClick={() => setSelectedVisitId(visit.id)} className="rounded-full bg-[#18181b] text-white px-4 py-2 text-sm">{lang === 'ar' ? 'عرض' : 'View'}</button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {selectedVisit ? (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div>
                            <div className="text-sm text-zinc-500">{lang === 'ar' ? 'العميل المحدد' : 'Selected visit'}</div>
                            <div className="text-xl font-semibold">{selectedClient?.name || lang === 'ar' ? 'بدون عميل' : 'No client'}</div>
                          </div>
                          <span className="rounded-full bg-[#d4a373]/10 text-[#4b513b] px-3 py-1 text-xs font-semibold">{contractLabels[selectedVisit.contract_status]}</span>
                        </div>
                        <div className="space-y-3 text-sm text-zinc-600">
                          <div><span className="font-semibold">{lang === 'ar' ? 'الهاتف:' : 'Phone:'}</span> {selectedClient?.phones.join(', ')}</div>
                          <div><span className="font-semibold">{lang === 'ar' ? 'العنوان:' : 'Address:'}</span> {selectedClient?.address || '-'}</div>
                          <div><span className="font-semibold">{lang === 'ar' ? 'المحافظة:' : 'Governorate:'}</span> {selectedClient?.governorate || '-'}</div>
                          <div><span className="font-semibold">{lang === 'ar' ? 'موعد المعاينة:' : 'Visit date:'}</span> {selectedVisit.scheduled_at ? formatDate(selectedVisit.scheduled_at) : (lang === 'ar' ? 'غير مجدول' : 'Unscheduled')}</div>
                          <div><span className="font-semibold">{lang === 'ar' ? 'الحالة:' : 'Status:'}</span> {statusLabels[selectedVisit.status]}</div>
                          <div><span className="font-semibold">{lang === 'ar' ? 'قيمة العقد:' : 'Contract value:'}</span> {selectedVisit.total_amount.toLocaleString()}</div>
                        </div>
                        <div className="mt-6 space-y-3">
                          <button onClick={() => handleChangeVisitStatus(selectedVisit.id, 'scheduled')} className="w-full rounded-[2rem] bg-[#d4a373] text-white px-4 py-3 text-sm font-semibold">{lang === 'ar' ? 'وضع كمجدول' : 'Mark scheduled'}</button>
                          <button onClick={() => handleChangeVisitStatus(selectedVisit.id, 'completed')} className="w-full rounded-[2rem] bg-[#18181b] text-white px-4 py-3 text-sm font-semibold">{lang === 'ar' ? 'وضع كمكتمل' : 'Mark completed'}</button>
                          {selectedVisit.contract_status === 'not_contracted' && (
                            <button onClick={() => handleContractToggle(selectedVisit.id, 'contracted')} className="w-full rounded-[2rem] bg-[#2563eb] text-white px-4 py-3 text-sm font-semibold">{lang === 'ar' ? 'نقل إلى متعاقد' : 'Move to contracted'}</button>
                          )}
                          {selectedVisit.contract_status === 'contracted' && (
                            <button onClick={() => handleContractToggle(selectedVisit.id, 'not_contracted')} className="w-full rounded-[2rem] bg-[#ef4444] text-white px-4 py-3 text-sm font-semibold">{lang === 'ar' ? 'إلغاء التعاقد' : 'Revoke contract'}</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 text-zinc-600">{lang === 'ar' ? 'اختر معاينة من القائمة لعرض التفاصيل.' : 'Choose a visit from the list to view details.'}</div>
                    )}
                    {selectedVisit && (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-semibold">{lang === 'ar' ? 'منشئ العرض' : 'Quote builder'}</h3>
                          <button onClick={handleSaveQuote} className="rounded-full bg-[#18181b] text-white px-4 py-2 text-sm">{lang === 'ar' ? 'حفظ العرض' : 'Save quote'}</button>
                        </div>
                        <div className="space-y-5">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-3xl border border-black/10 p-4 bg-[#faf7f1]">
                              <div className="text-sm font-semibold mb-2">{lang === 'ar' ? 'إضافة غرفة' : 'Add room'}</div>
                              <div className="grid gap-2">
                                {ROOM_TYPES.map(room => (
                                  <button key={room.key} onClick={() => addRoom(room.key)} className="rounded-3xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-[#f5f0e8]">{room.ar}</button>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-3xl border border-black/10 p-4 bg-[#faf7f1]">
                              <div className="text-sm font-semibold mb-2">{lang === 'ar' ? 'الإجمالي الكلي' : 'Grand total'}</div>
                              <div className="text-3xl font-bold">{quoteTotal.toLocaleString()}</div>
                              <div className="mt-4 text-sm text-zinc-600">
                                <div className="font-semibold mb-2">{lang === 'ar' ? 'إجمالي كل غرفة' : 'Room totals'}</div>
                                <div className="space-y-2">
                                  {quoteDrafts.length === 0 ? (
                                    <div className="text-zinc-500">{lang === 'ar' ? 'لا توجد غرف بعد' : 'No rooms yet'}</div>
                                  ) : (
                                    quoteDrafts.map((room, roomIndex) => (
                                      <div key={`${room.room_type}-${roomIndex}`} className="flex items-center justify-between gap-2">
                                        <span>{ROOM_TYPES.find(r => r.key === room.room_type)?.ar || room.room_type}</span>
                                        <span className="font-semibold">{quoteRoomSubtotal(room).toLocaleString()}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-5">
                            {quoteDrafts.map((room, roomIndex) => (
                              <div key={`${room.room_type}-${roomIndex}`} className="rounded-[2rem] border border-black/10 p-4 bg-[#fffef9]">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                  <div>
                                    <div className="text-lg font-semibold">{ROOM_TYPES.find(r => r.key === room.room_type)?.ar || room.room_type}</div>
                                    <div className="text-sm text-zinc-500">{lang === 'ar' ? 'قشرة أرو لكل الغرفة' : 'Aro veneer for room'}</div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <label className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 bg-white">
                                      <input type="checkbox" checked={room.aro_veneer} onChange={e => setRoomField(roomIndex, 'aro_veneer', e.target.checked)} className="accent-[#d4a373]" />
                                      <span className="text-sm">{lang === 'ar' ? 'قشرة أرو' : 'Aro veneer'}</span>
                                    </label>
                                    <button onClick={() => removeRoom(roomIndex)} className="rounded-full bg-red-500 text-white px-3 py-2 text-sm">{lang === 'ar' ? 'حذف الغرفة' : 'Remove'}</button>
                                  </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {ROOM_TYPES.find(r => r.key === room.room_type)?.defaults.slice(0, 4).map(itemName => (
                                    <button key={itemName} onClick={() => addDefaultItem(roomIndex, itemName)} className="rounded-3xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-[#f5f0e8]">{itemName}</button>
                                  ))}
                                </div>
                                <div className="mt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="font-semibold">{lang === 'ar' ? 'عناصر الغرفة' : 'Room items'}</div>
                                    <button onClick={() => addCustomItem(roomIndex)} className="rounded-full bg-[#d4a373] text-white px-4 py-2 text-sm">{lang === 'ar' ? 'عنصر مخصص' : 'Custom item'}</button>
                                  </div>
                                  <div className="space-y-4">
                                    {room.items.map((item, itemIndex) => (
                                      <div key={`${roomIndex}-${itemIndex}`} className="rounded-3xl bg-white p-4 border border-black/10">
                                        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                                          <input value={item.item_name} onChange={e => setRoomItemField(roomIndex, itemIndex, 'item_name', e.target.value)} placeholder={lang === 'ar' ? 'اسم العنصر' : 'Item name'} className="rounded-3xl border border-black/10 px-4 py-3 w-full" />
                                          <button onClick={() => removeRoomItem(roomIndex, itemIndex)} className="rounded-full bg-red-500 text-white px-4 py-3 text-sm">{lang === 'ar' ? 'حذف' : 'Remove'}</button>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 mt-3">
                                          <input type="number" min={1} value={item.quantity} onChange={e => setRoomItemField(roomIndex, itemIndex, 'quantity', Number(e.target.value))} className="rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'الكمية' : 'Quantity'} />
                                          <input value={item.dimensions} onChange={e => setRoomItemField(roomIndex, itemIndex, 'dimensions', e.target.value)} className="rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'الأبعاد' : 'Dimensions'} />
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 mt-3">
                                          <input type="number" min={0} value={item.price} onChange={e => setRoomItemField(roomIndex, itemIndex, 'price', Number(e.target.value))} className="rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'السعر' : 'Price'} />
                                          <input value={item.notes} onChange={e => setRoomItemField(roomIndex, itemIndex, 'notes', e.target.value)} className="rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'ملاحظات' : 'Notes'} />
                                        </div>
                                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                                          <label className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 bg-[#fbfbfb]">
                                            <input type="checkbox" checked={item.aro_veneer_addon} onChange={e => setRoomItemField(roomIndex, itemIndex, 'aro_veneer_addon', e.target.checked)} className="accent-[#d4a373]" />
                                            <span className="text-sm">{lang === 'ar' ? 'قشرة أرو' : 'Aro veneer'}</span>
                                          </label>
                                          {item.aro_veneer_addon && (
                                            <input type="number" min={0} value={item.aro_surcharge} onChange={e => setRoomItemField(roomIndex, itemIndex, 'aro_surcharge', Number(e.target.value))} className="rounded-3xl border border-black/10 px-4 py-3 w-full max-w-[180px]" placeholder={lang === 'ar' ? 'سعر الإضافة' : 'Surcharge'} />
                                          )}
                                        </div>
                                        <div className="mt-3 flex flex-col gap-2 text-right text-sm font-semibold">
                                          <span>{lang === 'ar' ? 'إجمالي القطعة:' : 'Item total:'} {quoteItemTotal(item).toLocaleString()} جنيه</span>
                                          <span className="text-zinc-500 text-xs">{lang === 'ar' ? `الكمية ${item.quantity} × السعر ${item.price}` : `${item.quantity} x ${item.price}`}{item.aro_veneer_addon ? ` + ${item.aro_surcharge}` : ''}</span>
                                        </div>
                                        <div className="mt-3 text-right text-sm font-semibold">{lang === 'ar' ? 'المجموع:' : 'Subtotal:'} {quoteRoomSubtotal(room).toLocaleString()} جنيه</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedVisit && selectedVisit.contract_status === 'contracted' && (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-5">
                        <h3 className="text-xl font-semibold">{lang === 'ar' ? 'التعاقد والبورتفوليو' : 'Contract & portfolio'}</h3>
                        <div className="grid gap-4">
                          <label className="space-y-2 text-sm font-semibold">{lang === 'ar' ? 'موعد البورتفوليو' : 'Portfolio appointment date'}</label>
                          <input type="datetime-local" value={selectedVisit.portfolio_appointment_date || ''} onChange={async e => await updateVisit(selectedVisit.id, { portfolio_appointment_date: e.target.value })} className="w-full rounded-3xl border border-black/10 px-4 py-3" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-2 rounded-3xl border border-black/10 p-4 text-sm bg-[#faf7f1] cursor-pointer">
                            <span>{lang === 'ar' ? 'رفع صورة العقد الورقي' : 'Upload paper contract photo'}</span>
                            <input type="file" accept="image/*" onChange={e => uploadDocument(e, 'paper_contract')} className="hidden" />
                          </label>
                          <label className="flex flex-col gap-2 rounded-3xl border border-black/10 p-4 text-sm bg-[#faf7f1] cursor-pointer">
                            <span>{lang === 'ar' ? 'رفع صور بورتفوليو' : 'Upload portfolio photos'}</span>
                            <input type="file" accept="image/*" onChange={e => uploadDocument(e, 'portfolio_photo')} className="hidden" />
                          </label>
                          <button onClick={generateElectronicContract} className="rounded-[2rem] bg-[#2563eb] text-white px-6 py-4 text-sm font-semibold">{lang === 'ar' ? 'توليد عقد إلكتروني' : 'Generate contract'}</button>
                        </div>
                        <div className="space-y-3">
                          {selectedDocuments.length === 0 ? (
                            <div className="text-zinc-500">{lang === 'ar' ? 'لم يتم رفع أي مستندات بعد.' : 'No documents yet.'}</div>
                          ) : (
                            selectedDocuments.map(doc => (
                              <div key={doc.id} className="rounded-3xl border border-black/10 bg-[#fbfbfb] p-4 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold">{doc.label}</div>
                                  <div className="text-xs text-zinc-500">{doc.type === 'paper_contract' ? (lang === 'ar' ? 'عقد ورقي' : 'Paper contract') : doc.type === 'electronic_contract' ? (lang === 'ar' ? 'عقد إلكتروني' : 'Electronic contract') : (lang === 'ar' ? 'صورة بورتفوليو' : 'Portfolio photo')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={doc.file_url} download={`${doc.label}.txt`} className="rounded-full bg-[#18181b] text-white px-4 py-2 text-sm flex items-center gap-2"><Download className="w-4 h-4" />{lang === 'ar' ? 'تحميل' : 'Download'}</a>
                                  <button onClick={() => sendWhatsAppMessage(selectedClient?.phones || [], lang === 'ar' ? 'يرجى استلام المستند المرفق.' : 'Please find the attached document.', doc)} className="rounded-full bg-[#d4a373] text-white px-4 py-2 text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" />{lang === 'ar' ? 'أرسل واتساب' : 'Send WhatsApp'}</button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {selectedVisit && (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-5">
                        <h3 className="text-xl font-semibold">{lang === 'ar' ? 'اللوجستيك' : 'Logistics'}</h3>
                        <div className="grid gap-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="space-y-2 text-sm font-semibold">{lang === 'ar' ? 'معاد الاستلام' : 'Pickup date'}</label>
                            <input type="datetime-local" value={selectedVisit.pickup_date || ''} onChange={async e => await updateVisit(selectedVisit.id, { pickup_date: e.target.value })} className="w-full rounded-3xl border border-black/10 px-4 py-3" />
                          </div>
                          <div className="inline-flex items-center gap-3">
                            <input type="checkbox" checked={selectedVisit.pickup_confirmed} onChange={async e => await updateVisit(selectedVisit.id, { pickup_confirmed: e.target.checked })} className="accent-[#d4a373]" />
                            <span>{lang === 'ar' ? 'تم الاستلام' : 'Received'}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="space-y-2 text-sm font-semibold">{lang === 'ar' ? 'معاد التسليم' : 'Delivery date'}</label>
                            <input type="datetime-local" value={selectedVisit.delivery_date || ''} onChange={async e => await updateVisit(selectedVisit.id, { delivery_date: e.target.value })} className="w-full rounded-3xl border border-black/10 px-4 py-3" />
                          </div>
                          <div className="inline-flex items-center gap-3">
                            <input type="checkbox" checked={selectedVisit.delivery_confirmed} onChange={async e => await updateVisit(selectedVisit.id, { delivery_confirmed: e.target.checked })} className="accent-[#d4a373]" />
                            <span>{lang === 'ar' ? 'تم التسليم' : 'Delivered'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedVisit && (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-5">
                        <h3 className="text-xl font-semibold">{lang === 'ar' ? 'سجل المدفوعات' : 'Payments'}</h3>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-3xl bg-[#faf7f1] p-4 text-zinc-700">
                            <div className="text-sm text-zinc-500">{lang === 'ar' ? 'إجمالي العقد' : 'Contract total'}</div>
                            <div className="mt-2 text-2xl font-bold">{selectedVisit.total_amount.toLocaleString()}</div>
                          </div>
                          <div className="rounded-3xl bg-[#faf7f1] p-4 text-zinc-700">
                            <div className="text-sm text-zinc-500">{lang === 'ar' ? 'مدفوع حتى الآن' : 'Paid so far'}</div>
                            <div className="mt-2 text-2xl font-bold">{contractTotalPaid.toLocaleString()}</div>
                          </div>
                          <div className="rounded-3xl bg-[#faf7f1] p-4 text-zinc-700">
                            <div className="text-sm text-zinc-500">{lang === 'ar' ? 'المتبقي' : 'Remaining'}</div>
                            <div className="mt-2 text-2xl font-bold">{contractRemaining.toLocaleString()}</div>
                          </div>
                        </div>
                        <form onSubmit={handleAddPayment} className="grid gap-4 sm:grid-cols-2">
                          <input value={paymentForm.amount} onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} type="number" min={1} placeholder={lang === 'ar' ? 'المبلغ' : 'Amount'} className="rounded-3xl border border-black/10 px-4 py-3" />
                          <select value={paymentForm.installment} onChange={e => setPaymentForm(prev => ({ ...prev, installment: e.target.value }))} className="rounded-3xl border border-black/10 px-4 py-3">
                            {PAYMENT_MILESTONES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <textarea value={paymentForm.note} onChange={e => setPaymentForm(prev => ({ ...prev, note: e.target.value }))} placeholder={lang === 'ar' ? 'ملاحظة الدفع' : 'Payment note'} className="rounded-3xl border border-black/10 px-4 py-3 min-h-[120px] col-span-2" />
                          <button type="submit" disabled={isLoading} className="rounded-[2rem] bg-[#18181b] text-white px-6 py-4 text-sm font-semibold">{lang === 'ar' ? 'سجل الدفع' : 'Log payment'}</button>
                        </form>
                        <div className="space-y-3">
                          {selectedPayments.length === 0 ? (
                            <div className="text-zinc-500">{lang === 'ar' ? 'لا يوجد دفعات بعد.' : 'No payments yet.'}</div>
                          ) : (
                            <div className="space-y-3">
                              {selectedPayments.map(payment => (
                                <div key={payment.id} className="rounded-3xl border border-black/10 bg-[#faf7f1] p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-semibold">{payment.installment || (lang === 'ar' ? 'دفعة' : 'Payment')}</div>
                                    <div className="text-sm text-zinc-500">{formatDate(payment.paid_at)}</div>
                                  </div>
                                  <div className="mt-2 text-lg font-semibold">{payment.amount.toLocaleString()} جنيه</div>
                                  {payment.note && <div className="text-sm text-zinc-600 mt-2">{payment.note}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedVisit && selectedVisit.contract_status === 'contracted' && (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-semibold">{lang === 'ar' ? 'تتبع الإنتاج' : 'Production progress'}</h3>
                          <button onClick={() => ensureProductionStages(selectedVisit.id)} className="rounded-full bg-[#d4a373] text-white px-4 py-2 text-sm">{lang === 'ar' ? 'تحديث المراحل' : 'Refresh stages'}</button>
                        </div>
                        <div className="space-y-3">
                          {STAGE_ORDER.map(stage => {
                            const stageRecord = selectedStages.find(s => s.stage === stage.key);
                            return (
                              <div key={stage.key} className="rounded-3xl border border-black/10 p-4 grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                                <div>
                                  <div className="font-semibold">{lang === 'ar' ? stage.ar : stage.en}</div>
                                  <div className="text-sm text-zinc-500">{stageRecord?.status || 'not_started'}</div>
                                  {stageRecord?.completed_at && <div className="text-xs text-zinc-500">{lang === 'ar' ? 'أنجز في:' : 'Completed at:'} {formatDate(stageRecord.completed_at)}</div>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {['not_started', 'in_progress', 'done'].map(state => (
                                    <button key={state} onClick={() => stageRecord && handleStageUpdate(stageRecord.id, state as ProductionStage['status'])} className={`rounded-full px-4 py-2 text-xs font-semibold ${stageRecord?.status === state ? 'bg-[#18181b] text-white' : 'bg-[#f5f0e8] text-zinc-700'}`}>{lang === 'ar' ? state === 'not_started' ? 'لم يبدأ' : state === 'in_progress' ? 'قيد التنفيذ' : 'منجز' : state}</button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {view === 'activities' && (
                      <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-4">
                        <h3 className="text-xl font-semibold">{lang === 'ar' ? 'سجل جميع الأنشطة' : 'All activity logs'}</h3>
                        <div className="space-y-3">
                          {activities.length > 0 ? activities.map(activity => (
                            <div key={activity.id} className="rounded-3xl bg-[#faf7f1] p-4 border border-black/10">
                              <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
                                <span>{getActivityTypeLabel(activity.type, lang)}</span>
                                <span>{formatDate(activity.created_at)}</span>
                              </div>
                              <div className="mt-2 text-sm text-zinc-700">{lang === 'ar' ? getArabicActivityMessage(activity.message) : activity.message}</div>
                              <div className="mt-2 text-xs text-zinc-500">{activity.success ? (lang === 'ar' ? 'نجاح' : 'Success') : (lang === 'ar' ? 'فشل' : 'Failed')}</div>
                            </div>
                          )) : <div className="text-zinc-500">{lang === 'ar' ? 'لا توجد أنشطة بعد.' : 'No activity logs yet.'}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {view === 'settings' && (
              <section className="space-y-6">
                <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10 space-y-4">
                  <h2 className="text-2xl font-semibold">{lang === 'ar' ? 'إعدادات واتساب' : 'WhatsApp settings'}</h2>
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm font-semibold">{lang === 'ar' ? 'رابط API لواتساب' : 'WhatsApp API URL'}</label>
                    <input value={brokerForm.apiUrl} onChange={e => setBrokerForm(prev => ({ ...prev, apiUrl: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3" placeholder={lang === 'ar' ? 'https://example.com/whatsapp' : 'https://example.com/whatsapp'} />
                    <label className="space-y-2 text-sm font-semibold">{lang === 'ar' ? 'أرقام الموظفين' : 'Staff phone numbers'}</label>
                    <textarea value={brokerForm.staffPhones} onChange={e => setBrokerForm(prev => ({ ...prev, staffPhones: e.target.value }))} className="w-full rounded-3xl border border-black/10 px-4 py-3 min-h-[120px]" placeholder={lang === 'ar' ? 'اكتب رقمًا واحدًا لكل سطر أو مفصول بفواصل' : 'One number per line or comma separated'} />
                    <button onClick={handleSaveSettings} className="rounded-[2rem] bg-[#18181b] text-white px-6 py-4 text-sm font-semibold">{lang === 'ar' ? 'حفظ الإعدادات' : 'Save settings'}</button>
                  </div>
                </div>
                <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-black/10">
                  <h3 className="text-xl font-semibold">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</h3>
                  <p className="text-zinc-600 text-sm">{lang === 'ar' ? 'وظائف إرسال واتساب تعتمد على إعداد رابط API صالح. يمكنك ربط خدمة Twilio أو Meta Cloud أو أي نقطة نهاية داخلية تقبل payload JSON.' : 'WhatsApp delivery depends on a configured API endpoint. You can wire this to Twilio, Meta Cloud, or any internal endpoint that accepts JSON payloads.'}</p>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
