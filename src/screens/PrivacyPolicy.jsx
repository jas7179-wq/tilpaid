import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface px-5 py-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-brand-500 text-sm font-medium mb-6">
        <ChevronLeft size={18} /> Back
      </button>

      <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-xs text-text-muted mb-6">Last updated: April 2026</p>

      <div className="space-y-5 text-sm text-text-secondary leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-text mb-2">Overview</h2>
          <p>
            TilPaid is a budgeting application published by Midline Digital LLC ("we", "us", "our").
            We are committed to protecting your privacy. This policy explains what data we collect,
            how we use it, and your rights regarding your information.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Data we collect</h2>
          <p className="mb-2">
            <strong className="text-text">Local data (stored on your device):</strong> Account balances,
            transactions, recurring bills, pay cycle information, categories, and app preferences.
            This data is stored locally using IndexedDB in your browser or device storage. We do not
            have access to this data unless you opt in to cloud sync.
          </p>
          <p>
            <strong className="text-text">Cloud sync data (optional):</strong> If you sign in with
            Apple or Google and enable sync, your financial data is encrypted and stored on our servers
            to enable cross-device access. You can delete your cloud data at any time from the Settings screen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Data we do NOT collect</h2>
          <p>
            TilPaid does not connect to your bank. We never access your bank credentials, account numbers,
            routing numbers, or any financial institution data. All transaction data is manually entered by you.
            We do not collect location data, contacts, photos, or any other personal information from your device.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Authentication</h2>
          <p>
            Sign-in is handled securely by Apple and Google. We receive only your name and email address
            from these providers. We never see or store your password.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">How we use your data</h2>
          <p>
            Your data is used solely to provide the TilPaid budgeting service to you. We do not sell,
            rent, or share your personal or financial data with third parties. We do not use your data
            for advertising or marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Data security</h2>
          <p>
            Local data is stored securely on your device. Cloud-synced data is transmitted over HTTPS
            and stored in encrypted databases. We use industry-standard security practices to protect
            your information.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Data deletion</h2>
          <p>
            You can delete all local data at any time from the Settings screen using "Erase all data & restart."
            If you use cloud sync, you can delete your cloud data from the same screen. Uninstalling the
            app removes all local data from your device.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Children's privacy</h2>
          <p>
            TilPaid is not directed at children under 13. We do not knowingly collect personal
            information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of any material changes
            by posting the updated policy within the app.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Contact us</h2>
          <p>
            If you have questions about this privacy policy or your data, contact us at:<br />
            <a href="mailto:support@tilpaid.app" className="text-brand-500 font-medium">support@tilpaid.app</a>
          </p>
          <p className="mt-2">
            Midline Digital LLC<br />
            Kyle, Texas
          </p>
        </section>
      </div>
    </div>
  );
}
