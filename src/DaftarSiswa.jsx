import React, { useState } from 'react';
import axios from 'axios';

export default function DaftarSiswa({ setIsRegistering, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('siswa');
  const [errorMessage, setErrorMessage] = useState('');
  
  // STATE UNTUK SHOWN/HIDE PASSWORD
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setErrorMessage('Kata sandi dan konfirmasi kata sandi tidak cocok!');
      return; 
    }

    try {
      setErrorMessage('');
      // Kirim data pendaftaran ke Laravel untuk disimpan ke tabel users
      const response = await axios.post('http://127.0.0.1:8000/api/register', {
        email: email,
        password: password,
        role: selectedRole
      });

      if (response.data.success) {
        // Pop-up alert bawaan browser sudah dihapus agar alur perpindahan halaman langsung instan
        onLogin(response.data.user); // Otomatis masuk akun sesuai role
      }
    } catch (error) {
      setErrorMessage('Pendaftaran gagal! Periksa koneksi internet atau database kamu.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-[#fcbfe8] via-[#fdf2f8] to-white p-4">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-8 md:p-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="text-center pb-2">
            <h3 className="text-xl font-bold text-slate-900">Buat Akun Baru</h3>
            <p className="text-xs text-slate-400 mt-1">Silakan lengkapi data diri Anda</p>
          </div>

          {/* Input Email */}
          <div className="space-y-2">
            <label className="block text-slate-800 text-base font-normal pl-2">Masukan Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 bg-[#f8f9fa] border border-slate-100 rounded-full px-6 text-slate-700 text-base"
              placeholder="contoh@email.com"
              required
            />
          </div>

          {/* Pilihan Role */}
          <div className="space-y-2">
            <label className="block text-slate-800 text-base font-normal pl-2">Mendaftar Sebagai</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('siswa')}
                className={`h-12 rounded-full font-semibold text-sm transition-all border cursor-pointer ${
                  selectedRole === 'siswa' ? 'bg-[#5b1eff] text-white border-[#5b1eff]' : 'bg-[#f8f9fa] text-slate-600'
                }`}
              >
                👨‍🎓 Siswa
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('guru')}
                className={`h-12 rounded-full font-semibold text-sm transition-all border cursor-pointer ${
                  selectedRole === 'guru' ? 'bg-[#5b1eff] text-white border-[#5b1eff]' : 'bg-[#f8f9fa] text-slate-600'
                }`}
              >
                👩‍🏫 Guru
              </button>
            </div>
          </div>

          {/* Input Kata Sandi */}
          <div className="space-y-2">
            <label className="block text-slate-800 text-base font-normal pl-2">Kata Sandi</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-[#f8f9fa] border border-slate-100 rounded-full pl-6 pr-14 text-slate-700 text-base"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 text-slate-400 hover:text-slate-600 bg-transparent border-none p-0 cursor-pointer text-xl"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Input Konfirmasi Kata Sandi */}
          <div className="space-y-2">
            <label className="block text-slate-800 text-base font-normal pl-2">Konfirmasi Kata Sandi</label>
            <div className="relative flex items-center">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-14 bg-[#f8f9fa] border border-slate-100 rounded-full pl-6 pr-14 text-slate-700 text-base"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-5 text-slate-400 hover:text-slate-600 bg-transparent border-none p-0 cursor-pointer text-xl"
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errorMessage && <p className="text-red-500 text-sm font-medium pl-2 pt-1">⚠️ {errorMessage}</p>}
          </div>

          <div className="pt-4">
            <button type="submit" className="w-full h-14 bg-[#5b1eff] text-white rounded-full font-medium text-lg border-none cursor-pointer">
              Konfirmasi
            </button>
          </div>

          <div className="text-center text-sm text-slate-500 pt-2">
            Sudah punya akun?{' '}
            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className="text-blue-600 font-semibold bg-transparent border-none p-0 cursor-pointer"
            >
              Login di sini
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}