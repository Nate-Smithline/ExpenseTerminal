import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { LegalBackLink } from "@/components/LegalBackLink";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "ExpenseTerminal Terms and Conditions for Sociatty LLC, including subscriptions, financial connections, AI outputs, disclaimers, and dispute resolution.",
  alternates: {
    canonical: "https://expenseterminal.com/terms",
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

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-none border-l-4 border-[#C9A84C] bg-[#F5F0E8] px-4 py-3 text-sm font-medium leading-6 text-[#0D1F35]">
      {children}
    </div>
  );
}

export default function TermsPage() {
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
            Terms and Conditions
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#E8EEF5] md:text-base">
            These Terms and Conditions (&ldquo;Terms&rdquo;) are a binding agreement
            between you and Sociatty LLC, doing business as ExpenseTerminal
            (&ldquo;ExpenseTerminal,&rdquo; &ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
            or &ldquo;our&rdquo;), governing your access to and use of ExpenseTerminal,
            expenseterminal.com, and related products and services (collectively, the
            &ldquo;Service&rdquo;).
          </p>
        </header>

        <div className="space-y-6">
          <LegalSection title="1. Acceptance of These Terms">
            <p>
              By creating an account, clicking to accept, connecting a financial account,
              uploading data, purchasing a subscription, or otherwise using the Service, you
              agree to these Terms and our <Link href="/privacy" className="text-[#5B82B4] underline">Privacy Policy</Link>.
              If you do not agree, you may not access or use the Service.
            </p>
            <p>
              If you use the Service on behalf of a company, organization, or other entity, you
              represent that you have authority to bind that entity, and &ldquo;you&rdquo; includes
              that entity.
            </p>
          </LegalSection>

          <LegalSection title="2. The Service">
            <p>
              ExpenseTerminal provides software tools for transaction import, bank connection
              workflows, AI-assisted categorization, deduction tracking, budget organization,
              income tracking, tax set-aside estimates, rules, exports, and related business
              recordkeeping workflows for creators, freelancers, contractors, and small
              businesses.
            </p>
            <p>
              We may add, change, suspend, or discontinue features at any time. Some features
              may be labeled beta, preview, experimental, or early access and may be incomplete,
              inaccurate, or changed without notice.
            </p>
          </LegalSection>

          <LegalSection title="3. No Tax, Legal, Accounting, or Financial Advice">
            <Warning>
              ExpenseTerminal provides software and informational outputs only. It does not
              provide tax advice, legal advice, accounting advice, financial advice, tax
              preparation, tax filing, or professional representation.
            </Warning>
            <p>
              We are not a CPA firm, accounting firm, law firm, tax preparer, enrolled agent,
              financial adviser, investment adviser, bank, lender, broker, or fiduciary. No
              accountant-client, attorney-client, adviser-client, fiduciary, or similar
              professional relationship is created by your use of the Service.
            </p>
            <p>
              All deductions, categories, Schedule C mappings, tax set-aside estimates, reports,
              exports, reminders, AI suggestions, and other outputs are for informational and
              organizational purposes only. You are solely responsible for reviewing outputs,
              maintaining accurate books and records, selecting tax positions, filing returns,
              paying taxes, and consulting qualified professionals where appropriate.
            </p>
            <p>
              We do not guarantee any deduction, refund, tax saving, audit result, compliance
              outcome, or financial result.
            </p>
          </LegalSection>

          <LegalSection title="4. Eligibility, Accounts, and Security">
            <p>
              You must be at least 18 years old and legally capable of entering a binding
              contract. You agree to provide accurate account information and keep it current.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>You are responsible for all activity under your account.</li>
              <li>You must keep credentials confidential and use reasonable security practices.</li>
              <li>You must promptly notify us of suspected unauthorized access or security incidents.</li>
              <li>We may refuse, suspend, or terminate accounts where permitted by these Terms or applicable law.</li>
            </ul>
          </LegalSection>

          <LegalSection title="5. Your Data and License to Operate the Service">
            <p>
              You retain ownership of data you upload, enter, connect, or generate through your
              use of the Service (&ldquo;User Data&rdquo;). User Data may include financial
              transactions, account labels, receipts, notes, rules, categories, reports, budgets,
              exports, profile data, and related information.
            </p>
            <p>
              You grant us a limited, worldwide, non-exclusive, royalty-free license to host,
              store, copy, process, transmit, display, analyze, format, and create technical
              derivatives of User Data solely to provide, secure, support, improve, and operate
              the Service and as otherwise described in our Privacy Policy.
            </p>
            <p>
              You represent that you have all rights, permissions, and lawful bases necessary to
              provide User Data to the Service and authorize us to process it. You are
              responsible for the accuracy, legality, completeness, and quality of User Data.
            </p>
          </LegalSection>

          <LegalSection title="6. Financial Connections">
            <p>
              The Service may let you connect bank, credit card, or other financial accounts
              through third-party providers such as Plaid. By using a financial connection, you
              authorize us and the applicable provider to access, retrieve, store, refresh, and
              process information from connected accounts to provide the Service.
            </p>
            <p>
              Financial connection providers and financial institutions are independent third
              parties. We are not responsible for their services, data accuracy, availability,
              security, terms, privacy practices, fees, or decisions. You may disconnect accounts
              where the Service provides that option or by contacting us.
            </p>
          </LegalSection>

          <LegalSection title="7. AI and Automated Outputs">
            <p>
              ExpenseTerminal may use AI, machine learning, deterministic rules, vendor pattern
              matching, and other automated systems to generate categories, explanations,
              confidence scores, deduction percentages, Schedule C mappings, reminders, summaries,
              and other outputs.
            </p>
            <p>
              Automated outputs may be wrong, incomplete, outdated, or unsuitable for your
              facts. You must review all outputs before relying on them. You agree not to treat
              AI outputs as professional advice, a final tax position, or a substitute for
              independent judgment.
            </p>
          </LegalSection>

          <LegalSection title="8. Subscriptions, Trials, Billing, and Taxes">
            <p>
              Certain features may require a paid subscription. Pricing, plan limits, trial
              terms, renewal periods, and feature availability are shown at checkout or in the
              Service and may change over time.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>You authorize us and our payment processor to charge your payment method for recurring fees, applicable taxes, and permitted adjustments.</li>
              <li>Subscriptions renew automatically unless canceled before the renewal date through available account settings or by contacting support.</li>
              <li>Fees are non-refundable except where required by law or expressly stated in writing by us.</li>
              <li>We may suspend or downgrade access for nonpayment, failed payment methods, chargebacks, abuse, or plan-limit violations.</li>
              <li>You are responsible for taxes, duties, and governmental charges associated with your purchase, other than taxes based on our net income.</li>
            </ul>
          </LegalSection>

          <LegalSection title="9. Acceptable Use">
            <p>You agree not to, and not to help anyone else:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the Service for unlawful, fraudulent, deceptive, harmful, abusive, or tax-evasion purposes.</li>
              <li>Upload data you do not have permission to process or data that violates another person&apos;s rights.</li>
              <li>Interfere with, disrupt, overload, scan, probe, or compromise the Service or related systems.</li>
              <li>Reverse engineer, decompile, copy, scrape, crawl, benchmark for competitive purposes, or extract source code except where law prohibits this restriction.</li>
              <li>Bypass access controls, rate limits, security controls, billing limits, or usage limits.</li>
              <li>Use the Service to build a competing product or resell, sublicense, rent, lease, or commercialize the Service without our written permission.</li>
              <li>Upload malware, exploit code, or content that is defamatory, invasive of privacy, infringing, or otherwise unlawful.</li>
              <li>Misrepresent ExpenseTerminal outputs as certified, audited, professionally reviewed, or government-approved unless we expressly state so in writing.</li>
            </ul>
          </LegalSection>

          <LegalSection title="10. Intellectual Property">
            <p>
              The Service, including software, workflows, designs, interfaces, graphics,
              trademarks, logos, text, documentation, models, prompts, taxonomies, and other
              materials, is owned by Sociatty LLC or its licensors and is protected by
              intellectual property laws.
            </p>
            <p>
              Subject to these Terms, we grant you a limited, revocable, non-exclusive,
              non-transferable, non-sublicensable license to access and use the Service for your
              personal or internal business purposes. No rights are granted except as expressly
              stated.
            </p>
            <p>
              If you provide feedback, suggestions, ideas, or requests, you grant us the right
              to use them without restriction, attribution, or compensation.
            </p>
          </LegalSection>

          <LegalSection title="11. Third-Party Services">
            <p>
              The Service may integrate with or link to third-party services, including Plaid,
              Stripe, Supabase, email providers, AI providers, tax-payment resources, and other
              tools. Third-party services are governed by their own terms and privacy policies.
              We do not control and are not responsible for third-party services.
            </p>
          </LegalSection>

          <LegalSection title="12. Suspension and Termination">
            <p>
              You may stop using the Service at any time. We may suspend or terminate access,
              remove content, or limit features if we reasonably believe you violated these
              Terms, created risk for the Service or other users, failed to pay fees, used the
              Service unlawfully, or if continued access could expose us to legal or security
              risk.
            </p>
            <p>
              Upon termination, your right to access the Service ends immediately. Sections that
              by their nature should survive will survive, including payment obligations,
              ownership, disclaimers, limitations of liability, indemnity, dispute resolution,
              and general provisions.
            </p>
          </LegalSection>

          <LegalSection title="13. Disclaimers">
            <Warning>
              To the maximum extent permitted by law, the Service is provided &ldquo;as is&rdquo;
              and &ldquo;as available,&rdquo; without warranties of any kind.
            </Warning>
            <p>
              We disclaim all express, implied, and statutory warranties, including warranties of
              merchantability, fitness for a particular purpose, title, non-infringement,
              accuracy, availability, uninterrupted operation, data integrity, security,
              regulatory compliance, tax compliance, and error-free performance.
            </p>
            <p>
              We do not warrant that the Service, outputs, integrations, financial connections,
              imports, exports, reminders, tax estimates, or AI suggestions will be accurate,
              complete, timely, secure, uninterrupted, or suitable for your specific situation.
            </p>
          </LegalSection>

          <LegalSection title="14. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Sociatty LLC and its owners, officers,
              employees, contractors, agents, affiliates, licensors, and service providers will
              not be liable for indirect, incidental, special, consequential, exemplary, punitive,
              or enhanced damages, lost profits, lost revenue, lost savings, lost data, business
              interruption, goodwill loss, tax penalties, interest, audit costs, professional
              fees, or substitute services, even if advised of the possibility.
            </p>
            <p>
              To the maximum extent permitted by law, our total aggregate liability for all
              claims arising out of or relating to the Service or these Terms will not exceed the
              greater of (a) amounts you paid to us for the Service during the twelve months
              before the event giving rise to the claim or (b) one hundred U.S. dollars
              ($100).
            </p>
            <p>
              These limitations apply to all theories of liability, including contract, tort,
              negligence, strict liability, warranty, statute, and otherwise, except where
              prohibited by law.
            </p>
          </LegalSection>

          <LegalSection title="15. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless Sociatty LLC and its owners,
              officers, employees, contractors, agents, affiliates, licensors, and service
              providers from and against claims, damages, losses, liabilities, penalties, costs,
              and expenses, including reasonable attorneys&apos; fees, arising out of or related
              to your User Data, your use of the Service, your violation of these Terms, your
              violation of law, your tax positions or filings, your reliance on Service outputs,
              or your infringement or misappropriation of any rights.
            </p>
          </LegalSection>

          <LegalSection title="16. Governing Law and Dispute Resolution">
            <p>
              These Terms are governed by the laws of the State of New Jersey, without regard to
              conflict-of-law rules.
            </p>
            <Warning>
              Please read this section carefully. It requires individual arbitration and limits
              class and representative actions, subject to the opt-out right below.
            </Warning>
            <p>
              Any dispute, claim, or controversy arising out of or relating to these Terms or
              the Service will be resolved by binding individual arbitration administered by the
              American Arbitration Association under its applicable rules, except that either
              party may seek injunctive or equitable relief in court for misuse of intellectual
              property, unauthorized access, security incidents, or other irreparable harm.
            </p>
            <p>
              You and we waive the right to a jury trial and the right to participate in a class
              action, class arbitration, private attorney general action, or other representative
              proceeding. Arbitration will take place in Bergen County, New Jersey, unless the
              parties agree otherwise or the arbitrator permits remote proceedings.
            </p>
            <p>
              You may opt out of this arbitration agreement within 30 days after first accepting
              these Terms by emailing <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#5B82B4] underline">{CONTACT_EMAIL}</a> with
              the subject line &ldquo;Arbitration Opt-Out&rdquo; and your account email. Opting
              out does not affect any other part of these Terms.
            </p>
            <p>
              Any claim must be brought within one year after it arose, unless applicable law
              requires a longer period.
            </p>
          </LegalSection>

          <LegalSection title="17. Changes to These Terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we will
              provide notice through the Service, by email, or as otherwise required by law.
              Updated Terms become effective on the date stated in the notice or posted version.
              Continued use of the Service after updated Terms become effective means you accept
              them.
            </p>
          </LegalSection>

          <LegalSection title="18. General Provisions">
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Entire agreement:</strong> These Terms, the Privacy Policy, and any plan-specific terms presented at checkout are the entire agreement about the Service.</li>
              <li><strong>Severability:</strong> If a provision is unenforceable, the remaining provisions remain in effect.</li>
              <li><strong>No waiver:</strong> Failure to enforce a provision is not a waiver.</li>
              <li><strong>Assignment:</strong> You may not assign these Terms without our consent. We may assign them in connection with a merger, acquisition, reorganization, financing, sale of assets, or by operation of law.</li>
              <li><strong>Force majeure:</strong> We are not liable for delays or failures caused by events beyond our reasonable control.</li>
              <li><strong>Electronic communications:</strong> You consent to receive notices and communications electronically, including by email and in-product messages.</li>
            </ul>
          </LegalSection>

          <LegalSection title="19. Contact">
            <p>
              Questions and legal notices may be sent to:
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
