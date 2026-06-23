import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { LegalBackLink } from "@/components/LegalBackLink";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "ExpenseTerminal Privacy Policy for Sociatty LLC, including financial data, AI processing, cookies, security, and privacy rights.",
  alternates: {
    canonical: "https://expenseterminal.com/privacy",
  },
};

const EFFECTIVE_DATE = "June 23, 2026";
const CONTACT_EMAIL = "expenseterminal@outlook.com";

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-none border border-[#E8EEF5] bg-white p-5 md:p-7 shadow-[0_14px_40px_rgba(13,31,53,0.04)]">
      <h2 className="font-display text-xl md:text-2xl text-[#0D1F35] mb-4">
        {title}
      </h2>
      <div className="space-y-4 text-sm md:text-[15px] leading-7 text-[#374151]">
        {children}
      </div>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-none border-l-4 border-[#C9A84C] bg-[#F5F0E8] px-4 py-3 text-sm leading-6 text-[#0D1F35]">
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <LandingNav />

      <main className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-16">
        <LegalBackLink href="/signup" label="Back to signup" />

        <header className="mb-10 rounded-none bg-[#0D1F35] px-6 py-8 text-white md:px-10 md:py-12">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#E8EEF5]">
            <span className="h-2 w-2 rounded-full bg-[#C9A84C]" />
            Effective {EFFECTIVE_DATE}
          </p>
          <h1 className="font-display text-4xl md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#E8EEF5] md:text-base">
            This Privacy Policy explains how Sociatty LLC, doing business as ExpenseTerminal
            (&ldquo;ExpenseTerminal,&rdquo; &ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
            or &ldquo;our&rdquo;), collects, uses, shares, protects, and deletes information
            when you use ExpenseTerminal, expenseterminal.com, and related services
            (collectively, the &ldquo;Service&rdquo;).
          </p>
        </header>

        <div className="space-y-6">
          <LegalSection title="1. Scope and Important Context">
            <p>
              ExpenseTerminal helps creators, freelancers, contractors, and small businesses
              organize transaction data, identify potential deductions, prepare tax-ready
              summaries, manage budgets, and estimate tax set-asides. The Service may process
              sensitive financial information, so we design our practices around data
              minimization, access control, and user control.
            </p>
            <Highlight>
              We are not a bank, accounting firm, CPA firm, law firm, tax preparer, broker,
              investment adviser, or money transmitter. Privacy protections in this policy do
              not convert ExpenseTerminal into a regulated financial institution or professional
              adviser.
            </Highlight>
          </LegalSection>

          <LegalSection title="2. Information We Collect">
            <p>
              We collect information you provide directly, information generated through your
              use of the Service, and information you authorize third parties to provide to us.
            </p>
            <h3 className="font-semibold text-[#0D1F35]">Account and profile information</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>Name, email address, password credentials or authentication identifiers, business profile details, tax-year settings, notification preferences, and support messages.</li>
              <li>Billing status, subscription plan, invoices, and payment metadata processed through our payment provider. We do not store full payment card numbers on our servers.</li>
            </ul>
            <h3 className="font-semibold text-[#0D1F35]">Financial and tax workflow information</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>CSV, Excel, or other files you upload, including transaction descriptions, vendors, dates, categories, amounts, account labels, notes, deductions, receipts, and tags.</li>
              <li>Financial account information you authorize through Plaid or similar providers, such as account names, account types, balances, transactions, institution identifiers, connection status, and related metadata.</li>
              <li>Outputs and settings generated in the Service, including categories, Schedule C mappings, deduction percentages, audit notes, budgets, income entries, rules, automations, exports, and reports.</li>
            </ul>
            <h3 className="font-semibold text-[#0D1F35]">Device, usage, and security information</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>IP address, browser type, device type, operating system, referring pages, pages viewed, feature usage, timestamps, diagnostics, and log data.</li>
              <li>Cookies, local storage, session identifiers, and similar technologies described in our <Link href="/cookies" className="text-[#5B82B4] underline">Cookie Policy</Link>.</li>
            </ul>
          </LegalSection>

          <LegalSection title="3. How We Use Information">
            <p>We use information for the following business and operational purposes:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide, maintain, secure, troubleshoot, and improve the Service.</li>
              <li>Create and manage your account, authenticate sessions, provide support, and send administrative notices.</li>
              <li>Import, normalize, categorize, search, sort, and display transactions and other financial data at your direction.</li>
              <li>Generate deduction suggestions, budget views, exports, tax summaries, quarterly tax set-aside estimates, reminders, and other product features.</li>
              <li>Process payments, manage subscriptions, prevent fraud, enforce our agreements, and comply with legal obligations.</li>
              <li>Develop aggregated or de-identified analytics that do not reasonably identify you.</li>
              <li>Send marketing communications where permitted by law, with the ability to unsubscribe from non-transactional emails.</li>
            </ul>
            <Highlight>
              We do not sell your personal information or financial data. We do not use your
              uploaded financial data or connected-account data to train our own general-purpose
              AI models, and we do not authorize service providers to use it to train their
              models except where you separately direct or consent.
            </Highlight>
          </LegalSection>

          <LegalSection title="4. AI Processing">
            <p>
              ExpenseTerminal may use artificial intelligence and automated rules to classify
              transactions, suggest Schedule C categories, create audit-friendly explanations,
              identify possible deductions, and summarize tax or budget information. These
              outputs are generated from the data you provide or authorize us to access.
            </p>
            <p>
              To provide these features, we may send limited transaction data, labels, notes,
              and related context to contracted AI infrastructure providers. We use these
              providers only to deliver and improve the Service under their applicable data
              protection terms and our instructions.
            </p>
            <p>
              AI outputs can be incomplete or incorrect. You are responsible for reviewing all
              categories, deduction percentages, estimates, exports, and reports before relying
              on them or sharing them with a tax professional.
            </p>
          </LegalSection>

          <LegalSection title="5. How We Share Information">
            <p>
              We share information only as needed to provide the Service, operate our business,
              comply with law, or protect rights and safety.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Service providers:</strong> Hosting, database, authentication, storage, email delivery, analytics, security, error monitoring, AI processing, customer support, and operational vendors.</li>
              <li><strong>Financial connection providers:</strong> Plaid or similar providers when you choose to connect financial accounts. Their services are governed by their own terms and privacy notices.</li>
              <li><strong>Payment processors:</strong> Stripe or similar processors for checkout, billing, tax, fraud prevention, and subscription management.</li>
              <li><strong>Professional advisers:</strong> Lawyers, accountants, insurers, auditors, and other advisers under duties of confidentiality.</li>
              <li><strong>Legal and safety disclosures:</strong> Courts, regulators, law enforcement, or other parties when we believe disclosure is required by law or necessary to protect users, the Service, or our legal rights.</li>
              <li><strong>Business transfers:</strong> A buyer, successor, or affiliate in connection with a merger, financing, acquisition, reorganization, bankruptcy, or sale of assets.</li>
            </ul>
          </LegalSection>

          <LegalSection title="6. Financial Connections and Plaid">
            <p>
              If you connect a bank, card, or other financial account, you authorize
              ExpenseTerminal and the applicable financial data provider to access and process
              information from that account to provide the Service. You may disconnect accounts
              through the Service where available or by contacting us.
            </p>
            <p>
              We do not receive your online banking password from Plaid. We may store encrypted
              access tokens or related identifiers that allow the Service to refresh data you
              have authorized. Plaid and your financial institution may independently process
              your information under their own agreements.
            </p>
          </LegalSection>

          <LegalSection title="7. Cookies and Tracking">
            <p>
              We use cookies and similar technologies for authentication, security, preferences,
              product functionality, analytics, diagnostics, and payment or financial connection
              flows. Please review our <Link href="/cookies" className="text-[#5B82B4] underline">Cookie Policy</Link> for more detail.
            </p>
            <p>
              Browser controls may let you block or delete cookies. Blocking necessary cookies
              may prevent the Service from working. We do not use cookies to sell your financial
              data or serve third-party behavioral advertising based on your transaction history.
            </p>
          </LegalSection>

          <LegalSection title="8. Security">
            <p>
              We use administrative, technical, and organizational safeguards designed to
              protect information, including encryption in transit, access controls, credential
              protections, vendor review, logging, backups, and encryption for sensitive tokens
              where appropriate.
            </p>
            <p>
              No internet service can guarantee perfect security. You are responsible for using
              a strong password, protecting your devices, keeping your login credentials
              confidential, and promptly notifying us of suspected unauthorized account access.
            </p>
          </LegalSection>

          <LegalSection title="9. Retention and Deletion">
            <p>
              We keep information for as long as reasonably necessary to provide the Service,
              maintain business records, comply with law, resolve disputes, enforce agreements,
              prevent fraud, and maintain backups. Retention periods vary depending on the type
              of data and the reason we hold it.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account and billing records may be retained while your account is active and for a reasonable period afterward for legal, tax, accounting, and dispute purposes.</li>
              <li>Uploaded files, transactions, rules, budgets, reports, and connected-account data are retained while needed to provide the Service or until deleted, subject to backups and legal requirements.</li>
              <li>Security logs and diagnostic data may be retained to protect the Service and investigate abuse.</li>
            </ul>
            <p>
              If you request account deletion, we will delete or de-identify personal
              information unless retention is reasonably necessary or legally required. Backup
              copies may persist for a limited period before being overwritten.
            </p>
          </LegalSection>

          <LegalSection title="10. Your Choices and Privacy Rights">
            <p>
              Depending on where you live, you may have rights to access, correct, delete,
              export, restrict, or object to certain processing of your personal information.
              You may also withdraw consent where processing is based on consent and opt out of
              certain communications.
            </p>
            <p>
              To exercise privacy rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#5B82B4] underline">{CONTACT_EMAIL}</a>.
              We may need to verify your identity and authority before completing a request. We
              will not discriminate against you for exercising rights provided by applicable law.
            </p>
            <p>
              California residents may have rights under the CCPA/CPRA, including the rights to
              know, delete, correct, limit certain uses of sensitive personal information, and
              opt out of sale or sharing. We do not sell personal information, and we do not
              share personal information for cross-context behavioral advertising.
            </p>
          </LegalSection>

          <LegalSection title="11. International Users">
            <p>
              ExpenseTerminal is operated from the United States. If you access the Service from
              outside the United States, your information may be processed in the United States
              and other countries where our providers operate. These locations may have data
              protection laws different from those in your jurisdiction.
            </p>
            <p>
              Where required, we rely on appropriate safeguards for international transfers,
              such as standard contractual clauses or other lawful transfer mechanisms.
            </p>
          </LegalSection>

          <LegalSection title="12. Children">
            <p>
              The Service is not directed to children under 18, and we do not knowingly collect
              personal information from children. If you believe a child has provided personal
              information to us, contact us and we will take appropriate steps to delete it.
            </p>
          </LegalSection>

          <LegalSection title="13. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. If we make material changes,
              we will provide notice through the Service, by email, or as otherwise required by
              law. The effective date above indicates when this policy was last revised.
            </p>
          </LegalSection>

          <LegalSection title="14. Contact">
            <p>
              Questions, requests, and privacy notices may be sent to:
            </p>
            <div className="rounded-none bg-[#F0F1F7] p-4 text-[#0D1F35]">
              <p className="font-semibold">Sociatty LLC, doing business as ExpenseTerminal</p>
              <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#5B82B4] underline">{CONTACT_EMAIL}</a></p>
              <p>Mailing Address: Tenafly, New Jersey 07670</p>
            </div>
            <p className="text-xs text-[#6B7280]">
              Last updated: {EFFECTIVE_DATE}
            </p>
          </LegalSection>
        </div>
      </main>
    </div>
  );
}
