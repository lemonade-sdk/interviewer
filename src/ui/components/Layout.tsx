import { useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Settings, History, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Separator } from './ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from '../lib/utils';

const Layout: React.FC = () => {
  const { loadSettings, loadInterviewerSettings, settings } = useStore();
  const location = useLocation();

  useEffect(() => {
    loadSettings();
    loadInterviewerSettings();
  }, []);

  // Apply theme class to document
  useEffect(() => {
    const theme = settings?.theme ?? 'light';
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [settings?.theme]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border bg-card flex flex-col">
          {/* Logo */}
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-widest uppercase text-foreground">
              interviewer
            </span>
          </div>

          <Separator />

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            <NavItem
              to="/dashboard"
              icon={<Home size={18} />}
              label="Dashboard"
              isActive={location.pathname === '/dashboard'}
            />
            <NavItem
              to="/interview-history"
              icon={<History size={18} />}
              label="History"
              isActive={location.pathname === '/interview-history'}
            />
            <NavItem
              to="/settings"
              icon={<Settings size={18} />}
              label="Settings"
              isActive={location.pathname === '/settings'}
            />
          </nav>

          <Separator />

          {/* Footer */}
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground text-center tracking-widest uppercase">
              powered by lemonade
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden bg-background">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
        >
          {icon}
          <span>{label}</span>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
};

export default Layout;
