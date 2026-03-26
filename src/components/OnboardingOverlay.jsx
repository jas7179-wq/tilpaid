import { useState, useEffect } from 'react';
import * as db from '../lib/db';
import { ChevronRight, X } from 'lucide-react';

const TIPS = [
  {
    id: 'welcome',
    title: 'Welcome to TilPaid!',
    message: 'Track every dollar between paychecks. Add your expenses as they happen and always know what\'s left.',
    icon: '💰',
  },
  {
    id: 'add-transaction',
    title: 'Log an expense',
    message: 'Tap the Add button in the nav bar to record a purchase. The amount entry works like an ATM — just type the numbers.',
    icon: '➕',
  },
  {
    id: 'reconcile',
    title: 'Stay accurate',
    message: 'The checkmark button lets you reconcile — compare your balance here with your bank to make sure they match.',
    icon: '✓',
  },
  {
    id: 'adjust',
    title: 'Fix your balance',
    message: 'The arrows button adjusts your balance if it gets out of sync. It creates a correction and locks older entries.',
    icon: '↕',
  },
  {
    id: 'done',
    title: 'You\'re all set!',
    message: 'Start logging your expenses. The more you use TilPaid, the clearer your spending picture becomes.',
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-surface-card w-full max-w-md rounded-t-2xl px-6 pt-6 pb-8">
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
              i === currentStep ? 'bg-brand-500' : i < currentStep ? 'bg-brand-200' : 'bg-gray-200'
            }`} />
          ))}
        </div>

        {/* Next button */}
        <button onClick={handleNext}
          className="w-full py-3 rounded-[10px] bg-brand-500 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          {isLast ? 'Get started' : 'Next'}
          {!isLast && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}
