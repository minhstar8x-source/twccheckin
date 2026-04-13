import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  User, 
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
  Camera, 
  Loader2, 
  History 
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
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

// === CẤU HÌNH CƠ BẢN ===
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

// --- KHỞI TẠO FIREBASE ---
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
  const [adminSubTab, setAdminSubTab] = useState('list'); 
  const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('week'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [filterType, setFilterType] = useState('all'); 
  
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

  // --- MANUAL ENTRY STATE ---
  const [manualDate, setManualDate] = useState('');
  const [manualStaff, setManualStaff] = useState(1);
  const [manualCustomer, setManualCustomer] = useState(0);
  const [newAdminEmail, setNewAdminEmail] = useState('');

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
        if (adminList.includes(currentUser.email)) {
          setIsAdminLoggedIn(true);
          setAdminEmail(currentUser.email);
        } else {
          setAdminError(`Tài khoản ${currentUser.email} không có quyền.`);
          setIsAdminLoggedIn(false);
          await signOut(auth);
          await signInAnonymously(auth);
        }
      } else {
        setIsAdminLoggedIn(false);
        setAdminEmail('');
      }
    });
    return () => unsubscribe();
  }, [adminList]);

  // --- FIRESTORE DATA ---
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

  // --- FORM HANDLERS ---
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate) return;
    
    const targetDate = new Date(manualDate);
    const dateStr = manualDate;

    const manualData = {
      agencyName: 'Dữ liệu cũ',
      staffName: 'Nhập thủ công',
      staffPhone: '0000',
      staffCount: parseInt(String(manualStaff)) || 0,
      customerName: 'Khách cũ',
      customerPhone: '0000',
      customerCount: parseInt(String(manualCustomer)) || 0,
      customerAge: 'N/A',
      hasCustomer: manualCustomer > 0,
      id: Date.now(),
      date: dateStr,
      timestamp: `${targetDate.toLocaleDateString('vi-VN')} (Thủ công)`,
      isManual: true
    };

    try {
      const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');
      await addDoc(collectionPath, manualData);
      setManualStaff(1);
      setManualCustomer(0);
      alert("Đã cập nhật dữ liệu thành công!");
    } catch(error: any) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleDeleteEntry = async (firebaseId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa dòng này?")) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins', firebaseId);
      await deleteDoc(docRef);
    } catch (e: any) {
      alert("Lỗi khi xóa: " + e.message);
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
        setAdminError("Lỗi: " + error.message);
      }
    }
  };

  const handleAdminLogout = async () => {
    setIsAdminLoggedIn(false);
    setAdminEmail('');
    setActiveTab('checkin');
    await signOut(auth);
    await signInAnonymously(auth);
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

    if (chartView === 'day') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dataMap[dateStr] = { 
          key: dateStr, 
          label: `${d.getDate()}/${d.getMonth()+1}`, 
          customers: 0, staff: 0, sortIndex: 7-i 
        };
      }
    } else if (chartView === 'week') {
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
          customers: 0, staff: 0, sortIndex: weekIdx, startDate: new Date(start), endDate: new Date(end)
        };
        currentMonday.setDate(currentMonday.getDate() + 7);
        weekIdx++;
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        dataMap[key] = { 
          key, label: `T${d.getMonth() + 1}/${d.getFullYear()}`, 
          customers: 0, staff: 0, sortIndex: 6-i 
        };
      }
    }

    checkIns.forEach((item: any) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);
      
      if (chartView === 'day') {
        if (dataMap[item.date]) {
          dataMap[item.date].customers += item.customerCount;
          dataMap[item.date].staff += item.staffCount;
        }
      } else if (chartView === 'week') {
        Object.values(dataMap).forEach((bucket: any) => {
          if (itemDate >= bucket.startDate && itemDate <= bucket.endDate) {
            bucket.customers += item.customerCount;
            bucket.staff += item.staffCount;
          }
        });
      } else {
        const key = `${itemDate.getFullYear()}-${itemDate.getMonth() + 1}`;
        if (dataMap[key]) {
          dataMap[key].customers += item.customerCount;
          dataMap[key].staff += item.staffCount;
        }
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView]);

  const baseMax = Math.max(5, ...chartData.map((d: any) => Math.max(d.customers, d.staff)));
  const maxChartValue = Math.ceil(baseMax * 1.5);

  // --- UI HELPERS ---
  const isFormValid = useMemo(() => {
    const staffOk = formData.agencyName.trim() !== '' && formData.staffName.trim() !== '' && formData.staffPhone.length === 4;
    if (!hasCustomer) return staffOk;
    return staffOk && formData.customerName.trim() !== '' && formData.customerPhone.length === 4 && formData.customerAge !== '';
  }, [formData, hasCustomer]);

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
          logging: false,
          allowTaint: false
        });
        
        // Chuyển sang DataURL để tương thích cao hơn trên di động thay vì toBlob
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Gallery_Chart_${new Date().getTime()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExporting(false);
      } catch (e) {
        console.error("Lỗi xuất ảnh:", e);
        alert("Lỗi: Trình duyệt không hỗ trợ chụp ảnh vùng này hoặc bị chặn bởi quyền riêng tư.");
        setIsExporting(false);
      }
    };

    if (typeof (w as any).html2canvas !== 'undefined') {
      runExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => runExport();
      script.onerror = () => {
        alert("Không thể tải thư viện lưu ảnh.");
        setIsExporting(false);
      };
      document.head.appendChild(script);
    }
  };

  const exportToExcel = () => {
    const headers = ['Thời gian', 'Đơn vị', 'CVKD', 'SL CVKD', 'Khách', 'SL Khách', 'Tổng'];
    const rows = filteredCheckIns.map(item => [
      item.timestamp, item.agencyName, item.staffName, item.staffCount, 
      item.hasCustomer ? item.customerName : 'N/A', 
      item.customerCount, 
      item.staffCount + item.customerCount
    ]);
    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Gallery_CheckIn_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

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
            <button onClick={() => setActiveTab('checkin')} className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'checkin' ? 'bg-[#ea580c] text-white shadow-md' : 'text-slate-600 hover:text-[#ea580c]'}`}>Đăng ký</button>
            <button onClick={() => setActiveTab('admin')} className={`font-medium transition-all ${activeTab === 'admin' ? 'text-[#ea580c]' : 'text-slate-500 hover:text-[#ea580c]'}`}>Admin</button>
            {isAdminLoggedIn && <button onClick={handleAdminLogout} className="text-red-500 font-medium ml-2 hover:underline">Thoát</button>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'checkin' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
              <div className="w-full h-48 sm:h-72 bg-cover bg-center relative flex items-center justify-center px-4" style={{ backgroundImage: `url('${BANNER_IMAGE_URL}')` }}>
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 text-center">
                  <h2 
                    className="text-2xl sm:text-4xl font-extrabold uppercase drop-shadow-lg text-white" 
                    style={{ color: '#ffffff' }}
                  >
                    CHECK IN THE WIN CITY GALLERY
                  </h2>
                  <p className="text-sm sm:text-lg font-medium opacity-90 text-white">Vui lòng điền thông tin để được hỗ trợ tốt nhất</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 uppercase mb-5 flex items-center">
                    <span className="bg-[#ea580c] text-white p-1.5 rounded-md mr-3"><Building2 size={18} /></span> Thông tin CVKD
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Tên đơn vị (Đại lý)</label>
                      <input type="text" name="agencyName" required value={formData.agencyName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="VD: Khải Hoàn Land..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Họ và Tên CVKD</label>
                      <input type="text" name="staffName" required value={formData.staffName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="Nguyễn Văn A" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">SĐT CVKD (4 số cuối)</label>
                      <input type="text" name="staffPhone" required minLength={4} maxLength={4} value={formData.staffPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="8888" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Số lượng CVKD đi cùng</label>
                      <input type="number" name="staffCount" required min="1" value={formData.staffCount} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" />
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input type="checkbox" checked={!hasCustomer} onChange={() => setHasCustomer(!hasCustomer)} className="w-5 h-5 accent-[#ea580c]" />
                      <span className="text-slate-700 font-semibold select-none group-hover:text-[#ea580c]">Tôi không đi cùng khách hàng</span>
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
                        <label className="text-sm font-semibold text-slate-700">Tên Khách Hàng</label>
                        <input type="text" name="customerName" required={hasCustomer} value={formData.customerName} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">SĐT Khách (4 số cuối)</label>
                        <input type="text" name="customerPhone" required={hasCustomer} minLength={4} maxLength={4} value={formData.customerPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Số lượng Khách</label>
                        <input type="number" name="customerCount" required={hasCustomer} min="1" value={formData.customerCount} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Độ tuổi Khách</label>
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
                <div className="bg-slate-100 p-4 rounded-full mb-6 text-slate-500"><Lock size={48} /></div>
                <h2 className="text-2xl font-bold text-slate-900 mb-8">Admin Dashboard</h2>
                <button onClick={handleGoogleLogin} className="px-6 py-3 bg-white border shadow-md rounded-lg flex items-center space-x-3 hover:bg-slate-50 transition-all font-bold">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  <span>Đăng nhập với Google</span>
                </button>
                {adminError && <p className="text-red-500 mt-4 text-sm font-medium">{adminError}</p>}
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center space-x-2 font-bold"><ShieldCheck size={20} className="text-orange-400" /> <span>ADMIN AREA</span></div>
                  <div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
                    <button onClick={() => setAdminSubTab('list')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'list' ? 'bg-[#ea580c]' : ''}`}>Danh sách</button>
                    <button onClick={() => setAdminSubTab('chart')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'chart' ? 'bg-[#ea580c]' : ''}`}>Thống kê</button>
                    <button onClick={() => setAdminSubTab('manual')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'manual' ? 'bg-[#ea580c]' : ''}`}>Nhập liệu cũ</button>
                    {adminEmail === ROOT_ADMIN_EMAIL && <button onClick={() => setAdminSubTab('settings')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'settings' ? 'bg-[#ea580c]' : ''}`}>Cài đặt</button>}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex-1 overflow-auto">
                  {/* DANH SÁCH */}
                  {adminSubTab === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in">
                      <div className="flex flex-col lg:flex-row justify-between p-4 border-b bg-slate-50 gap-4">
                        <h3 className="font-bold flex items-center text-slate-800">Lịch sử Đăng ký <span className="ml-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">{filteredCheckIns.length} lượt</span></h3>
                        <div className="flex flex-wrap items-center gap-3">
                          <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-md flex items-center font-bold hover:bg-emerald-700 shadow-sm"><Download size={14} className="mr-1"/> Excel</button>
                          
                          <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 text-xs border rounded-md shadow-sm outline-none focus:ring-1 focus:ring-[#ea580c]"
                          >
                            <option value="all">Tất cả</option>
                            <option value="customer_only">Có khách</option>
                            <option value="staff_only">Nội bộ</option>
                          </select>

                          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2 text-xs border rounded-md shadow-sm outline-none focus:ring-1 focus:ring-[#ea580c]" />
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-100 font-bold border-b text-slate-600">
                            <tr>
                              <th className="p-4">Thời gian</th>
                              <th className="p-4">CVKD / Đơn vị</th>
                              <th className="p-4">Khách hàng</th>
                              <th className="p-4 text-center">SL CVKD</th>
                              <th className="p-4 text-center">SL Khách</th>
                              <th className="p-4 text-center">Tổng cộng</th>
                              <th className="p-4"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCheckIns.length === 0 ? (
                              <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">Không tìm thấy dữ liệu</td></tr>
                            ) : (
                              filteredCheckIns.map(item => (
                                <tr key={item.firebaseId} className="border-b hover:bg-slate-50 transition-colors">
                                  <td className="p-4 text-xs font-medium text-slate-500">{item.timestamp}</td>
                                  <td className="p-4"><div className="font-bold text-slate-900">{item.staffName}</div><div className="text-[#ea580c] text-xs font-medium">{item.agencyName}</div></td>
                                  <td className="p-4">
                                    {item.hasCustomer ? (
                                      <div><div className="font-bold text-slate-900">{item.customerName}</div><div className="text-xs text-slate-500">Tuổi: {item.customerAge}</div></div>
                                    ) : (
                                      <span className="text-slate-300 italic text-xs bg-slate-50 px-2 py-0.5 rounded">Nội bộ</span>
                                    )}
                                  </td>
                                  <td className="p-4 text-center font-semibold text-slate-700">{item.staffCount}</td>
                                  <td className="p-4 text-center font-semibold text-orange-600">{item.customerCount}</td>
                                  <td className="p-4 text-center font-extrabold text-[#ea580c]">{item.staffCount + item.customerCount}</td>
                                  <td className="p-4 text-right">
                                    {adminEmail === ROOT_ADMIN_EMAIL && (
                                      <button 
                                        onClick={() => handleDeleteEntry(item.firebaseId)} 
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                        title="Xóa dữ liệu"
                                      >
                                        <Trash2 size={16}/>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* THỐNG KÊ */}
                  {adminSubTab === 'chart' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in">
                      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                        <div className="flex items-center space-x-3">
                          <BarChart3 size={24} className="text-[#ea580c]" />
                          <h3 className="font-bold text-lg text-slate-800">Thống kê lưu lượng khách</h3>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={exportChartImage} disabled={isExporting} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow hover:bg-slate-900 transition-all">
                            {isExporting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Camera size={14} className="mr-1"/>} {isExporting ? 'Đang lưu...' : 'Lưu ảnh'}
                          </button>
                          <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setChartView('day')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === 'day' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Ngày</button>
                            <button onClick={() => setChartView('week')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === 'week' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Tuần</button>
                            <button onClick={() => setChartView('month')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === 'month' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Tháng</button>
                          </div>
                        </div>
                      </div>
                      
                      <div id="admin-chart-container" className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-inner relative overflow-hidden">
                        <div className="absolute top-10 right-10 flex space-x-4 text-[10px] font-bold z-20">
                          <div className="flex items-center space-x-1.5 text-orange-400"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></div><span>Khách hàng</span></div>
                          <div className="flex items-center space-x-1.5 text-cyan-400"><div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm"></div><span>CVKD</span></div>
                        </div>

                        <div className="h-80 flex relative pl-20 pb-12 pt-16">
                          <div className="absolute top-4 left-6 text-cyan-500 font-bold text-[10px] uppercase opacity-50">SỐ LƯỢNG</div>
                          <div className="absolute top-16 bottom-12 left-2 w-16 flex flex-col justify-between pointer-events-none text-right pr-3">
                            {[maxChartValue, Math.ceil(maxChartValue * 0.75), Math.ceil(maxChartValue * 0.5), Math.ceil(maxChartValue * 0.25), 0].map((val, idx) => (
                              <div key={idx} className="h-0 flex items-center justify-end">
                                <span className="text-[10px] text-slate-500 font-bold leading-none">{val}</span>
                              </div>
                            ))}
                          </div>
                          <div className="absolute top-16 bottom-12 left-20 right-4 flex flex-col justify-between pointer-events-none">
                            {[0, 1, 2, 3, 4].map((_, idx) => (
                              <div key={idx} className="w-full border-t border-slate-700/20 border-dashed"></div>
                            ))}
                          </div>

                          <div className="flex-1 flex items-end justify-around relative z-10 h-full">
                            {chartData.map((d: any) => (
                              <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group">
                                <div className="flex items-end justify-center space-x-1 w-full h-full">
                                  <div style={{ height: `${d.customers === 0 ? 0 : (d.customers / maxChartValue) * 100}%` }} className="w-full max-w-[28px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-sm shadow-[0_0_15px_rgba(234,88,12,0.2)] relative transition-all group-hover:brightness-125">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-400">{d.customers}</span>
                                  </div>
                                  <div style={{ height: `${d.staff === 0 ? 0 : (d.staff / maxChartValue) * 100}%` }} className="w-full max-w-[28px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm shadow-[0_0_15px_rgba(6,182,212,0.2)] relative transition-all group-hover:brightness-125">
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-cyan-400">{d.staff}</span>
                                  </div>
                                </div>
                                <span className="absolute -bottom-10 text-[9px] font-bold text-slate-500 text-center w-full leading-tight whitespace-pre-wrap px-1">{d.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NHẬP LIỆU CŨ */}
                  {adminSubTab === 'manual' && (
                    <div className="max-w-xl mx-auto animate-in fade-in">
                      <div className="bg-white p-8 rounded-xl shadow-sm border">
                        <div className="flex items-center space-x-3 mb-6 text-slate-800">
                          <History size={24} className="text-[#ea580c]" />
                          <h3 className="font-bold text-lg">Cập nhật dữ liệu quá khứ</h3>
                        </div>
                        <p className="text-slate-500 text-sm mb-6">Sử dụng tính năng này để bù đắp số liệu cho các ngày chưa có dữ liệu hệ thống.</p>
                        
                        <form onSubmit={handleManualSubmit} className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Chọn ngày</label>
                            <input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">Lượng CVKD</label>
                              <input type="number" min="0" required value={manualStaff} onChange={e => setManualStaff(parseInt(e.target.value))} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">Lượng Khách hàng</label>
                              <input type="number" min="0" required value={manualCustomer} onChange={e => setManualCustomer(parseInt(e.target.value))} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
                            </div>
                          </div>
                          <button type="submit" className="w-full bg-[#ea580c] text-white py-3 rounded-lg font-bold shadow-lg hover:bg-[#c2410c] transition-all flex items-center justify-center gap-2">
                            <Plus size={20} /> Lưu dữ liệu
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* CÀI ĐẶT */}
                  {adminSubTab === 'settings' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in">
                      <div className="bg-white p-8 rounded-xl border shadow-sm">
                        <div className="flex items-center space-x-3 mb-6 text-slate-800">
                          <Settings size={24} className="text-slate-500" />
                          <h3 className="font-bold text-lg">Quản lý Quản trị viên</h3>
                        </div>
                        <form onSubmit={e => {
                          e.preventDefault();
                          if (newAdminEmail && !adminList.includes(newAdminEmail)) {
                            setAdminList([...adminList, newAdminEmail]);
                            setNewAdminEmail('');
                          }
                        }} className="flex gap-3 mb-8">
                          <input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Nhập email mới..." className="flex-1 px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
                          <button type="submit" className="bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center hover:bg-slate-900 transition-all"><Plus size={18} className="mr-1"/> Thêm</button>
                        </form>
                        <div className="space-y-3">
                          {adminList.map(email => (
                            <div key={email} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:border-slate-300">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-white border rounded-full flex items-center justify-center text-slate-400"><User size={16} /></div>
                                <span className="text-sm font-bold text-slate-700">{email}</span>
                              </div>
                              {email !== ROOT_ADMIN_EMAIL && (
                                <button onClick={() => setAdminList(adminList.filter(e => e !== email))} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={20}/></button>
                              )}
                              {email === ROOT_ADMIN_EMAIL && <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Chủ sở hữu</span>}
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