import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Briefcase, Settings, History } from 'lucide-react';
import { useStore } from '../store/useStore';

const Layout: React.FC = () => {
  const { loadSettings, loadInterviewerSettings } = useStore();

  useEffect(() => {
    loadSettings();
    loadInterviewerSettings();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary-600">AI Interviewer</h1>
          <p className="text-sm text-gray-500 mt-1">Practice & Improve</p>
        </div>

        <nav className="flex-1 p-4">
          <NavItem to="/dashboard" icon={<Home size={20} />} label="Dashboard" />
          <NavItem to="/interview-history" icon={<History size={20} />} label="Interview History" />
          <NavItem to="/jobs" icon={<Briefcase size={20} />} label="Job Applications" />
          <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            <p>Version 1.0.0</p>
            <p className="mt-1">Powered by Lemonade SDK</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export default Layout;
