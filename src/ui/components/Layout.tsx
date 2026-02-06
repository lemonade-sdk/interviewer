import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Briefcase, Settings, History, Citrus } from 'lucide-react';
import { useStore } from '../store/useStore';

const Layout: React.FC = () => {
  const { loadSettings, loadInterviewerSettings } = useStore();

  useEffect(() => {
    loadSettings();
    loadInterviewerSettings();
  }, []);

  return (
    <div className="flex h-screen bg-lemonade-bg text-lemonade-fg">
      {/* Sidebar */}
      <aside className="w-64 bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3">
          <Citrus className="text-lemonade-accent-hover w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Interviewer</h1>
            <p className="text-xs text-gray-500">Lemonade SDK</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/dashboard" icon={<Home size={20} />} label="Dashboard" />
          <NavItem to="/interview-history" icon={<History size={20} />} label="History" />
          <NavItem to="/jobs" icon={<Briefcase size={20} />} label="Applications" />
          <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            <p>Version 1.0.0</p>
            <p className="mt-1">Powered by Lemonade</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-lemonade-bg">
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
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-lemonade-accent text-black font-bold shadow-sm'
            : 'text-gray-600 hover:bg-lemonade-bg hover:text-black'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export default Layout;
