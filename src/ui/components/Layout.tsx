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
    <div className="flex h-screen bg-lemonade-bg text-lemonade-fg">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <img src="/logo.png" alt="lemonade" className="w-8 h-8" />
          <span className="text-lg font-bold tracking-widest text-black">NOVA AGENT</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavItem to="/dashboard" icon={<Home size={18} />} label="dashboard" />
          <NavItem to="/interview-history" icon={<History size={18} />} label="history" />
          <NavItem to="/jobs" icon={<Briefcase size={18} />} label="applications" />
          <NavItem to="/settings" icon={<Settings size={18} />} label="settings" />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center tracking-wide">
            powered by lemonade
          </p>
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
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
          isActive
            ? 'bg-lemonade-accent text-black font-semibold'
            : 'text-gray-500 hover:bg-lemonade-bg hover:text-black'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export default Layout;
