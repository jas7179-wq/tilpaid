import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface px-5 py-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-brand-500 text-sm font-medium mb-6">
        <ChevronLeft size={18} /> Back
      </button>

      <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
      <p className="text-xs text-text-muted mb-6">Last updated: April 2026</p>

      <div className="space-y-5 text-sm text-text-secondary leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-text mb-2">Agreement to terms</h2>
          <p>
            By downloading, installing, or using TilPaid ("the App"), you agree to be bound by these
            Terms of Service. The App is published by Midline Digital LLC ("we", "us", "our"),
            a Texas limited liability company.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Description of service</h2>
          <p>
            TilPaid is a manual-entry budgeting application designed to help you track spending
            between paychecks. The App does not connect to banks or financial institutions.
            All financial data is entered manually by you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Not financial advice</h2>
          <p>
            TilPaid is a tracking and organizational tool only. It does not provide financial advice,
            investment recommendations, tax guidance, or any professional financial services.
            You should consult a qualified financial professional for financial advice. We are not
            responsible for any financial decisions you make based on information displayed in the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">User accounts</h2>
          <p>
            You may use TilPaid without creating an account. If you choose to sign in with Apple
            or Google to enable cloud sync, you are responsible for maintaining the security of
            your authentication credentials. You must be at least 13 years old to use the App.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Free and premium tiers</h2>
          <p>
            TilPaid offers a free tier with core budgeting features and an optional Premium subscription
            with additional features. Premium subscriptions are billed through the Apple App Store or
            Google Play Store. Subscription management and cancellation are handled through your
            respective app store account settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Your data</h2>
          <p>
            You own all financial data you enter into TilPaid. We do not claim any ownership rights
            over your data. See our Privacy Policy for details on how your data is stored and protected.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Accuracy of data</h2>
          <p>
            Since all data is manually entered, you are responsible for the accuracy of the information
            in the App. TilPaid performs calculations based on the data you provide. We are not
            responsible for errors resulting from incorrect data entry.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Limitation of liability</h2>
          <p>
            TilPaid is provided "as is" without warranty of any kind. To the maximum extent permitted
            by law, Midline Digital LLC shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising from your use of the App. Our total liability
            shall not exceed the amount you paid for the App in the twelve months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Modifications</h2>
          <p>
            We reserve the right to modify these terms at any time. Continued use of the App after
            changes constitutes acceptance of the updated terms. We will make reasonable efforts to
            notify you of material changes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Termination</h2>
          <p>
            You may stop using TilPaid at any time by uninstalling the App and deleting your data.
            We may suspend or terminate your access to cloud sync services for violation of these terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Governing law</h2>
          <p>
            These terms are governed by the laws of the State of Texas. Any disputes shall be
            resolved in the courts of Hays County, Texas.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text mb-2">Contact us</h2>
          <p>
            Questions about these terms? Contact us at:<br />
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
