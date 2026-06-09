export const runtime = "nodejs";

// Creates a Cashfree order and returns the payment_session_id the frontend
// SDK needs to open checkout. Amount is fixed server-side (₹399) so the client
// can never tamper with the price.

const PRICE = 399; // INR

function cfBase() {
  // Use sandbox while testing; switch to production by setting CASHFREE_ENV=production
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

    const { url, customer } = await req.json();
    const orderId = "ds_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    const body = {
      order_id: orderId,
      order_amount: PRICE,
      order_currency: "INR",
      customer_details: {
        customer_id: "cust_" + Math.random().toString(36).slice(2, 10),
        customer_email: customer?.email || "guest@digistick.in",
        customer_phone: customer?.phone || "9999999999",
      },
      order_meta: {
        // Cashfree appends order_id automatically; return to same app
        return_url: (process.env.APP_BASE_URL || "") + "/?order_id={order_id}&audit=" + encodeURIComponent(url || ""),
      },
      order_note: "SiteCheck premium report — " + (url || ""),
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
      return Response.json(
        { error: data.message || "Could not start checkout. Try again." },
        { status: 502 }
      );
    }

    return Response.json({
      orderId,
      paymentSessionId: data.payment_session_id,
      amount: PRICE,
    });
  } catch (e) {
    return Response.json({ error: "Checkout failed to start." }, { status: 500 });
  }
}
