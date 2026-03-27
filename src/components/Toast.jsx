import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';

let showToastGlobal = null;

export function toast(message = 'Saved!', duration = 1500) {
  if (showToastGlobal) showToastGlobal(message, duration);
}

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [leaving, setLeaving] = useState(false);

  const show = useCallback((msg, duration) => {
    setMessage(msg);
    setVisible(true);
    setLeaving(false);

    setTimeout(() => {
      setLeaving(true);
      setTimeout(() => {
        setVisible(false);
        setLeaving(false);
      }, 200);
    }, duration);
  }, []);

  useEffect(() => {
    showToastGlobal = show;
    return () => { showToastGlobal = null; };
  }, [show]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-12 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-brand-600 text-white text-sm font-medium flex items-center gap-2 shadow-lg ${
        leaving ? 'toast-exit' : 'toast-enter'
      }`}
    >
      <CheckCircle2 size={16} />
      {message}
    </div>
  );
}
