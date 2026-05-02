import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  Home, 
  CalendarDays, 
  PhoneCall, 
  AlertTriangle, 
  UserSquare2, 
  Settings,
  Play
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';

const NAV_ITEMS = [
  { id: 'Home', path: '/', icon: Home },
  { id: 'Appointments', path: '/appointments', icon: CalendarDays },
  { id: 'Call Log', path: '/call-log', icon: PhoneCall },
  { id: 'Campaigns', path: '/campaigns', icon: Play },
  { id: 'Escalations', path: '/escalations', icon: AlertTriangle },
  { id: 'Patient History', path: '/patients', icon: UserSquare2 },
  { id: 'Settings', path: '/settings', icon: Settings },
];

const VendorLayout = () => {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 p-1.5 rounded flex items-center justify-center">
               <UserSquare2 size={16} className="text-white" />
            </div>
            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">Vendor Dashboard</h1>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white font-medium shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                }`
              }
            >
              <item.icon size={18} strokeWidth={2} />
              {item.id}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex-1"></div>
          <div className="font-bold text-gray-900 text-[15px]">
            Chennai Dental Care
          </div>
          <div className="flex-1 flex justify-end items-center gap-4">
            <span className="text-sm text-gray-500">{user?.name || user?.email}</span>
            <button onClick={handleLogout} className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <span className="text-gray-400">&rarr;</span> Logout
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-6xl mx-auto">
             <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default VendorLayout;
