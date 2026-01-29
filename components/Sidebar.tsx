import React from 'react';
import { Role, UserSession } from '../types';
import { LogOut, BookOpen, GraduationCap, FileText, Home, Monitor, User, BarChart2, CalendarClock, Activity } from 'lucide-react';

interface SidebarProps {
  user: UserSession;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, onTabChange, onLogout }) => {
  const getMenuItems = () => {
    switch (user.role) {
      case Role.ADMIN:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: Home },
          { id: 'students', label: 'Data Siswa', icon: GraduationCap },
          { id: 'questions', label: 'Bank Soal', icon: BookOpen },
          { id: 'exams', label: 'Jadwal Ujian', icon: CalendarClock },
          { id: 'monitor', label: 'Monitoring Ujian', icon: Activity },
          { id: 'analysis', label: 'Analisis Nilai', icon: BarChart2 },
        ];
      case Role.TEACHER_LITERASI:
      case Role.TEACHER_NUMERASI:
        // Guru akses Bank Soal dan Analisis Nilai sesuai bidangnya
        return [
           { id: 'questions', label: 'Bank Soal', icon: BookOpen },
           { id: 'analysis', label: 'Analisis Nilai', icon: BarChart2 },
        ];
      case Role.STUDENT:
        return [
          { id: 'dashboard', label: 'Ujian Aktif', icon: FileText },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-white/10 text-white flex flex-col h-full shadow-2xl relative">
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent opacity-50"></div>
      
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex gap-2 mb-4 opacity-50">
          <div className="w-2 h-2 bg-slate-600"></div>
          <div className="w-2 h-2 bg-slate-600"></div>
          <div className="w-2 h-2 bg-slate-600"></div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/50 border border-white/10 text-black rounded transform -skew-x-12 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-8 w-8 object-contain skew-x-12" />
            </div>
            <div>
                <h1 className="text-lg font-black tracking-tighter text-white leading-tight uppercase italic">
                  {user.role === Role.ADMIN ? 'Admin Panel' : 'Guru Panel'}
                </h1>
                <p className="text-[10px] text-yellow-500 font-mono tracking-widest uppercase opacity-80">Online</p>
            </div>
        </div>
      </div>

      <div className="px-6 mt-6 mb-2">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Menu Utama</p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {getMenuItems().map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 transition-all duration-300 text-sm font-bold uppercase tracking-wide group relative overflow-hidden transform ${
              activeTab === item.id 
                ? 'text-black bg-yellow-500 skew-x-12 border-l-4 border-white' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className={`flex items-center gap-3 ${activeTab === item.id ? '-skew-x-12' : ''}`}>
               <item.icon size={18} className={`${activeTab === item.id ? 'text-black' : 'text-slate-500 group-hover:text-yellow-500'} transition-colors`} />
               <span>{item.label}</span>
            </div>
            {activeTab !== item.id && <div className="absolute right-0 top-0 h-full w-1 bg-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
          </button>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 bg-black/20 backdrop-blur-sm border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 text-yellow-500 flex items-center justify-center">
                <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-white uppercase">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate font-mono">Role: {user.role}</p>
            </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 bg-red-900/20 border border-red-900/50 text-red-500 py-2 hover:bg-red-900/40 hover:text-red-400 transition-all text-xs font-bold uppercase tracking-wider skew-x-12"
        >
          <span className="-skew-x-12 flex items-center gap-2"><LogOut size={14} /> Keluar</span>
        </button>
      </div>
    </div>
  );
};