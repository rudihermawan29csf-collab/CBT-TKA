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
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-200 text-slate-700 flex flex-col h-full relative transition-all duration-300`}>
      
      {/* Header & Toggle */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        {!isCollapsed && (
            <div className="flex items-center gap-3 animate-fade-in">
                <div className="w-10 h-10 bg-white border-2 border-[#00A2FF] text-black rounded-xl flex items-center justify-center shadow-[0_4px_0_0_#007ACC]">
                    <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-6 w-6 object-contain" />
                </div>
                <div>
                    <h1 className="text-sm font-black font-display tracking-tight text-slate-800 leading-tight uppercase">
                      {user.role === Role.ADMIN ? 'Admin' : 'Guru'}
                    </h1>
                    <span className="text-[10px] text-slate-400 font-bold">MODE: CREATOR</span>
                </div>
            </div>
        )}
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#00A2FF] transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
        >
            {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {!isCollapsed && (
          <div className="px-6 mt-6 mb-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Main Menu</p>
          </div>
      )}

      <nav className={`flex-1 px-4 space-y-2 ${isCollapsed ? 'mt-4' : ''}`}>
        {getMenuItems().map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 transition-all duration-200 text-sm font-bold tracking-wide group relative overflow-hidden transform rounded-2xl border-2 ${
              activeTab === item.id 
                ? 'bg-[#00A2FF] border-[#0085CC] text-white shadow-[0_4px_0_0_#006BB3] translate-y-[-2px]' 
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon size={isCollapsed ? 24 : 20} className={`${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-[#00A2FF]'} transition-colors`} strokeWidth={2.5} />
            {!isCollapsed && <span className="font-display">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User Profile */}
      <div className={`p-4 bg-slate-50 border-t border-slate-200 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {!isCollapsed ? (
            <div className="flex items-center gap-3 mb-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center">
                    <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate text-slate-800 uppercase">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate font-mono bg-slate-100 inline-block px-1 rounded">{user.role}</p>
                </div>
            </div>
        ) : (
            <div className="mb-3 w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center">
                <User size={20} />
            </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center justify-center space-x-2 bg-red-50 border-2 border-red-100 text-red-500 py-3 hover:bg-red-100 hover:border-red-200 hover:text-red-600 transition-all text-xs font-black uppercase tracking-wider rounded-xl`}
        >
          {isCollapsed ? <LogOut size={20}/> : <span className="flex items-center gap-2"><LogOut size={16} /> Keluar</span>}
        </button>
      </div>
    </div>
  );
};