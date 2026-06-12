export const metadata = { title: "Refunds & Cancellations — SiteCheck by Digistick" };

export default function Refunds() {
  return (
    <main className="legal">
      <a href="/" className="legal-logo">DIGI<span>STICK</span></a>
      <h1>Refunds &amp; Cancellations Policy</h1>
      <p className="legal-date">Last updated: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>

      <p>This policy explains when payments made on SiteCheck (operated by Digistick Services Private Limited) are refundable, and how cancellations work. All payments are processed securely by Cashfree Payments.</p>

      <h2>1. Growth Plan / Fix-Kit (₹799)</h2>
      <p>The Growth Plan is a digital product delivered immediately after payment — written fixes, code snippets, an installable theme file and a growth blueprint generated for your store. Because the content is delivered and accessible instantly, this purchase is <b>non-refundable once the report has been generated and accessed</b>.</p>
      <p>Exception: if a technical failure on our side prevents your report from being generated or unlocked within 24 hours of payment, you are entitled to a <b>full refund</b>. Write to connect@digistick.in within 7 days of the payment.</p>

      <h2>2. Theme purchase (₹3,999)</h2>
      <p>Theme purchases are non-refundable once the theme file has been downloaded. If your payment succeeded but the download link does not work, contact us — we will fix access or issue a full refund.</p>

      <h2>3. Service bookings &amp; advance payments</h2>
      <p>Booking a service (speed optimization, SEO, CRO, ads management, development, shoots and others) requires a <b>30% advance</b>. The advance is fully adjustable against your final invoice.</p>
      <p><b>Cancellation by you:</b> you may cancel a booking any time <b>before the kickoff call / before work begins</b> for a full refund of the advance. Once work has started, the advance is non-refundable, as team time has been allotted to your project.</p>
      <p><b>Cancellation by us:</b> if we are unable to take up your project for any reason, your advance is refunded in full within 5–7 business days.</p>

      <h2>4. Failed or duplicate payments</h2>
      <p>If money was deducted but your purchase did not unlock, the amount is usually auto-reversed by your bank within 5–7 business days. If it is not, email us with the transaction details and we will trace it with Cashfree and resolve it.</p>

      <h2>5. How refunds are processed</h2>
      <p>Approved refunds are issued to the original payment method via Cashfree within <b>5–7 business days</b> of approval. The exact credit time depends on your bank or UPI provider.</p>

      <h2>6. How to request a refund or cancellation</h2>
      <p>Email <a href="mailto:connect@digistick.in">connect@digistick.in</a> from your registered email with your store URL and payment details, or message us from your dashboard&rsquo;s <b>Messages</b> tab. Every request receives a response within one business day.</p>

      <h2>7. Contact</h2>
      <p>Digistick Services Private Limited, Sector 68, Noida, Uttar Pradesh, India · connect@digistick.in</p>
    </main>
  );
}
