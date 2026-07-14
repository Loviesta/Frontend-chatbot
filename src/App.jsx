import React, { useState, useEffect } from 'react'; 
import Login from './Login';
import ChatSiswa from './ChatSiswa';
import DashboardGuru from './DashboardGuru';
import DaftarSiswa from './DaftarSiswa';

function App() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 

  // 💡 SEBELUM HALAMAN DI-RENDER, CEK LOCALSTORAGE APAKAH USER SUDAH LOGIN
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser({
          ...userData,
          token: savedToken
        });
      } catch (error) {
        console.error("Gagal membaca data user dari localStorage", error);
        localStorage.clear();
      }
    }
    setIsLoading(false); 
  }, []);

  // 💡 SINKRONISASI OTOMATIS: Menyimpan token, user data, dan data kelas saat berhasil login
  const handleLogin = (userData) => {
    const profileData = userData.user ? {...userData.user, token:userData.token} : userData;
    // 🔒 MENGUNCI DATA UTAMA: Langsung amankan token dan data user ke storage browser agar tidak hilang saat di-refresh
    localStorage.setItem('auth_token', profileData.token || localStorage.getItem('auth_token'));
    localStorage.setItem('auth_user', JSON.stringify(profileData));

    if (profileData.role === 'guru') {
      localStorage.removeItem('student_has_joined');
      localStorage.removeItem('student_class_code');
      localStorage.removeItem('student_active_class');
      localStorage.removeItem('student_current_session');
    } else if (profileData.role === 'siswa' && profileData.class_code) {
      // Jika database mencatat siswa ini punya kelas, amankan statusnya ke localStorage browser
      localStorage.setItem('student_has_joined', 'true');
      localStorage.setItem('student_class_code', profileData.class_code);
      localStorage.setItem('student_active_class', profileData.class_name || '');
    }
    setUser(profileData);
  };

  // 💡 STATE UPDATE: Memperbarui data avatar di state utama dan localStorage secara sinkron
  const handleUpdateAvatar = (newAvatarUrl) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, avatar: newAvatarUrl };
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  // 💡 PERBAIKAN: Bersihkan semua data tanpa sisa saat logout
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('student_has_joined');
    localStorage.removeItem('student_class_code');
    localStorage.removeItem('student_active_class');
    localStorage.removeItem('student_current_session');
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-purple-600 font-medium text-lg animate-pulse">
          Memuat halaman...
        </div>
      </div>
    );
  }

  if (!user) {
    if (isRegistering) {
      return <DaftarSiswa setIsRegistering={setIsRegistering} onLogin={handleLogin} />;
    }
    return <Login onLogin={handleLogin} setIsRegistering={setIsRegistering} />;
  }

  if (user.role === 'siswa') {
    return <ChatSiswa user={user} onLogout={handleLogout} onUpdateAvatar={handleUpdateAvatar} />;
  }

  if (user.role === 'guru') {
    return <DashboardGuru user={user} onLogout={handleLogout} onUpdateAvatar={handleUpdateAvatar} />;
  }
}

export default App;