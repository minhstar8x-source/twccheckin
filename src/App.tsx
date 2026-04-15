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
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2
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
import { getFirestore, collection, addDoc, onSnapshot, doc, writeBatch, deleteDoc } from 'firebase/firestore';

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

// Helper Dates
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
const AGE_COLORS: Record<string, string> = {
  '< 25': 'bg-rose-400', '25-35': 'bg-amber-400', '36-45': 'bg-emerald-400', '46-55': 'bg-blue-400', '> 55': 'bg-violet-400', 'Khác': 'bg-slate-400'
};

const App = () => {
  const [activeTab, setActiveTab] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('twc_activeTab') || 'checkin' : 'checkin'));
  useEffect(() => localStorage.setItem('twc_activeTab', activeTab), [activeTab]);

  const [checkIns, setCheckIns] = useState<any[]>([]); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ADMIN STATE
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubTab, setAdminSubTab] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('twc_adminSubTab') || 'list' : 'list'));
  useEffect(() => localStorage.setItem('twc_adminSubTab', adminSubTab), [adminSubTab]);

  const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('day'); 
  const [chartMetric, setChartMetric] = useState<'role' | 'age'>('role');
  const [chartFocusDate, setChartFocusDate] = useState(() => getLocalDateString(new Date()));
  const [filterDate, setFilterDate] = useState(''); 
  const [filterType, setFilterType] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [adminList, setAdminList] = useState<string[]>(() => {
    try { const saved = localStorage.getItem('twc_adminList'); return saved ? JSON.parse(saved) : [ROOT_ADMIN_EMAIL]; } catch { return [ROOT_ADMIN_EMAIL]; }
  });
  useEffect(() => localStorage.setItem('twc_adminList', JSON.stringify(adminList)), [adminList]);

  const [manualDate, setManualDate] = useState(() => getLocalDateString(new Date()));
  const [manualStaff, setManualStaff] = useState(1);
  const [manualCustomer, setManualCustomer] = useState(0);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // AUTH
  useEffect(() => {
    const initAuth = async () => {
      if (!firebaseConfig.apiKey) return;
      try {
        await getRedirectResult(auth); 
        if (!auth.currentUser) {
          const initToken = w.__initial_auth_token;
          initToken ? await signInWithCustomToken(auth, initToken) : await signInAnonymously(auth);
        }
      } catch (e) { console.error(e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
        if (adminList.includes(currentUser.email)) {
          setIsAdminLoggedIn(true); setAdminEmail(currentUser.email);
        } else {
          setAdminError(`Tài khoản ${currentUser.email} không có quyền.`);
          setIsAdminLoggedIn(false); await signOut(auth); await signInAnonymously(auth);
        }
      } else { setIsAdminLoggedIn(false); setAdminEmail(''); }
    });
    return () => unsubscribe();
  }, [adminList]);

  // FIRESTORE LISTENER (Real-time mượt mà)
  useEffect(() => {
    if (!user || !firebaseConfig.apiKey) return; 
    
    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');
    const unsubscribe = onSnapshot(collectionPath, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ firebaseId: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => b.id - a.id); 
      setCheckIns(data);
    }, (error) => {
      console.error("Firestore error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // FORM ĐĂNG KÝ
  const [hasCustomer, setHasCustomer] = useState(true);
  const initialFormState = { agencyName: '', staffName: '', staffPhone: '', staffCount: 1, customerName: '', customerPhone: '', customerCount: 1, customerAge: '' };
  const [formData, setFormData] = useState(initialFormState);

  const isFormValid = useMemo(() => {
    // Đã sửa: Nới lỏng kiểm tra để cho phép >= 4 ký tự
    const staffOk = formData.agencyName.trim() !== '' && formData.staffName.trim() !== '' && formData.staffPhone.length >= 4;
    if (!hasCustomer) return staffOk;
    return staffOk && formData.customerName.trim() !== '' && formData.customerPhone.length >= 4 && formData.customerAge !== '';
  }, [formData, hasCustomer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Chỉ cho phép nhập số vào ô điện thoại
    if ((name === 'staffPhone' || name === 'customerPhone') && !/^[0-9]*$/.test(value)) return;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const today = new Date();
    const newCheckIn = { 
      id: Date.now(), 
      date: getLocalDateString(today), 
      timestamp: today.toLocaleString('vi-VN'), 
      agencyName: formData.agencyName.trim(),
      staffName: formData.staffName.trim(),
      staffPhone: formData.staffPhone,
      staffCount: parseInt(String(formData.staffCount)) || 1,
      hasCustomer,
      customerName: hasCustomer ? formData.customerName.trim() : '',
      customerPhone: hasCustomer ? formData.customerPhone : '',
      customerAge: hasCustomer ? formData.customerAge : '',
      customerCount: hasCustomer ? parseInt(String(formData.customerCount)) || 0 : 0,
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins'), newCheckIn);
      setShowSuccess(true); 
      setFormData(initialFormState); 
      setHasCustomer(true); 
      setTimeout(() => setShowSuccess(false), 3000);
    } catch(err: any) { 
      alert("Lỗi khi gửi đăng ký: " + err.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  // ADMIN ACTIONS
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate) return;
    const manualData = { 
      id: Date.now(), date: manualDate, timestamp: manualDate, 
      agencyName: 'Bổ sung', staffName: 'Admin', staffPhone: '0000', staffCount: manualStaff, 
      customerName: manualCustomer > 0 ? 'Khách Bổ sung' : '', customerPhone: '', customerCount: manualCustomer, customerAge: 'Khác', 
      hasCustomer: manualCustomer > 0, isManual: true 
    };
    try { 
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins'), manualData); 
      alert("Đã thêm dữ liệu thành công!"); 
    } catch(e: any) { alert(e.message); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm("Bạn chắc chắn muốn xóa dòng đăng ký này?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins', id));
      } catch (e: any) { alert("Lỗi khi xóa: " + e.message); }
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm(`Xóa toàn bộ ${checkIns.length} dòng dữ liệu? Hành động này không thể hoàn tác!`)) return;
    try {
      const batch = writeBatch(db);
      checkIns.forEach(item => {
        if (item.firebaseId) {
          batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins', item.firebaseId));
        }
      });
      await batch.commit();
      alert("Đã dọn sạch dữ liệu!");
    } catch (err: any) {
      alert("Lỗi khi xóa dữ liệu (nếu quá nhiều dữ liệu, hãy xóa từng phần): " + err.message);
    }
  }

  // CHART & FILTER LOGIC
  const filteredCheckIns = useMemo(() => {
    return checkIns.filter(item => {
      const matchDate = filterDate ? item.date === filterDate : true;
      let matchType = true;
      if (filterType === 'customer_only') matchType = item.hasCustomer;
      if (filterType === 'staff_only') matchType = !item.hasCustomer;
      
      let matchSearch = true;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        matchSearch = (item.staffName && item.staffName.toLowerCase().includes(q)) || 
                      (item.agencyName && item.agencyName.toLowerCase().includes(q)) ||
                      (item.customerName && item.customerName.toLowerCase().includes(q));
      }
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
      }
    } else {
      for (let i = -3; i <= 2; i++) {
        const dt = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
        const k = `${dt.getFullYear()}-${dt.getMonth() + 1}`; 
        dataMap[k] = { key: k, label: `T${dt.getMonth() + 1}`, sortIndex: i + 3, customers: 0, staff: 0 };
        AGE_GROUPS.forEach(ag => dataMap[k][ag] = 0);
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
        if (parts.length >= 2) {
          bucket = dataMap[`${parts[0]}-${parseInt(parts[1])}`];
        }
      }

      if (bucket) {
        bucket.customers += (item.customerCount || 0); bucket.staff += (item.staffCount || 0);
        if (item.hasCustomer) bucket[normalizeAge(item.customerAge)] += (item.customerCount || 0);
      }
    });
    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView, chartFocusDate]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 5;
    const base = chartMetric === 'role' 
      ? Math.max(...chartData.map((d: any) => Math.max(d.customers, d.staff))) 
      : Math.max(...chartData.map((d: any) => AGE_GROUPS.reduce((s, ag) => s + d[ag], 0)));
    return Math.ceil(Math.max(base, 5) * 1.25);
  }, [chartData, chartMetric]);

  const exportToExcel = () => {
    const headers = ['Thời gian', 'Đơn vị', 'CVKD', 'SĐT CV', 'SL CVKD', 'Khách hàng', 'SĐT Khách', 'Tuổi Khách', 'SL Khách', 'Tổng'];
    const rows = filteredCheckIns.map(item => [
      `"${item.timestamp}"`, `"${item.agencyName}"`, `"${item.staffName}"`, `"${item.staffPhone}"`, item.staffCount, 
      item.hasCustomer ? `"${item.customerName}"` : 'N/A', item.hasCustomer ? `"${item.customerPhone}"` : '', item.hasCustomer ? `"${item.customerAge}"` : '', item.customerCount, 
      (item.staffCount || 0) + (item.customerCount || 0)
    ]);
    const csv = "\ufeff" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); 
    link.download = `DuLieu_CheckIn_${new Date().toLocaleDateString('vi-VN').replace(/\//g,'-')}.csv`; link.click();
  };

  const handleGoogleLogin = async () => {
    if (isCanvasEnv) { setIsAdminLoggedIn(true); setAdminEmail(ROOT_ADMIN_EMAIL); return; }
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e: any) { setAdminError(e.message); }
  };

  const handleAdminLogout = async () => { setIsAdminLoggedIn(false); setAdminEmail(''); setActiveTab('checkin'); await signOut(auth); await signInAnonymously(auth); };

  return (
    <div className="min-h-screen bg-slate-100 pb-12" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');`}} />

      {/* MODAL THÔNG BÁO THÀNH CÔNG */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95"><div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={48} className="text-emerald-500" /></div><h3 className="font-bold text-2xl text-slate-800 text-center mb-2">Thành công!</h3><p className="text-slate-500 text-center font-medium">Cảm ơn bạn đã check-in!</p></div></div>
      )}

      {/* HEADER */}
      <header className="bg-white shadow-sm sticky top-0 z-20"><div className="max-w-5xl mx-auto px-4 h-[72px] flex items-center justify-between"><div className="flex items-center space-x-2 text-[#d95d1e]"><CalendarDays size={28} /><h1 className="text-xl sm:text-2xl font-bold tracking-tight">The Win City</h1></div><div className="flex items-center space-x-4 sm:space-x-6"><button onClick={() => setActiveTab('checkin')} className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'checkin' ? 'bg-[#ea580c] text-white shadow-md' : 'text-slate-600'}`}>Đăng ký</button><button onClick={() => setActiveTab('admin')} className={`font-medium ${activeTab === 'admin' ? 'text-[#ea580c]' : 'text-slate-500'}`}>Admin</button>{isAdminLoggedIn && <button onClick={handleAdminLogout} className="text-red-500 font-medium ml-2">Thoát</button>}</div></div></header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        
        {/* TAB 1: FORM ĐĂNG KÝ */}
        {activeTab === 'checkin' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
              <div className="w-full h-48 sm:h-72 bg-cover bg-center relative flex items-center justify-center px-4" style={{ backgroundImage: `url('${BANNER_IMAGE_URL}')` }}>
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 text-center">
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase text-white drop-shadow-md">CHECK IN THẮNG LỢI HOMES GALLERY</h2>
                  <p className="mt-2 text-sm sm:text-base text-white/90 font-medium drop-shadow-sm">Vui lòng điền đầy đủ thông tin để chúng tôi tiếp đón chu đáo</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 uppercase mb-5 flex items-center"><span className="bg-[#ea580c] text-white p-1.5 rounded-md mr-3"><Building2 size={18} /></span> Thông tin CVKD</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Tên đơn vị</label><input type="text" name="agencyName" required value={formData.agencyName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                    <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Họ và Tên CVKD</label><input type="text" name="staffName" required value={formData.staffName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                    <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">SĐT CVKD</label><input type="text" name="staffPhone" required minLength={4} maxLength={12} placeholder="Tối thiểu 4 số cuối" value={formData.staffPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                    <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Số lượng CVKD đi cùng</label><input type="number" name="staffCount" required min="1" value={formData.staffCount} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                  </div>
                  <div className="mt-6 pt-5 border-t border-slate-200"><label className="flex items-center space-x-3 cursor-pointer group"><input type="checkbox" checked={!hasCustomer} onChange={() => setHasCustomer(!hasCustomer)} className="w-5 h-5 accent-[#ea580c] cursor-pointer" /><span className="text-slate-700 font-semibold group-hover:text-[#ea580c] select-none">Tôi không đi cùng khách hàng</span></label></div>
                </div>
                
                {hasCustomer && (
                  <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-base font-bold text-[#c2410c] uppercase mb-5 flex items-center"><span className="bg-[#fdba74] text-orange-900 p-1.5 rounded-md mr-3"><Users size={18} /></span> Thông tin Khách Hàng</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Tên Khách Hàng</label><input type="text" name="customerName" required={hasCustomer} value={formData.customerName} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                      <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">SĐT Khách</label><input type="text" name="customerPhone" required={hasCustomer} minLength={4} maxLength={12} placeholder="Tối thiểu 4 số cuối" value={formData.customerPhone} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                      <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Số lượng Khách</label><input type="number" name="customerCount" required={hasCustomer} min="1" value={formData.customerCount} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Độ tuổi Khách</label>
                        <select name="customerAge" required={hasCustomer} value={formData.customerAge} onChange={handleInputChange} className="w-full px-4 py-3 border border-orange-200 rounded-lg bg-white focus:ring-2 focus:ring-orange-400 outline-none font-medium">
                          <option value="" disabled>Chọn khoảng tuổi</option>
                          <option value="Dưới 25">Dưới 25</option>
                          <option value="25-35">25 - 35</option>
                          <option value="36-45">36 - 45</option>
                          <option value="46-55">46 - 55</option>
                          <option value="Trên 55">Trên 55</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                <button type="submit" disabled={!isFormValid || isSubmitting} className={`px-10 py-4 font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 w-full sm:w-auto ${isFormValid && !isSubmitting ? 'bg-[#ea580c] text-white hover:bg-[#c2410c] hover:-translate-y-1' : 'bg-slate-300 text-slate-500 opacity-70 cursor-not-allowed'}`}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                  <span>{isSubmitting ? 'Đang gửi...' : 'Xác nhận Đăng Ký'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: ADMIN AREA */}
        {activeTab === 'admin' && (
          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden min-h-[600px]">
            {!isAdminLoggedIn ? (
              <div className="flex flex-col items-center justify-center p-12 h-[500px]"><div className="bg-slate-100 p-4 rounded-full mb-6 text-slate-500"><Lock size={48} /></div><h2 className="text-2xl font-bold text-slate-900 mb-8">Admin Dashboard</h2><button onClick={handleGoogleLogin} className="px-6 py-3 bg-white border shadow-md rounded-lg flex items-center space-x-3 hover:bg-slate-50 transition-all font-bold"><svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg><span>Đăng nhập với Google</span></button>{adminError && <p className="text-red-500 mt-4 text-sm">{adminError}</p>}</div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4"><div className="flex items-center space-x-2 font-bold"><ShieldCheck size={20} className="text-orange-400" /> <span>ADMIN AREA</span></div><div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto overflow-x-auto text-center"><button onClick={() => setAdminSubTab('list')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'list' ? 'bg-[#ea580c]' : 'hover:bg-slate-700'}`}>Danh sách</button><button onClick={() => setAdminSubTab('chart')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'chart' ? 'bg-[#ea580c]' : 'hover:bg-slate-700'}`}>Thống kê</button>{adminEmail === ROOT_ADMIN_EMAIL && <button onClick={() => setAdminSubTab('settings')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'settings' ? 'bg-[#ea580c]' : 'hover:bg-slate-700'}`}>Hệ thống</button>}</div></div>

                <div className="p-6 bg-slate-50 flex-1 overflow-auto">
                    {/* SUBTAB 1: DANH SÁCH */}
                    {adminSubTab === 'list' && (
                      <div className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in"><div className="flex flex-col lg:flex-row justify-between p-4 border-b bg-slate-50 gap-4"><h3 className="font-bold flex items-center text-slate-800">Lịch sử Đăng ký <span className="ml-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">{filteredCheckIns.length} lượt</span></h3><div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><Search size={14}/></div>
                          <input type="text" placeholder="Tìm tên, đơn vị..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-2 text-xs border rounded-md shadow-sm outline-none focus:ring-1 focus:ring-orange-400 w-full sm:w-40" />
                        </div>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2 text-xs border rounded-md shadow-sm outline-none text-slate-600" />
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 text-xs border rounded-md shadow-sm outline-none text-slate-600"><option value="all">Tất cả</option><option value="customer_only">Có khách</option><option value="staff_only">Nội bộ</option></select>
                        <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-md flex items-center font-bold shadow-sm hover:bg-emerald-700"><Download size={14} className="mr-1"/> Excel</button>
                      </div></div><div className="overflow-x-auto min-h-[400px]"><table className="w-full text-sm text-left"><thead className="bg-slate-100 font-bold border-b text-slate-600"><tr><th className="p-4">Thời gian</th><th className="p-4">CVKD / Đơn vị</th><th className="p-4">Khách hàng</th><th className="p-4 text-center">SL CVKD</th><th className="p-4 text-center">SL Khách</th><th className="p-4 text-center">Tổng</th><th className="p-4"></th></tr></thead><tbody>{filteredCheckIns.length === 0 ? (<tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">Không tìm thấy dữ liệu</td></tr>) : (filteredCheckIns.map((item: any) => (<tr key={item.firebaseId || item.id} className="border-b hover:bg-slate-50 transition-colors"><td className="p-4 text-xs font-medium text-slate-500">{item.timestamp}</td><td className="p-4"><div className="font-bold text-slate-900">{item.staffName} <span className="text-slate-400 font-normal ml-1">({item.staffPhone})</span></div><div className="text-[#ea580c] text-xs font-medium mt-0.5">{item.agencyName}</div></td><td className="p-4">{item.hasCustomer ? (<div><div className="font-bold text-slate-900">{item.customerName} <span className="text-slate-400 font-normal ml-1">({item.customerPhone})</span></div><div className="text-xs text-slate-500 mt-0.5">Tuổi: {item.customerAge}</div></div>) : (<span className="text-slate-400 italic text-xs bg-slate-100 px-2 py-0.5 rounded border">Nội bộ</span>)}</td><td className="p-4 text-center font-semibold text-slate-700">{item.staffCount}</td><td className="p-4 text-center font-semibold text-orange-600">{item.customerCount}</td><td className="p-4 text-center font-extrabold text-[#ea580c]">{(item.staffCount || 0) + (item.customerCount || 0)}</td><td className="p-4 text-right">{adminEmail === ROOT_ADMIN_EMAIL && (<button onClick={() => handleDeleteEntry(item.firebaseId || item.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>)}</td></tr>)))}</tbody></table></div></div>
                    )}

                    {/* SUBTAB 2: THỐNG KÊ */}
                    {adminSubTab === 'chart' && (
                      <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in"><div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4"><div className="flex items-center space-x-3"><BarChart3 size={24} className="text-[#ea580c]" /><div><h3 className="font-bold text-lg text-slate-800">Thống kê lưu lượng</h3></div></div><div className="flex flex-wrap items-center gap-3 w-full xl:w-auto"><div className="flex bg-slate-100 p-1 rounded-lg mr-2 border"><button onClick={() => setChartMetric('role')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${chartMetric === 'role' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Theo Vai trò</button><button onClick={() => setChartMetric('age')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${chartMetric === 'age' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Theo Độ tuổi</button></div><div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-lg border"><button onClick={() => { const d = new Date(chartFocusDate); d.setDate(d.getDate() - (chartView === 'day' ? 7 : 30)); setChartFocusDate(getLocalDateString(d)); }} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft size={16} /></button><input type="date" value={chartFocusDate} onChange={(e) => setChartFocusDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none border-none w-28 text-center" /><button onClick={() => { const d = new Date(chartFocusDate); d.setDate(d.getDate() + (chartView === 'day' ? 7 : 30)); setChartFocusDate(getLocalDateString(d)); }} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight size={16} /></button></div><div className="flex bg-slate-100 p-1 rounded-lg border">{['day', 'week', 'month'].map((v: any) => (<button key={v} onClick={() => setChartView(v)} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{v === 'day' ? 'Tuần' : v === 'week' ? 'Tháng' : 'Năm'}</button>))}</div></div></div><div id="admin-chart-container" className="bg-slate-900 rounded-2xl pt-12 pr-6 pb-2 pl-2 border border-slate-800 shadow-inner relative overflow-hidden"><div className="absolute top-6 right-6 flex flex-wrap justify-end gap-3 text-[10px] font-bold z-20 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50 backdrop-blur-sm">{chartMetric === 'role' ? (<><div className="flex items-center space-x-1.5 text-orange-400"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm shadow-[0_0_8px_rgba(234,88,12,0.8)]"></div><span>Khách</span></div><div className="flex items-center space-x-1.5 text-cyan-400"><div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div><span>CVKD</span></div></>) : (AGE_GROUPS.map(ag => (<div key={ag} className="flex items-center space-x-1.5 text-slate-200"><div className={`w-2.5 h-2.5 rounded-sm ${AGE_COLORS[ag]}`}></div><span>{ag}</span></div>)))}</div><div className="h-80 flex relative pl-16 pr-4 pb-12 pt-12"><div className="absolute top-0 left-4 text-cyan-500 font-bold text-[10px] uppercase opacity-60 tracking-widest">Số lượng</div><div className="absolute top-12 bottom-12 left-0 w-14 flex flex-col justify-between items-end pr-2 pointer-events-none">{[maxChartValue, Math.ceil(maxChartValue * 0.75), Math.ceil(maxChartValue * 0.5), Math.ceil(maxChartValue * 0.25), 0].map((val: number, idx: number) => (<span key={idx} className="text-[10px] text-slate-400 font-bold leading-none translate-y-1/2">{val}</span>))}</div><div className="flex-1 relative border-l-[3px] border-b-[3px] border-slate-600 shadow-[0_0_15px_rgba(71,85,105,0.3)]"><div className="absolute inset-0 flex flex-col justify-between pointer-events-none">{[0, 1, 2, 3, 4].map((_: number, idx: number) => (<div key={idx} className="w-full border-t border-slate-700/40 border-dashed"></div>))}</div><div className="absolute inset-0 flex items-end justify-around">{chartData.map((d: any) => { const st = AGE_GROUPS.reduce((s, ag) => s + d[ag], 0); return (<div key={d.key} className="flex flex-col items-center flex-1 h-full relative group justify-end pb-[1px]">{chartMetric === 'role' ? (<div className="flex items-end justify-center space-x-1 sm:space-x-2 w-full h-full relative z-10"><div style={{ height: `${d.customers === 0 ? 0 : Math.max((d.customers / maxChartValue) * 100, 3)}%` }} className="w-full max-w-[28px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-sm relative transition-all group-hover:brightness-125 shadow-[0_0_8px_rgba(234,88,12,0.4)]">{d.customers > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-400">{d.customers}</span>}</div><div style={{ height: `${d.staff === 0 ? 0 : Math.max((d.staff / maxChartValue) * 100, 3)}%` }} className="w-full max-w-[28px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm relative transition-all group-hover:brightness-125 shadow-[0_0_8px_rgba(6,182,212,0.4)]">{d.staff > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-cyan-400">{d.staff}</span>}</div></div>) : (<div className="flex flex-col-reverse items-center justify-start w-full h-full relative z-10 max-w-[32px]">{AGE_GROUPS.map(ag => { const v = d[ag]; if (v === 0) return null; const hp = (v / maxChartValue) * 100; return (<div key={ag} style={{ height: `${hp}%` }} className={`w-full ${AGE_COLORS[ag]} relative border-t border-slate-900/30 transition-all flex items-center justify-center min-h-[4px]`}>{hp > 6 && <span className="text-[9px] font-bold text-slate-900">{v}</span>}</div>) })} {st > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-300">{st}</span>}</div>)}<span className="absolute -bottom-8 text-[9px] font-bold text-slate-400 text-center w-full whitespace-nowrap overflow-hidden text-ellipsis">{d.label}</span></div>) })}</div></div></div></div></div>
                    )}

                    {/* SUBTAB 3: HỆ THỐNG */}
                    {adminSubTab === 'settings' && adminEmail === ROOT_ADMIN_EMAIL && (
                      <div className="animate-in fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* QUẢN LÝ ADMIN */}
                        <div className="bg-white p-6 rounded-xl border shadow-sm"><div className="flex items-center space-x-3 mb-6 text-slate-800"><Settings size={20} className="text-slate-500" /><h3 className="font-bold text-lg">Phân quyền Admin</h3></div><form onSubmit={e => { e.preventDefault(); if (newAdminEmail && !adminList.includes(newAdminEmail)) { setAdminList([...adminList, newAdminEmail]); setNewAdminEmail(''); } }} className="flex gap-2 mb-6"><input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Email admin mới..." className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2" /><button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"><Plus size={16}/></button></form><div className="space-y-2">{adminList.map((email: string) => (<div key={email} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border"><div className="flex items-center space-x-3"><div className="w-6 h-6 bg-white border rounded-full flex items-center justify-center text-slate-400"><UserIcon size={12} /></div><span className="text-sm font-bold text-slate-700">{email}</span></div>{email !== ROOT_ADMIN_EMAIL && (<button onClick={() => setAdminList(adminList.filter((e: string) => e !== email))} className="text-slate-300 hover:text-red-500 p-1.5 transition-colors"><Trash2 size={16}/></button>)}{email === ROOT_ADMIN_EMAIL && <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-200 px-2 py-1 rounded">Chủ</span>}</div>))}</div></div>
                        
                        {/* THÊM DỮ LIỆU THỦ CÔNG */}
                        <div className="bg-white p-6 rounded-xl border shadow-sm"><div className="flex items-center space-x-3 mb-4 text-slate-800"><History size={20} className="text-[#ea580c]" /><h3 className="font-bold text-lg">Thêm dữ liệu thủ công</h3></div><form onSubmit={handleManualSubmit} className="space-y-4"><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">Ngày bổ sung</label><input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">SL CVKD</label><input type="number" min="0" required value={manualStaff} onChange={e => setManualStaff(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg" /></div><div className="space-y-1.5"><label className="text-xs font-bold text-slate-700">SL Khách</label><input type="number" min="0" required value={manualCustomer} onChange={e => setManualCustomer(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg" /></div></div><button type="submit" className="w-full bg-[#ea580c] text-white py-2 rounded-lg font-bold shadow hover:bg-[#c2410c] flex items-center justify-center gap-2 transition-all"><Plus size={16} /> Thêm dữ liệu</button></form></div>
                        
                        {/* DỌN DẸP DỮ LIỆU */}
                        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden lg:col-span-2"><div className="bg-red-50 p-4 border-b border-red-100 flex items-center space-x-2 text-red-600"><AlertTriangle size={20} /><h3 className="font-bold text-sm">KHU VỰC NGUY HIỂM</h3></div><div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4"><p className="text-sm text-slate-700 font-medium">Xóa sạch toàn bộ <b className="text-red-600">{checkIns.length}</b> dòng dữ liệu hiện có trên hệ thống.</p><button onClick={handleClearAllData} className="w-full sm:w-auto px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold flex items-center justify-center space-x-2 hover:bg-red-700 shadow-md transition-colors"><Trash2 size={16} /><span>Xóa Sạch Dữ Liệu</span></button></div></div>
                      
                      </div>
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