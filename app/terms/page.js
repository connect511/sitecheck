export const metadata = { title: "Terms of Service — SiteCheck by Digistick" };

export default function Terms() {
  return (
    <main className="legal">
      <a href="/" className="legal-logo">DIGI<span>STICK</span></a>
      <h1>Terms of Service</h1>
      <p className="legal-date">Last updated: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>

      <p>These Terms govern your use of SiteCheck (the "Service"), operated by Digistick Services Private Limited ("Digistick"). By using the Service you agree to these Terms.</p>

      <h2>1. The Service</h2>
      <p>SiteCheck provides automated website audits and improvement suggestions across performance, SEO, accessibility and conversion. Audit results, AI-generated suggestions, and growth blueprints are provided for guidance only. Results depend on third-party data (such as Google PageSpeed) and may vary between scans.</p>

      <h2>2. No guarantee of results</h2>
      <p>Our suggestions are recommendations, not guarantees. We do not warrant any specific increase in traffic, ranking, conversions, or revenue. Implementing changes to your store is your responsibility, and you should review any code or copy before publishing it.</p>

      <h2>3. Paid features</h2>
      <p>Certain features (the fix-kit, growth blueprint, score history, scheduled scans and others, collectively "Pro") require a one-time payment. Prices are shown at checkout. Payments are processed by Cashfree.</p>

      <h2>4. Refunds</h2>
      <p>Because Pro delivers digital content (written fixes, code snippets and reports) immediately on payment, purchases are generally non-refundable once the content has been accessed. If you experience a genuine technical problem that prevents you from receiving what you paid for, contact us within 7 days at connect@digistick.in and we will make it right.</p>

      <h2>5. Acceptable use</h2>
      <p>You agree to scan only websites you own or are authorised to audit, and not to misuse, overload, or attempt to disrupt the Service.</p>

      <h2>6. Accounts</h2>
      <p>You are responsible for keeping your account credentials secure and for activity under your account.</p>

      <h2>7. Limitation of liability</h2>
      <p>To the extent permitted by law, Digistick is not liable for any indirect or consequential loss arising from use of the Service. Our total liability for any claim is limited to the amount you paid us for the Service in the preceding three months.</p>

      <h2>8. Changes</h2>
      <p>We may update these Terms; material changes will be reflected by the "last updated" date above. Continued use after changes means you accept the updated Terms.</p>

      <h2>9. Contact</h2>
      <p>Questions about these Terms: <a href="mailto:connect@digistick.in">connect@digistick.in</a>, Digistick Services Private Limited, Noida, India.</p>

      <p className="legal-foot"><a href="/">← Back to SiteCheck</a> · <a href="/privacy">Privacy Policy</a></p>
    </main>
  );
}
