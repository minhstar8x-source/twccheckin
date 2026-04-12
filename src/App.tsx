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
const ROOT_ADMIN_EMAIL = 'admin@thewincity.vn'; 
const BANNER_IMAGE_URL = 'https://i.postimg.cc/7hQSRb42/660431692-122180502596789445-5003665343564458581-n.jpg';

const MY_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// ===========================================

// --- KHỞI TẠO FIREBASE ONLINE & XỬ LÝ TYPESCRIPT ---
const w = window as any; 
const isCanvasEnv = typeof w.__firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnv ? JSON.parse(w.__firebase_config) : MY_FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof w.__app_id !== 'undefined' ? w.__app_id : 'default-app-id';

const App = () => {
  // Sử dụng LocalStorage để giữ đúng tab Admin sau khi tải lại trang do Redirect
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('twc_activeTab') || 'checkin';
  });

  useEffect(() => {
    localStorage.setItem('twc_activeTab', activeTab);
  }, [activeTab]);

  const [checkIns, setCheckIns] = useState<any[]>([]); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false); // Thêm trạng thái tải ảnh

  // --- ADMIN STATE ---
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  
  // Lưu danh sách quyền Admin vào LocalStorage để không mất khi tải lại trang
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
  const [chartView, setChartView] = useState('week'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [filterType, setFilterType] = useState('all'); 

  // --- FIREBASE KẾT NỐI & TẢI DỮ LIỆU ---
  useEffect(() => {
    const initAuth = async () => {
      if (!firebaseConfig.apiKey) return;
      try {
        // Đón kết quả nếu đang từ trang đăng nhập Google (Redirect) trở về
        await getRedirectResult(auth); 
        
        // Nếu sau khi đón mà vẫn chưa đăng nhập, cấp tài khoản ẩn danh
        if (!auth.currentUser) {
          const initToken = w.__initial_auth_token;
          if (typeof initToken !== 'undefined' && initToken) {
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
    
    // Theo dõi liên tục trạng thái người dùng (Cả ẩn danh lẫn có Email)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Nếu có email (tức là đã đăng nhập bằng Google thành công)
      if (currentUser && currentUser.email) {
        const savedList = localStorage.getItem('twc_adminList');
        const currentAdmins = savedList ? JSON.parse(savedList) : [ROOT_ADMIN_EMAIL];
        
        if (currentAdmins.includes(currentUser.email)) {
          setIsAdminLoggedIn(true);
          setAdminEmail(currentUser.email);
        } else {
          // Có email nhưng không nằm trong danh sách cấp quyền -> Đá ra
          setAdminError(`Tài khoản ${currentUser.email} không có quyền truy cập.`);
          setIsAdminLoggedIn(false);
          setAdminEmail('');
          await signOut(auth);
          await signInAnonymously(auth); // Cho lại ẩn danh để có thể điền form Checkin
        }
      } else {
        setIsAdminLoggedIn(false);
        setAdminEmail('');
      }
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user && firebaseConfig.apiKey) return; 
    if (!firebaseConfig.apiKey) return; 

    const collectionPath = isCanvasEnv 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins')
        : collection(db, 'gallery_checkins');

    const unsubscribe = onSnapshot(collectionPath, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ firebaseId: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => b.id - a.id); 
      setCheckIns(data);
    }, (error: any) => {
      console.error("Lỗi đồng bộ dữ liệu Firestore:", error);
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

  // --- HANDLERS ---
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
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
       alert("Vui lòng thiết lập MY_FIREBASE_CONFIG (Mã API Firebase) trong Code để có thể lưu trữ lên mạng!");
       return;
    }

    try {
      const collectionPath = isCanvasEnv 
          ? collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins')
          : collection(db, 'gallery_checkins');
          
      await addDoc(collectionPath, newCheckIn);
      
      setShowSuccess(true);
      setFormData(initialFormState);
      setHasCustomer(true);

      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch(error: any) {
      alert("Đã xảy ra lỗi khi lưu dữ liệu lên mạng: " + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    setAdminError('');
    
    if (isCanvasEnv || !firebaseConfig.apiKey) {
      setIsAdminLoggedIn(true);
      setAdminEmail(ROOT_ADMIN_EMAIL);
      return;
    }

    const provider = new GoogleAuthProvider();
    try {
      // 1. Thử mở cửa sổ Popup trước cho nhanh
      await signInWithPopup(auth, provider);
      // Kết quả thành công sẽ được tự động đón ở onAuthStateChanged phía trên
    } catch (error: any) {
      console.error("Lỗi đăng nhập:", error);
      // 2. Bắt lỗi nếu cửa sổ bị Zalo/Messenger/Safari chặn (auth/popup-blocked)
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
         try {
           // Ép dùng chế độ Chuyển Trang (Redirect) để vượt rào chắn
           await signInWithRedirect(auth, provider);
         } catch(e: any) {
           setAdminError("Lỗi hệ thống khi chuyển trang: " + e.message);
         }
      } else {
        setAdminError("Đăng nhập thất bại: " + error.message);
      }
    }
  };

  const handleAdminLogout = async () => {
    setIsAdminLoggedIn(false);
    setAdminEmail('');
    setActiveTab('checkin');
    
    if (!isCanvasEnv && firebaseConfig.apiKey) {
      await signOut(auth);
      await signInAnonymously(auth);
    }
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminEmail && !adminList.includes(newAdminEmail)) {
      setAdminList([...adminList, newAdminEmail]);
      setNewAdminEmail('');
    }
  };

  const handleRemoveAdmin = (emailToRemove: string) => {
    if (adminList.length > 1) {
      setAdminList(adminList.filter(email => email !== emailToRemove));
    } else {
      alert('Không thể xóa Quản trị viên cuối cùng!');
    }
  };

  // --- ADMIN FILTER & CHART LOGIC ---
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
      // Tuần hiện tại: Lấy 7 ngày từ Thứ 2 đến Chủ nhật
      const dayOfWeek = now.getDay();
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);

      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        dataMap[dateStr] = { 
          key: dateStr, 
          label: `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth()+1})`, 
          customers: 0, 
          staff: 0, 
          sortIndex: i 
        };
      }
    } else if (chartView === 'month') {
      // Tháng hiện tại: Gom thành các nhóm Tuần (Thứ 2 -> Chủ nhật)
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      let day = firstDayOfMonth.getDay();
      let diff = firstDayOfMonth.getDate() - day + (day === 0 ? -6 : 1);
      let currentMonday = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), diff);

      let weekIndex = 0;
      while (currentMonday <= lastDayOfMonth) {
        const start = new Date(currentMonday);
        const end = new Date(currentMonday);
        end.setDate(end.getDate() + 6); // Cộng thêm 6 ngày để ra Chủ nhật

        const key = `week-${weekIndex}`;
        
        dataMap[key] = {
          key,
          label: `Từ ${start.getDate()}/${start.getMonth()+1}\nđến ${end.getDate()}/${end.getMonth()+1}`,
          customers: 0,
          staff: 0,
          sortIndex: weekIndex,
          startDate: start,
          endDate: end
        };

        // Tiến tới tuần tiếp theo
        currentMonday.setDate(currentMonday.getDate() + 7);
        weekIndex++;
      }
    }

    checkIns.forEach((item: any) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);
      
      if (chartView === 'week') {
        const dateStr = item.date;
        if (dataMap[dateStr]) {
          dataMap[dateStr].customers += item.customerCount;
          dataMap[dateStr].staff += item.staffCount;
        }
      } else if (chartView === 'month') {
        // Kiểm tra xem Data thuộc tuần nào trong tháng
        Object.values(dataMap).forEach((weekBucket: any) => {
          if (itemDate >= weekBucket.startDate && itemDate <= weekBucket.endDate) {
            weekBucket.customers += item.customerCount;
            weekBucket.staff += item.staffCount;
          }
        });
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView]);

  const baseMax = Math.max(5, ...chartData.map((d: any) => Math.max(d.customers, d.staff)));
  const maxChartValue = Math.ceil(baseMax * 1.2); // Tăng đỉnh trục Y thêm 20% để tạo khoảng trống phía trên

  // --- TÍNH NĂNG EXPORT ---
  const exportToExcel = () => {
    const headers = ['Ngày giờ', 'Đơn vị/Đại lý', 'Họ tên CVKD', 'SĐT CVKD', 'SL CVKD', 'Họ tên Khách', 'SĐT Khách', 'Độ tuổi Khách', 'SL Khách', 'Trạng thái'];
    const rows = filteredCheckIns.map((item: any) => [
      `"${item.timestamp}"`,
      `"${item.agencyName}"`,
      `"${item.staffName}"`,
      `"${item.staffPhone}"`,
      item.staffCount,
      `"${item.hasCustomer ? item.customerName : ''}"`,
      `"${item.hasCustomer ? item.customerPhone : ''}"`,
      `"${item.hasCustomer ? item.customerAge : ''}"`,
      item.hasCustomer ? item.customerCount : 0,
      `"${item.hasCustomer ? 'Có khách' : 'Không đi cùng khách'}"`
    ]);
    
    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DanhSachKhachThamQuan_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    link.click();
  };

  const exportChartImage = async () => {
    if (isExporting) return;
    
    const chartEl = document.getElementById('admin-chart-container');
    if (!chartEl) {
      alert("Không tìm thấy biểu đồ để xuất.");
      return;
    }

    setIsExporting(true);

    const processExport = async () => {
      try {
        const canvas = await (w as any).html2canvas(chartEl, { 
          backgroundColor: '#0f172a', 
          scale: 2, 
          useCORS: true, 
          allowTaint: false, // Ngăn việc Canvas bị đánh dấu là "bẩn" gây lỗi bảo mật trên Safari/iOS
          logging: false
        });
        
        // Dùng toDataURL thay vì toBlob để tương thích tuyệt đối với mọi trình duyệt
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `BieuDoThongKe_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.png`;
        link.href = dataUrl;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setIsExporting(false);
      } catch (error: any) {
        console.error("Chi tiết lỗi xuất ảnh:", error);
        alert("Không thể lưu ảnh do giới hạn bảo mật của trình duyệt.\nLỗi: " + (error.message || error));
        setIsExporting(false);
      }
    };

    // Tải html2canvas nếu chưa có (Dùng JSDelivr thay vì CDNJS để tránh bị Firewall/Adblock chặn)
    if (typeof (w as any).html2canvas !== 'undefined') {
      processExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => processExport();
      script.onerror = () => {
        alert("Lỗi mạng: Không thể tải công cụ xuất ảnh do bị chặn bởi Adblock hoặc Tường lửa.");
        setIsExporting(false);
      };
      document.head.appendChild(script);
    }
  };

  // --- FORM VALIDATION ---
  const isFormValid = useMemo(() => {
    const isStaffValid = formData.agencyName.trim() !== '' &&
                         formData.staffName.trim() !== '' &&
                         formData.staffPhone.trim().length === 4 &&
                         Number(formData.staffCount) >= 1;
    
    if (!hasCustomer) return isStaffValid;
    
    const isCustomerValid = formData.customerName.trim() !== '' &&
                            formData.customerPhone.trim().length === 4 &&
                            Number(formData.customerCount) >= 1 &&
                            formData.customerAge !== '';
                            
    return isStaffValid && isCustomerValid;
  }, [formData, hasCustomer]);

  return (
    <div className="min-h-screen bg-slate-100 pb-12" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      
      {/* KHIẾN TOÀN BỘ FONT TRONG APP ĐỔI THÀNH BE VIETNAM PRO */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
        body, input, button, select, textarea {
          font-family: 'Be Vietnam Pro', sans-serif !important;
        }
      `}} />

      {/* THÔNG BÁO POP-UP THÀNH CÔNG */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h3 className="font-bold text-2xl text-slate-800 text-center mb-2">Check in thành công.</h3>
            <p className="text-slate-500 text-center font-medium text-lg">Welcome to The Win City Gallery!!!</p>
          </div>
        </div>
      )}

      {/* HEADER MỚI (Màu trắng, Nút cam) */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#d95d1e]">
            <CalendarDays size={28} />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">The Win City</h1>
          </div>
          
          <div className="flex items-center space-x-4 sm:space-x-6">
            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'checkin' 
                  ? 'bg-[#ea580c] text-white shadow-md hover:bg-[#c2410c]' 
                  : 'text-slate-600 hover:text-[#ea580c]'
              }`}
            >
              Đăng ký
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`font-medium transition-all ${
                activeTab === 'admin' ? 'text-[#ea580c]' : 'text-slate-500 hover:text-[#ea580c]'
              }`}
            >
              Admin
            </button>
            {isAdminLoggedIn && (
              <button
                onClick={handleAdminLogout}
                className="text-red-500 hover:text-red-700 font-medium transition-all"
              >
                Thoát
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        
        {/* TAB 1: CHECK-IN FORM */}
        {activeTab === 'checkin' && (
          <div className="max-w-4xl mx-auto">

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
              
              <div 
                className="w-full h-48 sm:h-72 bg-cover bg-center relative flex items-center justify-center text-center px-4"
                style={{ backgroundImage: `url('${BANNER_IMAGE_URL}')` }}
              >
                <div className="absolute inset-0 bg-black/55"></div>
                
                <div className="relative z-10 space-y-2 mt-4 text-white" style={{ color: 'white' }}>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-wide uppercase drop-shadow-lg text-white" style={{ color: 'white' }}>
                    CHECK IN THE WIN CITY GALLERY
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg font-medium drop-shadow-md px-2 text-white" style={{ color: 'white' }}>
                    Vui lòng điền đầy đủ thông tin để chúng tôi tiếp đón chu đáo
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* SECTION 1: THÔNG TIN CVKD */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider mb-5 flex items-center">
                    <span className="bg-[#ea580c] text-white p-1.5 rounded-md mr-3"><Building2 size={18} /></span>
                    Thông tin Đại lý / CVKD
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Tên đơn vị (Đại lý)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Building2 size={18} />
                        </div>
                        <input
                          type="text"
                          name="agencyName"
                          required
                          value={formData.agencyName}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          placeholder="VD: CenLand, Khải Hoàn Land..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Họ và Tên (CVKD)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User size={18} />
                        </div>
                        <input
                          type="text"
                          name="staffName"
                          required
                          value={formData.staffName}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          placeholder="Nguyễn Văn A"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">SĐT CVKD (4 số cuối)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone size={18} />
                        </div>
                        <input
                          type="text"
                          name="staffPhone"
                          required
                          minLength={4}
                          maxLength={4}
                          value={formData.staffPhone}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          placeholder="VD: 8888"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Số lượng CVKD đi cùng</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Users size={18} />
                        </div>
                        <input
                          type="number"
                          name="staffCount"
                          required
                          min="1"
                          value={formData.staffCount}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-200">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={!hasCustomer}
                          onChange={() => setHasCustomer(!hasCustomer)}
                          className="w-5 h-5 rounded border-slate-300 text-[#ea580c] focus:ring-[#ea580c] focus:ring-2 transition-all cursor-pointer peer"
                        />
                      </div>
                      <span className="text-slate-700 font-semibold group-hover:text-[#ea580c] transition-colors select-none text-sm sm:text-base">
                        Tôi không đi cùng khách hàng
                      </span>
                    </label>
                  </div>
                </div>

                {/* SECTION 2: THÔNG TIN KHÁCH HÀNG */}
                {hasCustomer && (
                  <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-base font-bold text-[#c2410c] uppercase tracking-wider mb-5 flex items-center">
                      <span className="bg-[#fdba74] text-orange-900 p-1.5 rounded-md mr-3"><Users size={18} /></span>
                      Thông tin Khách Hàng
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Tên Khách Hàng</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User size={18} />
                          </div>
                          <input
                            type="text"
                            name="customerName"
                            required={hasCustomer}
                            value={formData.customerName}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                            placeholder="Trần Thị B"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">SĐT Khách Hàng (4 số cuối)</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone size={18} />
                          </div>
                          <input
                            type="text"
                            name="customerPhone"
                            required={hasCustomer}
                            minLength={4}
                            maxLength={4}
                            value={formData.customerPhone}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                            placeholder="VD: 9999"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Số lượng Khách</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Users size={18} />
                          </div>
                          <input
                            type="number"
                            name="customerCount"
                            required={hasCustomer}
                            min="1"
                            value={formData.customerCount}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Độ tuổi Khách hàng</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <CalendarClock size={18} />
                          </div>
                          <select
                            name="customerAge"
                            required={hasCustomer}
                            value={formData.customerAge}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors appearance-none font-medium"
                          >
                            <option value="" disabled>Chọn khoảng độ tuổi</option>
                            <option value="Dưới 25">Dưới 25</option>
                            <option value="25 - 35">25 - 35</option>
                            <option value="36 - 45">36 - 45</option>
                            <option value="46 - 55">46 - 55</option>
                            <option value="Trên 55">Trên 55</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                            <ChevronRight size={16} className="rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className={`w-full sm:w-auto px-10 py-4 font-bold text-lg rounded-xl shadow-lg transition-all focus:ring-4 focus:ring-orange-200 flex items-center justify-center space-x-2 
                      ${isFormValid 
                        ? 'bg-[#ea580c] hover:bg-[#c2410c] text-white hover:shadow-xl transform hover:-translate-y-0.5' 
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'}`}
                  >
                    <CheckCircle2 size={24} />
                    <span>Gửi Đăng Ký</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: ADMIN AREA */}
        {activeTab === 'admin' && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-h-[600px]">
            
            {!isAdminLoggedIn ? (
              <div className="flex flex-col items-center justify-center p-12 h-[500px]">
                <div className="bg-slate-100 p-4 rounded-full mb-6">
                  <Lock size={48} className="text-slate-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Quản trị Hệ thống</h2>
                <p className="text-slate-500 mb-8 text-center max-w-sm">Khu vực dành riêng cho Ban quản lý. Vui lòng đăng nhập.</p>
                
                <div className="w-full max-w-sm space-y-4 text-center">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-lg shadow-md border border-slate-200 transition-all flex justify-center items-center space-x-3"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Đăng nhập bằng Google</span>
                  </button>
                  {adminError && <p className="text-red-500 text-sm mt-2 font-medium">{adminError}</p>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck size={20} className="text-orange-400" />
                    <span className="font-bold">Admin Dashboard</span>
                    <span className="text-slate-400 text-sm hidden sm:inline">| Xin chào, {adminEmail}</span>
                  </div>
                  
                  <div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
                    <button
                      onClick={() => setAdminSubTab('list')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                        adminSubTab === 'list' ? 'bg-[#ea580c] text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Danh sách
                    </button>
                    <button
                      onClick={() => setAdminSubTab('chart')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                        adminSubTab === 'chart' ? 'bg-[#ea580c] text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Thống kê
                    </button>
                    {adminEmail === ROOT_ADMIN_EMAIL && (
                      <button
                        onClick={() => setAdminSubTab('settings')}
                        className={`flex-1 sm:flex-none flex justify-center items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                          adminSubTab === 'settings' ? 'bg-[#ea580c] text-white' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Settings size={16} className="mr-1"/> Phân quyền
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex-1">
                  
                  {/* SUB-TAB 1: DANH SÁCH */}
                  {adminSubTab === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border-b border-slate-200 bg-slate-50 gap-4">
                        <div className="flex items-center space-x-2">
                          <ListOrdered size={20} className="text-slate-500" />
                          <h3 className="font-bold text-slate-800">Danh sách Check-in</h3>
                          <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold ml-2">Tổng: {filteredCheckIns.length}</span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={exportToExcel}
                            className="flex items-center justify-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            <Download size={16} />
                            <span>Xuất Excel</span>
                          </button>
                          
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <CalendarDays size={16} />
                            </div>
                            <input
                              type="date"
                              value={filterDate}
                              onChange={(e) => setFilterDate(e.target.value)}
                              className="w-full sm:w-auto pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#ea580c] outline-none"
                            />
                          </div>

                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#ea580c] outline-none"
                          >
                            <option value="all">Tất cả đối tượng</option>
                            <option value="customer_only">Có mang theo Khách hàng</option>
                            <option value="staff_only">CVKD đi nội bộ (1 mình)</option>
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Ngày & Giờ</th>
                              <th className="px-4 py-3">Đơn vị & CVKD</th>
                              <th className="px-4 py-3">Khách hàng</th>
                              <th className="px-4 py-3 text-center">SL Khách</th>
                              <th className="px-4 py-3 text-center">SL CVKD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredCheckIns.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                                  Không tìm thấy dữ liệu.
                                </td>
                              </tr>
                            ) : (
                              filteredCheckIns.map((item: any) => (
                                <tr key={item.id} className="hover:bg-orange-50/50 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium text-xs">
                                    {item.timestamp}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{item.staffName} <span className="text-slate-400 font-normal text-xs ml-1">({item.staffPhone})</span></div>
                                    <div className="text-[#ea580c] font-medium text-xs mt-0.5">{item.agencyName}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {item.hasCustomer ? (
                                      <>
                                        <div className="font-bold text-slate-900">{item.customerName} <span className="text-slate-400 font-normal text-xs ml-1">({item.customerPhone})</span></div>
                                        <div className="text-slate-500 text-xs mt-0.5">Tuổi: {item.customerAge}</div>
                                      </>
                                    ) : (
                                      <span className="text-slate-400 italic text-xs border border-slate-200 px-2 py-0.5 rounded bg-slate-50">Không đi cùng khách</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`font-bold px-3 py-1 rounded-full ${item.customerCount > 0 ? 'bg-orange-100 text-orange-800' : 'text-slate-300'}`}>
                                      {item.customerCount > 0 ? item.customerCount : '0'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                                      {item.staffCount}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: THỐNG KÊ */}
                  {adminSubTab === 'chart' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <BarChart3 size={20} className="text-slate-600" />
                            <h3 className="font-bold text-slate-800 text-lg">Biểu đồ Lượng Khách & CVKD</h3>
                          </div>
                          <button
                            onClick={exportChartImage}
                            disabled={isExporting}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm ${
                              isExporting 
                                ? 'bg-slate-600 cursor-wait text-slate-300' 
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                          >
                            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            <span className="hidden sm:inline">
                              {isExporting ? 'Đang tải về...' : 'Lưu ảnh biểu đồ'}
                            </span>
                          </button>
                        </div>
                        
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                          {['week', 'month'].map(view => (
                            <button
                              key={view}
                              onClick={() => setChartView(view)}
                              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                chartView === view 
                                  ? 'bg-white text-slate-900 shadow-sm' 
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {view === 'week' ? 'Tuần' : 'Tháng'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div id="admin-chart-container" className="relative bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-inner font-mono mt-8 border border-slate-800">
                        <div className="absolute -top-4 right-4 flex space-x-4 text-xs font-medium bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shadow-lg z-20">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-t from-orange-600 to-orange-400 rounded-sm shadow-[0_0_8px_rgba(234,88,12,0.8)]"></div>
                            <span className="text-slate-200">Khách hàng</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                            <span className="text-slate-200">CVKD</span>
                          </div>
                        </div>

                        <div className="h-80 flex relative pl-8 pb-10 pt-10">
                          <div className="absolute top-0 left-0 text-cyan-500/80 font-bold text-xs uppercase tracking-wider">Số lượng</div>
                          
                          <div className="absolute top-10 bottom-10 left-0 right-4 flex flex-col justify-between pointer-events-none">
                            {[maxChartValue, Math.ceil(maxChartValue * 0.75), Math.ceil(maxChartValue * 0.5), Math.ceil(maxChartValue * 0.25), 0].map((val, idx) => (
                              <div key={idx} className="w-full flex items-center relative">
                                <span className="absolute -left-8 text-[10px] text-slate-400 w-6 text-right">{val}</span>
                                <div className="w-full border-t border-slate-700/50 border-dashed"></div>
                              </div>
                            ))}
                          </div>

                          <div className="absolute bottom-10 left-8 right-4 border-b-2 border-slate-600 shadow-[0_0_10px_rgba(71,85,105,0.5)]"></div>
                          <div className="absolute top-10 bottom-10 left-8 border-l-2 border-slate-600 shadow-[0_0_10px_rgba(71,85,105,0.5)]"></div>

                          <div className="flex-1 flex items-end justify-around relative z-10 w-full h-full">
                            {chartData.map((d: any) => (
                              <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group">
                                <div className="flex items-end justify-center space-x-1 sm:space-x-2 w-full h-full">
                                  <div 
                                    style={{ height: `${d.customers === 0 ? 0 : Math.max((d.customers / maxChartValue) * 100, 2)}%` }} 
                                    className="w-full max-w-[16px] sm:max-w-[32px] rounded-t-md relative bg-gradient-to-t from-orange-600 to-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.6)] group-hover:brightness-125 transition-all"
                                  >
                                    <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[11px] sm:text-xs font-bold text-orange-400 drop-shadow-md">{d.customers}</span>
                                  </div>
                                  <div 
                                    style={{ height: `${d.staff === 0 ? 0 : Math.max((d.staff / maxChartValue) * 100, 2)}%` }} 
                                    className="w-full max-w-[16px] sm:max-w-[32px] rounded-t-md relative bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)] group-hover:brightness-125 transition-all"
                                  >
                                    <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[11px] sm:text-xs font-bold text-cyan-400 drop-shadow-md">{d.staff}</span>
                                  </div>
                                </div>
                                <span className="absolute -bottom-10 text-[9px] sm:text-[11px] font-medium text-slate-400 text-center w-full min-w-[50px] leading-tight px-1 whitespace-pre-wrap">{d.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: PHÂN QUYỀN */}
                  {adminSubTab === 'settings' && adminEmail === ROOT_ADMIN_EMAIL && (
                    <div className="max-w-2xl mx-auto">
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200">
                          <h3 className="font-bold text-slate-800 text-lg">Quản lý Quản trị viên</h3>
                          <p className="text-sm text-slate-500 mt-1">Thêm hoặc xóa những email được phép truy cập vào bảng Quản trị này.</p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                          <form onSubmit={handleAddAdmin} className="flex gap-3">
                            <input
                              type="email"
                              required
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                              placeholder="Nhập email cần cấp quyền..."
                              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#ea580c] outline-none"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                              <Plus size={18} />
                              <span className="hidden sm:inline">Thêm Quyền</span>
                            </button>
                          </form>

                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <ul className="divide-y divide-slate-100">
                              {adminList.map((email, index) => (
                                <li key={index} className="flex items-center justify-between p-4 hover:bg-slate-50">
                                  <div className="flex items-center space-x-3">
                                    <div className="bg-orange-100 text-orange-600 p-2 rounded-full">
                                      <User size={16} />
                                    </div>
                                    <span className="font-medium text-slate-700">{email}</span>
                                    {email === ROOT_ADMIN_EMAIL && (
                                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">Mặc định</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleRemoveAdmin(email)}
                                    className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                                    title="Xóa quyền Admin"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </li>
                              ))}
                            </ul>
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
};
// ===========================================

// --- KHỞI TẠO FIREBASE ONLINE & XỬ LÝ TYPESCRIPT ---
const w = window as any; 
const isCanvasEnv = typeof w.__firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnv ? JSON.parse(w.__firebase_config) : MY_FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof w.__app_id !== 'undefined' ? w.__app_id : 'default-app-id';

const App = () => {
  // Sử dụng LocalStorage để giữ đúng tab Admin sau khi tải lại trang do Redirect
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('twc_activeTab') || 'checkin';
  });

  useEffect(() => {
    localStorage.setItem('twc_activeTab', activeTab);
  }, [activeTab]);

  const [checkIns, setCheckIns] = useState<any[]>([]); 
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false); // Thêm trạng thái tải ảnh

  // --- ADMIN STATE ---
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  
  // Lưu danh sách quyền Admin vào LocalStorage để không mất khi tải lại trang
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
  const [chartView, setChartView] = useState('week'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [filterType, setFilterType] = useState('all'); 

  // --- FIREBASE KẾT NỐI & TẢI DỮ LIỆU ---
  useEffect(() => {
    const initAuth = async () => {
      if (!firebaseConfig.apiKey) return;
      try {
        // Đón kết quả nếu đang từ trang đăng nhập Google (Redirect) trở về
        await getRedirectResult(auth); 
        
        // Nếu sau khi đón mà vẫn chưa đăng nhập, cấp tài khoản ẩn danh
        if (!auth.currentUser) {
          const initToken = w.__initial_auth_token;
          if (typeof initToken !== 'undefined' && initToken) {
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
    
    // Theo dõi liên tục trạng thái người dùng (Cả ẩn danh lẫn có Email)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Nếu có email (tức là đã đăng nhập bằng Google thành công)
      if (currentUser && currentUser.email) {
        const savedList = localStorage.getItem('twc_adminList');
        const currentAdmins = savedList ? JSON.parse(savedList) : [ROOT_ADMIN_EMAIL];
        
        if (currentAdmins.includes(currentUser.email)) {
          setIsAdminLoggedIn(true);
          setAdminEmail(currentUser.email);
        } else {
          // Có email nhưng không nằm trong danh sách cấp quyền -> Đá ra
          setAdminError(`Tài khoản ${currentUser.email} không có quyền truy cập.`);
          setIsAdminLoggedIn(false);
          setAdminEmail('');
          await signOut(auth);
          await signInAnonymously(auth); // Cho lại ẩn danh để có thể điền form Checkin
        }
      } else {
        setIsAdminLoggedIn(false);
        setAdminEmail('');
      }
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user && firebaseConfig.apiKey) return; 
    if (!firebaseConfig.apiKey) return; 

    const collectionPath = isCanvasEnv 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins')
        : collection(db, 'gallery_checkins');

    const unsubscribe = onSnapshot(collectionPath, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ firebaseId: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => b.id - a.id); 
      setCheckIns(data);
    }, (error: any) => {
      console.error("Lỗi đồng bộ dữ liệu Firestore:", error);
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

  // --- HANDLERS ---
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
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
       alert("Vui lòng thiết lập MY_FIREBASE_CONFIG (Mã API Firebase) trong Code để có thể lưu trữ lên mạng!");
       return;
    }

    try {
      const collectionPath = isCanvasEnv 
          ? collection(db, 'artifacts', appId, 'public', 'data', 'gallery_checkins')
          : collection(db, 'gallery_checkins');
          
      await addDoc(collectionPath, newCheckIn);
      
      setShowSuccess(true);
      setFormData(initialFormState);
      setHasCustomer(true);

      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch(error: any) {
      alert("Đã xảy ra lỗi khi lưu dữ liệu lên mạng: " + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    setAdminError('');
    
    if (isCanvasEnv || !firebaseConfig.apiKey) {
      setIsAdminLoggedIn(true);
      setAdminEmail(ROOT_ADMIN_EMAIL);
      return;
    }

    const provider = new GoogleAuthProvider();
    try {
      // 1. Thử mở cửa sổ Popup trước cho nhanh
      await signInWithPopup(auth, provider);
      // Kết quả thành công sẽ được tự động đón ở onAuthStateChanged phía trên
    } catch (error: any) {
      console.error("Lỗi đăng nhập:", error);
      // 2. Bắt lỗi nếu cửa sổ bị Zalo/Messenger/Safari chặn (auth/popup-blocked)
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
         try {
           // Ép dùng chế độ Chuyển Trang (Redirect) để vượt rào chắn
           await signInWithRedirect(auth, provider);
         } catch(e: any) {
           setAdminError("Lỗi hệ thống khi chuyển trang: " + e.message);
         }
      } else {
        setAdminError("Đăng nhập thất bại: " + error.message);
      }
    }
  };

  const handleAdminLogout = async () => {
    setIsAdminLoggedIn(false);
    setAdminEmail('');
    setActiveTab('checkin');
    
    if (!isCanvasEnv && firebaseConfig.apiKey) {
      await signOut(auth);
      await signInAnonymously(auth);
    }
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminEmail && !adminList.includes(newAdminEmail)) {
      setAdminList([...adminList, newAdminEmail]);
      setNewAdminEmail('');
    }
  };

  const handleRemoveAdmin = (emailToRemove: string) => {
    if (adminList.length > 1) {
      setAdminList(adminList.filter(email => email !== emailToRemove));
    } else {
      alert('Không thể xóa Quản trị viên cuối cùng!');
    }
  };

  // --- ADMIN FILTER & CHART LOGIC ---
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
      // Tuần hiện tại: Lấy 7 ngày từ Thứ 2 đến Chủ nhật
      const dayOfWeek = now.getDay();
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);

      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        dataMap[dateStr] = { 
          key: dateStr, 
          label: `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth()+1})`, 
          customers: 0, 
          staff: 0, 
          sortIndex: i 
        };
      }
    } else if (chartView === 'month') {
      // Tháng hiện tại: Gom thành các nhóm Tuần (Thứ 2 -> Chủ nhật)
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      let day = firstDayOfMonth.getDay();
      let diff = firstDayOfMonth.getDate() - day + (day === 0 ? -6 : 1);
      let currentMonday = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), diff);

      let weekIndex = 0;
      while (currentMonday <= lastDayOfMonth) {
        const start = new Date(currentMonday);
        const end = new Date(currentMonday);
        end.setDate(end.getDate() + 6); // Cộng thêm 6 ngày để ra Chủ nhật

        const key = `week-${weekIndex}`;
        
        dataMap[key] = {
          key,
          label: `Từ ${start.getDate()}/${start.getMonth()+1}\nđến ${end.getDate()}/${end.getMonth()+1}`,
          customers: 0,
          staff: 0,
          sortIndex: weekIndex,
          startDate: start,
          endDate: end
        };

        // Tiến tới tuần tiếp theo
        currentMonday.setDate(currentMonday.getDate() + 7);
        weekIndex++;
      }
    }

    checkIns.forEach((item: any) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);
      
      if (chartView === 'week') {
        const dateStr = item.date;
        if (dataMap[dateStr]) {
          dataMap[dateStr].customers += item.customerCount;
          dataMap[dateStr].staff += item.staffCount;
        }
      } else if (chartView === 'month') {
        // Kiểm tra xem Data thuộc tuần nào trong tháng
        Object.values(dataMap).forEach((weekBucket: any) => {
          if (itemDate >= weekBucket.startDate && itemDate <= weekBucket.endDate) {
            weekBucket.customers += item.customerCount;
            weekBucket.staff += item.staffCount;
          }
        });
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.sortIndex - b.sortIndex);
  }, [checkIns, chartView]);

  const baseMax = Math.max(5, ...chartData.map((d: any) => Math.max(d.customers, d.staff)));
  const maxChartValue = Math.ceil(baseMax * 1.2); // Tăng đỉnh trục Y thêm 20% để tạo khoảng trống phía trên

  // --- TÍNH NĂNG EXPORT ---
  const exportToExcel = () => {
    const headers = ['Ngày giờ', 'Đơn vị/Đại lý', 'Họ tên CVKD', 'SĐT CVKD', 'SL CVKD', 'Họ tên Khách', 'SĐT Khách', 'Độ tuổi Khách', 'SL Khách', 'Trạng thái'];
    const rows = filteredCheckIns.map((item: any) => [
      `"${item.timestamp}"`,
      `"${item.agencyName}"`,
      `"${item.staffName}"`,
      `"${item.staffPhone}"`,
      item.staffCount,
      `"${item.hasCustomer ? item.customerName : ''}"`,
      `"${item.hasCustomer ? item.customerPhone : ''}"`,
      `"${item.hasCustomer ? item.customerAge : ''}"`,
      item.hasCustomer ? item.customerCount : 0,
      `"${item.hasCustomer ? 'Có khách' : 'Không đi cùng khách'}"`
    ]);
    
    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DanhSachKhachThamQuan_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    link.click();
  };

  const exportChartImage = async () => {
    if (isExporting) return;
    
    const chartEl = document.getElementById('admin-chart-container');
    if (!chartEl) {
      alert("Không tìm thấy biểu đồ để xuất.");
      return;
    }

    setIsExporting(true);

    const processExport = async () => {
      try {
        const canvas = await (w as any).html2canvas(chartEl, { 
          backgroundColor: '#0f172a', 
          scale: 2, 
          useCORS: true, 
          allowTaint: false, // Ngăn việc Canvas bị đánh dấu là "bẩn" gây lỗi bảo mật trên Safari/iOS
          logging: false
        });
        
        // Dùng toDataURL thay vì toBlob để tương thích tuyệt đối với mọi trình duyệt
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `BieuDoThongKe_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.png`;
        link.href = dataUrl;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setIsExporting(false);
      } catch (error: any) {
        console.error("Chi tiết lỗi xuất ảnh:", error);
        alert("Không thể lưu ảnh do giới hạn bảo mật của trình duyệt.\nLỗi: " + (error.message || error));
        setIsExporting(false);
      }
    };

    // Tải html2canvas nếu chưa có (Dùng JSDelivr thay vì CDNJS để tránh bị Firewall/Adblock chặn)
    if (typeof (w as any).html2canvas !== 'undefined') {
      processExport();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => processExport();
      script.onerror = () => {
        alert("Lỗi mạng: Không thể tải công cụ xuất ảnh do bị chặn bởi Adblock hoặc Tường lửa.");
        setIsExporting(false);
      };
      document.head.appendChild(script);
    }
  };

  // --- FORM VALIDATION ---
  const isFormValid = useMemo(() => {
    const isStaffValid = formData.agencyName.trim() !== '' &&
                         formData.staffName.trim() !== '' &&
                         formData.staffPhone.trim().length === 4 &&
                         Number(formData.staffCount) >= 1;
    
    if (!hasCustomer) return isStaffValid;
    
    const isCustomerValid = formData.customerName.trim() !== '' &&
                            formData.customerPhone.trim().length === 4 &&
                            Number(formData.customerCount) >= 1 &&
                            formData.customerAge !== '';
                            
    return isStaffValid && isCustomerValid;
  }, [formData, hasCustomer]);

  return (
    <div className="min-h-screen bg-slate-100 pb-12" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      
      {/* KHIẾN TOÀN BỘ FONT TRONG APP ĐỔI THÀNH BE VIETNAM PRO */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
        body, input, button, select, textarea {
          font-family: 'Be Vietnam Pro', sans-serif !important;
        }
      `}} />

      {/* THÔNG BÁO POP-UP THÀNH CÔNG */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 size={48} className="text-emerald-500" />
            </div>
            <h3 className="font-bold text-2xl text-slate-800 text-center mb-2">Check in thành công.</h3>
            <p className="text-slate-500 text-center font-medium text-lg">Welcome to The Win City Gallery!!!</p>
          </div>
        </div>
      )}

      {/* HEADER MỚI (Màu trắng, Nút cam) */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#d95d1e]">
            <CalendarDays size={28} />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">The Win City</h1>
          </div>
          
          <div className="flex items-center space-x-4 sm:space-x-6">
            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'checkin' 
                  ? 'bg-[#ea580c] text-white shadow-md hover:bg-[#c2410c]' 
                  : 'text-slate-600 hover:text-[#ea580c]'
              }`}
            >
              Đăng ký
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`font-medium transition-all ${
                activeTab === 'admin' ? 'text-[#ea580c]' : 'text-slate-500 hover:text-[#ea580c]'
              }`}
            >
              Admin
            </button>
            {isAdminLoggedIn && (
              <button
                onClick={handleAdminLogout}
                className="text-red-500 hover:text-red-700 font-medium transition-all"
              >
                Thoát
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        
        {/* TAB 1: CHECK-IN FORM */}
        {activeTab === 'checkin' && (
          <div className="max-w-4xl mx-auto">

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
              
              <div 
                className="w-full h-48 sm:h-72 bg-cover bg-center relative flex items-center justify-center text-center px-4"
                style={{ backgroundImage: `url('${BANNER_IMAGE_URL}')` }}
              >
                <div className="absolute inset-0 bg-black/55"></div>
                
                <div className="relative z-10 space-y-2 mt-4 text-white" style={{ color: 'white' }}>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-wide uppercase drop-shadow-lg text-white" style={{ color: 'white' }}>
                    CHECK IN THE WIN CITY GALLERY
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg font-medium drop-shadow-md px-2 text-white" style={{ color: 'white' }}>
                    Vui lòng điền đầy đủ thông tin để chúng tôi tiếp đón chu đáo
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* SECTION 1: THÔNG TIN CVKD */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider mb-5 flex items-center">
                    <span className="bg-[#ea580c] text-white p-1.5 rounded-md mr-3"><Building2 size={18} /></span>
                    Thông tin Đại lý / CVKD
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Tên đơn vị (Đại lý)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Building2 size={18} />
                        </div>
                        <input
                          type="text"
                          name="agencyName"
                          required
                          value={formData.agencyName}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          placeholder="VD: CenLand, Khải Hoàn Land..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Họ và Tên (CVKD)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User size={18} />
                        </div>
                        <input
                          type="text"
                          name="staffName"
                          required
                          value={formData.staffName}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          placeholder="Nguyễn Văn A"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">SĐT CVKD (4 số cuối)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone size={18} />
                        </div>
                        <input
                          type="text"
                          name="staffPhone"
                          required
                          minLength={4}
                          maxLength={4}
                          value={formData.staffPhone}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          placeholder="VD: 8888"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Số lượng CVKD đi cùng</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Users size={18} />
                        </div>
                        <input
                          type="number"
                          name="staffCount"
                          required
                          min="1"
                          value={formData.staffCount}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-200">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={!hasCustomer}
                          onChange={() => setHasCustomer(!hasCustomer)}
                          className="w-5 h-5 rounded border-slate-300 text-[#ea580c] focus:ring-[#ea580c] focus:ring-2 transition-all cursor-pointer peer"
                        />
                      </div>
                      <span className="text-slate-700 font-semibold group-hover:text-[#ea580c] transition-colors select-none text-sm sm:text-base">
                        Tôi không đi cùng khách hàng
                      </span>
                    </label>
                  </div>
                </div>

                {/* SECTION 2: THÔNG TIN KHÁCH HÀNG */}
                {hasCustomer && (
                  <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-base font-bold text-[#c2410c] uppercase tracking-wider mb-5 flex items-center">
                      <span className="bg-[#fdba74] text-orange-900 p-1.5 rounded-md mr-3"><Users size={18} /></span>
                      Thông tin Khách Hàng
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Tên Khách Hàng</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User size={18} />
                          </div>
                          <input
                            type="text"
                            name="customerName"
                            required={hasCustomer}
                            value={formData.customerName}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                            placeholder="Trần Thị B"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">SĐT Khách Hàng (4 số cuối)</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone size={18} />
                          </div>
                          <input
                            type="text"
                            name="customerPhone"
                            required={hasCustomer}
                            minLength={4}
                            maxLength={4}
                            value={formData.customerPhone}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                            placeholder="VD: 9999"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Số lượng Khách</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Users size={18} />
                          </div>
                          <input
                            type="number"
                            name="customerCount"
                            required={hasCustomer}
                            min="1"
                            value={formData.customerCount}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Độ tuổi Khách hàng</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <CalendarClock size={18} />
                          </div>
                          <select
                            name="customerAge"
                            required={hasCustomer}
                            value={formData.customerAge}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] focus:border-[#ea580c] transition-colors appearance-none font-medium"
                          >
                            <option value="" disabled>Chọn khoảng độ tuổi</option>
                            <option value="Dưới 25">Dưới 25</option>
                            <option value="25 - 35">25 - 35</option>
                            <option value="36 - 45">36 - 45</option>
                            <option value="46 - 55">46 - 55</option>
                            <option value="Trên 55">Trên 55</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                            <ChevronRight size={16} className="rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className={`w-full sm:w-auto px-10 py-4 font-bold text-lg rounded-xl shadow-lg transition-all focus:ring-4 focus:ring-orange-200 flex items-center justify-center space-x-2 
                      ${isFormValid 
                        ? 'bg-[#ea580c] hover:bg-[#c2410c] text-white hover:shadow-xl transform hover:-translate-y-0.5' 
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'}`}
                  >
                    <CheckCircle2 size={24} />
                    <span>Gửi Đăng Ký</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: ADMIN AREA */}
        {activeTab === 'admin' && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-h-[600px]">
            
            {!isAdminLoggedIn ? (
              <div className="flex flex-col items-center justify-center p-12 h-[500px]">
                <div className="bg-slate-100 p-4 rounded-full mb-6">
                  <Lock size={48} className="text-slate-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Quản trị Hệ thống</h2>
                <p className="text-slate-500 mb-8 text-center max-w-sm">Khu vực dành riêng cho Ban quản lý. Vui lòng đăng nhập.</p>
                
                <div className="w-full max-w-sm space-y-4 text-center">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-lg shadow-md border border-slate-200 transition-all flex justify-center items-center space-x-3"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Đăng nhập bằng Google</span>
                  </button>
                  {adminError && <p className="text-red-500 text-sm mt-2 font-medium">{adminError}</p>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck size={20} className="text-orange-400" />
                    <span className="font-bold">Admin Dashboard</span>
                    <span className="text-slate-400 text-sm hidden sm:inline">| Xin chào, {adminEmail}</span>
                  </div>
                  
                  <div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
                    <button
                      onClick={() => setAdminSubTab('list')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                        adminSubTab === 'list' ? 'bg-[#ea580c] text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Danh sách
                    </button>
                    <button
                      onClick={() => setAdminSubTab('chart')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                        adminSubTab === 'chart' ? 'bg-[#ea580c] text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Thống kê
                    </button>
                    {adminEmail === ROOT_ADMIN_EMAIL && (
                      <button
                        onClick={() => setAdminSubTab('settings')}
                        className={`flex-1 sm:flex-none flex justify-center items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                          adminSubTab === 'settings' ? 'bg-[#ea580c] text-white' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Settings size={16} className="mr-1"/> Phân quyền
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex-1">
                  
                  {/* SUB-TAB 1: DANH SÁCH */}
                  {adminSubTab === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border-b border-slate-200 bg-slate-50 gap-4">
                        <div className="flex items-center space-x-2">
                          <ListOrdered size={20} className="text-slate-500" />
                          <h3 className="font-bold text-slate-800">Danh sách Check-in</h3>
                          <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold ml-2">Tổng: {filteredCheckIns.length}</span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={exportToExcel}
                            className="flex items-center justify-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            <Download size={16} />
                            <span>Xuất Excel</span>
                          </button>
                          
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              <CalendarDays size={16} />
                            </div>
                            <input
                              type="date"
                              value={filterDate}
                              onChange={(e) => setFilterDate(e.target.value)}
                              className="w-full sm:w-auto pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#ea580c] outline-none"
                            />
                          </div>

                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#ea580c] outline-none"
                          >
                            <option value="all">Tất cả đối tượng</option>
                            <option value="customer_only">Có mang theo Khách hàng</option>
                            <option value="staff_only">CVKD đi nội bộ (1 mình)</option>
                          </select>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Ngày & Giờ</th>
                              <th className="px-4 py-3">Đơn vị & CVKD</th>
                              <th className="px-4 py-3">Khách hàng</th>
                              <th className="px-4 py-3 text-center">SL Khách</th>
                              <th className="px-4 py-3 text-center">SL CVKD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredCheckIns.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                                  Không tìm thấy dữ liệu.
                                </td>
                              </tr>
                            ) : (
                              filteredCheckIns.map((item: any) => (
                                <tr key={item.id} className="hover:bg-orange-50/50 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium text-xs">
                                    {item.timestamp}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{item.staffName} <span className="text-slate-400 font-normal text-xs ml-1">({item.staffPhone})</span></div>
                                    <div className="text-[#ea580c] font-medium text-xs mt-0.5">{item.agencyName}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {item.hasCustomer ? (
                                      <>
                                        <div className="font-bold text-slate-900">{item.customerName} <span className="text-slate-400 font-normal text-xs ml-1">({item.customerPhone})</span></div>
                                        <div className="text-slate-500 text-xs mt-0.5">Tuổi: {item.customerAge}</div>
                                      </>
                                    ) : (
                                      <span className="text-slate-400 italic text-xs border border-slate-200 px-2 py-0.5 rounded bg-slate-50">Không đi cùng khách</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`font-bold px-3 py-1 rounded-full ${item.customerCount > 0 ? 'bg-orange-100 text-orange-800' : 'text-slate-300'}`}>
                                      {item.customerCount > 0 ? item.customerCount : '0'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                                      {item.staffCount}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: THỐNG KÊ */}
                  {adminSubTab === 'chart' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <BarChart3 size={20} className="text-slate-600" />
                            <h3 className="font-bold text-slate-800 text-lg">Biểu đồ Lượng Khách & CVKD</h3>
                          </div>
                          <button
                            onClick={exportChartImage}
                            disabled={isExporting}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm ${
                              isExporting 
                                ? 'bg-slate-600 cursor-wait text-slate-300' 
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                          >
                            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            <span className="hidden sm:inline">
                              {isExporting ? 'Đang tải về...' : 'Lưu ảnh biểu đồ'}
                            </span>
                          </button>
                        </div>
                        
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                          {['week', 'month'].map(view => (
                            <button
                              key={view}
                              onClick={() => setChartView(view)}
                              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                chartView === view 
                                  ? 'bg-white text-slate-900 shadow-sm' 
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {view === 'week' ? 'Tuần' : 'Tháng'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div id="admin-chart-container" className="relative bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-inner font-mono mt-8 border border-slate-800">
                        <div className="absolute -top-4 right-4 flex space-x-4 text-xs font-medium bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shadow-lg z-20">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-t from-orange-600 to-orange-400 rounded-sm shadow-[0_0_8px_rgba(234,88,12,0.8)]"></div>
                            <span className="text-slate-200">Khách hàng</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                            <span className="text-slate-200">CVKD</span>
                          </div>
                        </div>

                        <div className="h-80 flex relative pl-8 pb-10 pt-10">
                          <div className="absolute top-0 left-0 text-cyan-500/80 font-bold text-xs uppercase tracking-wider">Số lượng</div>
                          
                          <div className="absolute top-10 bottom-10 left-0 right-4 flex flex-col justify-between pointer-events-none">
                            {[maxChartValue, Math.ceil(maxChartValue * 0.75), Math.ceil(maxChartValue * 0.5), Math.ceil(maxChartValue * 0.25), 0].map((val, idx) => (
                              <div key={idx} className="w-full flex items-center relative">
                                <span className="absolute -left-8 text-[10px] text-slate-400 w-6 text-right">{val}</span>
                                <div className="w-full border-t border-slate-700/50 border-dashed"></div>
                              </div>
                            ))}
                          </div>

                          <div className="absolute bottom-10 left-8 right-4 border-b-2 border-slate-600 shadow-[0_0_10px_rgba(71,85,105,0.5)]"></div>
                          <div className="absolute top-10 bottom-10 left-8 border-l-2 border-slate-600 shadow-[0_0_10px_rgba(71,85,105,0.5)]"></div>

                          <div className="flex-1 flex items-end justify-around relative z-10 w-full h-full">
                            {chartData.map((d: any) => (
                              <div key={d.key} className="flex flex-col items-center flex-1 h-full relative group">
                                <div className="flex items-end justify-center space-x-1 sm:space-x-2 w-full h-full">
                                  <div 
                                    style={{ height: `${d.customers === 0 ? 0 : Math.max((d.customers / maxChartValue) * 100, 2)}%` }} 
                                    className="w-full max-w-[16px] sm:max-w-[32px] rounded-t-md relative bg-gradient-to-t from-orange-600 to-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.6)] group-hover:brightness-125 transition-all"
                                  >
                                    <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[11px] sm:text-xs font-bold text-orange-400 drop-shadow-md">{d.customers}</span>
                                  </div>
                                  <div 
                                    style={{ height: `${d.staff === 0 ? 0 : Math.max((d.staff / maxChartValue) * 100, 2)}%` }} 
                                    className="w-full max-w-[16px] sm:max-w-[32px] rounded-t-md relative bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)] group-hover:brightness-125 transition-all"
                                  >
                                    <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[11px] sm:text-xs font-bold text-cyan-400 drop-shadow-md">{d.staff}</span>
                                  </div>
                                </div>
                                <span className="absolute -bottom-10 text-[9px] sm:text-[11px] font-medium text-slate-400 text-center w-full min-w-[50px] leading-tight px-1 whitespace-pre-wrap">{d.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: PHÂN QUYỀN */}
                  {adminSubTab === 'settings' && adminEmail === ROOT_ADMIN_EMAIL && (
                    <div className="max-w-2xl mx-auto">
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-200">
                          <h3 className="font-bold text-slate-800 text-lg">Quản lý Quản trị viên</h3>
                          <p className="text-sm text-slate-500 mt-1">Thêm hoặc xóa những email được phép truy cập vào bảng Quản trị này.</p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                          <form onSubmit={handleAddAdmin} className="flex gap-3">
                            <input
                              type="email"
                              required
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                              placeholder="Nhập email cần cấp quyền..."
                              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#ea580c] outline-none"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                              <Plus size={18} />
                              <span className="hidden sm:inline">Thêm Quyền</span>
                            </button>
                          </form>

                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <ul className="divide-y divide-slate-100">
                              {adminList.map((email, index) => (
                                <li key={index} className="flex items-center justify-between p-4 hover:bg-slate-50">
                                  <div className="flex items-center space-x-3">
                                    <div className="bg-orange-100 text-orange-600 p-2 rounded-full">
                                      <User size={16} />
                                    </div>
                                    <span className="font-medium text-slate-700">{email}</span>
                                    {email === ROOT_ADMIN_EMAIL && (
                                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">Mặc định</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleRemoveAdmin(email)}
                                    className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                                    title="Xóa quyền Admin"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </li>
                              ))}
                            </ul>
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