import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  User as UserIcon, 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  BarChart3, 
  CalendarDays, 
  Settings, 
  Trash2, 
  Plus, 
  Download, 
  History,
  AlertTriangle,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  getRedirectResult, 
  signOut 
} from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';

// === CẤU HÌNH CƠ BẢN ===
const ROOT_ADMIN_EMAIL = 'minhpv@thangloigroup.vn'; 
const BANNER_IMAGE_URL = 'https://i.postimg.cc/7hQSRb42/660431692-122180502596789445-5003665343564458581-n.jpg';

const MY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBe_LmvyTLaicrXpY1-VVoyyz2J9MexMws",
  authDomain: "thangloihomesgallerycheckin.firebaseapp.com",
  projectId: "thangloihomesgallerycheckin",
  storageBucket: "thangloihomesgallerycheckin.firebasestorage.app",
  messagingSenderId: "379103774620",
  appId: "1:379103774620:web:c3647bde9faa6385806a59"
};

// --- KHỞI TẠO FIREBASE ---
const w = typeof window !== 'undefined' ? (window as any) : {};
const isCanvasEnv = typeof w.__firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnv ? JSON.parse(w.__firebase_config) : MY_FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof w.__app_id !== 'undefined' ? w.__app_id : 'default-app-id';

// Helper Path
const getCheckInCollection = () => isCanvasEnv ? collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins') : collection(db, 'gallery_checkins');
const getAdminCollection = () => isCanvasEnv ? collection(db, 'artifacts', appId, 'public', 'data', 'admin_users') : collection(db, 'admin_users');

const getLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeAge = (ageStr: string) => {
  if (!ageStr) return 'Khác';
  const s = ageStr.toLowerCase().replace(/\s+/g, '');
  if (s.includes('dưới25') || s.includes('<25')) return '< 25';
  if (s.includes('25-35') || s.includes('25-34')) return '25-35';
  if (s.includes('36-45') || s.includes('35-44')) return '36-45';
  if (s.includes('46-55') || s.includes('45-54')) return '46-55';
  if (s.includes('trên55') || s.includes('>55')) return '> 55';
  return 'Khác';
};

const AGE_GROUPS = ['< 25', '25-35', '36-45', '46-55', '> 55', 'Khác'];
const AGE_COLORS: Record<string, string> = { '< 25': 'bg-rose-400', '25-35': 'bg-amber-400', '36-45': 'bg-emerald-400', '46-55': 'bg-blue-400', '> 55': 'bg-violet-400', 'Khác': 'bg-slate-400' };
const LOCATION_GROUPS = ['Tp Hồ Chí Minh', 'Tây Ninh', 'Hà Nội', 'Đông Nam Bộ', 'Tây Nam Bộ', 'Miền Trung', 'Miền Bắc', 'Người nước ngoài', 'Khác'];
const LOCATION_COLORS: Record<string, string> = { 'Tp Hồ Chí Minh': 'bg-sky-400', 'Tây Ninh': 'bg-orange-400', 'Hà Nội': 'bg-red-400', 'Đông Nam Bộ': 'bg-teal-400', 'Tây Nam Bộ': 'bg-lime-400', 'Miền Trung': 'bg-yellow-400', 'Miền Bắc': 'bg-indigo-400', 'Người nước ngoài': 'bg-pink-400', 'Khác': 'bg-slate-400' };

