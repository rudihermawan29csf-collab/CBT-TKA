import React, { useState } from 'react';
import { Role, UserSession } from '../types';
import { LogOut, BookOpen, GraduationCap, FileText, Home, Monitor, User, BarChart2, CalendarClock, Activity, Settings, Menu, ChevronLeft } from 'lucide-react';

interface SidebarProps {
  user: UserSession;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, onTabChange, onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getMenuItems = () => {
    switch (user.role) {
      case Role.ADMIN:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: Home },
          { id: 'students', label: 'Data Siswa', icon: GraduationCap },
          { id: 'questions', label: 'Bank Soal', icon: BookOpen },
          { id: 'exams', label: 'Jadwal Ujian', icon: CalendarClock },
          { id: 'monitor', label: 'Monitoring', icon: Activity },
          { id: 'analysis', label: 'Analisis', icon: BarChart2 },
          { id: 'settings', label: 'Pengaturan', icon: Settings },
        ];
      case Role.TEACHER_LITERASI:
      case Role.TEACHER_NUMERASI:
        return [
           { id: 'questions', label: 'Bank Soal', icon: BookOpen },
           { id: 'analysis', label: 'Analisis', icon: BarChart2 },
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
    // Structure: Flex Col, Height Full (parent is fixed), so this fits perfectly
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/10 text-white flex flex-col h-full shadow-2xl relative transition-all duration-300`}>
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent opacity-50 pointer-events-none"></div>
      
      {/* 1. Header (Fixed Height) */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between flex-none h-16">
        {!isCollapsed && (
            <div className="flex items-center gap-3 animate-fade-in overflow-hidden">
                <div className="w-8 h-8 bg-black/50 border border-white/10 text-black rounded transform -skew-x-12 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.4)] flex-none">
                    <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-6 w-6 object-contain skew-x-12" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-sm font-black tracking-tighter text-white leading-tight uppercase italic truncate">
                      {user.role === Role.ADMIN ? 'Admin Panel' : 'Guru Panel'}
                    </h1>
                </div>
            </div>
        )}
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-1.5 rounded hover:bg-white/10 text-slate-400 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
        >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {!isCollapsed && (
          <div className="px-6 mt-4 mb-2 flex-none">
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Menu Utama</p>
          </div>
      )}

      {/* 2. Navigation Area (Takes Remaining Space & Scrolls) */}
      <nav className={`flex-1 px-3 space-y-2 overflow-y-auto custom-scrollbar min-h-0 ${isCollapsed ? 'mt-4' : ''}`}>
        {getMenuItems().map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 transition-all duration-300 text-sm font-bold uppercase tracking-wide group relative overflow-hidden transform rounded-lg ${
              activeTab === item.id 
                ? 'text-black bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon size={isCollapsed ? 24 : 18} className={`${activeTab === item.id ? 'text-black' : 'text-slate-500 group-hover:text-yellow-500'} transition-colors flex-none`} />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* 3. User Profile / Logout (Fixed Bottom) */}
      <div className={`p-4 bg-black/40 backdrop-blur-sm border-t border-white/10 flex-none ${isCollapsed ? 'flex justify-center' : ''}`}>
        {!isCollapsed ? (
            <div className="flex items-center gap-3 mb-3 overflow-hidden">
                <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 text-yellow-500 flex items-center justify-center flex-none">
                    <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-white uppercase">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate font-mono">{user.role}</p>
                </div>
            </div>
        ) : (
            <div className="mb-3 w-10 h-10 rounded bg-slate-800 border border-slate-700 text-yellow-500 flex items-center justify-center">
                <User size={20} />
            </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center justify-center space-x-2 bg-red-900/20 border border-red-900/50 text-red-500 py-2 hover:bg-red-900/40 hover:text-red-400 transition-all text-xs font-bold uppercase tracking-wider ${!isCollapsed && 'skew-x-12'}`}
        >
          {isCollapsed ? <LogOut size={18}/> : <span className="-skew-x-12 flex items-center gap-2"><LogOut size={14} /> Keluar</span>}
        </button>
      </div>
    </div>
  );
};