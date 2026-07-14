import React, { useState, useEffect } from 'react';
import logoTemanBelajar from './assets/logo.png'; 
import axios from 'axios'; 

export default function DashboardGuru({ 
  user, 
  onLogout, 
  onUpdateAvatar 
}) {
  const [activeTab, setActiveTab] = useState('minggu-ini');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 💡 STATE MANAJEMEN KELAS (Sekarang mengambil nilai awal dari localStorage agar anti-refresh)
  const [classCode, setClassCode] = useState(() => localStorage.getItem('teacher_class_code') || ''); 
  const [className, setClassName] = useState(''); 
  const [isClassLocked, setIsClassLocked] = useState(() => localStorage.getItem('teacher_class_locked') === 'true');
  const [copiedText, setCopiedText] = useState('Salin Link');
  const [isLoading, setIsLoading] = useState(false); 
  
  // STATE MODAL DAFTAR SISWA & DATA SISWA REAL DARI DATABASE
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [students, setStudents] = useState([]);

  const [isKickModalOpen, setIsKickModalOpen] = useState(false);
  const [selectedStudentToKick, setSelectedStudentToKick] = useState(null);

  // STATE RIWAYAT CHAT SISWA DENGAN AI
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  
  // STATE BARU: Menyimpan siswa yang sedang dipilih di dalam modal chat
  const [selectedStudentChat, setSelectedStudentChat] = useState(null);

  // 🧠 STATE BARU: Menyimpan hasil analisis topik terpopuler dari Gemini API Backend
  const [analyzedTopics, setAnalyzedTopics] = useState([]);

  const totalSiswa = students.length;
  const siswaOnline = students.filter(s => s.last_seen || s.isOnline).length;

  // ====================================================================
  // HELPER: MENGAMBIL TOKEN DARI LOCALSTORAGE / USER STATE
  // ====================================================================
  const getAuthConfig = () => {
    const token = localStorage.getItem('auth_token') || user?.token;
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  };

  // Helper untuk memformat URL avatar agar aman dari double domain / missing domain
  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return `https://api.dicebear.com/7.x/initials/svg?seed=${user?.email || 'Guru'}`;
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      return avatarPath;
    }
    return `http://127.0.0.1:8000${avatarPath.startsWith('/') ? '' : '/'}${avatarPath}`;
  };

  // ====================================================================
  // EFFECT: CEK APAKAH GURU SUDAH MEMILIKI KELAS AKTIF DI DATABASE
  // ====================================================================
  useEffect(() => {
    if (!user?.email) return;

    const checkActiveClass = async () => {
      try {
        const teacherName = user.email.split('@')[0];
        const response = await axios.get(
          `http://127.0.0.1:8000/api/classes/teacher/${teacherName}`, 
          getAuthConfig()
        );
        
        if (response.data.success && response.data.data) {
          const fetchedCode = response.data.data.class_code;
          const fetchedLock = response.data.data.is_locked || false;
          
          setClassCode(fetchedCode);
          setIsClassLocked(fetchedLock);
          
          // 💡 Simpan ke localStorage agar awet saat di-refresh
          localStorage.setItem('teacher_class_code', fetchedCode);
          localStorage.setItem('teacher_class_locked', fetchedLock);
        }
      } catch (error) {
        console.error("Gagal mengecek kelas aktif dari database:", error);
      }
    };

    checkActiveClass();
  }, [user]);

  // ====================================================================
  // EFFECT: SINKRONISASI OTOMATIS DATA SISWA DARI LARAVEL BACKEND
  // ====================================================================
  useEffect(() => {
    if (!classCode) return;

    const fetchStudentsData = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:8000/api/classes/${classCode}/students`, 
          getAuthConfig()
        );
        if (response.data.success) {
          setStudents(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data siswa dari server:", error);
      }
    };

    fetchStudentsData();
    const interval = setInterval(fetchStudentsData, 5000);
    return () => clearInterval(interval);
  }, [classCode]);

  // ====================================================================
  // EFFECT: SINKRONISASI OTOMATIS RIWAYAT CHAT DARI LARAVEL
  // ====================================================================
  useEffect(() => {
    if (!classCode || !isChatModalOpen) return;

    const fetchChatHistory = async () => {
      setIsLoadingChats(true);
      try {
        const response = await axios.get(
          `http://127.0.0.1:8000/api/classes/${classCode}/teacher-history`, 
          getAuthConfig()
        );
        if (response.data.success) {
          setChatHistory(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil riwayat chat siswa:", error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    fetchChatHistory();
    const chatInterval = setInterval(fetchChatHistory, 7000);
    return () => clearInterval(chatInterval);
  }, [classCode, isChatModalOpen]);

  // ====================================================================
  // 🧠 EFFECT BARU: SINKRONISASI TOPIK TERANALISIS UNTUK BOX OVERVIEW GURU
  // ====================================================================
  useEffect(() => {
    if (!classCode) return;

    const fetchAnalyzedTopics = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:8000/api/classes/${classCode}/overview-summary`,
          getAuthConfig()
        );
        if (response.data.success) {
          setAnalyzedTopics(response.data.data);
        }
      } catch (error) {
        console.error("Gagal mengambil ringkasan analisis topik Gemini:", error);
      }
    };

    fetchAnalyzedTopics();
    const analysisInterval = setInterval(fetchAnalyzedTopics, 10000); // Sinkronisasi setiap 10 detik
    return () => clearInterval(analysisInterval);
  }, [classCode, activeTab]); // Akan ter-trigger ulang saat ganti tab atau ganti kelas

  // ====================================================================
  // FITUR 1: LOGIKA KUNCI / BUKA PENDAFTARAN KELAS (PATCH LARAVEL)
  // ====================================================================
  const handleToggleClassLock = async () => {
    if (!classCode) return alert('Buat ruang kelas terlebih dahulu!');
    
    const targetLockState = !isClassLocked;
    try {
      const response = await axios.patch(
        `http://127.0.0.1:8000/api/classes/${classCode}/lock`, 
        { is_locked: targetLockState },
        getAuthConfig()
      );

      if (response.data.success) {
        setIsClassLocked(targetLockState);
        localStorage.setItem('teacher_class_locked', targetLockState);
      }
    } catch (error) {
      console.error("Gagal mengubah status pendaftaran:", error);
      alert('Gagal memperbarui status kunci kelas di server backend.');
    }
  };

  // ====================================================================
  // FITUR 2: LOGIKA KICK SISWA PERMANEN DARI DATABASE (DELETE LARAVEL)
  // ====================================================================
  const handleKickStudent = (id, name) => {
    setSelectedStudentToKick({ id, name });
    setIsKickModalOpen(true);
  };

  const confirmKickStudent = async () => {
    if (!selectedStudentToKick || !classCode) return;

    try {
      const response = await axios.delete(
        `http://127.0.0.1:8000/api/classes/${classCode}/students/${selectedStudentToKick.id}`,
        getAuthConfig()
      );

      if (response.data.success) {
        setStudents(prevStudents => prevStudents.filter(student => student.id !== selectedStudentToKick.id));
        setIsKickModalOpen(false);
        setSelectedStudentToKick(null);
      }
    } catch (error) {
      console.error("Gagal mengeluarkan siswa:", error);
      alert('Gagal memproses pengeluaran siswa dari server database.');
    }
  };

  // ====================================================================
  // LOGIKA KIRIM DAN BUAT RUANG KELAS BARU KE LARAVEL BACKEND
  // ====================================================================
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!className.trim()) return alert('Nama kelas wajib diisi!');

    setIsLoading(true);
    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/classes', 
        {
          class_name: className,
          teacher_name: user?.email ? user.email.split('@')[0] : 'Guru Pengampu'
        },
        getAuthConfig()
      );

      if (response.data.success) {
        const newCode = response.data.data.class_code;
        setClassCode(newCode);
        setIsClassLocked(false); 
        
        // Simpan data kelas baru ke localStorage
        localStorage.setItem('teacher_class_code', newCode);
        localStorage.setItem('teacher_class_locked', 'false');

        alert(`Sukses! Kelas "${response.data.data.class_name}" berhasil dibuat.`);
        setClassName(''); 
      }
    } catch (error) {
      console.error("Gagal membuat kelas:", error);
      alert('Gagal terhubung ke server Backend! Pastikan token valid dan server Laravel menyala.');
    } finally {
      setIsLoading(false);
    }
  };

  // ====================================================================
  // FITUR 4: LOGIKA UPLOAD AVATAR GURU PERMANEN
  // ====================================================================
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!user?.id) return alert('Data user tidak valid, silakan relogin.');

    if (file.size > 2 * 1024 * 1024) return alert('Ukuran file terlalu besar! Maksimal 2MB.');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const config = getAuthConfig();
      config.headers['Content-Type'] = 'multipart/form-data';

      const response = await axios.post(
        `http://127.0.0.1:8000/api/user/${user.id}/avatar`, 
        formData, 
        config
      );

      if (response.data.success) {
        onUpdateAvatar(response.data.avatar);
        alert('Avatar profil berhasil diperbarui secara permanen! 🌟');
      }
    } catch (error) {
      console.error("Gagal mengunggah avatar:", error);
      alert('Gagal mengunggah foto profil ke server backend!');
    }
  };

  // ====================================================================
  // FITUR 3: SALIN LINK AKSES DINAMIS BERDASARKAN ALAMAT RUNNING
  // ====================================================================
  const handleCopyLink = () => {
    if (!classCode) return;
    const inviteLink = `${window.location.origin}/join/${classCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedText('Tersalin! ✅');
    setTimeout(() => setCopiedText('Salin Link'), 2000);
  };

  const uniqueStudentsWithChats = Array.from(new Set(chatHistory.map(c => c.student_name)))
    .map(name => {
      return {
        name: name,
        totalChats: chatHistory.filter(c => c.student_name === name).length
      };
    });

  const selectedStudentChatLogs = chatHistory.filter(c => c.student_name === selectedStudentChat);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#fcbfe8] to-white p-4 md:p-8 font-sans select-none flex items-center justify-center relative">
      
      {/* MODAL POPUP: PROFIL / DAFTAR SISWA KELAS */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[99] flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-purple-100 p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Daftar Siswa Kelas</h3>
                <p className="text-xs text-slate-400">
                  {classCode ? `Mengelola siswa di kelas ${classCode}` : 'Silakan buat kelas terlebih dahulu'}
                </p>
              </div>
              <button 
                onClick={() => setIsStudentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {students.length === 0 ? (
                <p className="text-sm text-slate-400 text-center italic py-8">Belum ada siswa yang bergabung</p>
              ) : (
                students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-purple-50/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                          {student.name ? student.name.charAt(0) : 'S'}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${student.last_seen || student.isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate mb-0.5 leading-none">{student.name}</p>
                        <p className="text-xs text-slate-400 truncate mb-0 leading-none">{student.email}</p>
                      </div>
                    </div>
                    <button onClick={() => handleKickStudent(student.id, student.name)} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-xl transition-all border-none cursor-pointer flex items-center justify-center active:scale-95 shadow-sm">
                      Kick 🚫
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
              Total: {totalSiswa} Siswa ({siswaOnline} Online)
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP: RIWAYAT CHAT SISWA */}
      {isChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[99] flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-purple-100 p-6 flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedStudentChat ? `Riwayat Chat: ${selectedStudentChat}` : 'Riwayat Chat Siswa AI'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedStudentChat ? `Melihat log interaksi personal siswa` : 'Pilih nama siswa untuk memantau obrolan'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsChatModalOpen(false);
                  setSelectedStudentChat(null); 
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 pr-1">
              {isLoadingChats && chatHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center italic py-8">Memuat data obrolan...</p>
              ) : chatHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center italic py-8">Belum ada aktivitas obrolan di kelas ini</p>
              ) : !selectedStudentChat ? (
                
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Daftar Kontak Siswa Aktif Chat:</p>
                  {uniqueStudentsWithChats.map((student, idx) => (
                    <div 
                      key={idx}
                      onClick={() => setSelectedStudentChat(student.name)}
                      className="flex items-center justify-between p-4 bg-slate-50 hover:bg-purple-50 rounded-2xl border border-slate-100 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center">
                          👤
                        </div>
                        <span className="text-sm font-bold text-slate-800">{student.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-purple-600 bg-purple-100 px-2.5 py-1 rounded-full">
                          {student.totalChats} Pesan
                        </span>
                        <span className="text-slate-300 text-xs">➔</span>
                      </div>
                    </div>
                  ))}
                </div>

              ) : (
                
                <div className="space-y-4">
                  <button 
                    onClick={() => setSelectedStudentChat(null)}
                    className="mb-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    ⬅️ Kembali ke Daftar Siswa
                  </button>

                  {selectedStudentChatLogs.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center italic py-4">Tidak ada log pesan ditemukan.</p>
                  ) : (
                    selectedStudentChatLogs.map((chat) => (
                      <div key={chat.id} className="p-4 bg-purple-50/40 rounded-2xl border border-purple-100/40 space-y-2.5 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(chat.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-slate-800">
                            <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wide mb-0.5">Pertanyaan:</span>
                            "{chat.message}"
                          </div>
                          <div className="bg-purple-600 text-white p-2.5 rounded-xl text-slate-700 whitespace-pre-line shadow-sm">
                            <span className="font-bold text-purple-200 block text-[10px] uppercase tracking-wide mb-0.5">Respon AI:</span>
                            {chat.response_ai}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
              {!selectedStudentChat 
                ? `Total: ${uniqueStudentsWithChats.length} Siswa Berinteraksi` 
                : `Total: ${selectedStudentChatLogs.length} Percakapan Tercatat`
              }
            </div>
          </div>
        </div>
      )}

      {/* PAPAN UTAMA DASHBOARD */}
      <div className="w-full max-w-md bg-white/40 backdrop-blur-md rounded-[40px] shadow-[0_25px_60px_rgba(120,50,150,0.12)] border border-white/60 p-6 md:p-8 space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-1 relative">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 flex items-center justify-center">
              <img src={logoTemanBelajar} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Teman Belajar</span>
          </div>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex flex-col justify-between w-7 h-5 bg-transparent border-none p-0 cursor-pointer group focus:outline-none z-50">
            <span className={`w-full h-[2.5px] bg-slate-800 rounded-full transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`w-full h-[2.5px] bg-slate-800 rounded-full transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`w-full h-[2.5px] bg-slate-800 rounded-full transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>

          {/* DROPDOWN MENU */}
          {isMenuOpen && (
            <div className="absolute right-0 top-10 w-64 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-4 border border-purple-100 z-40 animate-fadeIn space-y-3">
              <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-100/50 space-y-2">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Ruang Kelas Aktif</p>
                <div className="flex items-center justify-between">
                  {classCode ? (
                    <>
                      <span className="text-xl font-black text-slate-800 tracking-wider bg-white px-2.5 py-0.5 rounded-xl border border-purple-200/60 shadow-sm">
                        {classCode}
                      </span>
                      <button onClick={handleCopyLink} className="text-[11px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors px-2.5 py-1 rounded-lg border-none cursor-pointer">
                        {copiedText}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs italic text-slate-400 py-1 block">Belum ada kelas aktif</span>
                  )}
                </div>
              </div>

              <button onClick={() => { setIsStudentModalOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-all border-none cursor-pointer flex items-center justify-between shadow-sm">
                <span>👥 Profil Kelas (Daftar Siswa)</span>
                <span className="bg-purple-200 text-purple-800 text-[10px] px-1.5 py-0.5 rounded-md">{totalSiswa}</span>
              </button>

              <button 
                onClick={() => { 
                  if (!classCode) return alert('Buat kelas dulu atau pastikan kelas sedang aktif!');
                  setIsChatModalOpen(true); 
                  setIsMenuOpen(false); 
                }} 
                className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-all border-none cursor-pointer flex items-center justify-between shadow-sm"
              >
                <span>💬 Riwayat Chat AI</span>
                <span className="bg-emerald-200 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-md font-black">VIEW</span>
              </button>

              <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Kunci Pendaftaran</span>
                  <span className="text-[10px] text-slate-400">Batasi siswa luar masuk</span>
                </div>
                <button onClick={handleToggleClassLock} className={`w-11 h-6 rounded-full p-0.5 transition-colors border-none cursor-pointer flex items-center ${isClassLocked ? 'bg-red-500 justify-end' : 'bg-slate-200 justify-start'}`}>
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm block"></span>
                </button>
              </div>

              <button 
                onClick={() => {
                  // 💡 Bersihkan localStorage khusus kelas guru saat logout
                  localStorage.removeItem('teacher_class_code');
                  localStorage.removeItem('teacher_class_locked');
                  onLogout();
                }} 
                className="w-full text-center py-2.5 text-sm text-red-600 hover:bg-red-50 font-bold border-none bg-transparent cursor-pointer rounded-xl transition-colors border-t border-slate-100 block"
              >
                🚪 Keluar Dashboard
              </button>
            </div>
          )}
        </div>

        {/* CARD WELCOME GURU */}
        <div className="w-full bg-white/80 rounded-[28px] shadow-[0_8px_20px_rgba(0,0,0,0.03)] p-4 flex items-center gap-4 border border-white">
          <div className="relative flex-shrink-0 group">
            <label htmlFor="upload-avatar-guru" className="cursor-pointer block relative">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-sm overflow-hidden border-2 border-purple-200 group-hover:border-purple-500 transition-all">
                <img 
                  src={getAvatarUrl(user?.avatar)} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${user?.email || 'Guru'}`; }}
                /> 
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-white font-medium">Edit</span>
              </div>
            </label>
            <input type="file" id="upload-avatar-guru" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Welcome</p>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{user?.email ? user.email.split('@')[0] : 'Guru'}</h2>
          </div>
        </div>

        {/* KONDISI TAMPILAN KELAS */}
        {!classCode ? (
          <div className="w-full bg-white/90 rounded-[28px] shadow-sm p-5 border border-white space-y-3">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">🛠️ Buat Ruang Kelas Baru</p>
            <form onSubmit={handleCreateClass} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Contoh: Kelas X-A Informatika"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="flex-1 bg-purple-50/50 border border-purple-100 rounded-2xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-purple-400 text-slate-800"
                required
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold text-xs px-4 py-2 rounded-2xl transition-all active:scale-95 border-none cursor-pointer shadow-sm flex-shrink-0"
              >
                {isLoading ? 'Proses...' : 'Buat 🚀'}
              </button>
            </form>
          </div>
        ) : (
          <div className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[28px] shadow-md p-5 border border-emerald-400/30 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100 mb-0">🟢 Status: Kelas Sedang Aktif</p>
              <span className="bg-emerald-400/40 text-emerald-50 font-black text-[10px] px-2 py-0.5 rounded-full">LIVE</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate mb-0 leading-tight">Selamat Mengajar!</h4>
                <p className="text-[11px] text-emerald-100/90 truncate mb-0 mt-0.5">Kode Akses Siswa: <span className="font-mono font-bold bg-white/20 px-1 py-0.5 rounded text-white">{classCode}</span></p>
              </div>
              <button 
                onClick={() => {
                  if(confirm("Apakah Anda ingin menutup sesi kelas ini?")) {
                    setClassCode('');
                    setStudents([]);
                    setIsClassLocked(false);
                    setAnalyzedTopics([]);
                    // 💡 Hapus data kelas dari localStorage saat kelas ditutup resmi
                    localStorage.removeItem('teacher_class_code');
                    localStorage.removeItem('teacher_class_locked');
                  }
                }} 
                className="bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] px-3 py-2 rounded-xl border-none cursor-pointer transition-all active:scale-95 flex-shrink-0"
              >
                Tutup Kelas 🟥
              </button>
            </div>
          </div>
        )}

        {/* OVERVIEW */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-center text-slate-900 tracking-wide">Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 text-center">
              <span className="font-semibold text-slate-700 text-sm">Online</span>
              <div className="h-14 w-full bg-gradient-to-r from-[#ffd9ff] to-[#fbcaff] rounded-[20px] shadow-inner border border-white/60 flex items-center justify-center font-bold text-base text-purple-900">{siswaOnline} Siswa</div>
            </div>
            <div className="space-y-1.5 text-center">
              <span className="font-semibold text-slate-700 text-sm">Semua Siswa</span>
              <div className="h-14 w-full bg-gradient-to-r from-[#ffd9ff] to-[#fbcaff] rounded-[20px] shadow-inner border border-white/60 flex items-center justify-center font-bold text-base text-purple-900">{totalSiswa} Siswa</div>
            </div>
          </div>
        </div>

        {/* PERTANYAAN */}
        <div className="space-y-2.5">
          <div className="flex gap-2 px-1">
            <button onClick={() => setActiveTab('minggu-ini')} className={`text-sm font-bold px-4 py-1.5 rounded-full transition-all border-none bg-transparent cursor-pointer ${activeTab === 'minggu-ini' ? 'bg-white/80 shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Minggu ini</button>
            <button onClick={() => setActiveTab('minggu-lalu')} className={`text-sm font-bold px-4 py-1.5 rounded-full transition-all border-none bg-transparent cursor-pointer ${activeTab === 'minggu-lalu' ? 'bg-white/80 shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>Minggu lalu</button>
          </div>

          <div className="w-full min-h-[300px] bg-gradient-to-b from-[#fca0ff] to-[#fecfff] rounded-[28px] shadow-[0_12px_35px_rgba(243,167,255,0.3)] p-5 border border-white/40 flex flex-col">
            <p className="text-xs font-bold text-purple-950/80 mb-3 tracking-wide">🔥 Topik Analisis Chat Paling Sering Ditanyakan:</p>
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              {/* 💡 SEKARANG RENDER DATA HASIL ANALISIS REAL DARI GEMINI BACKEND */}
              {analyzedTopics && analyzedTopics.length > 0 ? (
                analyzedTopics.map((item, idx) => (
                  <div key={idx} className="bg-white/40 hover:bg-white/60 transition-all p-3 rounded-2xl border border-white/30 flex items-center justify-between gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] animate-fadeIn">
                    <span className="text-xs font-bold text-purple-950 leading-snug">
                      ✨ {item.topic}
                    </span>
                    <span className="bg-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 shadow-sm">
                      {item.total}x
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-purple-950/60 text-center italic py-12">
                  Belum ada aktivitas obrolan atau data analisis terdeteksi untuk periode ini.
                </p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* POP-UP MODAL KICK */}
      {isKickModalOpen && selectedStudentToKick && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-6 text-center shadow-[0_25px_60px_-10px_rgba(0,0,0,0.3)] border border-purple-50">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 text-red-500 mb-4 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Keluarkan Siswa?</h3>
            <p className="text-sm text-slate-500 mt-2 px-2 leading-relaxed">Apakah Anda yakin ingin mengeluarkan <span className="font-bold text-slate-800">"{selectedStudentToKick.name}"</span> dari ruang kelas?</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => { setIsKickModalOpen(false); setSelectedStudentToKick(null); }} className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-full transition-all active:scale-[0.97] border-none cursor-pointer">Batal</button>
              <button type="button" onClick={confirmKickStudent} className="h-12 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-full transition-all shadow-[0_4px_12px_rgba(239,68,68,0.2)] active:scale-[0.97] border-none cursor-pointer">Ya, Keluarkan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}