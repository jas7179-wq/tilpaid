import { useNavigate, useLocation } from 'react-router-dom';
import { List, PlusCircle, Settings, CalendarClock } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }) => (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col items-center gap-1 px-2 py-2 min-w-[48px]"
    >
      <Icon size={20} className={isActive(path) ? 'text-brand-500' : 'text-text-muted'} />
      <span className={`text-[9px] font-medium ${isActive(path) ? 'text-brand-500' : 'text-text-muted'}`}>
        {label}
      </span>
      {isActive(path) && (
        <div className="w-1 h-1 rounded-full bg-brand-500 -mt-0.5" />
      )}
    </button>
  );

  return (
    <div className="sticky bottom-0 flex items-center justify-evenly py-3 border-t border-border bg-surface-card/90 backdrop-blur-sm z-10"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <NavItem path="/" icon={List} label="Ledger" />
      <NavItem path="/add" icon={PlusCircle} label="Add" />
      <NavItem path="/recurring" icon={CalendarClock} label="Recurring" />
      <NavItem path="/settings" icon={Settings} label="Settings" />
    </div>
  );
}
