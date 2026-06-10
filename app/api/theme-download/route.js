import { THEME } from "../../lib/theme";

export const runtime = "nodejs";

function cfBase() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

async function verifyPaid(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) return false;
  const res = await fetch(cfBase() + "/orders/" + encodeURIComponent(orderId), {
    headers: { "x-api-version": "2023-08-01", "x-client-id": appId, "x-client-secret": secret },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.order_status === "PAID" && String(orderId).includes("_theme_");
}

// GET /api/theme-download?order_id=...
// Verifies the theme order is PAID, then redirects to the real file URL.
// Set THEME_FILE_URL in env to a private/expiring link (e.g. signed S3 / R2 URL).
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order_id");
  if (!orderId) return new Response("Missing order.", { status: 400 });

  const ok = await verifyPaid(orderId);
  if (!ok) return new Response("Payment not verified for this theme order.", { status: 402 });

  const fileUrl = process.env.THEME_FILE_URL;
  if (!fileUrl) {
    return Response.json({
      paid: true,
      message: "Payment verified. Theme delivery isn't auto-configured yet — set THEME_FILE_URL to enable instant download. Digistick will email your file shortly.",
    });
  }
  // Redirect the browser straight to the (private/expiring) download link.
  return Response.redirect(fileUrl, 302);
}
