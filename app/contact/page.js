export const metadata = { title: "Contact Us — SiteCheck by Digistick" };

export default function Contact() {
  return (
    <main className="legal">
      <a href="/" className="legal-logo">DIGI<span>STICK</span></a>
      <h1>Contact Us</h1>
      <p className="legal-date">We typically respond within one business day.</p>

      <h2>Get in touch</h2>
      <p>For support with your audit, Growth Plan, service bookings, payments or refunds, reach us through any of the channels below.</p>

      <h2>Email</h2>
      <p><a href="mailto:connect@digistick.in">connect@digistick.in</a></p>

      <h2>Registered business</h2>
      <p>
        Digistick Services Private Limited<br />
        Sector 68, Noida, Uttar Pradesh, India
      </p>

      <h2>From your dashboard</h2>
      <p>Logged-in customers can also message our team directly from the <a href="/dashboard">dashboard</a> under the <b>Messages</b> tab — replies land right back in your account.</p>

      <h2>Payments &amp; billing queries</h2>
      <p>Payments on SiteCheck are processed securely by Cashfree Payments. For any billing issue — a failed payment, a double charge, or a payment that was deducted but not reflected — email us with your registered email address and the approximate time of the transaction, and we will resolve it promptly.</p>

      <h2>Business hours</h2>
      <p>Monday to Saturday, 10:00 AM – 7:00 PM IST. Messages received outside these hours are answered the next business day.</p>
    </main>
  );
}
