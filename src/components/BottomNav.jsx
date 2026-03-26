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
    </button>
  );

  return (
    <div className="sticky bottom-0 flex items-center justify-evenly py-3 pb-6 border-t border-border bg-surface-card z-10">
      <NavItem path="/" icon={List} label="Ledger" />
      <NavItem path="/add" icon={PlusCircle} label="Add" />
      <NavItem path="/upcoming" icon={CalendarClock} label="Upcoming" />
      <NavItem path="/settings" icon={Settings} label="Settings" />
    </div>
  );
}
