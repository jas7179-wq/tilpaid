import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, CalendarClock, Shield, Smartphone, 
  ArrowRight, CheckCircle2, Plus, List, Clock,
  ChevronDown, X
} from 'lucide-react';
import { useState } from 'react';

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 220 }}>
      {/* Phone frame */}
      <div className="rounded-[32px] border-[6px] border-gray-800 bg-gray-800 overflow-hidden shadow-2xl">
        {/* Notch */}
        <div className="relative bg-surface">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-800 rounded-b-2xl z-10" />
          
          {/* Screen content */}
          <div className="pt-8 pb-4 px-3">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[8px] text-text-muted uppercase tracking-wider">Checking</p>
                <p className="text-xl font-semibold">$1,247.50</p>
                <p className="text-[9px] text-success-600 font-medium">TilPaid</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-brand-500 font-semibold">5d til pay</p>
              </div>
            </div>

            {/* Mini transaction list */}
            <div className="space-y-1.5">
              {[
                { desc: 'Groceries', amt: '-$67.23', color: '#E24B4A', cat: 'Food' },
                { desc: 'Electric bill', amt: '-$142.00', color: '#BA7517', cat: 'Bills' },
                { desc: 'Gas', amt: '-$38.50', color: '#534AB7', cat: 'Transport' },
                { desc: 'Paycheck', amt: '+$2,150.00', color: '#1D9E75', cat: 'Income', positive: true },
              ].map((tx, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-light last:border-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.color }} />
                    <div>
                      <p className="text-[9px] font-medium leading-tight">{tx.desc}</p>
                      <p className="text-[7px] text-text-muted">{tx.cat}</p>
                    </div>
                  </div>
                  <p className={`text-[9px] font-medium ${tx.positive ? 'text-success-600' : 'text-text'}`}>
                    {tx.amt}
                  </p>
                </div>
              ))}
            </div>

            {/* Mini nav */}
            <div className="flex justify-evenly mt-3 pt-2 border-t border-border">
              {[
                { icon: List, label: 'Ledger', active: true },
                { icon: Plus, label: 'Add', active: false },
                { icon: Clock, label: 'Recurring', active: false },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <item.icon size={10} className={item.active ? 'text-brand-500' : 'text-text-muted'} />
                  <span className={`text-[6px] ${item.active ? 'text-brand-500 font-medium' : 'text-text-muted'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border-light last:border-0">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="text-sm font-medium pr-4">{question}</span>
        <ChevronDown 
          size={16} 
          className={`text-text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
        />
      </button>
      {open && (
        <div className="pb-4 -mt-1">
          <p className="text-sm text-text-secondary leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  const goToApp = () => navigate('/app');

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[0.08]" 
            style={{ background: 'radial-gradient(circle, #1D9E75 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full opacity-[0.06]" 
            style={{ background: 'radial-gradient(circle, #4A8B3F 0%, transparent 70%)' }} />
        </div>

        <div className="max-w-lg mx-auto px-6 pt-14 pb-10 relative">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2DBF7E] to-[#1A8F5C] flex items-center justify-center">
              <DollarSign size={18} className="text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              <span className="text-text">Til</span><span className="text-success-600">Paid</span>
            </span>
          </div>

          {/* Headline */}
          <div className="mb-8">
            <h1 className="text-[2rem] leading-[1.15] font-semibold tracking-tight mb-3">
              Your money,<br />
              <span className="text-success-600">mapped to payday.</span>
            </h1>
            <p className="text-base text-text-secondary leading-relaxed max-w-sm">
              Know exactly what's left before payday. No bank linking. No judgment. Just clarity.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button 
              onClick={goToApp}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-[10px] bg-success-600 text-white text-[15px] font-medium active:scale-[0.98] transition-transform shadow-lg shadow-success-500/20"
            >
              Try it free <ArrowRight size={16} />
            </button>
            <p className="text-xs text-text-muted self-center">No account needed. Works instantly.</p>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[40px] opacity-20"
                style={{ background: 'linear-gradient(135deg, #4A8B3F 0%, #2DBF7E 100%)', filter: 'blur(24px)' }} />
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ── */}
      <section className="max-w-lg mx-auto px-6 py-12">
        <p className="text-xs text-success-600 font-semibold uppercase tracking-wider mb-2">Why TilPaid</p>
        <h2 className="text-xl font-semibold mb-8">Built for how you actually manage money</h2>

        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: Shield,
              title: 'Private by default',
              desc: 'Your data stays on your device. No bank linking ever.',
              color: '#4A8B3F',
            },
            {
              icon: CalendarClock,
              title: 'Payday countdown',
              desc: 'Always know how many days and dollars til you get paid.',
              color: '#1D9E75',
            },
            {
              icon: Smartphone,
              title: 'Manual & honest',
              desc: 'You enter what you spend. That awareness changes habits.',
              color: '#534AB7',
            },
            {
              icon: DollarSign,
              title: 'Running balance',
              desc: 'See exactly what\'s left after every transaction.',
              color: '#BA7517',
            },
          ].map((f, i) => (
            <div key={i} className="bg-surface-card rounded-[12px] border border-border p-3.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                style={{ backgroundColor: `${f.color}12` }}>
                <f.icon size={16} style={{ color: f.color }} />
              </div>
              <p className="text-[13px] font-medium mb-1">{f.title}</p>
              <p className="text-[11px] text-text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-lg mx-auto px-6 py-12">
        <p className="text-xs text-success-600 font-semibold uppercase tracking-wider mb-2">How it works</p>
        <h2 className="text-xl font-semibold mb-8">30 seconds to start</h2>

        <div className="space-y-5">
          {[
            {
              step: '1',
              title: 'Enter your balance',
              desc: 'Open your bank app, check your balance, type it in. That\'s your starting point.',
            },
            {
              step: '2',
              title: 'Set your payday',
              desc: 'Tell us when you get paid and how often. We\'ll track the countdown for you.',
            },
            {
              step: '3',
              title: 'Log what you spend',
              desc: 'Every coffee, every bill, every tank of gas. Quick taps, not spreadsheets.',
            },
            {
              step: '4',
              title: 'Know what\'s left',
              desc: 'Your running balance updates instantly. No surprises before payday.',
            },
          ].map((s, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-success-50 border border-success-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-success-700">{s.step}</span>
              </div>
              <div>
                <p className="text-sm font-medium mb-0.5">{s.title}</p>
                <p className="text-[13px] text-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-lg mx-auto px-6 py-12">
        <p className="text-xs text-success-600 font-semibold uppercase tracking-wider mb-2">Pricing</p>
        <h2 className="text-xl font-semibold mb-8">Start free, upgrade when you're ready</h2>

        <div className="space-y-3">
          {/* Free tier */}
          <div className="bg-surface-card rounded-[14px] border border-border p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-base font-semibold">Free</p>
                <p className="text-xs text-text-muted">Everything you need to start</p>
              </div>
              <p className="text-lg font-semibold">$0</p>
            </div>
            <div className="space-y-2">
              {[
                'Manual transaction entry',
                'Running balance tracker',
                'Payday countdown',
                'Category tracking',
                'CSV export',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-success-500 shrink-0" />
                  <span className="text-[13px] text-text-secondary">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Premium tier */}
          <div className="bg-gradient-to-br from-brand-50 to-success-50 rounded-[14px] border border-brand-200 p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">Coming soon</span>
            </div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-base font-semibold text-brand-700">Premium</p>
                <p className="text-xs text-brand-600">For serious budgeters</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-brand-700">$2.99</p>
                <p className="text-[10px] text-brand-500">/month</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                'Everything in Free',
                'Multiple accounts',
                'Recurring bills & deposits',
                'Calendar look-ahead view',
                'Spending insights & trends',
                'Cloud sync across devices',
                'Push notifications',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-brand-500 shrink-0" />
                  <span className="text-[13px] text-brand-700">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-lg mx-auto px-6 py-12">
        <p className="text-xs text-success-600 font-semibold uppercase tracking-wider mb-2">FAQ</p>
        <h2 className="text-xl font-semibold mb-6">Common questions</h2>

        <div className="bg-surface-card rounded-[14px] border border-border px-4">
          <FAQItem 
            question="Do I need to link my bank account?" 
            answer="Never. TilPaid is 100% manual entry. You enter your balance and transactions yourself. This keeps your financial data completely private and helps you stay more aware of your spending." 
          />
          <FAQItem 
            question="Where is my data stored?" 
            answer="Right on your device, in your browser's local storage. Nothing leaves your phone unless you sign in and enable cloud sync (premium feature). Even then, we never see your bank credentials." 
          />
          <FAQItem 
            question="Is this really free?" 
            answer="The core app is completely free — manual entry, running balance, payday countdown, categories, and CSV export. Premium adds multi-account support, recurring transactions, calendar views, and cloud sync for $2.99/month." 
          />
          <FAQItem 
            question="What if I forget to log a transaction?" 
            answer="Use the Reconcile feature to re-sync your balance with your bank. It adjusts your running total so you're always accurate, even if you missed a few entries." 
          />
          <FAQItem 
            question="Can I use this on multiple devices?" 
            answer="With Premium, you can sign in with Apple or Google and sync your data across devices. On the free tier, your data stays on the single device you're using." 
          />
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="max-w-lg mx-auto px-6 pt-8 pb-16">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Ready to know what's left?</h2>
          <p className="text-sm text-text-secondary mb-6">Takes 30 seconds. No signup required.</p>
          <button 
            onClick={goToApp}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-[10px] bg-success-600 text-white text-[15px] font-medium active:scale-[0.98] transition-transform shadow-lg shadow-success-500/20"
          >
            Start budgeting <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="max-w-lg mx-auto px-6 py-8 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2DBF7E] to-[#1A8F5C] flex items-center justify-center">
              <DollarSign size={12} className="text-white" />
            </div>
            <span className="text-sm font-medium">
              <span className="text-text">Til</span><span className="text-success-600">Paid</span>
            </span>
          </div>
          <p className="text-[11px] text-text-muted">© 2026 Midline Digital LLC</p>
        </div>
        <div className="flex gap-4 mt-3">
          <a href="/privacy" className="text-[11px] text-text-muted hover:text-text-secondary">Privacy Policy</a>
          <a href="/terms" className="text-[11px] text-text-muted hover:text-text-secondary">Terms of Service</a>
          <a href="mailto:support@tilpaid.app" className="text-[11px] text-text-muted hover:text-text-secondary">Contact</a>
        </div>
      </footer>
    </div>
  );
}
