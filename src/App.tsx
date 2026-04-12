import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  Users, 
  CalendarClock, 
  CheckCircle2, 
  ListOrdered, 
  ChevronRight,
  ShieldCheck,
  Lock,
  BarChart3,
  CalendarDays,
  Settings,
  Trash2,
  Plus,
  Download,
  Camera,
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
  signInWithRedirect, 
  getRedirectResult, 
  signOut 
} from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';

// === CẤU HÌNH CƠ BẢN (THAY ĐỔI TẠI ĐÂY) ===
const ROOT_ADMIN_EMAIL = 'minhpv@thangloigroup.vn'; 
const BANNER_IMAGE_URL = 'https://i.postimg.cc/7hQSRb42/660431692-122180502596789445-5003665343564458581-n.jpg';

const MY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6Lr-MmSHB2MsrOjlod_IaDDR_SoLxlZE",
  authDomain: "gallerycheckin-f6428.firebaseapp.com",
  projectId: "gallerycheckin-f6428",
  storageBucket: "gallerycheckin-f6428.firebasestorage.app",
  messagingSenderId: "174212194011",
  appId: "1:174212194011:web:e15d6844ef11b4f71476fe"
};
// ===========================================

// --- KHỞI TẠO FIREBASE ONLINE & XỬ LÝ ---
const w = typeof window !== 'undefined' ? (window as any) : {}; 
const isCanvasEnv = typeof w.__firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnv ? JSON.parse(w.__firebase_config) : MY_FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof w.__app_id !== 'undefined' ? w.__app_id : 'default-app-id';

