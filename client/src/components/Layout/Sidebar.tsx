import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Files,
  Camera,
  Settings,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../services/store';

const Sidebar: React.FC = () => {
  const { canManage, isAdmin } = useAuth();
  const { sidebarOpen, toggleSidebar } = useStore();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/templates', icon: Layers, label: 'Templates' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/files', icon: Files, label: 'Files' },
    { to: '/photos', icon: Camera, label: 'Photos' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
  ];

  const adminItems = [
    { to: '/users', icon: Users, label: 'Users', show: isAdmin() },
    { to: '/settings', icon: Settings, label: 'Settings', show: canManage() },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
        {sidebarOpen && (
          <span className="text-xl font-bold text-primary-400">ProjectMgr</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Admin Section */}
        {(isAdmin() || canManage()) && (
          <>
            <div className="mt-8 mb-4">
              {sidebarOpen && (
                <span className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
            <div className="space-y-1">
              {adminItems
                .filter((item) => item.show)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </NavLink>
                ))}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
