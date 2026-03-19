import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Vector Expense",
  description:
    "Vector Expense privacy policy. Your data stays on your device. No accounts, no tracking, no server storage.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: March 14, 2026</p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Our Core Principle</h2>
            <p>Vector Expense is built on a simple promise: <strong className="text-foreground">your financial data never leaves your device</strong>. We designed Vector Expense from the ground up to be privacy-first. There are no accounts to create, no data to sync, and no servers storing your information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">How Your Data Is Processed</h2>
            <ul className="space-y-4 list-none">
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">PDF Processing:</strong> When you upload a credit card statement, the PDF is sent to our server solely for text extraction and parsing. The file is processed entirely in memory and is <strong className="text-foreground">immediately discarded</strong> after parsing is complete. We do not write your PDF to disk, log its contents, or retain any copy.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">Local Storage Only:</strong> All parsed transactions, statements, and spending insights are stored locally on your device using SQLite. This data never leaves your phone.
              </li>
              <li className="pl-4 border-l-2 border-primary/30">
                <strong className="text-foreground">No Cloud Sync:</strong> Vector Expense does not have user accounts, cloud storage, or any synchronization mechanism. Your data exists only on the device where you use the app.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">What We Do NOT Collect</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Personal information or identity details</li>
              <li>Credit card numbers or account numbers</li>
              <li>Transaction data or financial history</li>
              <li>Device identifiers or fingerprints</li>
              <li>Usage analytics or behavioral tracking</li>
              <li>Location data</li>
              <li>Cookies or cross-site tracking pixels</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Third-Party Services</h2>
            <p>Vector Expense does not share your data with any third parties. We do not integrate advertising SDKs, analytics platforms, or social media trackers. The only external service used is our own parsing API, which processes your PDF in memory and retains nothing.</p>
            <p className="mt-3">When AI-powered parsing is used, the text content of your statement may be sent to AI providers for processing. This is done without any identifying information, and no data is retained for training purposes under their API terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Data Retention</h2>
            <p>Since we do not store your data on our servers, there is nothing to retain or delete on our end. All data lives on your device. You can delete all your data at any time by clearing the app&apos;s storage or uninstalling Vector Expense.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Security</h2>
            <p>All communication between the Vector Expense app and our parsing API uses HTTPS/TLS encryption. PDFs are processed in isolated memory buffers and are never persisted. Our API enforces rate limiting to prevent abuse.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Children&apos;s Privacy</h2>
            <p>Vector Expense is not directed at children under the age of 13. We do not knowingly collect any information from children.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Any changes will be reflected on this page with an updated revision date. Our core commitment to privacy-first design will not change.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Contact Us</h2>
            <p>If you have questions about this privacy policy or Vector Expense&apos;s privacy practices, please reach out:</p>
            <p className="mt-3"><a href="mailto:privacy@vectorexpense.com" className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4">privacy@vectorexpense.com</a></p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>Vector Expense - Your Money. Directed.</p>
        </div>
      </div>
    </main>
  );
}
