import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Vector Expense",
  description:
    "Vector Expense terms of service. Understand your rights and responsibilities when using Vector Expense.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-12"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-12">
          Last updated: March 14, 2026
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By downloading, installing, or using Vector Expense (&quot;the App&quot;), you agree
              to be bound by these Terms of Service. If you do not agree to
              these terms, do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              2. Description of Service
            </h2>
            <p>
              Vector Expense is a privacy-first credit card statement parser that
              extracts transaction data from PDF statements and provides
              spending insights. The App processes your documents, categorizes
              transactions, and presents analytics - all with a focus on keeping
              your data private and under your control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              3. User Responsibilities
            </h2>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Document Ownership:</strong> You
                represent that you have the legal right to upload and process any
                documents you submit to Vector Expense. You must only upload your own
                credit card statements or statements you are authorized to
                access.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Accurate Use:</strong> You are
                responsible for verifying the accuracy of parsed transaction
                data. Vector Expense uses AI and pattern matching to extract data, which
                may occasionally produce errors. The App is a tool for
                convenience, not a certified financial record.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Lawful Use:</strong> You agree to
                use Vector Expense only for lawful purposes and in accordance with
                applicable laws and regulations.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              4. Free Tier &amp; Usage Limits
            </h2>
            <p>
              Vector Expense offers a free tier with the following limitations:
            </p>
            <ul className="mt-4 space-y-2 list-disc list-inside text-muted-foreground">
              <li>
                Up to{" "}
                <span className="text-primary font-medium">
                  3 statement uploads per month
                </span>
              </li>
              <li>AI-powered parsing with automatic categorization</li>
              <li>Full local storage and analytics features</li>
              <li>Support for all 33+ supported banks</li>
            </ul>
            <p className="mt-4">
              Free tier limits reset on the first day of each calendar month.
              We reserve the right to modify free tier limits with reasonable
              notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              5. Pro Subscription
            </h2>
            <ul className="space-y-3 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Features:</strong> The Pro
                subscription removes upload limits and provides access to
                premium features including advanced analytics, export
                capabilities, and priority parsing.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Billing:</strong> Pro
                subscriptions are billed on a recurring basis (monthly or
                annually) through the platform&apos;s app store (Apple App Store or
                Google Play Store). Pricing is displayed before purchase.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Cancellation:</strong> You may
                cancel your subscription at any time through your app store
                account settings. Cancellation takes effect at the end of the
                current billing period. No refunds are provided for partial
                billing periods.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Price Changes:</strong> We
                reserve the right to change subscription pricing. Existing
                subscribers will be notified in advance and given the option to
                cancel before new pricing takes effect.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              6. Intellectual Property
            </h2>
            <p>
              Vector Expense, its logo, design, and underlying technology are the
              intellectual property of the Vector Expense team. You are granted a
              limited, non-exclusive, non-transferable license to use the App
              for personal, non-commercial purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              7. Disclaimer of Warranties
            </h2>
            <div className="p-4 rounded-lg bg-muted border border-border">
              <p>
                Vector Expense is provided{" "}
                <strong className="text-foreground">&quot;AS IS&quot;</strong> and{" "}
                <strong className="text-foreground">
                  &quot;AS AVAILABLE&quot;
                </strong>{" "}
                without warranties of any kind, either express or implied,
                including but not limited to implied warranties of
                merchantability, fitness for a particular purpose, and
                non-infringement.
              </p>
              <p className="mt-3">
                We do not warrant that the App will be uninterrupted,
                error-free, or that parsing results will be 100% accurate. AI
                and regex-based parsing are inherently probabilistic and may
                produce incorrect results.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, Vector Expense and its
              creators shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of
              profits, data, or goodwill, arising out of or in connection with
              your use of the App.
            </p>
            <p className="mt-3">
              You acknowledge that Vector Expense is a parsing and visualization tool
              and should not be used as the sole basis for financial decisions.
              Always verify important financial information with your bank or
              financial institution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              9. Data &amp; Privacy
            </h2>
            <p>
              Your use of Vector Expense is also governed by our{" "}
              <Link
                href="/privacy"
                className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              , which details how we handle (and do not store) your data. By
              using Vector Expense, you acknowledge and agree to the practices described
              in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              10. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate access to Vector Expense&apos;s
              parsing API for any user who violates these terms or abuses the
              service, including but not limited to exceeding rate limits,
              automated scraping, or uploading malicious files.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              11. Changes to Terms
            </h2>
            <p>
              We may update these Terms of Service from time to time. Changes
              will be posted on this page with an updated revision date.
              Continued use of the App after changes are posted constitutes
              acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              12. Governing Law
            </h2>
            <p>
              These terms shall be governed by and construed in accordance with
              applicable laws, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              13. Contact
            </h2>
            <p>
              For questions about these Terms of Service, please contact us:
            </p>
            <p className="mt-3">
              <a
                href="mailto:legal@vectorexpense.com"
                className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4"
              >
                legal@vectorexpense.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>Vector Expense - Your Money. Directed.</p>
        </div>
      </div>
    </main>
  );
}
