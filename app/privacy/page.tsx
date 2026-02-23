import Link from "next/link";

export default function PrivacyPage() {
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

        <h1 className="font-display text-3xl text-mono-dark mb-2">Privacy Policy</h1>
        <p className="text-sm text-mono-light mb-10">Effective Date: February 20, 2026</p>

        <div className="card p-8 space-y-8 text-sm text-mono-medium leading-relaxed">
          <section>
            <p className="mb-4">
              Smith Global LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the ExpenseTerminal platform (&ldquo;Platform&rdquo;), including when you connect financial accounts through third-party aggregators such as Stripe Financial Connections or Plaid.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">1. Information We Collect</h2>
            <h3 className="text-base text-mono-dark mb-2 mt-4">1.1 Information You Provide Directly</h3>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Account registration data (name, email address, password, billing information)</li>
              <li>User profile information you choose to provide</li>
              <li>CSV files and other financial data files you upload to the Platform</li>
              <li>Communications you send to us (support requests, feedback)</li>
            </ul>
            <h3 className="text-base text-mono-dark mb-2 mt-4">1.2 Financial Account Data via Third-Party Aggregators</h3>
            <p className="mb-2">
              When you connect financial accounts through Stripe Financial Connections, Plaid, or similar services, we may receive:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Account balances and transaction histories</li>
              <li>Account identifiers (account numbers, routing numbers as applicable)</li>
              <li>Institution names and account types</li>
              <li>Investment holdings and tax-relevant financial data</li>
            </ul>
            <p>
              This data is retrieved only with your explicit authorization and is used solely to provide the Platform&apos;s tax analysis features.
            </p>
            <h3 className="text-base text-mono-dark mb-2 mt-4">1.3 Automatically Collected Data</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Log data (IP address, browser type, pages visited, timestamps)</li>
              <li>Device information (operating system, browser version, device identifiers)</li>
              <li>Usage data (features used, session duration, clicks)</li>
              <li>Cookies and similar tracking technologies (see Section 7 and our <Link href="/cookies" className="text-accent-navy underline">Cookie Policy</Link>)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">2. How We Use Your Information</h2>
            <p className="mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Provide, operate, maintain, and improve the Platform</li>
              <li>Process and analyze your uploaded financial data to generate tax insights</li>
              <li>Manage your account, subscriptions, and billing</li>
              <li>Send you service-related communications (account updates, security alerts)</li>
              <li>Send you optional marketing communications (with your consent, where required)</li>
              <li>Detect, prevent, and investigate fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
              <li>Conduct internal analytics and product development (using anonymized/aggregated data)</li>
            </ul>
            <p>
              We do <strong>NOT</strong> sell, rent, or lease your personal data or financial data to third parties. We do <strong>NOT</strong> use your uploaded financial data to train machine learning models without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">3. Legal Bases for Processing (For EEA/UK Users)</h2>
            <p className="mb-2">
              If you are located in the European Economic Area or United Kingdom, our legal bases for processing include:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contract performance</strong> — processing necessary to provide the Platform services</li>
              <li><strong>Legitimate interests</strong> — security, fraud prevention, product improvement</li>
              <li><strong>Legal compliance</strong> — meeting applicable regulatory requirements</li>
              <li><strong>Consent</strong> — where you have provided explicit consent (e.g., optional analytics, marketing)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">4. Information Sharing &amp; Disclosure</h2>
            <h3 className="text-base text-mono-dark mb-2 mt-4">4.1 Service Providers</h3>
            <p className="mb-3">
              We share data with trusted third-party service providers who assist in operating the Platform, including cloud hosting, payment processing, analytics, and customer support. These providers are contractually bound to use your data only as directed by us and in compliance with this Privacy Policy.
            </p>
            <h3 className="text-base text-mono-dark mb-2 mt-4">4.2 Financial Data Partners</h3>
            <p className="mb-3">
              Your financial account data may be shared with or retrieved through Stripe Financial Connections, Plaid, or other aggregators solely to facilitate account connectivity. These partners operate under their own privacy policies, which we encourage you to review.
            </p>
            <h3 className="text-base text-mono-dark mb-2 mt-4">4.3 Legal Requirements</h3>
            <p className="mb-3">
              We may disclose your information if required to do so by law, subpoena, court order, or other governmental request, or when we believe in good faith that disclosure is necessary to protect our rights, prevent fraud, or respond to an emergency.
            </p>
            <h3 className="text-base text-mono-dark mb-2 mt-4">4.4 Business Transfers</h3>
            <p className="mb-3">
              In the event of a merger, acquisition, bankruptcy, or sale of all or substantially all of our assets, your information may be transferred as part of that transaction. We will notify you via email and/or prominent notice on the Platform before your information is transferred and becomes subject to a different privacy policy.
            </p>
            <h3 className="text-base text-mono-dark mb-2 mt-4">4.5 Aggregate/Anonymized Data</h3>
            <p>
              We may share aggregated or de-identified data that cannot reasonably be used to identify you for research, analytics, or business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">5. Data Retention</h2>
            <p className="mb-2">We retain your personal and financial data for as long as your account is active or as needed to provide the Platform&apos;s services. Specifically:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Account data is retained until account deletion plus a 90-day grace period</li>
              <li>Uploaded financial files are retained for as long as you maintain them on the Platform; you may delete them at any time</li>
              <li>Financial connection data retrieved via aggregators is retained for the duration of your authorized connection plus 30 days following revocation</li>
              <li>Log and usage data is retained for up to 24 months</li>
              <li>Data required for legal compliance may be retained for longer periods as required by law</li>
            </ul>
            <p>
              Upon account deletion, we will delete or anonymize your personal data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">6. Data Security</h2>
            <p className="mb-2">
              We implement industry-standard technical and organizational security measures designed to protect your information from unauthorized access, use, alteration, or destruction. These measures include:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Encryption of data in transit (TLS 1.2+) and at rest (AES-256)</li>
              <li>Access controls limiting employee access to personal data on a need-to-know basis</li>
              <li>Regular security assessments and vulnerability testing</li>
              <li>Incident response and breach notification procedures</li>
            </ul>
            <p>
              However, no method of transmission over the internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security. You are responsible for maintaining the security of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">7. Cookies &amp; Tracking Technologies</h2>
            <p className="mb-3">
              We use cookies and similar technologies to maintain your logged-in session and Platform preferences, analyze Platform usage and performance (via analytics tools), and prevent fraud and enhance security.
            </p>
            <p className="mb-3">
              You may control cookie preferences through your browser settings. Disabling certain cookies may impact Platform functionality. We do not currently respond to Do Not Track (DNT) browser signals, but you may opt out of analytics tracking as described in our <Link href="/cookies" className="text-accent-navy underline">Cookie Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">8. Your Privacy Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Access &amp; Portability</strong> — Request a copy of the personal data we hold about you in a portable format</li>
              <li><strong>Correction</strong> — Request correction of inaccurate or incomplete personal data</li>
              <li><strong>Deletion</strong> — Request deletion of your personal data, subject to legal retention obligations</li>
              <li><strong>Restriction</strong> — Request that we restrict processing of your data in certain circumstances</li>
              <li><strong>Objection</strong> — Object to processing based on legitimate interests</li>
              <li><strong>Withdrawal of Consent</strong> — Where processing is based on consent, withdraw it at any time without affecting prior processing</li>
              <li><strong>Opt-Out of Sale/Sharing</strong> — We do not sell personal data; if this changes, you will have the right to opt out</li>
            </ul>
            <p className="mb-3">
              To exercise any of these rights, submit a request to <a href="mailto:expenseterminal@outlook.com" className="text-accent-navy underline">expenseterminal@outlook.com</a>. We will respond within 30 days (or as required by applicable law). We may need to verify your identity before fulfilling requests.
            </p>
            <p>
              You also have the right to lodge a complaint with the applicable data protection supervisory authority in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">9. California Privacy Rights (CCPA/CPRA)</h2>
            <p className="mb-2">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA):
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Right to Know</strong> — The categories and specific pieces of personal information collected about you</li>
              <li><strong>Right to Delete</strong> — Deletion of personal information we have collected, subject to exceptions</li>
              <li><strong>Right to Correct</strong> — Correction of inaccurate personal information</li>
              <li><strong>Right to Opt-Out</strong> — Opt out of the sale or sharing of personal information (we do not sell or share personal information for cross-context behavioral advertising)</li>
              <li><strong>Right to Limit Use of Sensitive Personal Information</strong> — Limit our use of sensitive personal information to what is necessary for providing the service</li>
              <li><strong>Right to Non-Discrimination</strong> — We will not discriminate against you for exercising your CCPA/CPRA rights</li>
            </ul>
            <p>
              To submit a CCPA/CPRA request, contact us at <a href="mailto:expenseterminal@outlook.com" className="text-accent-navy underline">expenseterminal@outlook.com</a> or call (201) 657-6035. We will verify your identity and respond within 45 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">10. Children&apos;s Privacy</h2>
            <p>
              The Platform is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information without parental consent, we will take steps to delete such information promptly. If you believe we may have collected information from a child, please contact us at <a href="mailto:expenseterminal@outlook.com" className="text-accent-navy underline">expenseterminal@outlook.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence, including the United States, where data protection laws may differ from those in your jurisdiction. For transfers from the EEA or UK, we rely on appropriate safeguards such as Standard Contractual Clauses (SCCs) approved by the European Commission. By using the Platform, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">12. Third-Party Links &amp; Integrations</h2>
            <p>
              The Platform may contain links to third-party websites or integrate with third-party services. This Privacy Policy does not apply to third-party services. We encourage you to review the privacy policies of any third-party services you interact with. We are not responsible for the privacy practices of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">13. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email to your registered address and/or by posting a prominent notice on the Platform at least 30 days before the effective date of the changes. Your continued use of the Platform after the effective date constitutes acceptance of the revised Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-mono-dark mb-3">14. Contact Us</h2>
            <p className="mb-2">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact:
            </p>
            <p className="mb-1">
              <strong>Smith Global LLC</strong>
            </p>
            <p className="mb-1">
              Privacy Team: <a href="mailto:expenseterminal@outlook.com" className="text-accent-navy underline">expenseterminal@outlook.com</a>
            </p>
            <p>
              Mailing Address: Tenafly, New Jersey 07670
            </p>
            <p className="mt-3 text-xs text-mono-light">
              This Privacy Policy was last updated on: February 20, 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
