import nodemailer from "nodemailer";

/* Transactional email via your own SMTP (Google Workspace app password works).
   Required env vars in Vercel:
     SMTP_USER = connect@digistick.in   (the sender mailbox)
     SMTP_PASS = the 16-char app password (no spaces)
   Optional: SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 587), MAIL_FROM_NAME.
   Every send is wrapped so a mail failure can NEVER break a payment or booking. */

let _transport = null;
function transport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return _transport;
}

export async function sendMail({ to, subject, html }) {
  try {
    const t = transport();
    if (!t || !to) return false;
    await t.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || "Digistick SiteCheck"}" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });
    return true;
  } catch (e) {
    console.error("mailer:", e.message);
    return false;
  }
}

/* Branded wrapper matching the OTP email design */
export function tpl({ heading, body, ctaText, ctaUrl }) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7eaf3;">
      <tr><td align="center" style="background-color:#2E60B4;background-image:linear-gradient(135deg,#2E60B4,#2563EB);padding:26px 24px;">
        <span style="font-size:21px;font-weight:bold;color:#ffffff;">DIGI<span style="color:#FFD166;">STICK</span></span>
        <div style="margin-top:3px;font-size:9px;font-weight:bold;letter-spacing:3px;color:#cdddf7;">SITECHECK</div>
      </td></tr>
      <tr><td style="padding:30px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#15203a;font-weight:bold;">${heading}</h1>
        <div style="font-size:13.5px;line-height:1.7;color:#55585e;">${body}</div>
      </td></tr>
      ${ctaText ? `<tr><td align="center" style="padding:20px 32px 30px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="background-color:#2E60B4;border-radius:10px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${ctaText}</a>
        </td></tr></table>
      </td></tr>` : `<tr><td style="padding:0 0 26px 0;"></td></tr>`}
      <tr><td align="center" style="background-color:#15203a;padding:20px 24px;">
        <div style="font-size:12px;font-weight:bold;color:#ffffff;">DIGI<span style="color:#2563EB;">STICK</span></div>
        <p style="margin:6px 0 0 0;font-size:10.5px;line-height:1.6;color:#8a93a6;">Digistick Services Pvt Ltd &middot; Noida, India</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

export function inrFmt(n) { return "₹" + (n || 0).toLocaleString("en-IN"); }
