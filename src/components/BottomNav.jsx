import { useNavigate, useLocation } from 'react-router-dom';
import { List, Plus, Settings, CalendarClock } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }) => (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col items-center gap-1 px-4 py-1.5 min-w-[52px] transition-all active:scale-95"
    >
      <Icon 
        size={22} 
        className={isActive(path) ? 'text-brand-600 scale-110' : 'text-text-muted'} 
        strokeWidth={isActive(path) ? 2.5 : 1.75} 
      />
      <span className={`text-[10px] font-medium transition-colors ${isActive(path) ? 'text-brand-600' : 'text-text-muted'}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div 
      className="sticky bottom-0 border-t border-border/60 bg-white/80 backdrop-blur-xl z-50 shadow-xl shadow-black/5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-end justify-evenly pt-1 pb-1 relative">
        
        <NavItem path="/" icon={List} label="Ledger" />

        {/* Floating Add Button */}
        <div className="flex flex-col items-center -mt-6 relative z-10">
          <button
            onClick={() => navigate('/add')}
            className="w-14 h-14 rounded-3xl bg-gradient-to-br from-brand-500 to-[#2DBF7E] flex items-center justify-center shadow-2xl shadow-brand-500/40 active:scale-95 transition-all"
          >
            <Plus size={26} className="text-white" strokeWidth={2.75} />
          </button>
          <span className="text-[10px] font-medium text-text-muted mt-1">Add</span>
        </div>

        <NavItem path="/recurring" icon={CalendarClock} label="Recurring" />
        <NavItem path="/settings" icon={Settings} label="Settings" />

      </div>
    </div>
  );
}