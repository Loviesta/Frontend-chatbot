import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios'; // Memastikan axios terimport untuk menembak API Laravel
import ReactMarkdown from 'react-markdown'; // Mengimport library pendukung Markdown

export default function ChatSiswa({ user, onLogout, onUpdateAvatar }) {
  const [messages, setMessages] = useState([
    { id: 1, text: "Halo! Aku Teman Belajar AI. Ada materi sekolah atau tugas yang ingin kamu diskusikan hari ini?", isAi: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false); // <-- State untuk animasi loading chat AI
  
  // STATE ANTI-REFRESH: Mengambil kondisi awal langsung dari localStorage browser
  const [hasJoinedClass, setHasJoinedClass] = useState(() => localStorage.getItem('student_has_joined') === 'true'); 
  const [inputClassCode, setInputClassCode] = useState('');
  const [classError, setClassError] = useState('');
  const [activeClass, setActiveClass] = useState(() => localStorage.getItem('student_active_class') || ''); 
  const [classCode, setClassCode] = useState(() => localStorage.getItem('student_class_code') || ''); 

  // MULTI-SESI STATES
  const [sessions, setSessions] = useState([]); // Menyimpan daftar sesi di sidebar
  const [currentSessionId, setCurrentSessionId] = useState(() => localStorage.getItem('student_current_session') || `session-${Date.now()}`); // Sesi aktif saat ini

  const chatEndRef = useRef(null);

  // DETEKTOR REALTIME KICK GURU (MENGECEK STATUS TIAP 5 DETIK)
  useEffect(() => {
    // Jika siswa memang sedang berada di dalam ruang chat kelas, jalankan detektor
    if (hasJoinedClass) {
      const checkKickStatus = async () => {
        try {
          const token = localStorage.getItem('auth_token') || user?.token;
          if (!token) return;

          const response = await axios.get('http://127.0.0.1:8000/api/user/status', {
            headers: { Authorization: `Bearer ${token}` }
          });

          // RESPON JIKA DI DATABASE MYSQL STATUS CLASS_CODE SUDAH BERUBAH JADI NULL (DI-KICK GURU)
          if (response.data.success && response.data.class_code === null) {
            alert('Akses kamu dicabut! Kamu telah dikeluarkan dari kelas oleh guru. 🔒');
            
            // Bersihkan semua penyimpanan lokal terkait kelas
            localStorage.removeItem('student_has_joined');
            localStorage.removeItem('student_class_code');
            localStorage.removeItem('student_active_class');
            localStorage.removeItem('student_current_session');
            
            // Paksa state kembali ke tampilan utama pendaftaran kode kelas
            setHasJoinedClass(false);
            setClassCode('');
            setActiveClass('');
          }
        } catch (error) {
          console.error("Gagal memeriksa status keaktifan kelas:", error);
        }
      };

      // Setel interval pengecekan berkala otomatis
      const intervalId = setInterval(checkKickStatus, 5000);

      // Bersihkan interval saat komponen dilepas demi performa memori browser
      return () => clearInterval(intervalId);
    }
  }, [hasJoinedClass, user]);

  // Mengunci status jika user sudah punya kelas dari database Laravel maupun localStorage
  useEffect(() => {
    if (user?.class_code) {
      setHasJoinedClass(true);
      setClassCode(user.class_code);
      setActiveClass(user.class_name);
      
      localStorage.setItem('student_has_joined', 'true');
      localStorage.setItem('student_class_code', user.class_code);
      localStorage.setItem('student_active_class', user.class_name);
      
      fetchStudentSessions(user.class_code);
    } else if (hasJoinedClass && classCode) {
      fetchStudentSessions(classCode);
    }
  }, [user]);

  // Fungsi Hanya scroll ke bawah saat siswa kirim chat baru
  useEffect(() => {
    if (messages.length > 0 && !messages[messages.length - 1].isAi) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fokuskan layar ke bawah tepat di AWAL AI mulai merespon agar posisinya pas
  useEffect(() => {
    if (isAiTyping) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isAiTyping]);

  // Ambil daftar sesi unik dari backend saat berhasil masuk kelas
  const fetchStudentSessions = async (targetClassCode) => {
    const token = localStorage.getItem('auth_token') || user?.token;
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/classes/${targetClassCode}/sessions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setSessions(response.data.sessions);
      }
    } catch (error) {
      console.error("Gagal mengambil daftar sesi:", error);
    }
  };

  // Simpan log percakapan siswa & AI ke database analitik guru
  const saveChatToTeacherAnalytics = async (userMsg, aiMsg) => {
    const token = localStorage.getItem('auth_token') || user?.token;
    const currentCode = localStorage.getItem('student_class_code') || classCode;
    try {
      await axios.post(
        `http://127.0.0.1:8000/api/classes/${currentCode}/chats`,
        {
          session_id: currentSessionId,
          message: userMsg,
          response_ai: aiMsg,
          student_name: user?.name || user?.email || 'Siswa Teman Belajar'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh daftar sesi di sidebar agar judulnya terupdate/muncul
      fetchStudentSessions(currentCode);
    } catch (error) {
      console.error("Gagal menyimpan log analisis chat:", error);
    }
  };

  // Muat ulang riwayat pesan lama saat salah satu judul sesi di sidebar diklik
  const handleSelectSession = async (sessionId) => {
    const token = localStorage.getItem('auth_token') || user?.token;
    setIsSidebarOpen(false); // Tutup sidebar di tampilan HP
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/sessions/${sessionId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setCurrentSessionId(sessionId);
        localStorage.setItem('student_current_session', sessionId); // Amankan sesi aktif di localStorage
        
        if (response.data.messages.length === 0) {
          setMessages([
            { id: 1, text: "Halo! Aku Teman Belajar AI. Ada materi sekolah atau tugas yang ingin kamu diskusikan hari ini?", isAi: true }
          ]);
        } else {
          // Bentuk ulang struktur data dari MySQL agar sesuai state messages di React
          const formatted = response.data.messages.flatMap((msg) => [
            { id: `u-${msg.id}`, text: msg.message, isAi: false },
            { id: `a-${msg.id}`, text: msg.response_ai, isAi: true }
          ]);
          setMessages(formatted);
        }
      }
    } catch (error) {
      console.error("Gagal memuat pesan dari sesi ini:", error);
    }
  };

  // Fungsi tombol membuat obrolan baru (+ Chat Baru)
  const handleNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    setCurrentSessionId(newSessionId);
    localStorage.setItem('student_current_session', newSessionId);
    setMessages([
      { id: 1, text: "Halo! Aku Teman Belajar AI. Ada materi sekolah atau tugas yang ingin kamu diskusikan hari ini?", isAi: true }
    ]);
    setIsSidebarOpen(false);
  };

  // FUNGSI KIRIM PESAN KE GEMINI AI (Lewat Laravel) + EFEK TYPEWRITER
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isAiTyping) return;

    const currentInput = inputText.trim();
    
    // 1. Tambah pesan siswa ke layar terlebih dahulu
    const userMessage = { id: Date.now(), text: currentInput, isAi: false };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    
    // 2. Aktifkan status loading/mengetik
    setIsAiTyping(true);

    // Ambil token sanctum dari localStorage
    const token = localStorage.getItem('auth_token') || user?.token;
    const currentClassName = localStorage.getItem('student_active_class') || activeClass;

    try {
      // 3. Tembak rute /api/chat di Laravel dengan menyertakan nama kelas (activeClass)
      const response = await axios.post(
        'http://127.0.0.1:8000/api/chat',
        { 
          message: currentInput,
          active_class: currentClassName // INI AGAR LARAVEL TAHU MAPELNYA!
        },
        {
          headers: {
            Authorization: `Bearer ${token}` // Wajib kirim token biar lolos middleware
          }
        }
      );

      if (response.data.success) {
        // Matikan animasi loading titik-titik tepat sebelum pengetikan dimulai
        setIsAiTyping(false);

        const fullReply = response.data.reply;
        
        // EFEK TYPEWRITER (KATA PER KATA)
        const words = fullReply.split(' '); 
        let currentWordIndex = 0;
        let displayedText = '';
        const aiMessageId = Date.now() + 1;

        // Buat slot gelembung chat kosong milik AI terlebih dahulu di layar
        setMessages((prev) => [
          ...prev,
          { id: aiMessageId, text: '', isAi: true }
        ]);

        // Jalankan pencicilan teks kata per kata dengan interval 40ms
        const typingInterval = setInterval(() => {
          if (currentWordIndex < words.length) {
            displayedText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
            
            // Update teks di dalam gelembung secara real-time
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, text: displayedText } : msg
              )
            );
            
            currentWordIndex++;
          } else {
            // Bersihkan timer jika seluruh kata sudah dimunculkan semua
            clearInterval(typingInterval);
            
            // Simpan obrolan ke database ketika efek mengetik selesai sempurna!
            saveChatToTeacherAnalytics(currentInput, fullReply);
          }
        }, 40);
      }
    } catch (error) {
      console.error(error);
      setIsAiTyping(false);

      // fungsi status kelas ilegal / tidak ditemukan lagi di database akibat di-kick guru
      if (error.response && (error.response.status === 403 || error.response.status === 404)) {
        setHasJoinedClass(false);
        localStorage.removeItem('student_has_joined');
        localStorage.removeItem('student_class_code');
        localStorage.removeItem('student_active_class');
        alert('Ups! Kamu sudah tidak terdaftar di kelas ini atau akses kelas telah dicabut gurumu. 🔒');
        return;
      }

      const errorMessage = error.response?.data?.message || 'Aduh, koneksiku ke otak AI terputus. Pastikan server Laravel menyala ya! ⚠️';
      
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: errorMessage, isAi: true }
      ]);
    }
  };

  // FUNGSI VALIDASI KODE KELAS 
  const handleJoinClass = async (e) => {
    e.preventDefault();
    const formattedCode = inputClassCode.trim();

    if (!formattedCode) {
      setClassError('Kode kelas tidak boleh kosong ya! ❌');
      return;
    }

    const token = localStorage.getItem('auth_token') || user?.token;

    try {
      setClassError('');
      
      const response = await axios.post(
        'http://127.0.0.1:8000/api/check-class', 
        { class_code: formattedCode },
        {
          headers: {
            Authorization: `Bearer ${token}` 
          }
        }
      );

      if (response.data.success) {
        setClassCode(formattedCode); 
        setActiveClass(response.data.class_name); 
        setHasJoinedClass(true); 
        setClassError('');
        
        // Amankan semua status pendaftaran siswa ke localStorage biar anti-refresh
        localStorage.setItem('student_has_joined', 'true');
        localStorage.setItem('student_class_code', formattedCode);
        localStorage.setItem('student_active_class', response.data.class_name);
        localStorage.setItem('student_current_session', currentSessionId);
        
        // Tarik riwayat sesi obrolan yang pernah dibuat di kelas ini sebelumnya
        fetchStudentSessions(formattedCode);
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          setClassError('Kode kelas tidak ditemukan. Periksa kembali huruf besar-kecilnya! ❌');
        } else if (error.response.status === 403) {
          setClassError(error.response.data.message || 'Kelas sedang dikunci oleh guru! 🔒');
        } else if (error.response.status === 401) {
          setClassError('Sesi kamu telah berakhir. Silakan logout lalu login kembali! ⚠️');
        } else {
          setClassError(error.response.data.message || 'Gagal memproses permintaan kelas. ❌');
        }
      } else {
        setClassError('Gagal terhubung ke server. Pastikan server Laravel kamu menyala! ⚠️');
      }
    }
  };

  // FUNGSI LOGOUT INTEGRATED: Membersihkan semua jejak session siswa di komputer
  const handleStudentLogout = () => {
    localStorage.removeItem('student_has_joined');
    localStorage.removeItem('student_class_code');
    localStorage.removeItem('student_active_class');
    localStorage.removeItem('student_current_session');
    onLogout();
  };

  // bantuan untuk memformat URL avatar agar aman dari double domain / missing domain
  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'default'}`;
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      return avatarPath;
    }
    return `http://127.0.0.1:8000${avatarPath.startsWith('/') ? '' : '/'}${avatarPath}`;
  };

  return (
    <div className="h-screen flex bg-slate-50 font-sans relative overflow-hidden">
      
      {/* ================= MODAL POPUP: KUNCI GERBANG KODE KELAS ================= */}
      {!hasJoinedClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl border border-purple-100 p-6 md:p-8 space-y-5 text-center transform scale-100 transition-transform">
            
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600 text-2xl shadow-sm">
              🔑
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Masuk Ruang Kelas</h2>
              <p className="text-xs text-slate-500 leading-relaxed px-2">
                Silakan masukkan Kode Kelas yang diberikan oleh gurumu untuk mulai mengobrol dengan Teman Belajar AI.
              </p>
            </div>

            <form onSubmit={handleJoinClass} className="space-y-3">
              <input 
                type="text"
                placeholder="Contoh: AI-10A"
                value={inputClassCode}
                onChange={(e) => {
                  setInputClassCode(e.target.value);
                  if(classError) setClassError(''); 
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-center font-bold text-lg uppercase tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all shadow-inner"
              />

              {classError && (
                <p className="text-[11px] font-semibold text-red-500 bg-red-50 py-1.5 px-3 rounded-xl animate-shake mb-0">
                  {classError}
                </p>
              )}

              <button 
                type="submit"
                className="w-full bg-[#5e17eb] hover:bg-[#4c10c4] text-white font-bold py-3.5 rounded-2xl transition-all shadow-md active:scale-[0.98] border-none cursor-pointer text-sm"
              >
                Gabung Kelas 🚀
              </button>
            </form>

            <button 
              onClick={handleStudentLogout}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors border-none bg-transparent cursor-pointer"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      )}

      {/* ================= SIDEBAR RIWAYAT CHAT (KIRI) ================= */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-purple-50/50">
          <div className="flex flex-col">
            <h3 className="font-bold text-slate-800 text-sm leading-tight">Riwayat Belajar</h3>
            <span className="text-[10px] font-bold text-purple-600 mt-0.5">Kelas: {activeClass || '-'}</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600 md:hidden border-none bg-transparent cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-3">
          <button 
            onClick={handleNewChat}
            className="w-full bg-purple-50 hover:bg-purple-100 text-[#5e17eb] font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs border border-purple-200/50 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <span>➕</span> Obrolan Baru
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.length === 0 ? (
            <div className="p-3 text-slate-400 text-xs text-center italic">
              Belum ada riwayat belajar
            </div>
          ) : (
            sessions.map((ses) => (
              <div 
                key={ses.session_id}
                onClick={() => handleSelectSession(ses.session_id)}
                className={`p-3 rounded-xl text-xs font-medium cursor-pointer truncate transition-all ${
                  currentSessionId === ses.session_id 
                    ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-200' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                💬 {ses.title || "Obrolan Lama"}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
          Chatbot AI © 2026
        </div>
      </div>

      {/* Overlay penutup sidebar HP */}
      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-40 md:hidden" />
      )}

      {/* ================= AREA KONTEN UTAMA (KANAN) ================= */}
      <div className="flex-1 flex flex-col h-screen bg-white overflow-hidden">
        
        {/* HEADER ATAS */}
        <header className="h-16 border-b border-slate-100 px-4 flex items-center justify-between bg-white z-30 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none border-none bg-transparent cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Teman Belajar
          </h1>

          <div className="relative flex items-center">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 rounded-full hover:scale-105 transition-transform focus:outline-none flex items-center justify-center overflow-hidden border-2 border-purple-200 bg-slate-800 text-white shadow-sm border-none cursor-pointer"
            >
              <img 
                src={getAvatarUrl(user?.avatar)} 
                alt="Profil Siswa" 
                className="w-full h-full object-cover" 
                onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'siswa'}`; }} 
              />
            </button>

            {/* Dropdown Menu Akun Siswa */}
            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-fadeIn flex flex-col items-center">
                <div className="w-full px-4 pb-3 flex flex-col items-center border-b border-slate-100 relative group">
                  <label htmlFor="upload-avatar-siswa" className="cursor-pointer relative block group">
                    <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center overflow-hidden border-2 border-slate-200 shadow-sm group-hover:border-purple-500 transition-colors">
                      <img 
                        src={getAvatarUrl(user?.avatar)} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        onError={(e)=> { e.target.src=`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email || 'siswa'}`; }} 
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-white font-medium">Ganti</span>
                    </div>
                  </label>
                  
                  {/* KODE UPLOAD AVATAR (PERMANEN) */}
                  <input 
                    type="file" 
                    id="upload-avatar-siswa" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;

                      const formData = new FormData();
                      formData.append('avatar', file);

                      try {
                        const token = localStorage.getItem('auth_token') || user?.token;
                        
                        const response = await axios.post(
                          `http://127.0.0.1:8000/api/user/${user.id}/avatar`, 
                          formData,
                          {
                            headers: {
                              'Content-Type': 'multipart/form-data',
                              Authorization: `Bearer ${token}`
                            }
                          }
                        );

                        if (response.data.success) {
                          onUpdateAvatar(response.data.avatar);
                          alert('Avatar profil berhasil diperbarui secara permanen! 🌟');
                        }
                      } catch (error) {
                        console.error("Gagal mengunggah avatar:", error);
                        alert(error.response?.data?.message || 'Gagal mengunggah avatar ke server database.');
                      }
                    }}
                  />
                  
                  <p className="text-xs text-slate-400 mt-2 mb-0">Masuk sebagai</p>
                  <p className="text-sm font-semibold text-slate-800 truncate w-full text-center">{user?.email || 'Siswa Teman Belajar'}</p>
                </div>

                <button 
                  onClick={handleStudentLogout}
                  className="w-full text-left px-5 py-2 mt-1 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer"
                >
                  🚪 Keluar Akun
                </button>
              </div>
            )}
          </div>
        </header>

        {/* TAMPILAN GELEMBUNG CHAT */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-4">
          {messages.map((msg, index) => (
            <div key={msg.id || index} className={`flex ${msg.isAi ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed ${
                msg.isAi 
                  ? 'bg-slate-100 text-slate-800 rounded-tl-none' 
                  : 'bg-[#5e17eb] text-white rounded-tr-none shadow-sm'
              }`}>
                {msg.isAi ? (
                  <div className="space-y-2 break-words text-slate-800 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {/* INDIKATOR LOADING CHAT AI */}
          {isAiTyping && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-slate-100 text-slate-500 max-w-[80%] px-5 py-3 rounded-2xl rounded-tl-none text-sm italic flex items-center gap-2">
                <span>Teman Belajar AI sedang mengetik</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                </span>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* INPUT CHAT BAWAH */}
        <div className="p-4 bg-white border-t border-slate-100 flex justify-center shrink-0">
          <form onSubmit={handleSendMessage} className="w-full max-w-3xl flex items-center relative bg-white">
            <input 
              type="text"
              disabled={isAiTyping} 
              placeholder={isAiTyping ? "Tunggu sebentar ya..." : "Tanya apa saja ke Teman Belajar..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-full py-4 pl-6 pr-16 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] disabled:opacity-60"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isAiTyping}
              className="absolute right-2 p-3 bg-slate-200 hover:bg-[#5e17eb] text-slate-600 hover:text-white rounded-full transition-all active:scale-95 flex items-center justify-center border-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transform rotate-45 -translate-x-0.5 translate-y-0.5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.53 60.53 0 0 0 18.425-9.207v-.122A60.53 60.53 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}