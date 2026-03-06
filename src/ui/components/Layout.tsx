import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Settings, History } from 'lucide-react';
import { useStore } from '../store/useStore';

const Layout: React.FC = () => {
  const { loadSettings, loadInterviewerSettings, settings } = useStore();

  useEffect(() => {
    loadSettings();
    loadInterviewerSettings();
  }, []);

  useEffect(() => {
    const theme = settings?.theme ?? 'light';
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [settings?.theme]);

  return (
    <div className="flex h-screen bg-lemonade-bg dark:bg-lemonade-dark-bg text-lemonade-fg dark:text-white transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-60 bg-lemonade-bg dark:bg-lemonade-dark-surface border-r border-gray-200/50 dark:border-white/[0.08] flex flex-col transition-colors duration-300">
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3">
          <img src="/logo.png" alt="lemonade" className="w-8 h-8" />
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-black dark:text-white leading-none">
              interviewer
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 space-y-1">
          <NavItem to="/dashboard" icon={<Home size={18} />} label="Dashboard" />
          <NavItem to="/interview-history" icon={<History size={18} />} label="History" />
          <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" />
        </nav>

        {/* Footer */}
        <div className="px-4 pb-5 pt-3">
          <div className="px-4 py-3 rounded-xl bg-lemonade-accent/5 dark:bg-white/[0.03] border border-lemonade-accent/10 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[11px] font-semibold text-gray-600 dark:text-white/50">
                System Ready
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-white/20 text-center mt-4 tracking-wide">
            powered by lemonade
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-lemonade-bg dark:bg-lemonade-dark-bg transition-colors duration-300">
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
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-lemonade-accent text-black font-semibold'
            : 'text-gray-500 dark:text-white/40 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-black dark:hover:text-white'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export default Layout;
