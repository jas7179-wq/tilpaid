import { useState, useEffect } from 'react';
import * as db from '../lib/db';
import { ChevronRight, X } from 'lucide-react';

const TIPS = [
  {
    id: 'welcome',
    title: 'Welcome to TilPaid!',
    message: 'Your money, mapped to payday. TilPaid shows you what\'s really left to spend between now and your next check — no bank linking, no guesswork.',
    icon: '💰',
  },
  {
    id: 'progress-ring',
    title: 'Your payday countdown',
    message: 'The ring at the top tracks how far you are through your pay cycle. Watch it fill up as payday gets closer.',
    icon: '⏱️',
  },
  {
    id: 'add-transaction',
    title: 'Log an expense',
    message: 'Tap the green Add button floating above the bottom nav to record a purchase. The amount entry works like an ATM — just type the numbers.',
    icon: '➕',
  },
  {
    id: 'tilpaid-balance',
    title: 'Your TilPaid balance',
    message: 'This isn\'t just your bank balance — it subtracts upcoming bills so you see what\'s actually safe to spend. No surprises before payday.',
    icon: '🛡️',
  },
  {
    id: 'recurring',
    title: 'Set up your bills',
    message: 'Add recurring bills from the Recurring screen. They\'ll show up on your ledger when they\'re due and get factored into your TilPaid balance automatically.',
    icon: '🔁',
  },
  {
    id: 'reconcile',
    title: 'Verify against your bank',
    message: 'Tap the Verify button to compare your TilPaid balance with your actual bank balance. Keeps everything in sync.',
    icon: '🏛️',
  },
  {
    id: 'done',
    title: 'You\'re all set!',
    message: 'Start logging expenses as you spend. The more you use TilPaid, the clearer your picture gets — and the fewer surprises before payday.',
    icon: '🎉',
  },
];

export default function OnboardingOverlay() {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function check() {
      const seen = await db.getSetting('onboardingSeen');
      if (!seen) {
        setDismissed(false);
      }
    }
    check();
  }, []);

  if (dismissed) return null;

  const tip = TIPS[currentStep];
  const isLast = currentStep === TIPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleDismiss();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleDismiss = async () => {
    await db.saveSetting('onboardingSeen', true);
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5 overlay-enter">
      <div className="bg-surface-card w-full max-w-sm rounded-2xl px-6 pt-6 pb-6 shadow-xl sheet-enter">
        {/* Skip */}
        <div className="flex justify-end mb-2">
          <button onClick={handleDismiss} className="text-xs text-text-muted flex items-center gap-1">
            Skip <X size={12} />
          </button>
        </div>

        {/* Icon */}
        <div className="text-center mb-4">
          <span className="text-4xl">{tip.icon}</span>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-center mb-2">{tip.title}</h3>
        <p className="text-sm text-text-secondary text-center leading-relaxed mb-6">{tip.message}</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {TIPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep ? 'bg-brand-500' : i < currentStep ? 'bg-brand-200' : 'bg-border'
            }`} />
          ))}
        </div>

        {/* Next button */}
        <button onClick={handleNext}
          className="w-full py-3 rounded-[10px] bg-brand-500 text-white text-sm font-medium flex items-center justify-center gap-2">
          {isLast ? 'Get started' : 'Next'}
          {!isLast && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}
