import React, { useState } from 'react';
import axios from 'axios'; // <-- Tambahan untuk koneksi database
import logoImage from './assets/logo.png'; 

export default function Login({ onLogin, setIsRegistering }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Tembak API Login Laravel
      const response = await axios.post('http://127.0.0.1:8000/api/login', {
        email: email,
        password: password
      });

      if (response.data.success) {
        onLogin(response.data);
      }
    } catch (error) {
      if (error.response && error.response.data.message) {
        alert(error.response.data.message);
      } else {
        alert('Gagal terhubung ke server backend! Pastikan Laravel sudah menyala.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbcfe8] via-[#fdf2f8] to-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-200">
      
      <div className="mb-8 text-center pt-6">
        <div className="flex justify-center mb-4">
          <img src={logoImage} alt="Logo" style={{ width: '60px', height: 'auto' }} />
        </div>
        <h2 className="text-2xl md:text-3xl font-medium text-slate-900 px-4">
          Selamat Datang di Teman Belajar
        </h2>
        <p className="text-slate-600 mt-2 text-sm md:text-base">
          Silahkan Masuk Ke Akun Anda
        </p>
      </div>
      
      <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.15)] w-full max-w-[400px] mb-12">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-slate-800 font-medium text-base mb-2 pl-2">Email</label>
            <input 
              type="email" 
              required
              placeholder="nama@sekolah.sch.id"
              className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-700 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-800 font-medium text-base mb-2 pl-2">Kata Sandi</label>
            <div className="relative flex items-center">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="••••••••"
                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-700 text-sm pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-5 text-slate-400 hover:text-slate-700 bg-transparent border-none p-0 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <button 
              type="submit" 
              className="w-full bg-[#5e17eb] hover:bg-[#4c12c4] text-white font-medium text-base py-3.5 rounded-full border-none cursor-pointer"
            >
              MASUK
            </button>
          </div>

          <div className="text-center text-sm text-slate-500">
            Belum punya akun?{' '}
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              Daftar sekarang
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}