const App = () => {
  const [activeTab, setActiveTab] = useState('checkin');
  const [checkIns, setCheckIns] = useState<any[]>([]); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ADMIN STATE
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubTab, setAdminSubTab] = useState('list');
  const [adminEmailsFromDb, setAdminEmailsFromDb] = useState<string[]>([]);
  const [isAdminDataLoading, setIsAdminDataLoading] = useState(true);

  // PROGRESS STATES
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingText, setProcessingText] = useState('');
  const [processedCount, setProcessedCount] = useState(0);

  // CHART STATES
  const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('day'); 
  const [chartMetric, setChartMetric] = useState<'role' | 'age' | 'location'>('role');
  const [chartFocusDate, setChartFocusDate] = useState(() => getLocalDateString(new Date()));
  const [filterDate, setFilterDate] = useState(''); 
  const [filterType, setFilterType] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [manualDate, setManualDate] = useState(() => getLocalDateString(new Date()));
  const [manualStaff, setManualStaff] = useState(1);
  const [manualCustomer, setManualCustomer] = useState(0);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // 1. AUTH & LOGIN CHECK
  useEffect(() => {
    const initAuth = async () => {
      if (!firebaseConfig.apiKey) return;
      try {
        await getRedirectResult(auth); 
        if (!auth.currentUser) {
          if (typeof w.__initial_auth_token !== 'undefined' && w.__initial_auth_token) {
            await signInWithCustomToken(auth, w.__initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        }
      } catch (e) { 
        console.error("Lỗi xác thực Firebase:", e); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. FIRESTORE LISTENERS
  useEffect(() => {
    if (!user) return;

    // Listener for ADMIN LIST
    const unsubAdmin = onSnapshot(getAdminCollection(), (snapshot) => {
      const emails = snapshot.docs.map(doc => doc.id.toLowerCase());
      if (!emails.includes(ROOT_ADMIN_EMAIL.toLowerCase())) emails.push(ROOT_ADMIN_EMAIL.toLowerCase());
      setAdminEmailsFromDb(emails);
      setIsAdminDataLoading(false);
    }, (error) => {
      console.error("Lỗi nạp danh sách admin từ server:", error);
      setIsAdminDataLoading(false);
    });

    // Listener for CHECK-IN LIST
    const unsubCheckin = onSnapshot(getCheckInCollection(), (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ firebaseId: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => b.id - a.id); 
      setCheckIns(data);
    }, (err) => {
      console.error("Lỗi nạp dữ liệu check-in:", err);
    });

    return () => {
      unsubAdmin();
      unsubCheckin();
    };
  }, [user]);

  // 3. ADMIN PERMISSION CHECK
  useEffect(() => {
    if (!isAdminDataLoading && user?.email) {
      const userEmail = user.email.toLowerCase();
      if (adminEmailsFromDb.includes(userEmail)) {
        setIsAdminLoggedIn(true);
        setAdminEmail(user.email);
        setAdminError('');
      } else {
        setIsAdminLoggedIn(false);
        setAdminEmail('');
        setAdminError(`Tài khoản ${user.email} không có quyền truy cập quản trị.`);
      }
    } else {
      setIsAdminLoggedIn(false);
      setAdminEmail('');
    }
  }, [adminEmailsFromDb, user, isAdminDataLoading]);

  // --- FORM HANDLERS ---
  const [hasCustomer, setHasCustomer] = useState(true);
  const initialFormState = { agencyName: '', staffName: '', staffPhone: '', staffCount: 1, customerName: '', customerPhone: '', customerCount: 1, customerAge: '', customerLocation: '' };
  const [formData, setFormData] = useState(initialFormState);

  const isFormValid = useMemo(() => {
    const staffOk = formData.agencyName.trim() !== '' && formData.staffName.trim() !== '' && formData.staffPhone.length >= 4;
    if (!hasCustomer) return staffOk;
    return staffOk && formData.customerName.trim() !== '' && formData.customerPhone.length >= 4 && formData.customerAge !== '' && formData.customerLocation !== '';
  }, [formData, hasCustomer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if ((name === 'staffPhone' || name === 'customerPhone') && !/^[0-9]*$/.test(value)) return;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Hệ thống chưa sẵn sàng, vui lòng đợi giây lát."); return; }
    setIsSubmitting(true);
    const today = new Date();
    const newDoc = { 
      id: Date.now(), date: getLocalDateString(today), timestamp: today.toLocaleString('vi-VN'), 
      agencyName: formData.agencyName.trim(), staffName: formData.staffName.trim(), staffPhone: formData.staffPhone, staffCount: Number(formData.staffCount),
      hasCustomer, customerName: hasCustomer ? formData.customerName.trim() : '', customerPhone: hasCustomer ? formData.customerPhone : '',
      customerAge: hasCustomer ? formData.customerAge : '', customerLocation: hasCustomer ? formData.customerLocation : '', customerCount: hasCustomer ? Number(formData.customerCount) : 0,
    };
    try {
      await Promise.race([
        addDoc(getCheckInCollection(), newDoc),
        new Promise((_, r) => setTimeout(() => r(new Error("Mất kết nối server.")), 10000))
      ]);
      setShowSuccess(true); setFormData(initialFormState); setHasCustomer(true); setTimeout(() => setShowSuccess(false), 3000);
    } catch(err: any) { alert("Lỗi gửi dữ liệu: " + err.message); } finally { setIsSubmitting(false); }
  };

  // --- ADMIN ACTIONS ---
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const email = newAdminEmail.trim().toLowerCase();
    if (email && !adminEmailsFromDb.includes(email)) {
      try {
        await setDoc(doc(getAdminCollection(), email), { addedAt: new Date().toISOString(), addedBy: adminEmail });
        setNewAdminEmail('');
        alert(`Đã cấp quyền cho ${email}`);
      } catch (e: any) { alert("Lỗi khi thêm: " + e.message); }
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!user || email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) return;
    if (window.confirm(`Xóa quyền Admin của ${email}?`)) {
      try {
        await deleteDoc(doc(getAdminCollection(), email.toLowerCase()));
      } catch (e: any) { alert("Lỗi khi xóa: " + e.message); }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const manualData = { 
      id: Date.now(), date: manualDate, timestamp: manualDate, agencyName: 'Bổ sung', staffName: 'Admin', staffPhone: '0000', staffCount: manualStaff, 
      customerName: manualCustomer > 0 ? 'Khách Bổ sung' : '', customerPhone: '', customerCount: manualCustomer, customerAge: 'Khác', customerLocation: 'Khác', hasCustomer: manualCustomer > 0, isManual: true 
    };
    try { await addDoc(getCheckInCollection(), manualData); alert("Thành công!"); } catch(e: any) { alert(e.message); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!user) return;
    if (window.confirm("Xóa dòng này?")) {
      try { await deleteDoc(doc(getCheckInCollection(), id)); } catch (e: any) { alert(e.message); }
    }
  };

  const handleClearAllData = async () => {
    if (!user || checkIns.length === 0) return;
    if (!window.confirm(`XÓA TOÀN BỘ ${checkIns.length} DỮ LIỆU?`)) return;

    setIsProcessing(true);
    setProcessedCount(0);
    setProcessingProgress(0);
    setProcessingText('ĐANG CHUẨN BỊ DỌN DẸP...');

    try {
      const collectionRef = getCheckInCollection();
      const itemsToDelete = [...checkIns];
      const total = itemsToDelete.length;
      const chunkSize = 400;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = itemsToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(item => {
          if (item.firebaseId) batch.delete(doc(collectionRef, item.firebaseId));
        });

        setProcessingText(`Đang xử lý gói ${i / chunkSize + 1}...`);
        await batch.commit();

        const currentProcessed = Math.min(i + chunkSize, total);
        setProcessedCount(currentProcessed);
        setProcessingProgress(Math.floor((currentProcessed / total) * 100));
      }

      setProcessingText('HOÀN TẤT DỌN DẸP!');
      setTimeout(() => setIsProcessing(false), 2000);
    } catch (err: any) {
      alert("Lỗi khi xóa dữ liệu: " + err.message);
      setIsProcessing(false);
    }
  }

  // --- CHART LOGIC ---
  const filteredCheckIns = useMemo(() => {
    return checkIns.filter(item => {
      const matchDate = filterDate ? item.date === filterDate : true;
      const matchType = filterType === 'all' ? true : (filterType === 'customer_only' ? item.hasCustomer : !item.hasCustomer);
      const q = searchQuery.toLowerCase();
      const matchSearch = !searchQuery ? true : (item.staffName?.toLowerCase().includes(q) || item.agencyName?.toLowerCase().includes(q) || item.customerName?.toLowerCase().includes(q));
      return matchDate && matchType && matchSearch;
    });
  }, [checkIns, filterDate, filterType, searchQuery]);

  const chartData = useMemo(() => {
    if (checkIns.length === 0) return []; 
    const dataMap: any = {};
    const [y, m, d] = chartFocusDate.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);
    baseDate.setHours(0,0,0,0);

    if (chartView === 'day') {
      const monday = new Date(baseDate); monday.setDate(baseDate.getDate() + (baseDate.getDay() === 0 ? -6 : 1 - baseDate.getDay()));
      for (let i = 0; i < 7; i++) {
        const dt = new Date(monday); dt.setDate(monday.getDate() + i);
        const ds = getLocalDateString(dt); 
        dataMap[ds] = { key: ds, label: `${dt.getDate()}/${dt.getMonth()+1}`, sortIndex: i, customers: 0, staff: 0 };
        AGE_GROUPS.forEach(ag => dataMap[ds][ag] = 0);
        LOCATION_GROUPS.forEach(lg => dataMap[ds][`loc_${lg}`] = 0);
      }
    } else if (chartView === 'week') {
      const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const firstMonday = new Date(monthStart); firstMonday.setDate(monthStart.getDate() + (monthStart.getDay() === 0 ? -6 : 1 - monthStart.getDay()));
      for (let i = 0; i < 5; i++) {
        const s = new Date(firstMonday); s.setDate(firstMonday.getDate() + (i * 7));
        const e = new Date(s); e.setDate(s.getDate() + 6);
        const k = `w-${i}`; 
        dataMap[k] = { key: k, label: `Từ ${s.getDate()}/${s.getMonth()+1}`, sortIndex: i, customers: 0, staff: 0, sDate: new Date(s), eDate: new Date(e) };
        AGE_GROUPS.forEach(ag => dataMap[k][ag] = 0);
        LOCATION_GROUPS.forEach(lg => dataMap[k][`loc_${lg}`] = 0);
      }
    } else {
      for (let i = -3; i <= 2; i++) {
        const dt = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
        const k = `${dt.getFullYear()}-${dt.getMonth() + 1}`; 
        dataMap[k] = { key: k, label: `T${dt.getMonth() + 1}`, sortIndex: i + 3, customers: 0, staff: 0 };
        AGE_GROUPS.forEach(ag => dataMap[k][ag] = 0);
        LOCATION_GROUPS.forEach(lg => dataMap[k][`loc_${lg}`] = 0);
      }
    }

    checkIns.forEach(item => {
      let bucket = null;
      if (chartView === 'day') bucket = dataMap[item.date];
      else if (chartView === 'week') {
        const idt = new Date(item.date); idt.setHours(0,0,0,0);
        bucket = Object.values(dataMap).find((b: any) => b.sDate && idt >= b.sDate && idt <= b.eDate);
      } else {
        const parts = item.date.split('-');
        if (parts.length >= 2) bucket = dataMap[`${parts[0]}-${parseInt(parts[1])}`];
      }

      if (bucket) {
        bucket.customers += (item.customerCount || 0); bucket.staff += (item.staffCount || 0);
        if (item.hasCustomer) {
            bucket[normalizeAge(item.customerAge)] += (item.customerCount || 0);
            const locKey = `loc_${item.customerLocation || 'Khác'}`;
            if (bucket[locKey] !== undefined) bucket[locKey] += (item.customerCount || 0);
            else bucket['loc_Khác'] += (item.customerCount || 0);
        }
      }
    });
    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView, chartFocusDate]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 5;
    let b = 5;
    if (chartMetric === 'role') b = Math.max(...chartData.map((d: any) => Math.max(d.customers, d.staff)));
    else if (chartMetric === 'age') b = Math.max(...chartData.map((d: any) => AGE_GROUPS.reduce((s, ag) => s + d[ag], 0)));
    else b = Math.max(...chartData.map((d: any) => LOCATION_GROUPS.reduce((s, lg) => s + d[`loc_${lg}`], 0)));
    return Math.ceil(Math.max(b, 5) * 1.2);
  }, [chartData, chartMetric]);

  const exportToExcel = () => {
    const headers = ['Thời gian', 'Đơn vị', 'CVKD', 'SĐT CV', 'SL CVKD', 'Khách hàng', 'SĐT Khách', 'Tuổi Khách', 'Khu Vực', 'SL Khách', 'Tổng'];
    const rows = filteredCheckIns.map(item => [
      `"${item.timestamp}"`, `"${item.agencyName}"`, `"${item.staffName}"`, `"${item.staffPhone}"`, item.staffCount, 
      item.hasCustomer ? `"${item.customerName}"` : 'N/A', item.hasCustomer ? `"${item.customerPhone}"` : '', item.hasCustomer ? `"${item.customerAge}"` : '', item.hasCustomer ? `"${item.customerLocation || ''}"` : '', item.customerCount, (item.staffCount || 0) + (item.customerCount || 0)
    ]);
    const csv = "\ufeff" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); 
    link.download = `DuLieu_CheckIn_${new Date().toLocaleDateString('vi-VN').replace(/\//g,'-')}.csv`; link.click();
  };

  const handleGoogleLogin = async () => {
    if (isCanvasEnv) { setIsAdminLoggedIn(true); setAdminEmail(ROOT_ADMIN_EMAIL); return; }
    try { 
        setIsAdminDataLoading(true); 
        await signInWithPopup(auth, new GoogleAuthProvider()); 
    } catch (e: any) { setAdminError(e.message); setIsAdminDataLoading(false); }
  };

  const handleAdminLogout = async () => { setIsAdminLoggedIn(false); setAdminEmail(''); setActiveTab('checkin'); await signOut(auth); await signInAnonymously(auth); };

  // Helper để thay đổi ngày biểu đồ
  const changeFocusDate = (days: number) => {
    const d = new Date(chartFocusDate);
    d.setDate(d.getDate() + days);
    setChartFocusDate(getLocalDateString(d));
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-12" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');`}} />

      {/* OVERLAY XỬ LÝ DỮ LIỆU */}
      {isProcessing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full p-10 flex flex-col items-center text-center">
            <div className="relative w-32 h-32 mb-8">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
                <circle className="text-orange-600 transition-all duration-300" strokeWidth="6" strokeDasharray="264" strokeDashoffset={264 - (264 * processingProgress) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Loader2 className="animate-spin text-orange-600" size={32} />
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-[#1e293b] mb-4">Đang xử lý...</h2>
            <p className="text-slate-500 font-medium leading-relaxed mb-8 max-w-xs">{processingText}</p>
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mb-6 border border-slate-200 shadow-inner">
                <div style={{ width: `${processingProgress}%` }} className="h-full bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.5)] transition-all duration-300" />
            </div>
            <div className="flex justify-between w-full font-bold">
                <span className="text-slate-400 text-xs uppercase tracking-widest">ĐÃ XÓA: {processedCount} / {checkIns.length} DÒNG...</span>
                <span className="text-orange-600 text-lg">{processingProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95"><div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={48} className="text-emerald-500" /></div><h3 className="font-bold text-2xl text-slate-800 text-center mb-2">Thành công!</h3><p className="text-slate-500 text-center font-medium">Cảm ơn bạn đã check-in!</p></div></div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-20"><div className="max-w-5xl mx-auto px-4 h-[72px] flex items-center justify-between"><div className="flex items-center space-x-2 text-[#d95d1e]"><CalendarDays size={28} /><h1 className="text-xl sm:text-2xl font-bold tracking-tight">The Win City</h1></div><div className="flex items-center space-x-4 sm:space-x-6"><button onClick={() => setActiveTab('checkin')} className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'checkin' ? 'bg-[#ea580c] text-white shadow-md' : 'text-slate-600'}`}>Đăng ký</button><button onClick={() => setActiveTab('admin')} className={`font-medium ${activeTab === 'admin' ? 'text-[#ea580c]' : 'text-slate-500'}`}>Admin</button>{isAdminLoggedIn && <button onClick={handleAdminLogout} className="text-red-500 font-medium ml-2 text-sm">Thoát</button>}</div></div></header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'checkin' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
              <div className="w-full h-48 sm:h-72 bg-cover bg-center relative flex items-center justify-center px-4" style={{ backgroundImage: `url('${BANNER_IMAGE_URL}')` }}><div className="absolute inset-0 bg-black/55"></div><div className="relative z-10 text-center"><h2 className="text-2xl sm:text-4xl font-extrabold uppercase text-white drop-shadow-md">CHECK IN THẮNG LỢI HOMES GALLERY</h2><p className="mt-2 text-sm sm:text-base text-white/90 font-medium drop-shadow-sm">Vui lòng điền đầy đủ thông tin để chúng tôi tiếp đón chu đáo</p></div></div>
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100"><h3 className="text-base font-bold text-slate-800 uppercase mb-5 flex items-center"><span className="bg-[#ea580c] text-white p-1.5 rounded-md mr-3"><Building2 size={18} /></span> Thông tin CVKD</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Tên đơn vị</label><input type="text" name="agencyName" required value={formData.agencyName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Họ và Tên CVKD</label><input type="text" name="staffName" required value={formData.staffName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">SĐT CVKD</label><input type="text" name="staffPhone" required minLength={4} maxLength={12} placeholder="Tối thiểu 4 số cuối" value={formData.staffPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Số lượng CVKD đi cùng</label><input type="number" name="staffCount" required min="1" value={formData.staffCount} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div></div><div className="mt-6 pt-5 border-t border-slate-200"><label className="flex items-center space-x-3 cursor-pointer group"><input type="checkbox" checked={!hasCustomer} onChange={() => setHasCustomer(!hasCustomer)} className="w-5 h-5 accent-[#ea580c] cursor-pointer" /><span className="text-slate-700 font-semibold group-hover:text-[#ea580c] select-none">Tôi không đi cùng khách hàng</span></label></div></div>
                {hasCustomer && (
                  <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-4"><h3 className="text-base font-bold text-[#c2410c] uppercase mb-5 flex items-center"><span className="bg-[#fdba74] text-orange-900 p-1.5 rounded-md mr-3"><Users size={18} /></span> Thông tin Khách Hàng</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Tên Khách Hàng</label><input type="text" name="customerName" required={hasCustomer} value={formData.customerName} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">SĐT Khách</label><input type="text" name="customerPhone" required={hasCustomer} minLength={4} maxLength={12} placeholder="Tối thiểu 4 số cuối" value={formData.customerPhone} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Số lượng Khách</label><input type="number" name="customerCount" required={hasCustomer} min="1" value={formData.customerCount} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Độ tuổi Khách</label><select name="customerAge" required={hasCustomer} value={formData.customerAge} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg bg-white focus:ring-2 focus:ring-orange-400 outline-none font-medium"><option value="" disabled>Chọn khoảng tuổi</option>{AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}</select></div><div className="space-y-3 md:col-span-2 flex flex-col items-center justify-center"><label className="text-sm font-bold text-[#c2410c] uppercase tracking-wide">Khách hàng đến từ</label><select name="customerLocation" required={hasCustomer} value={formData.customerLocation} onChange={handleInputChange} className="w-full max-w-md px-4 py-3 border-2 border-orange-200 rounded-xl bg-white focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none font-bold text-center text-slate-700 transition-all shadow-sm"><option value="" disabled>--- Chọn khu vực ---</option>{LOCATION_GROUPS.map(l => <option key={l} value={l}>{l}</option>)}</select></div></div></div>
                )}
                <button type="submit" disabled={!isFormValid || isSubmitting} className={`px-10 py-4 font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 w-full sm:w-auto ${isFormValid && !isSubmitting ? 'bg-[#ea580c] text-white hover:bg-[#c2410c] hover:-translate-y-1' : 'bg-slate-300 text-slate-500 opacity-70 cursor-not-allowed'}`}>{isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}<span>{isSubmitting ? 'Đang gửi...' : 'Xác nhận Đăng Ký'}</span></button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden min-h-[600px]">{!isAdminLoggedIn ? (
              <div className="flex flex-col items-center justify-center p-12 h-[500px]">
                <div className="bg-slate-100 p-4 rounded-full mb-6 text-slate-500">
                    {isAdminDataLoading ? <Loader2 className="animate-spin" size={48} /> : <Lock size={48} />}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-8">Admin Dashboard</h2>
                {isAdminDataLoading ? (
                    <p className="text-slate-500 animate-pulse font-medium italic">Đang tải dữ liệu admin, vui lòng đợi giây lát...</p>
                ) : (
                    <button onClick={handleGoogleLogin} className="px-6 py-3 bg-white border shadow-md rounded-lg flex items-center space-x-3 hover:bg-slate-50 transition-all font-bold"><svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg><span>Đăng nhập bằng Google</span></button>
                )}
                {adminError && <p className="text-red-500 mt-6 text-sm font-bold text-center border-t pt-4 border-red-100">{adminError}</p>}
              </div>
            ) : (
              <div className="flex flex-col h-full"><div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4"><div className="flex items-center space-x-2 font-bold text-sm"><ShieldCheck size={20} className="text-orange-400" /> <span>ADMIN AREA ({adminEmail})</span></div><div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto overflow-x-auto text-center"><button onClick={() => setAdminSubTab('list')} className={`flex-1 px-4 py-1.5 text-xs font-semibold rounded-md ${adminSubTab === 'list' ? 'bg-[#ea580c]' : 'hover:bg-slate-700'}`}>Danh sách</button><button onClick={() => setAdminSubTab('chart')} className={`flex-1 px-4 py-1.5 text-xs font-semibold rounded-md ${adminSubTab === 'chart' ? 'bg-[#ea580c]' : 'hover:bg-slate-700'}`}>Thống kê</button>{adminEmail.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() && <button onClick={() => setAdminSubTab('settings')} className={`flex-1 px-4 py-1.5 text-xs font-semibold rounded-md ${adminSubTab === 'settings' ? 'bg-[#ea580c]' : 'hover:bg-slate-700'}`}>Hệ thống</button>}</div></div>
                <div className="p-6 bg-slate-50 flex-1 overflow-auto">
                    {adminSubTab === 'list' && (
                      <div className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in"><div className="flex flex-col lg:flex-row justify-between p-4 border-b bg-slate-50 gap-4"><h3 className="font-bold flex items-center text-slate-800 text-sm">Lịch sử Check-in <span className="ml-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-[10px] font-bold">{filteredCheckIns.length} lượt</span></h3><div className="flex flex-wrap items-center gap-3"><div className="relative"><div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><Search size={14}/></div><input type="text" placeholder="Tìm tên, đơn vị..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-2 text-xs border rounded-md outline-none focus:ring-1 focus:ring-orange-400 w-full sm:w-40" /></div><input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2 text-xs border rounded-md outline-none text-slate-600" /><select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 text-xs border rounded-md outline-none text-slate-600"><option value="all">Tất cả</option><option value="customer_only">Có khách</option><option value="staff_only">Nội bộ</option></select><button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-md flex items-center font-bold shadow-sm hover:bg-emerald-700"><Download size={14} className="mr-1"/> Excel</button></div></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 font-bold border-b text-slate-600 text-xs"><tr><th className="p-4">Thời gian</th><th className="p-4">CVKD / Đơn vị</th><th className="p-4">Khách hàng</th><th className="p-4 text-center">SL Khách</th><th className="p-4 text-center">Tổng</th><th className="p-4"></th></tr></thead><tbody>{filteredCheckIns.length === 0 ? (<tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">Không tìm thấy dữ liệu</td></tr>) : (filteredCheckIns.map((item: any) => (<tr key={item.firebaseId} className="border-b hover:bg-slate-50 transition-colors text-xs"><td className="p-4 text-slate-500">{item.timestamp}</td><td className="p-4"><div className="font-bold text-slate-900">{item.staffName} <span className="text-slate-400 font-normal">({item.staffPhone})</span></div><div className="text-[#ea580c] font-medium mt-0.5">{item.agencyName}</div></td><td className="p-4">{item.hasCustomer ? (<div><div className="font-bold text-slate-900">{item.customerName} <span className="text-slate-400 font-normal">({item.customerPhone})</span></div><div className="text-[10px] text-slate-500 mt-0.5">{item.customerAge} | {item.customerLocation}</div></div>) : (<span className="text-slate-400 italic bg-slate-100 px-2 py-0.5 rounded border text-[10px]">Nội bộ</span>)}</td><td className="p-4 text-center font-bold text-orange-600">{item.customerCount}</td><td className="p-4 text-center font-extrabold text-[#ea580c]">{(item.staffCount || 0) + (item.customerCount || 0)}</td><td className="p-4 text-right"><button onClick={() => handleDeleteEntry(item.firebaseId)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button></td></tr>)))}</tbody></table></div></div>
                    )}

                    {adminSubTab === 'chart' && (
                      <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
                          <div className="flex items-center space-x-3">
                            <BarChart3 size={24} className="text-[#ea580c]" />
                            <div><h3 className="font-bold text-lg text-slate-800">Thống kê lưu lượng</h3></div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                            {/* Nút lọc Loại */}
                            <div className="flex bg-slate-100 p-1 rounded-lg border">
                              <button onClick={() => setChartMetric('role')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md ${chartMetric === 'role' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Vai trò</button>
                              <button onClick={() => setChartMetric('age')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md ${chartMetric === 'age' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Độ tuổi</button>
                              <button onClick={() => setChartMetric('location')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md ${chartMetric === 'location' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Khu vực</button>
                            </div>
                            
                            {/* Control Ngày Tháng đã được khôi phục để bạn có thể xem lại dữ liệu cũ */}
                            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-lg border">
                              <button onClick={() => changeFocusDate(chartView === 'day' ? -7 : -30)} className="p-1 hover:bg-white rounded shadow-sm text-slate-500 hover:text-orange-500"><ChevronLeft size={16} /></button>
                              <input type="date" value={chartFocusDate} onChange={(e) => setChartFocusDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none border-none w-28 text-center text-slate-700" />
                              <button onClick={() => changeFocusDate(chartView === 'day' ? 7 : 30)} className="p-1 hover:bg-white rounded shadow-sm text-slate-500 hover:text-orange-500"><ChevronRight size={16} /></button>
                            </div>

                            <div className="flex bg-slate-100 p-1 rounded-lg border">
                              <button onClick={() => setChartView('day')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md ${chartView === 'day' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Tuần</button>
                              <button onClick={() => setChartView('week')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md ${chartView === 'week' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Tháng</button>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-900 rounded-2xl pt-12 pr-6 pb-2 pl-2 border border-slate-800 shadow-inner relative overflow-hidden">
                          {/* Chú thích biểu đồ */}
                          <div className="absolute top-6 right-6 flex flex-wrap justify-end gap-3 text-[9px] font-bold z-20 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50 backdrop-blur-sm">
                            {chartMetric === 'role' ? (
                              <>
                                <div className="flex items-center space-x-1.5 text-orange-400"><div className="w-2 h-2 bg-orange-500 rounded-sm"></div><span>Khách</span></div>
                                <div className="flex items-center space-x-1.5 text-cyan-400"><div className="w-2 h-2 bg-cyan-500 rounded-sm"></div><span>CVKD</span></div>
                              </>
                            ) : (
                              (chartMetric === 'age' ? AGE_GROUPS : LOCATION_GROUPS).map(g => (
                                <div key={g} className="flex items-center space-x-1 text-slate-300">
                                  <div className={`w-2 h-2 rounded-sm ${chartMetric === 'age' ? AGE_COLORS[g] : LOCATION_COLORS[g]}`}></div><span>{g}</span>
                                </div>
                              ))
                            )}
                          </div>
                          
                          {/* Khung Biểu đồ chính */}
                          <div className="h-80 flex relative pl-12 pr-4 pb-12 pt-12">
                            {/* Trục Y */}
                            <div className="absolute top-12 bottom-12 left-0 w-10 flex flex-col justify-between items-end pr-2 text-[10px] text-slate-400 font-bold">
                              {[maxChartValue, Math.ceil(maxChartValue * 0.75), Math.ceil(maxChartValue * 0.5), Math.ceil(maxChartValue * 0.25), 0].map((v, i) => <span key={i}>{v}</span>)}
                            </div>
                            
                            <div className="flex-1 relative border-l-2 border-b-2 border-slate-600">
                              {/* Grid lines */}
                              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                {[0,1,2,3,4].map(i => <div key={i} className="w-full border-t border-slate-700/40 border-dashed"></div>)}
                              </div>
                              
                              {/* Các cột dữ liệu */}
                              <div className="absolute inset-0 flex items-end justify-around">
                                {chartData.map((d: any) => (
                                  <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group justify-end pb-[1px]">
                                    
                                    {/* SỬA LỖI H-FULL Ở ĐÂY */}
                                    {chartMetric === 'role' ? (
                                      <div className="flex items-end space-x-1 h-full w-full justify-center">
                                        <div style={{ height: `${d.customers === 0 ? 0 : Math.max((d.customers / maxChartValue) * 100, 2)}%` }} className="w-4 sm:w-6 bg-orange-500 rounded-t-sm transition-all shadow-[0_0_8px_rgba(234,88,12,0.4)] relative">
                                            {d.customers > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-400">{d.customers}</span>}
                                        </div>
                                        <div style={{ height: `${d.staff === 0 ? 0 : Math.max((d.staff / maxChartValue) * 100, 2)}%` }} className="w-4 sm:w-6 bg-cyan-500 rounded-t-sm transition-all shadow-[0_0_8px_rgba(6,182,212,0.4)] relative">
                                            {d.staff > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-cyan-400">{d.staff}</span>}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col-reverse items-center justify-start h-full w-6">
                                        {(chartMetric === 'age' ? AGE_GROUPS : LOCATION_GROUPS).map(g => { 
                                          const v = d[chartMetric === 'age' ? g : `loc_${g}`]; 
                                          if (!v) return null; 
                                          return (
                                            <div key={g} style={{ height: `${(v / maxChartValue) * 100}%` }} className={`w-full ${chartMetric === 'age' ? AGE_COLORS[g] : LOCATION_COLORS[g]} border-t border-slate-900/30 flex items-center justify-center min-h-[4px]`}>
                                              {(v / maxChartValue) * 100 > 6 && <span className="text-[9px] font-bold text-slate-900">{v}</span>}
                                            </div>
                                          ) 
                                        })}
                                      </div>
                                    )}
                                    <span className="absolute -bottom-7 text-[9px] font-bold text-slate-400 whitespace-nowrap">{d.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {adminSubTab === 'settings' && adminEmail.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() && (
                      <div className="animate-in fade-in grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-xl border shadow-sm"><div className="flex items-center space-x-3 mb-6 text-slate-800"><Settings size={20} className="text-slate-500" /><h3 className="font-bold text-lg">Phân quyền Admin (Hệ thống)</h3></div><p className="text-xs text-slate-500 mb-4">* Chú ý: Cấp quyền tại đây để admin có thể đăng nhập trên mọi thiết bị.</p><form onSubmit={handleAddAdmin} className="flex gap-2 mb-6"><input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Email người được cấp quyền..." className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" /><button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"><Plus size={16}/></button></form><div className="space-y-2">{adminEmailsFromDb.map((email: string) => (<div key={email} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border"><div className="flex items-center space-x-3 text-sm font-bold text-slate-700"><UserIcon size={14} /><span>{email}</span></div>{email.toLowerCase() !== ROOT_ADMIN_EMAIL.toLowerCase() && (<button onClick={() => handleRemoveAdmin(email)} className="text-slate-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={16}/></button>)}{email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() && <span className="text-[9px] font-extrabold text-slate-400 uppercase bg-slate-200 px-2 py-1 rounded">Chủ</span>}</div>))}</div></div><div className="bg-white p-6 rounded-xl border shadow-sm"><div className="flex items-center space-x-3 mb-4 text-slate-800"><History size={20} className="text-[#ea580c]" /><h3 className="font-bold text-lg">Bổ sung dữ liệu</h3></div><form onSubmit={handleManualSubmit} className="space-y-4"><div><label className="text-xs font-bold text-slate-700">Ngày</label><input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-700">CVKD</label><input type="number" min="0" value={manualStaff} onChange={e => setManualStaff(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="text-xs font-bold text-slate-700">Khách</label><input type="number" min="0" value={manualCustomer} onChange={e => setManualCustomer(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" /></div></div><button type="submit" className="w-full bg-[#ea580c] text-white py-2 rounded-lg font-bold shadow hover:bg-[#c2410c] flex items-center justify-center gap-2"><Plus size={16} /> Thêm</button></form></div><div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden lg:col-span-2"><div className="bg-red-50 p-4 border-b border-red-100 flex items-center space-x-2 text-red-600"><AlertTriangle size={20} /><h3 className="font-bold text-sm text-red-700">DỌN DẸP HỆ THỐNG</h3></div><div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4"><p className="text-sm text-slate-700 font-medium">Xóa vĩnh viễn <b className="text-red-600">{checkIns.length}</b> dòng dữ liệu check-in.</p><button onClick={handleClearAllData} className="w-full sm:w-auto px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold flex items-center justify-center space-x-2 hover:bg-red-700 shadow-md transition-colors"><Trash2 size={16} /><span>Xóa Sạch Dữ Liệu</span></button></div></div></div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;