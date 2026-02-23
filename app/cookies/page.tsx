import Link from "next/link";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 text-sm text-mono-light hover:text-mono-medium transition-colors mb-10"
        >
          <span className="material-symbols-rounded text-[18px]">arrow_back</span>
          Back
        </Link>

        <h1 className="font-display text-3xl text-mono-dark mb-2">Cookie Policy</h1>
        <p className="text-sm text-mono-light mb-10">Effective Date: February 20, 2026</p>

        <div className="card p-8 space-y-8 text-sm text-mono-medium leading-relaxed">
          <section>
            <p className="mb-4">
              This Cookie Policy explains how Smith Global LLC, doing business as ExpenseTerminal (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), uses cookies and similar tracking technologies on the ExpenseTerminal platform (&ldquo;Platform&rdquo;). This policy should be read alongside our <Link href="/privacy" className="text-accent-navy underline">Privacy Policy</Link> and <Link href="/terms" className="text-accent-navy underline">Terms of Service</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device when you visit a website or use a web-based application. They allow the Platform to recognize your device, remember your preferences, and collect information about how you interact with our services. Similar technologies include web beacons, pixel tags, local storage objects, and session tokens — all of which we refer to collectively as &ldquo;cookies&rdquo; in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">2. Types of Cookies We Use</h2>
            <h3 className="text-base text-mono-dark mb-2 mt-4">2.1 Strictly Necessary Cookies</h3>
            <p className="mb-2">
              These cookies are essential for the Platform to function. They cannot be disabled without breaking core functionality. They include:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Session authentication tokens — keep you logged in during your session</li>
              <li>Security cookies — protect against cross-site request forgery (CSRF) and session hijacking</li>
              <li>Load balancing cookies — ensure stable platform performance</li>
            </ul>
            <p>
              <strong>Legal basis:</strong> These are required for contract performance. They do not require your consent.
            </p>

            <h3 className="text-base text-mono-dark mb-2 mt-4">2.2 Functional Cookies</h3>
            <p className="mb-2">
              These cookies remember your preferences and settings to enhance your experience. They include:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>UI preferences (e.g., column layouts, display settings)</li>
              <li>Language and regional settings</li>
              <li>Recently accessed files or reports</li>
            </ul>
            <p>
              <strong>Legal basis:</strong> Legitimate interests in providing a personalized experience. You may disable these but some features may not work as expected.
            </p>

            <h3 className="text-base text-mono-dark mb-2 mt-4">2.3 Analytics Cookies</h3>
            <p className="mb-2">
              These cookies help us understand how users interact with the Platform so we can improve it. They collect aggregated, anonymized data about:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Pages and features visited</li>
              <li>Session duration and click paths</li>
              <li>Error rates and performance metrics</li>
            </ul>
            <p className="mb-3">
              We may use third-party analytics providers such as Google Analytics, Mixpanel, or similar services. These providers process data under their own privacy policies. You may opt out of analytics cookies via your browser settings or our cookie preference center.
            </p>

            <h3 className="text-base text-mono-dark mb-2 mt-4">2.4 Payment &amp; Fraud Prevention Cookies</h3>
            <p className="mb-3">
              Our payment processor (e.g., Stripe) may set cookies to process transactions securely and detect fraudulent activity. These are governed by Stripe&apos;s own cookie and privacy policies. We do not control these cookies directly.
            </p>

            <h3 className="text-base text-mono-dark mb-2 mt-4">2.5 Financial Connection Cookies</h3>
            <p className="mb-2">
              When you connect financial accounts via Plaid or Stripe Financial Connections, those services may set their own cookies or local storage values during the connection flow. These are governed by each provider&apos;s respective policies. We recommend reviewing:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><a href="https://plaid.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-accent-navy underline">Plaid Privacy Policy</a></li>
              <li><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-navy underline">Stripe Privacy Policy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">3. What We Do NOT Use Cookies For</h2>
            <p className="mb-2">We do not use cookies to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Serve third-party advertisements or build advertising profiles</li>
              <li>Track you across unaffiliated websites for behavioral advertising</li>
              <li>Sell your cookie-derived data to data brokers or advertisers</li>
              <li>Fingerprint your device beyond what is necessary for security purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">4. Cookie Duration</h2>
            <p className="mb-2">Cookies we set fall into two categories by duration:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Session cookies</strong> — deleted automatically when you close your browser</li>
              <li><strong>Persistent cookies</strong> — remain on your device for a set period (typically 30–365 days) or until you delete them</li>
            </ul>
            <p>
              Strictly necessary and security cookies are generally session-based. Analytics and functional cookies may persist for up to 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">5. Your Cookie Choices &amp; Controls</h2>
            <h3 className="text-base text-mono-dark mb-2 mt-4">5.1 Browser Settings</h3>
            <p className="mb-2">
              Most browsers allow you to view, manage, block, and delete cookies through their settings. Common browser controls:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies and other site data</li>
              <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
              <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
              <li><strong>Edge:</strong> Settings &gt; Cookies and site permissions</li>
            </ul>
            <p className="mb-3">
              <strong>Note:</strong> blocking strictly necessary cookies will impair or prevent your ability to use the Platform.
            </p>

            <h3 className="text-base text-mono-dark mb-2 mt-4">5.2 Opt-Out of Analytics</h3>
            <p className="mb-3">
              You may opt out of Google Analytics tracking by installing the Google Analytics Opt-Out Browser Add-On available at: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-accent-navy underline">https://tools.google.com/dlpage/gaoptout</a>
            </p>

            <h3 className="text-base text-mono-dark mb-2 mt-4">5.3 Do Not Track</h3>
            <p>
              We do not currently alter our data collection practices in response to Do Not Track (DNT) browser signals, as there is no universally accepted standard for DNT. We will revisit this position as standards evolve.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">6. California Residents</h2>
            <p>
              Under the CCPA/CPRA, certain cookie-derived data may constitute &ldquo;personal information.&rdquo; We do not sell cookie-derived personal information. If you have questions about your California privacy rights in connection with our cookie practices, please see the California Privacy Rights section of our <Link href="/privacy" className="text-accent-navy underline">Privacy Policy</Link> or contact us at <a href="mailto:expenseterminal@outlook.com" className="text-accent-navy underline">expenseterminal@outlook.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">7. EEA &amp; UK Residents</h2>
            <p>
              If you access the Platform from the European Economic Area or United Kingdom, we will obtain your consent before placing non-essential cookies on your device, in accordance with the ePrivacy Directive and applicable national laws. You may withdraw consent at any time by adjusting your browser settings or contacting us. Strictly necessary cookies do not require consent under applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">8. Updates to This Cookie Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our practices or applicable law. We will notify you of material changes via the Platform or by email. The &ldquo;Effective Date&rdquo; at the top of this policy indicates when it was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">9. Contact Us</h2>
            <p className="mb-2">
              If you have questions about our use of cookies, please contact:
            </p>
            <p className="mb-1">
              <strong>Smith Global LLC, doing business as ExpenseTerminal</strong>
            </p>
            <p className="mb-1">
              Email: <a href="mailto:expenseterminal@outlook.com" className="text-accent-navy underline">expenseterminal@outlook.com</a>
            </p>
            <p>
              Mailing Address: Tenafly, New Jersey 07670
            </p>
            <p className="mt-3 text-xs text-mono-light">
              This Cookie Policy was last updated on: February 20, 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
