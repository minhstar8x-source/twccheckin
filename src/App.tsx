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
  History,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
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
  signInWithRedirect, 
  getRedirectResult, 
  signOut 
} from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, writeBatch } from 'firebase/firestore';

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

// Helper lấy ngày YYYY-MM-DD theo giờ địa phương
const getLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
  const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('day'); 
  const [chartFocusDate, setChartFocusDate] = useState(() => getLocalDateString(new Date()));
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

  // --- MANUAL & IMPORT STATE ---
  const [manualDate, setManualDate] = useState('');
  const [manualStaff, setManualStaff] = useState(1);
  const [manualCustomer, setManualCustomer] = useState(0);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

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
      const regex = /^[0-9]{0,12}$/; 
      if (!regex.test(value)) return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date();
    const dateStr = getLocalDateString(today); // Dùng giờ địa phương

    const newCheckIn = {
      ...formData,
      id: Date.now(),
      date: dateStr,
      timestamp: today.toLocaleString('vi-VN'),
      hasCustomer: hasCustomer,
      customerName: hasCustomer ? formData.customerName : '',
      customerPhone: hasCustomer ? (formData.customerPhone.length > 4 ? formData.customerPhone.slice(-4) : formData.customerPhone) : '',
      customerAge: hasCustomer ? formData.customerAge : '',
      customerCount: hasCustomer ? parseInt(String(formData.customerCount)) || 0 : 0,
      staffCount: parseInt(String(formData.staffCount)) || 1,
      staffPhone: formData.staffPhone.length > 4 ? formData.staffPhone.slice(-4) : formData.staffPhone
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

  // --- BULK IMPORT LOGIC ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      processCSV(content);
    };
    reader.readAsText(file);
  };

  const processCSV = async (csvText: string) => {
    setImportLoading(true);
    setImportProgress(0);
    
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) {
      alert("Tệp không có dữ liệu.");
      setImportLoading(false);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const idx = {
      ts: headers.findIndex(h => h.includes("dấu thời gian")),
      agency: headers.findIndex(h => h.includes("tên đơn vị")),
      staff: headers.findIndex(h => h.includes("họ và tên cvtv")),
      sPhone: headers.findIndex(h => h.includes("số điện thoại cvtv")),
      cName: headers.findIndex(h => h.includes("tên khách hàng")),
      cCount: headers.findIndex(h => h.includes("số lượng khách hàng")),
      cPhone: headers.findIndex(h => h.includes("số điện thoại kh")),
      age: headers.findIndex(h => h.includes("độ tuổi")),
      sCount: headers.findIndex(h => h.includes("số lượng cvtv"))
    };

    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');
    const dataRows = lines.slice(1);
    const total = dataRows.length;
    
    let batch = writeBatch(db);
    let count = 0;

    try {
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i].match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g) || [];
        if (row.length < 3) continue;

        const clean = (val: string) => val ? val.replace(/"/g, '').trim() : '';
        
        const timestampRaw = clean(row[idx.ts]);
        const dateObj = new Date(timestampRaw.replace(/-/g, "/")); // Chống lỗi parse ngày trên một số trình duyệt
        const dateStr = !isNaN(dateObj.getTime()) ? getLocalDateString(dateObj) : getLocalDateString(new Date());

        const docData = {
          id: Date.now() + i,
          date: dateStr,
          timestamp: timestampRaw || new Date().toLocaleString('vi-VN'),
          agencyName: clean(row[idx.agency]),
          staffName: clean(row[idx.staff]),
          staffPhone: clean(row[idx.sPhone]).slice(-4),
          staffCount: parseInt(clean(row[idx.sCount])) || 1,
          customerName: clean(row[idx.cName]),
          customerCount: parseInt(clean(row[idx.cCount])) || 0,
          customerPhone: clean(row[idx.cPhone]).slice(-4),
          customerAge: clean(row[idx.age]),
          hasCustomer: (parseInt(clean(row[idx.cCount])) || 0) > 0,
          isImported: true
        };

        const newDocRef = doc(collectionPath);
        batch.set(newDocRef, docData);
        
        count++;
        if (count % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
          setImportProgress(Math.round((i / total) * 100));
        }
      }
      
      await batch.commit();
      setImportProgress(100);
      setTimeout(() => {
        setImportLoading(false);
        alert(`Đã nhập thành công ${count} dòng dữ liệu!`);
        setAdminSubTab('list');
      }, 500);
    } catch (err: any) {
      alert("Lỗi khi nhập dữ liệu: " + err.message);
      setImportLoading(false);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm("CẢNH BÁO NGUY HIỂM: Hành động này sẽ xóa vĩnh viễn TOÀN BỘ dữ liệu check-in trong hệ thống. Bạn có chắc chắn muốn thực hiện?")) return;
    
    setImportLoading(true);
    setImportProgress(0);
    let count = 0;
    const total = checkIns.length;

    try {
      let batch = writeBatch(db);
      for (const item of checkIns) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins', item.firebaseId);
        batch.delete(docRef);
        count++;

        if (count % 450 === 0) {
          await batch.commit();
          batch = writeBatch(db);
          setImportProgress(Math.round((count / total) * 100));
        }
      }

      if (count % 450 !== 0) {
        await batch.commit();
      }

      setImportProgress(100);
      setTimeout(() => {
        setImportLoading(false);
        alert(`Đã xóa sạch toàn bộ ${count} dòng dữ liệu.`);
      }, 500);
    } catch (err: any) {
      alert("Lỗi khi xóa: " + err.message);
      setImportLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate) return;
    
    const targetDate = new Date(manualDate.replace(/-/g, "/"));
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
    // Tạo baseDate từ chartFocusDate một cách an toàn (tránh lệch UTC)
    const [y, m, d] = chartFocusDate.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);
    baseDate.setHours(0,0,0,0);

    if (chartView === 'day') {
      const dayNum = baseDate.getDay();
      const diffToMonday = dayNum === 0 ? -6 : 1 - dayNum;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() + diffToMonday);

      for (let i = 0; i < 7; i++) {
        const d_temp = new Date(monday);
        d_temp.setDate(monday.getDate() + i);
        const dateStr = getLocalDateString(d_temp);
        dataMap[dateStr] = { 
          key: dateStr, 
          label: `${d_temp.getDate()}/${d_temp.getMonth()+1}`, 
          customers: 0, staff: 0, sortIndex: i 
        };
      }
    } else if (chartView === 'week') {
      const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const firstMonday = new Date(monthStart);
      const startDay = monthStart.getDay();
      const diffToFirstMonday = startDay === 0 ? -6 : 1 - startDay;
      firstMonday.setDate(monthStart.getDate() + diffToFirstMonday);

      for (let i = 0; i < 5; i++) {
        const start = new Date(firstMonday);
        start.setDate(firstMonday.getDate() + (i * 7));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const key = `week-${i}`;
        dataMap[key] = {
          key, label: `Từ ${start.getDate()}/${start.getMonth()+1}`,
          customers: 0, staff: 0, sortIndex: i, startDate: new Date(start), endDate: new Date(end)
        };
      }
    } else {
      for (let i = -3; i <= 2; i++) {
        const d_temp = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
        const key = `${d_temp.getFullYear()}-${d_temp.getMonth() + 1}`;
        dataMap[key] = { 
          key, label: `T${d_temp.getMonth() + 1}/${d_temp.getFullYear()}`, 
          customers: 0, staff: 0, sortIndex: i + 3 
        };
      }
    }

    checkIns.forEach((item: any) => {
      if (chartView === 'day') {
        if (dataMap[item.date]) {
          dataMap[item.date].customers += (item.customerCount || 0);
          dataMap[item.date].staff += (item.staffCount || 0);
        }
      } else if (chartView === 'week') {
        const [iy, im, id] = item.date.split('-').map(Number);
        const itemDate = new Date(iy, im - 1, id);
        itemDate.setHours(0,0,0,0);

        Object.values(dataMap).forEach((bucket: any) => {
          if (bucket.startDate && itemDate >= bucket.startDate && itemDate <= bucket.endDate) {
            bucket.customers += (item.customerCount || 0);
            bucket.staff += (item.staffCount || 0);
          }
        });
      } else {
        const [iy, im] = item.date.split('-').map(Number);
        const key = `${iy}-${im}`;
        if (dataMap[key]) {
          dataMap[key].customers += (item.customerCount || 0);
          dataMap[key].staff += (item.staffCount || 0);
        }
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView, chartFocusDate]);

  const baseMax = Math.max(5, ...chartData.map((d: any) => Math.max(d.customers, d.staff)));
  const maxChartValue = Math.ceil(baseMax * 1.5);

  const isFormValid = useMemo(() => {
    const staffOk = formData.agencyName.trim() !== '' && formData.staffName.trim() !== '' && formData.staffPhone.length >= 4;
    if (!hasCustomer) return staffOk;
    return staffOk && formData.customerName.trim() !== '' && formData.customerPhone.length >= 4 && formData.customerAge !== '';
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
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Gallery_Chart_${new Date().getTime()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExporting(false);
      } catch (e) {
        alert("Lỗi: Không thể lưu ảnh.");
        setIsExporting(false);
      }
    };

    if (typeof (w as any).html2canvas !== 'undefined') {
      runExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => runExport();
      document.head.appendChild(script);
    }
  };

  const exportToExcel = () => {
    const headers = ['Thời gian', 'Đơn vị', 'CVKD', 'SL CVKD', 'Khách', 'SL Khách', 'Tổng'];
    const rows = filteredCheckIns.map(item => [
      item.timestamp, item.agencyName, item.staffName, item.staffCount, 
      item.hasCustomer ? item.customerName : 'N/A', 
      item.customerCount, 
      (item.staffCount || 0) + (item.customerCount || 0)
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

      {importLoading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-80 text-center animate-in zoom-in-95">
             <div className="w-16 h-16 border-4 border-orange-100 border-t-[#ea580c] rounded-full animate-spin mx-auto mb-4"></div>
             <h3 className="font-bold text-slate-800 mb-1">Đang xử lý dữ liệu</h3>
             <p className="text-xs text-slate-500 mb-4">Vui lòng không đóng trình duyệt</p>
             <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                <div className="bg-[#ea580c] h-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
             </div>
             <p className="text-[10px] font-bold text-[#ea580c]">{importProgress}% hoàn thành</p>
          </div>
        </div>
      )}

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
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase drop-shadow-lg text-white" style={{ color: '#ffffff' }}>CHECK IN THE WIN CITY GALLERY</h2>
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
                      <input type="text" name="staffPhone" required minLength={4} value={formData.staffPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-none" placeholder="8888" />
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
                        <input type="text" name="customerPhone" required={hasCustomer} minLength={4} value={formData.customerPhone} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#ea580c]" />
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
                  <div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto overflow-x-auto whitespace-nowrap text-center">
                    <button onClick={() => setAdminSubTab('list')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'list' ? 'bg-[#ea580c]' : ''}`}>Danh sách</button>
                    <button onClick={() => setAdminSubTab('chart')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'chart' ? 'bg-[#ea580c]' : ''}`}>Thống kê</button>
                    <button onClick={() => setAdminSubTab('manual')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'manual' ? 'bg-[#ea580c]' : ''}`}>Nhập liệu cũ</button>
                    <button onClick={() => setAdminSubTab('import')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'import' ? 'bg-[#ea580c]' : ''}`}>Nhập Excel/CSV</button>
                    {adminEmail === ROOT_ADMIN_EMAIL && <button onClick={() => setAdminSubTab('settings')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'settings' ? 'bg-[#ea580c]' : ''}`}>Cài đặt</button>}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex-1 overflow-auto">
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
                                  <td className="p-4 text-center font-extrabold text-[#ea580c]">{(item.staffCount || 0) + (item.customerCount || 0)}</td>
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

                  {adminSubTab === 'chart' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border animate-in fade-in">
                      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
                        <div className="flex items-center space-x-3">
                          <BarChart3 size={24} className="text-[#ea580c]" />
                          <h3 className="font-bold text-lg text-slate-800">Thống kê lưu lượng khách</h3>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-lg border">
                            <button 
                              onClick={() => {
                                const [y, m, d] = chartFocusDate.split('-').map(Number);
                                const date = new Date(y, m - 1, d);
                                date.setDate(date.getDate() - 7);
                                setChartFocusDate(getLocalDateString(date));
                              }}
                              className="p-1 hover:bg-white rounded shadow-sm transition-all"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <input 
                              type="date" 
                              value={chartFocusDate} 
                              onChange={(e) => setChartFocusDate(e.target.value)}
                              className="bg-transparent text-xs font-bold outline-none border-none focus:ring-0 p-0 w-28 text-center"
                            />
                            <button 
                              onClick={() => {
                                const [y, m, d] = chartFocusDate.split('-').map(Number);
                                const date = new Date(y, m - 1, d);
                                date.setDate(date.getDate() + 7);
                                setChartFocusDate(getLocalDateString(date));
                              }}
                              className="p-1 hover:bg-white rounded shadow-sm transition-all"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>

                          <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setChartView('day')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === 'day' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Tuần</button>
                            <button onClick={() => setChartView('week')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === 'week' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Tháng</button>
                            <button onClick={() => setChartView('month')} className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === 'month' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Năm</button>
                          </div>

                          <button onClick={exportChartImage} disabled={isExporting} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow hover:bg-slate-900 transition-all ml-auto xl:ml-0">
                            {isExporting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Camera size={14} className="mr-1"/>} {isExporting ? 'Đang lưu...' : 'Lưu ảnh'}
                          </button>
                        </div>
                      </div>
                      
                      <div id="admin-chart-container" className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-inner relative overflow-hidden">
                        <div className="absolute top-10 right-10 flex space-x-4 text-[10px] font-bold z-20 text-center">
                          <div className="flex items-center space-x-1.5 text-orange-400"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></div><span>Khách</span></div>
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
                          <div className="absolute top-16 bottom-12 left-20 right-4 flex flex-col justify-between pointer-events-none text-center">
                            {[0, 1, 2, 3, 4].map((_, idx) => (
                              <div key={idx} className="w-full border-t border-slate-700/20 border-dashed text-center"></div>
                            ))}
                          </div>

                          <div className="flex-1 flex items-end justify-around relative z-10 h-full text-center">
                            {chartData.map((d: any) => (
                              <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group text-center">
                                <div className="flex items-end justify-center space-x-1 w-full h-full text-center">
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

                  {adminSubTab === 'import' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in">
                      <div className="bg-white p-8 rounded-xl shadow-sm border text-center">
                        <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-center">
                          <FileSpreadsheet size={40} className="text-[#ea580c] text-center" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Nhập dữ liệu từ Excel/CSV</h3>
                        <p className="text-slate-500 text-sm mb-8 text-center">Hệ thống sẽ tự động đồng bộ hóa các cột thông tin từ tệp Excel của Thắng Lợi Group Gallery.</p>
                        
                        {importLoading ? (
                          <div className="space-y-4 text-center">
                            <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden text-center">
                              <div className="bg-[#ea580c] h-full transition-all duration-300 text-center" style={{ width: `${importProgress}%` }}></div>
                            </div>
                            <p className="text-sm font-bold text-[#ea580c] text-center">Đang xử lý... {importProgress}%</p>
                          </div>
                        ) : (
                          <div className="space-y-6 text-center">
                            <label className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-12 hover:border-[#ea580c] hover:bg-orange-50/30 transition-all cursor-pointer text-center">
                              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                              <Upload className="mx-auto text-slate-400 mb-4" size={32} />
                              <span className="block font-bold text-slate-700 mb-1 text-center">Bấm để chọn tệp CSV</span>
                              <span className="text-xs text-slate-400 uppercase tracking-widest font-bold text-center">Chỉ hỗ trợ định dạng .CSV</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {adminSubTab === 'settings' && (
                    <div className="max-w-2xl mx-auto animate-in fade-in text-center">
                      <div className="bg-white p-8 rounded-xl border shadow-sm space-y-8 text-center">
                        <div>
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
                          }} className="flex gap-3 mb-8 text-center">
                            <input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Nhập email mới..." className="flex-1 px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
                            <button type="submit" className="bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center hover:bg-slate-900 transition-all"><Plus size={18} className="mr-1"/> Thêm</button>
                          </form>
                        </div>

                        {adminEmail === ROOT_ADMIN_EMAIL && (
                          <div className="pt-8 border-t border-red-100 text-center">
                             <div className="flex items-center space-x-3 mb-4 text-red-600 text-center">
                               <AlertTriangle size={24} />
                               <h3 className="font-bold text-lg uppercase tracking-tight">Khu vực nguy hiểm</h3>
                             </div>
                             <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                                <p className="text-sm text-red-800 font-medium mb-4 text-center">
                                  Hành động này sẽ xóa sạch toàn bộ {checkIns.length} dòng dữ liệu đã lưu trong hệ thống.
                                </p>
                                <button 
                                  onClick={handleClearAllData}
                                  className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-red-700 transition-all shadow-lg text-center"
                                >
                                  <Trash2 size={20} />
                                  <span>Xóa Sạch Toàn Bộ Dữ Liệu</span>
                                </button>
                             </div>
                          </div>
                        )}
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