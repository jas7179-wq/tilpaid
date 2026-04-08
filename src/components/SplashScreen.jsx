import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1600); // feels premium, not too fast

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#E8F5E9] to-[#4A8B3F] overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
      </div>

      {/* Main icon - the one you liked */}
      <div className="relative mb-8">
        <div className="w-28 h-28 bg-white rounded-3xl shadow-2xl flex items-center justify-center">
          <div className="relative">
            <CalendarClock size={72} className="text-[#4A8B3F]" strokeWidth={1.8} />
            {/* Dollar overlay */}
            <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-2xl border-4 border-[#4A8B3F] flex items-center justify-center shadow-inner">
              <span className="text-[#4A8B3F] text-5xl font-bold leading-none">$</span>
            </div>
          </div>
        </div>
      </div>

      {/* TilPaid name */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-5xl font-semibold text-white tracking-[-2px]">Til</span>
        <span className="text-5xl font-semibold text-white tracking-[-2px]">Paid</span>
      </div>

      {/* Tagline */}
      <p className="text-white text-xl font-medium text-center tracking-tight">
        Your money,<br />mapped to payday.
      </p>
    </div>
  );
}