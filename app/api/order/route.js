import { THEME } from "../../lib/theme";

export const runtime = "nodejs";

// Creates a Cashfree order. Amount + product are fixed server-side so the
// client can never tamper with the price. Supports two products:
//   "report" → ₹799 fix-kit
//   "theme"  → the CRO theme upsell (price from theme config)
const PRICES = { report: 799, theme: THEME.price };

function cfBase() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

export async function POST(req) {
  try {
    const appId = process.env.CASHFREE_APP_ID;
    const secret = process.env.CASHFREE_SECRET_KEY;
    if (!appId || !secret) {
      return Response.json(
        { error: "Payments are not configured yet. Add Cashfree keys in environment variables." },
        { status: 503 }
      );
    }

    const { url, customer, product, returnTo } = await req.json();
    const kind = product === "theme" ? "theme" : "report";
    const amount = PRICES[kind];
    const orderId = "ds_" + kind + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    const base = process.env.APP_BASE_URL || "";
    const ret = returnTo === "dashboard-theme"
      ? base + "/dashboard?theme_order={order_id}"
      : returnTo === "dashboard"
      ? base + "/dashboard?order_id={order_id}&unlock=" + encodeURIComponent(url || "")
      : base + "/?order_id={order_id}&product=" + kind + "&audit=" + encodeURIComponent(url || "");

    const body = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: "cust_" + Math.random().toString(36).slice(2, 10),
        customer_email: customer?.email || "guest@digistick.in",
        customer_phone: customer?.phone || "9999999999",
      },
      order_meta: { return_url: ret },
      order_note: (kind === "theme" ? "Digistick CRO Theme — " : "SiteCheck fix-kit — ") + (url || ""),
    };

    const res = await fetch(cfBase() + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secret,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.message || "Could not start checkout. Try again." }, { status: 502 });
    }

    return Response.json({ orderId, paymentSessionId: data.payment_session_id, amount, product: kind, env: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox" });
  } catch (e) {
    return Response.json({ error: "Checkout failed to start." }, { status: 500 });
  }
}
