import { useNavigate, useLocation } from 'react-router-dom';
import { List, Plus, Settings, CalendarClock } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }) => (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px]"
    >
      <Icon size={20} className={isActive(path) ? 'text-brand-500' : 'text-text-muted'} strokeWidth={isActive(path) ? 2.2 : 1.5} />
      <span className={`text-[9px] font-medium ${isActive(path) ? 'text-brand-500' : 'text-text-muted'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="sticky bottom-0 border-t border-border bg-surface-card/90 backdrop-blur-sm z-10"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-end justify-evenly pt-2 relative">
        <NavItem path="/" icon={List} label="Ledger" />

        {/* Elevated Add button */}
        <div className="flex flex-col items-center -mt-5">
          <button
            onClick={() => navigate('/add')}
            className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30 mb-1"
          >
            <Plus size={22} className="text-white" strokeWidth={2.5} />
          </button>
          <span className={`text-[9px] font-medium ${isActive('/add') ? 'text-brand-500' : 'text-text-muted'}`}>
            Add
          </span>
        </div>

        <NavItem path="/recurring" icon={CalendarClock} label="Recurring" />
        <NavItem path="/settings" icon={Settings} label="Settings" />
      </div>
    </div>
  );
}
