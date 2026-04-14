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

// Chuẩn hóa chuỗi độ tuổi (từ Form và CSV)
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
  '< 25': 'bg-rose-400',
  '25-35': 'bg-amber-400',
  '36-45': 'bg-emerald-400',
  '46-55': 'bg-blue-400',
  '> 55': 'bg-violet-400',
  'Khác': 'bg-slate-400'
};

// Trình phân tích CSV chuẩn xác
const parseCSVRow = (str: string) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
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
  
  const [adminSubTab, setAdminSubTab] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('twc_adminSubTab') : 'list';
    return ['list', 'chart', 'settings'].includes(saved || '') ? saved || 'list' : 'list';
  }); 

  useEffect(() => {
    localStorage.setItem('twc_adminSubTab', adminSubTab);
  }, [adminSubTab]);

  const [chartView, setChartView] = useState<'day' | 'week' | 'month'>('day'); 
  const [chartMetric, setChartMetric] = useState<'role' | 'age'>('role'); // State mới cho loại biểu đồ
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
      } catch (error: any) {
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
    
    // GIẢI PHÁP TỐI THƯỢNG: NGẮT KẾT NỐI KHI ĐANG XỬ LÝ NHIỀU DỮ LIỆU
    // Nếu đang xóa sạch hoặc nhập file, ta huỷ listener để Firebase không làm đơ giao diện
    if (importLoading) return;

    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');
    const unsubscribe = onSnapshot(collectionPath, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ firebaseId: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => b.id - a.id); 
      setCheckIns(data);
    }, (error: any) => {
      console.error("Firestore Error:", error);
    });
    
    return () => unsubscribe();
  }, [user, importLoading]); // Phụ thuộc vào importLoading

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
    const dateStr = getLocalDateString(today);

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
    
    const lines = csvText.split(/\r?\n/).filter((line: string) => line.trim() !== "");
    if (lines.length < 2) {
      alert("Tệp không có dữ liệu.");
      setImportLoading(false);
      return;
    }

    const headers = parseCSVRow(lines[0]).map((h: string) => h.toLowerCase());
    
    const idx = {
      ts: headers.findIndex((h: string) => h.includes("dấu thời gian") || h.includes("thời gian")),
      date: headers.findIndex((h: string) => h.includes("ngày tham quan") || h.includes("ngày")),
      agency: headers.findIndex((h: string) => h.includes("tên đơn vị") || h.includes("đại lý")),
      staff: headers.findIndex((h: string) => h.includes("họ và tên cvtv") || h.includes("tên cvkd")),
      sPhone: headers.findIndex((h: string) => h.includes("số điện thoại cvtv") || h.includes("sđt cvkd") || h.includes("điện thoại cvtv")),
      cName: headers.findIndex((h: string) => h.includes("tên khách hàng") || h.includes("tên khách")),
      cCount: headers.findIndex((h: string) => h.includes("số lượng khách hàng") || h.includes("sl khách") || h.includes("số lượng khách")),
      cPhone: headers.findIndex((h: string) => h.includes("số điện thoại kh") || h.includes("sđt kh") || h.includes("điện thoại kh")),
      age: headers.findIndex((h: string) => h.includes("độ tuổi") || h.includes("tuổi")),
      sCount: headers.findIndex((h: string) => h.includes("số lượng cvtv") || h.includes("sl cvkd") || h.includes("số lượng cv"))
    };

    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins');
    const dataRows = lines.slice(1);
    const total = dataRows.length;
    
    let batch = writeBatch(db);
    let batchCount = 0;
    let validCount = 0;

    try {
      for (let i = 0; i < dataRows.length; i++) {
        const row = parseCSVRow(dataRows[i]);

        if (row.length < 3) continue;

        const getStr = (index: number) => (index !== -1 && row[index] !== undefined && row[index] !== null) ? String(row[index]).trim() : '';
        const getNum = (index: number, defaultVal: number) => {
          const val = parseInt(getStr(index));
          return isNaN(val) ? defaultVal : val;
        };

        const timestampRaw = getStr(idx.ts);
        const dateRaw = getStr(idx.date);
        
        let dateStr = '';
        const strToParse = timestampRaw || dateRaw;

        if (strToParse) {
          const matchYMD = strToParse.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
          const matchDMY = strToParse.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);

          if (matchYMD) {
            dateStr = `${matchYMD[1]}-${matchYMD[2].padStart(2, '0')}-${matchYMD[3].padStart(2, '0')}`;
          } else if (matchDMY) {
            dateStr = `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
          } else {
            const dateObj = new Date(strToParse.replace(/-/g, "/"));
            if (!isNaN(dateObj.getTime())) {
              dateStr = getLocalDateString(dateObj);
            }
          }
        }

        if (!dateStr) continue;

        const docData = {
          id: Date.now() + i,
          date: dateStr,
          timestamp: timestampRaw || dateStr || new Date().toLocaleString('vi-VN'),
          agencyName: getStr(idx.agency) || 'N/A',
          staffName: getStr(idx.staff) || 'N/A',
          staffPhone: getStr(idx.sPhone).slice(-4),
          staffCount: getNum(idx.sCount, 1),
          customerName: getStr(idx.cName),
          customerCount: getNum(idx.cCount, 0),
          customerPhone: getStr(idx.cPhone).slice(-4),
          customerAge: getStr(idx.age),
          hasCustomer: getNum(idx.cCount, 0) > 0,
          isImported: true
        };

        const newDocRef = doc(collectionPath);
        batch.set(newDocRef, docData);
        
        batchCount++;
        validCount++;

        // Chia chunk 100 dòng
        if (batchCount >= 100) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          setImportProgress(Math.round(((i + 1) / total) * 100));
          await new Promise(r => setTimeout(r, 100)); 
        } else if (i % 25 === 0) {
          setImportProgress(Math.round(((i + 1) / total) * 100));
          await new Promise(r => setTimeout(r, 5));
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }

      setImportProgress(100);
      setTimeout(() => {
        setImportLoading(false);
        alert(`Đã nhập thành công ${validCount} dòng dữ liệu hợp lệ!`);
        setAdminSubTab('list');
      }, 500);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi khi nhập dữ liệu: " + err.message);
      setImportLoading(false);
    }
  };

  // NÂNG CẤP XÓA SẠCH DỮ LIỆU CHỐNG TREO
  const handleClearAllData = async () => {
    if (!window.confirm("CẢNH BÁO NGUY HIỂM: Hành động này sẽ xóa vĩnh viễn TOÀN BỘ dữ liệu check-in trong hệ thống. Bạn có chắc chắn muốn thực hiện?")) return;
    
    // Lưu lại danh sách ID cần xóa vào bộ nhớ đệm trước khi cờ Loading bật
    const itemsToDelete = [...checkIns];
    const total = itemsToDelete.length;

    if (total === 0) {
      alert("Chưa có dữ liệu nào để xóa.");
      return;
    }

    // Khi bật cái này lên, useEffect trên kia sẽ tự động TẮT Firebase OnSnapshot
    setImportLoading(true);
    setImportProgress(0);

    try {
      const chunkSize = 50; // Giảm xuống 50 để chạy siêu an toàn
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = itemsToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(item => {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins', item.firebaseId);
          batch.delete(docRef);
        });

        await batch.commit();
        setImportProgress(Math.round(((i + chunk.length) / total) * 100));
        await new Promise(r => setTimeout(r, 100)); // Nhường luồng cho UI chạy progress bar
      }

      setTimeout(() => {
        setImportLoading(false); // Khi xong mới bật OnSnapshot chạy lại
        alert(`Đã xóa sạch toàn bộ ${total} dòng dữ liệu.`);
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
    if (importLoading) return []; 
    return checkIns.filter((item: any) => {
      const matchDate = filterDate ? item.date === filterDate : true;
      let matchType = true;
      if (filterType === 'customer_only') matchType = item.hasCustomer;
      if (filterType === 'staff_only') matchType = !item.hasCustomer;
      return matchDate && matchType;
    });
  }, [checkIns, filterDate, filterType, importLoading]);

  const chartData = useMemo<any[]>(() => {
    if (importLoading) return []; 

    const dataMap: any = {};
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
        dataMap[dateStr] = { key: dateStr, label: `${d_temp.getDate()}/${d_temp.getMonth()+1}`, sortIndex: i };
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
        dataMap[key] = { key, label: `Từ ${start.getDate()}/${start.getMonth()+1}`, sortIndex: i, startDate: new Date(start), endDate: new Date(end) };
      }
    } else {
      for (let i = -3; i <= 2; i++) {
        const d_temp = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
        const key = `${d_temp.getFullYear()}-${d_temp.getMonth() + 1}`;
        dataMap[key] = { key, label: `T${d_temp.getMonth() + 1}/${d_temp.getFullYear()}`, sortIndex: i + 3 };
      }
    }

    Object.values(dataMap).forEach((bucket: any) => {
      bucket.customers = 0; bucket.staff = 0;
      AGE_GROUPS.forEach(ag => bucket[ag] = 0);
    });

    checkIns.forEach((item: any) => {
      let targetBucket: any = null;

      if (chartView === 'day') {
        targetBucket = dataMap[item.date];
      } else if (chartView === 'week') {
        const [iy, im, id] = item.date.split('-').map(Number);
        const itemDate = new Date(iy, im - 1, id);
        itemDate.setHours(0,0,0,0);
        targetBucket = Object.values(dataMap).find((b: any) => b.startDate && itemDate >= b.startDate && itemDate <= b.endDate);
      } else {
        const [iy, im] = item.date.split('-').map(Number);
        targetBucket = dataMap[`${iy}-${im}`];
      }

      if (targetBucket) {
        targetBucket.customers += (item.customerCount || 0);
        targetBucket.staff += (item.staffCount || 0);
        
        if (item.hasCustomer && item.customerCount > 0) {
          const ageGroup = normalizeAge(item.customerAge);
          targetBucket[ageGroup] += (item.customerCount || 0);
        }
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView, chartFocusDate, chartMetric, importLoading]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 5;
    if (chartMetric === 'role') {
      const baseMax = Math.max(5, ...chartData.map(d => Math.max(d.customers, d.staff)));
      return Math.ceil(baseMax * 1.4); 
    } else {
      const baseMax = Math.max(5, ...chartData.map(d => AGE_GROUPS.reduce((sum, ag) => sum + d[ag], 0)));
      return Math.ceil(baseMax * 1.2); 
    }
  }, [chartData, chartMetric]);

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
      } catch (e: any) {
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
    const rows = filteredCheckIns.map((item: any) => [
      item.timestamp, item.agencyName, item.staffName, item.staffCount, 
      item.hasCustomer ? item.customerName : 'N/A', 
      item.customerCount, 
      (item.staffCount || 0) + (item.customerCount || 0)
    ]);
    const csvContent = "\ufeff" + [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
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
             <h3 className="font-bold text-slate-800 mb-1">Đang đồng bộ dữ liệu</h3>
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
                    {adminEmail === ROOT_ADMIN_EMAIL && <button onClick={() => setAdminSubTab('settings')} className={`flex-1 px-4 py-1.5 text-sm font-semibold rounded-md ${adminSubTab === 'settings' ? 'bg-[#ea580c]' : ''}`}>Cài đặt hệ thống</button>}
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
                            {importLoading ? (
                              <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-semibold animate-pulse">Hệ thống đang đồng bộ. Bảng tạm ẩn để chống đơ trình duyệt...</td></tr>
                            ) : filteredCheckIns.length === 0 ? (
                              <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic">Không tìm thấy dữ liệu</td></tr>
                            ) : (
                              filteredCheckIns.map((item: any) => (
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
                          <div>
                            <h3 className="font-bold text-lg text-slate-800">Thống kê lưu lượng khách</h3>
                            <p className="text-xs font-medium text-slate-500">
                              {chartView === 'day' && chartData.length > 0 
                                ? `Tuần từ ${chartData[0].label} đến ${chartData[chartData.length - 1].label}` 
                                : chartView === 'week' ? '5 tuần gần nhất' : '6 tháng gần nhất'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                          
                          {/* Nút Chọn Loại Biểu Đồ (Đối tượng / Độ tuổi) */}
                          <div className="flex bg-slate-100 p-1 rounded-lg mr-2 border border-slate-200">
                            <button 
                              onClick={() => setChartMetric('role')} 
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartMetric === 'role' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              Theo Đối tượng
                            </button>
                            <button 
                              onClick={() => setChartMetric('age')} 
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartMetric === 'age' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              Theo Độ tuổi
                            </button>
                          </div>

                          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                            <button 
                              onClick={() => {
                                const [y, m, d] = chartFocusDate.split('-').map(Number);
                                const date = new Date(y, m - 1, d);
                                date.setDate(date.getDate() - (chartView === 'day' ? 7 : chartView === 'week' ? 35 : 180));
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
                                date.setDate(date.getDate() + (chartView === 'day' ? 7 : chartView === 'week' ? 35 : 180));
                                setChartFocusDate(getLocalDateString(date));
                              }}
                              className="p-1 hover:bg-white rounded shadow-sm transition-all"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>

                          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            {['day', 'week', 'month'].map((view: string) => (
                              <button 
                                key={view}
                                onClick={() => setChartView(view as 'day' | 'week' | 'month')} 
                                className={`px-4 py-1.5 text-xs font-bold rounded-md ${chartView === view ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                              >
                                {view === 'day' ? 'Tuần' : view === 'week' ? 'Tháng' : 'Năm'}
                              </button>
                            ))}
                          </div>

                          <button onClick={exportChartImage} disabled={isExporting} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow hover:bg-slate-900 transition-all ml-auto xl:ml-0">
                            {isExporting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Camera size={14} className="mr-1"/>} {isExporting ? 'Đang lưu...' : 'Lưu ảnh'}
                          </button>
                        </div>
                      </div>
                      
                      <div id="admin-chart-container" className="bg-slate-900 rounded-2xl pt-6 pr-6 pb-2 pl-2 border border-slate-800 shadow-inner relative overflow-hidden">
                        
                        {/* CHÚ THÍCH BIỂU ĐỒ (Thay đổi tùy theo loại biểu đồ) */}
                        <div className="absolute top-6 right-6 flex flex-wrap justify-end gap-3 text-[10px] font-bold z-20 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                          {chartMetric === 'role' ? (
                            <>
                              <div className="flex items-center space-x-1.5 text-orange-400"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></div><span>Khách</span></div>
                              <div className="flex items-center space-x-1.5 text-cyan-400"><div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm"></div><span>CVKD</span></div>
                            </>
                          ) : (
                            AGE_GROUPS.map(ag => (
                              <div key={ag} className="flex items-center space-x-1.5 text-slate-200">
                                <div className={`w-2.5 h-2.5 rounded-sm ${AGE_COLORS[ag]}`}></div>
                                <span>{ag}</span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="h-80 flex relative pl-16 pr-4 pb-12 pt-12">
                          <div className="absolute top-0 left-4 text-cyan-500 font-bold text-[10px] uppercase opacity-60">Số lượng</div>
                          
                          {/* Y-Axis Labels */}
                          <div className="absolute top-12 bottom-12 left-0 w-14 flex flex-col justify-between items-end pr-2 pointer-events-none">
                            {[maxChartValue, Math.ceil(maxChartValue * 0.75), Math.ceil(maxChartValue * 0.5), Math.ceil(maxChartValue * 0.25), 0].map((val: number, idx: number) => (
                              <span key={idx} className="text-[10px] text-slate-400 font-bold leading-none translate-y-1/2">{val}</span>
                            ))}
                          </div>

                          {/* Chart Area with Grid and Axes */}
                          <div className="flex-1 relative border-l-[3px] border-b-[3px] border-slate-400">
                            {/* Horizontal Grids (Lưới mờ) */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                              {[0, 1, 2, 3, 4].map((_: number, idx: number) => (
                                <div key={idx} className="w-full border-t border-slate-500/40 border-dashed"></div>
                              ))}
                            </div>

                            {/* BARS: Hiển thị tùy loại */}
                            <div className="absolute inset-0 flex items-end justify-around">
                              {importLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs uppercase tracking-widest animate-pulse font-bold">
                                  Hệ thống đang tạm ngừng vẽ biểu đồ để tập trung đẩy dữ liệu...
                                </div>
                              ) : chartData.map((d: any) => {
                                const stackedTotal = AGE_GROUPS.reduce((sum, ag) => sum + d[ag], 0);

                                return (
                                <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group justify-end pb-[1px]">
                                  {chartMetric === 'role' ? (
                                    // BIỂU ĐỒ CVKD & KHÁCH (CỘT SONG SONG)
                                    <div className="flex items-end justify-center space-x-1 sm:space-x-2 w-full h-full relative z-10">
                                      <div style={{ height: `${d.customers === 0 ? 0 : Math.max((d.customers / maxChartValue) * 100, 4)}%` }} className="w-full max-w-[28px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-sm shadow-[0_0_10px_rgba(234,88,12,0.3)] relative transition-all group-hover:brightness-125">
                                        {d.customers > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-400">{d.customers}</span>}
                                      </div>
                                      <div style={{ height: `${d.staff === 0 ? 0 : Math.max((d.staff / maxChartValue) * 100, 4)}%` }} className="w-full max-w-[28px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm shadow-[0_0_10px_rgba(6,182,212,0.3)] relative transition-all group-hover:brightness-125">
                                        {d.staff > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-cyan-400">{d.staff}</span>}
                                      </div>
                                    </div>
                                  ) : (
                                    // BIỂU ĐỒ ĐỘ TUỔI KHÁCH HÀNG (CỘT CHỒNG - STACKED)
                                    <div className="flex flex-col-reverse items-center justify-start w-full h-full relative z-10 max-w-[32px]">
                                      {AGE_GROUPS.map(ag => {
                                        const val = d[ag];
                                        if (val === 0) return null;
                                        const heightPct = (val / maxChartValue) * 100;
                                        return (
                                          <div key={ag} style={{ height: `${heightPct}%` }} className={`w-full ${AGE_COLORS[ag]} relative border-t border-slate-900/30 transition-all hover:brightness-110 flex items-center justify-center min-h-[4px]`}>
                                            {/* Chỉ hiện số lượng nếu cột đủ cao để không bị đè chữ */}
                                            {heightPct > 8 && <span className="text-[10px] font-bold text-slate-900 drop-shadow-sm">{val}</span>}
                                          </div>
                                        )
                                      })}
                                      {/* Hiện tổng khách trên cùng */}
                                      {stackedTotal > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-300">{stackedTotal}</span>}
                                    </div>
                                  )}
                                  <span className="absolute -bottom-8 text-[9px] font-bold text-slate-400 text-center w-full leading-tight whitespace-pre-wrap px-1">{d.label}</span>
                                </div>
                              )})}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {adminSubTab === 'settings' && adminEmail === ROOT_ADMIN_EMAIL && (
                    <div className="animate-in fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Cột 1: Quản lý Quản trị viên & Nhập liệu thủ công */}
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                          <div className="flex items-center space-x-3 mb-6 text-slate-800">
                            <Settings size={20} className="text-slate-500" />
                            <h3 className="font-bold text-lg">Quản lý Quản trị viên</h3>
                          </div>
                          <form onSubmit={e => {
                            e.preventDefault();
                            if (newAdminEmail && !adminList.includes(newAdminEmail)) {
                              setAdminList([...adminList, newAdminEmail]);
                              setNewAdminEmail('');
                            }
                          }} className="flex gap-2 mb-6">
                            <input type="email" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Thêm email admin..." className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-300" />
                            <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-slate-900 transition-all"><Plus size={16}/></button>
                          </form>
                          
                          <div className="space-y-2">
                            {adminList.map((email: string) => (
                              <div key={email} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 transition-all hover:border-slate-300">
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 bg-white border rounded-full flex items-center justify-center text-slate-400"><UserIcon size={12} /></div>
                                  <span className="text-sm font-bold text-slate-700">{email}</span>
                                </div>
                                {email !== ROOT_ADMIN_EMAIL && (
                                  <button onClick={() => setAdminList(adminList.filter((e: string) => e !== email))} className="text-slate-300 hover:text-red-500 p-1.5 transition-colors"><Trash2 size={16}/></button>
                                )}
                                {email === ROOT_ADMIN_EMAIL && <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Chủ</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                          <div className="flex items-center space-x-3 mb-4 text-slate-800">
                            <History size={20} className="text-[#ea580c]" />
                            <h3 className="font-bold text-lg">Cập nhật dữ liệu quá khứ</h3>
                          </div>
                          <p className="text-slate-500 text-xs mb-6">Bù đắp số liệu cho các ngày chưa sử dụng hệ thống.</p>
                          
                          <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">Chọn ngày</label>
                              <input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#ea580c]" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Lượng CVKD</label>
                                <input type="number" min="0" required value={manualStaff} onChange={e => setManualStaff(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#ea580c]" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Lượng Khách</label>
                                <input type="number" min="0" required value={manualCustomer} onChange={e => setManualCustomer(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#ea580c]" />
                              </div>
                            </div>
                            <button type="submit" className="w-full bg-[#ea580c] text-white py-2 rounded-lg text-sm font-bold shadow hover:bg-[#c2410c] transition-all flex items-center justify-center gap-2 mt-2">
                              <Plus size={16} /> Thêm dữ liệu
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Cột 2: Nhập Excel & Clear Data */}
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border shadow-sm text-center">
                          <div className="bg-orange-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileSpreadsheet size={32} className="text-[#ea580c]" />
                          </div>
                          <h3 className="text-lg font-bold mb-2">Nhập dữ liệu từ Excel/CSV</h3>
                          <p className="text-slate-500 text-xs mb-6">Hệ thống sẽ tự động đồng bộ hóa các cột thông tin từ tệp Excel của Thắng Lợi Group Gallery.</p>
                          
                          {importLoading ? (
                            <div className="space-y-3">
                              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                                <div className="bg-[#ea580c] h-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                              </div>
                              <p className="text-xs font-bold text-[#ea580c]">Đang xử lý... {importProgress}%</p>
                            </div>
                          ) : (
                            <label className="block w-full border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-[#ea580c] hover:bg-orange-50/30 transition-all cursor-pointer">
                              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                              <Upload className="mx-auto text-slate-400 mb-3" size={24} />
                              <span className="block font-bold text-sm text-slate-700 mb-1">Bấm để chọn tệp CSV</span>
                            </label>
                          )}
                        </div>

                        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                          <div className="bg-red-50 p-4 border-b border-red-100 flex items-center space-x-2 text-red-600">
                            <AlertTriangle size={20} />
                            <h3 className="font-bold uppercase tracking-tight text-sm">Khu vực nguy hiểm</h3>
                          </div>
                          <div className="p-6 text-center">
                            <p className="text-xs text-red-800 font-medium mb-4">
                              Hành động này sẽ xóa sạch toàn bộ <b>{checkIns.length}</b> dòng dữ liệu đã lưu trong hệ thống. Chỉ sử dụng khi cần làm sạch để nhập lại từ đầu.
                            </p>
                            <button 
                              onClick={handleClearAllData}
                              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold flex items-center justify-center space-x-2 hover:bg-red-700 transition-all shadow-md"
                            >
                              <Trash2 size={16} />
                              <span>Xóa Sạch Dữ Liệu</span>
                            </button>
                          </div>
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