const App = () => {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('twc_activeTab') || 'checkin';
    }
    return 'checkin';
  });

  useEffect(() => {
    localStorage.setItem('twc_activeTab', activeTab);
  }, [activeTab]);

  const [checkIns, setCheckIns] = useState<any[]>([]); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- ADMIN STATE ---
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  
  const [adminList, setAdminList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('twc_adminList');
      return saved ? JSON.parse(saved) : [ROOT_ADMIN_EMAIL];
    } catch {
      return [ROOT_ADMIN_EMAIL];
    }
  });

  useEffect(() => {
    localStorage.setItem('twc_adminList', JSON.stringify(adminList));
  }, [adminList]);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminSubTab, setAdminSubTab] = useState('list'); 
  const [chartView, setChartView] = useState<'week' | 'month'>('week'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [filterType, setFilterType] = useState('all'); 

  // --- FIREBASE AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      if (!firebaseConfig.apiKey) return;
      try {
        await getRedirectResult(auth); 
        if (!auth.currentUser) {
          const initToken = w.__initial_auth_token;
          if (initToken) {
            await signInWithCustomToken(auth, initToken);
          } else {
            await signInAnonymously(auth);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        const savedList = localStorage.getItem('twc_adminList');
        const currentAdmins = savedList ? JSON.parse(savedList) : [ROOT_ADMIN_EMAIL];
        if (currentAdmins.includes(currentUser.email)) {
          setIsAdminLoggedIn(true);
          setAdminEmail(currentUser.email);
        } else {
          setAdminError(`Tài khoản ${currentUser.email} không có quyền truy cập.`);
          setIsAdminLoggedIn(false);
          await signOut(auth);
          await signInAnonymously(auth);
        }
      } else {
        setIsAdminLoggedIn(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- FIRESTORE REALTIME DATA ---
  useEffect(() => {
    if (!user || !firebaseConfig.apiKey) return; 

    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');

    const unsubscribe = onSnapshot(collectionPath, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ firebaseId: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => b.id - a.id); 
      setCheckIns(data);
    }, (error: any) => {
      console.error("Firestore Error:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  // --- FORM STATE ---
  const [hasCustomer, setHasCustomer] = useState(true);
  const initialFormState = {
    agencyName: '',
    staffName: '',
    staffPhone: '',
    staffCount: 1,
    customerName: '',
    customerPhone: '',
    customerCount: 1,
    customerAge: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if ((name === 'staffPhone' || name === 'customerPhone')) {
      const regex = /^[0-9]{0,4}$/;
      if (!regex.test(value)) return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const newCheckIn = {
      ...formData,
      id: Date.now(),
      date: dateStr,
      timestamp: today.toLocaleString('vi-VN'),
      hasCustomer: hasCustomer,
      customerName: hasCustomer ? formData.customerName : '',
      customerPhone: hasCustomer ? formData.customerPhone : '',
      customerAge: hasCustomer ? formData.customerAge : '',
      customerCount: hasCustomer ? parseInt(String(formData.customerCount)) || 0 : 0,
      staffCount: parseInt(String(formData.staffCount)) || 1,
    };

    if(!firebaseConfig.apiKey) {
       alert("Lỗi cấu hình Firebase.");
       return;
    }

    try {
      const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');
      await addDoc(collectionPath, newCheckIn);
      setShowSuccess(true);
      setFormData(initialFormState);
      setHasCustomer(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch(error: any) {
      alert("Lỗi lưu dữ liệu: " + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    setAdminError('');
    if (isCanvasEnv) {
      setIsAdminLoggedIn(true);
      setAdminEmail(ROOT_ADMIN_EMAIL);
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
      } else {
        setAdminError("Lỗi đăng nhập: " + error.message);
      }
    }
  };

  const handleAdminLogout = async () => {
    setIsAdminLoggedIn(false);
    setActiveTab('checkin');
    await signOut(auth);
    await signInAnonymously(auth);
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminEmail && !adminList.includes(newAdminEmail)) {
      setAdminList([...adminList, newAdminEmail]);
      setNewAdminEmail('');
    }
  };

  const handleRemoveAdmin = (emailToRemove: string) => {
    if (emailToRemove === ROOT_ADMIN_EMAIL) return;
    setAdminList(adminList.filter(email => email !== emailToRemove));
  };

  // --- CHART LOGIC ---
  const filteredCheckIns = useMemo(() => {
    return checkIns.filter((item: any) => {
      const matchDate = filterDate ? item.date === filterDate : true;
      let matchType = true;
      if (filterType === 'customer_only') matchType = item.hasCustomer;
      if (filterType === 'staff_only') matchType = !item.hasCustomer;
      return matchDate && matchType;
    });
  }, [checkIns, filterDate, filterType]);

  const chartData = useMemo(() => {
    const dataMap: any = {};
    const now = new Date();
    now.setHours(0,0,0,0);

    if (chartView === 'week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        dataMap[dateStr] = { 
          key: dateStr, 
          label: `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth()+1})`, 
          customers: 0, staff: 0, sortIndex: i 
        };
      }
    } else {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      let dayIdx = firstDay.getDay();
      let diff = firstDay.getDate() - dayIdx + (dayIdx === 0 ? -6 : 1);
      let currentMonday = new Date(firstDay.getFullYear(), firstDay.getMonth(), diff);

      let weekIdx = 0;
      while (currentMonday <= lastDay) {
        const start = new Date(currentMonday);
        const end = new Date(currentMonday);
        end.setDate(end.getDate() + 6);
        const key = `week-${weekIdx}`;
        dataMap[key] = {
          key, label: `Từ ${start.getDate()}/${start.getMonth()+1}\nđến ${end.getDate()}/${end.getMonth()+1}`,
          customers: 0, staff: 0, sortIndex: weekIdx, startDate: start, endDate: end
        };
        currentMonday.setDate(currentMonday.getDate() + 7);
        weekIdx++;
      }
    }

    checkIns.forEach((item: any) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);
      if (chartView === 'week') {
        if (dataMap[item.date]) {
          dataMap[item.date].customers += item.customerCount;
          dataMap[item.date].staff += item.staffCount;
        }
      } else {
        Object.values(dataMap).forEach((bucket: any) => {
          if (itemDate >= bucket.startDate && itemDate <= bucket.endDate) {
            bucket.customers += item.customerCount;
            bucket.staff += item.staffCount;
          }
        });
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView]);

  const baseMax = Math.max(5, ...chartData.map((d: any) => Math.max(d.customers, d.staff)));
  const maxChartValue = Math.ceil(baseMax * 1.3); // Tạo khoảng trống 30% bên trên cho thoáng

  // --- EXPORT ---
  const exportToExcel = () => {
    const headers = ['Ngày giờ', 'Đơn vị', 'CVKD', 'SĐT CVKD', 'SL CVKD', 'Khách', 'SĐT Khách', 'Tuổi', 'SL Khách', 'Trạng thái'];
    const rows = filteredCheckIns.map((item: any) => [
      item.timestamp, item.agencyName, item.staffName, item.staffPhone, item.staffCount,
      item.hasCustomer ? item.customerName : '', item.hasCustomer ? item.customerPhone : '',
      item.hasCustomer ? item.customerAge : '', item.hasCustomer ? item.customerCount : 0,
      item.hasCustomer ? 'Có khách' : 'Nội bộ'
    ]);
    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Gallery_CheckIn_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const exportChartImage = async () => {
    if (isExporting) return;
    const chartEl = document.getElementById('admin-chart-container');
    if (!chartEl) return;
    setIsExporting(true);

    const runExport = async () => {
      try {
        const canvas = await (w as any).html2canvas(chartEl, { 
          backgroundColor: '#0f172a', 
          scale: 2, 
          useCORS: true, 
          allowTaint: false 
        });
        const link = document.createElement('a');
        link.download = `Gallery_Chart_${new Date().toLocaleDateString()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExporting(false);
      } catch (e) {
        alert("Lỗi bảo mật trình duyệt, vui lòng thử lại trên Chrome.");
        setIsExporting(false);
      }
    };

    if (typeof (w as any).html2canvas !== 'undefined') {
      runExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => runExport();
      script.onerror = () => setIsExporting(false);
      document.head.appendChild(script);
    }
  };

  const isFormValid = useMemo(() => {
    const staffOk = formData.agencyName.trim() !== '' && formData.staffName.trim() !== '' && formData.staffPhone.length === 4;
    if (!hasCustomer) return staffOk;
    return staffOk && formData.customerName.trim() !== '' && formData.customerPhone.length === 4 && formData.customerAge !== '';
  }, [formData, hasCustomer]);

  return (
    <div className="min-h-screen bg-slate-100 pb-12" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
        body, input, button, select { font-family: 'Be Vietnam Pro', sans-serif !important; }
      `}} />

      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h3 className="font-bold text-2xl text-slate-800 text-center mb-2">Check in thành công.</h3>
            <p className="text-slate-500 text-center font-medium">Welcome to The Win City Gallery!!!</p>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#d95d1e]">
            <CalendarDays size={28} />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">The Win City</h1>
          </div>
          <div className="flex items-center space-x-4 sm:space-x-6">
            <button onClick={() => setActiveTab('checkin')} className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'checkin' ? 'bg-[#ea580c] text-white' : 'text-slate-600'}`}>Đăng ký</button>
            <button onClick={() => setActiveTab('admin')} className={`font-medium transition-all ${activeTab === 'admin' ? 'text-[#ea580c]' : 'text-slate-500'}`}>Admin</button>
            {isAdminLoggedIn && <button onClick={handleAdminLogout} className="text-red-500 font-medium ml-2">Thoát</button>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'checkin' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
              <div className="w-full h-48 sm:h-72 bg-cover bg-center relative flex items-center justify-center px-4" style={{ backgroundImage: `url('${BANNER_IMAGE_URL}')` }}>
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 text-center text-white">
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase drop-shadow-lg">CHECK IN GALLERY</h2>
                  <p className="text-sm sm:text-lg font-medium opacity-90">Vui lòng điền thông tin để được hỗ trợ tốt nhất</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 uppercase mb-5 flex items-center">
                    <span className="bg-[#ea580c] text-white p-1.5 rounded-md mr-3"><Building2 size={18} /></span> Thông tin CVKD
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Tên đơn vị (Đại lý)</label>
                      <input type="text" name="agencyName" required value={formData.agencyName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="VD: Khải Hoàn Land..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Họ và Tên CVKD</label>
                      <input type="text" name="staffName" required value={formData.staffName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="Nguyễn Văn A" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">SĐT (4 số cuối)</label>
                      <input type="text" name="staffPhone" required minLength={4} maxLength={4} value={formData.staffPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="8888" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Số lượng CVKD</label>
                      <input type="number" name="staffCount" required min="1" value={formData.staffCount} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" />
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={!hasCustomer} onChange={() => setHasCustomer(!hasCustomer)} className="w-5 h-5 accent-[#ea580c]" />
                      <span className="text-slate-700 font-semibold select-none">Tôi không đi cùng khách hàng</span>
                    </label>
                  </div>
                </div>

                {hasCustomer && (
                  <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-base font-bold text-[#c2410c] uppercase mb-5 flex items-center">
                      <span className="bg-[#fdba74] text-orange-900 p-1.5 rounded-md mr-3"><Users size={18} /></span> Thông tin Khách Hàng
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Tên Khách Hàng</label>
                        <input type="text" name="customerName" required={hasCustomer} value={formData.customerName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">SĐT Khách (4 số cuối)</label>
                        <input type="text" name="customerPhone" required={hasCustomer} minLength={4} maxLength={4} value={formData.customerPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Số lượng Khách</label>
                        <input type="number" name="customerCount" required={hasCustomer} min="1" value={formData.customerCount} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">Độ tuổi</label>
                        <select name="customerAge" required={hasCustomer} value={formData.customerAge} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none bg-white">
                          <option value="" disabled>Chọn khoảng tuổi</option>
                          <option value="Dưới 25">Dưới 25</option><option value="25-35">25-35</option><option value="36-45">36-45</option><option value="46-55">46-55</option><option value="Trên 55">Trên 55</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={!isFormValid} className={`w-full sm:w-auto px-10 py-4 font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 ${isFormValid ? 'bg-[#ea580c] text-white hover:bg-[#c2410c]' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
                  <CheckCircle2 size={24} /> <span>Gửi Đăng Ký</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden min-h-[600px]">
            {!isAdminLoggedIn ? (
              <div className="flex flex-col items-center justify-center p-12 h-[500px]">
                <div className="bg-slate-100 p-4 rounded-full mb-6"><Lock size={48} /></div>
                <h2 className="text-2xl font-bold mb-8">Đăng nhập Admin</h2>
                <button onClick={handleGoogleLogin} className="px-6 py-3 bg-white border shadow-md rounded-lg flex items-center space-x-3 hover:bg-slate-50">
                  <span className="font-bold">Đăng nhập với Google</span>
                </button>
                {adminError && <p className="text-red-500 mt-4">{adminError}</p>}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                  <div className="flex items-center space-x-2 font-bold"><ShieldCheck size={20} className="text-orange-400" /> <span>ADMIN DASHBOARD</span></div>
                  <div className="flex bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setAdminSubTab('list')} className={`px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'list' ? 'bg-[#ea580c]' : ''}`}>Danh sách</button>
                    <button onClick={() => setAdminSubTab('chart')} className={`px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'chart' ? 'bg-[#ea580c]' : ''}`}>Thống kê</button>
                    {adminEmail === ROOT_ADMIN_EMAIL && <button onClick={() => setAdminSubTab('settings')} className={`px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'settings' ? 'bg-[#ea580c]' : ''}`}>Cài đặt</button>}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex-1 overflow-auto">
                  {adminSubTab === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                      <div className="flex justify-between p-4 border-b bg-slate-50">
                        <h3 className="font-bold flex items-center">Check-in List <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs">{filteredCheckIns.length}</span></h3>
                        <div className="flex space-x-2">
                          <button onClick={exportToExcel} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-md flex items-center"><Download size={14} className="mr-1"/> Excel</button>
                          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-2 py-1 text-xs border rounded-md" />
                        </div>
                      </div>
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 font-bold border-b"><tr><th className="p-4">Thời gian</th><th className="p-4">CVKD / Đơn vị</th><th className="p-4">Khách hàng</th><th className="p-4 text-center">SL</th></tr></thead>
                        <tbody>
                          {filteredCheckIns.map(item => (
                            <tr key={item.id} className="border-b hover:bg-slate-50">
                              <td className="p-4 text-xs">{item.timestamp}</td>
                              <td className="p-4"><div className="font-bold">{item.staffName}</div><div className="text-[#ea580c] text-xs">{item.agencyName}</div></td>
                              <td className="p-4">{item.hasCustomer ? <div><div className="font-bold">{item.customerName}</div><div className="text-xs text-slate-500">{item.customerAge}</div></div> : <span className="text-slate-300 italic">Nội bộ</span>}</td>
                              <td className="p-4 text-center font-bold text-orange-600">{item.customerCount + item.staffCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {adminSubTab === 'chart' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="font-bold text-lg">Thống kê lưu lượng</h3>
                        <div className="flex space-x-2">
                          <button onClick={exportChartImage} disabled={isExporting} className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs flex items-center">{isExporting ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} className="mr-1"/>} Lưu ảnh</button>
                          <div className="flex bg-slate-100 p-1 rounded-md">
                            <button onClick={() => setChartView('week')} className={`px-3 py-1 text-xs rounded ${chartView === 'week' ? 'bg-white shadow' : ''}`}>Tuần</button>
                            <button onClick={() => setChartView('month')} className={`px-3 py-1 text-xs rounded ${chartView === 'month' ? 'bg-white shadow' : ''}`}>Tháng</button>
                          </div>
                        </div>
                      </div>
                      <div id="admin-chart-container" className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                        <div className="h-80 flex relative pl-10 pb-12 pt-10">
                          <div className="absolute top-0 left-0 text-cyan-500 font-bold text-[10px] uppercase">SỐ LƯỢNG</div>
                          <div className="absolute top-10 bottom-12 left-0 right-4 flex flex-col justify-between pointer-events-none">
                            {[maxChartValue, Math.ceil(maxChartValue * 0.5), 0].map((val, idx) => (
                              <div key={idx} className="w-full flex items-center"><span className="absolute -left-8 text-[10px] text-slate-500">{val}</span><div className="w-full border-t border-slate-700/30"></div></div>
                            ))}
                          </div>
                          <div className="flex-1 flex items-end justify-around relative z-10 h-full">
                            {chartData.map((d: any) => (
                              <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group">
                                <div className="flex items-end justify-center space-x-1 w-full h-full">
                                  <div style={{ height: `${d.customers === 0 ? 0 : (d.customers / maxChartValue) * 100}%` }} className="w-full max-w-[24px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t relative transition-all group-hover:brightness-125">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-400">{d.customers}</span>
                                  </div>
                                  <div style={{ height: `${d.staff === 0 ? 0 : (d.staff / maxChartValue) * 100}%` }} className="w-full max-w-[24px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t relative transition-all group-hover:brightness-125">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-cyan-400">{d.staff}</span>
                                  </div>
                                </div>
                                <span className="absolute -bottom-10 text-[9px] text-slate-500 text-center w-full leading-tight whitespace-pre-wrap">{d.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {adminSubTab === 'settings' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="bg-white p-6 rounded-xl border">
                        <h3 className="font-bold mb-4">Quản lý Quản trị viên</h3>
                        <form onSubmit={handleAddAdmin} className="flex gap-3 mb-6">
                          <input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Nhập email..." className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none" />
                          <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm flex items-center"><Plus size={18} className="mr-1"/> Thêm</button>
                        </form>
                        <div className="space-y-2">
                          {adminList.map(email => (
                            <div key={email} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                              <span className="text-sm font-medium">{email}</span>
                              {email !== ROOT_ADMIN_EMAIL && <button onClick={() => handleRemoveAdmin(email)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>}
                            </div>
                          ))}
                        </div>
                      </div>
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