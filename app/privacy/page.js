export const metadata = { title: "Privacy Policy — SiteCheck by Digistick" };

export default function Privacy() {
  return (
    <main className="legal">
      <a href="/" className="legal-logo">DIGI<span>STICK</span></a>
      <h1>Privacy Policy</h1>
      <p className="legal-date">Last updated: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>

      <p>This Privacy Policy explains how Digistick Services Private Limited ("Digistick", "we", "us") collects and uses information when you use SiteCheck (the "Service") at sitecheck.digistick.in.</p>

      <h2>1. Information we collect</h2>
      <p>We collect: (a) the website URLs you submit for auditing; (b) account information if you create one — your email address and an encrypted password (managed by our authentication provider, Supabase); (c) scan results and reports generated for your sites; and (d) basic technical data such as browser type and usage patterns.</p>

      <h2>2. How we use information</h2>
      <p>We use your information to run website audits, generate and store your reports, manage your account and dashboard, process payments for paid features, and improve the Service. We do not sell your personal information to third parties.</p>

      <h2>3. Third-party services</h2>
      <p>We rely on trusted providers to operate: Google PageSpeed Insights (performance data), Anthropic (AI-generated suggestions), Supabase (authentication and database), Cashfree (payment processing), and Vercel (hosting). Each processes data under its own privacy terms. We share only what is necessary for these services to function.</p>

      <h2>4. Website data</h2>
      <p>SiteCheck analyses publicly accessible pages of the URLs you submit. We do not access password-protected or private areas of any website.</p>

      <h2>5. Payments</h2>
      <p>Payments are processed securely by Cashfree. We do not store your card or banking details on our servers.</p>

      <h2>6. Data retention &amp; your rights</h2>
      <p>We retain your account and scan data while your account is active. You can remove a site (which deletes its scans) from your dashboard, or request deletion of your account and associated data by contacting us. You may also request a copy of the data we hold about you.</p>

      <h2>7. Cookies</h2>
      <p>We use only essential cookies and local storage needed to keep you signed in and to operate the Service. We do not use advertising trackers.</p>

      <h2>8. Contact</h2>
      <p>For any privacy questions or data requests, contact Digistick Services Private Limited at <a href="mailto:connect@digistick.in">connect@digistick.in</a>.</p>

      <p className="legal-foot"><a href="/">← Back to SiteCheck</a> · <a href="/terms">Terms of Service</a></p>
    </main>
  );
}
