import * as cheerio from "cheerio";
import { selectSnippets } from "../../lib/liquidSnippets";

export const runtime = "nodejs";
export const maxDuration = 60;

function cfBase() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

// --- Verify the order was actually PAID (never trust the client) -----------

async function verifyPayment(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) return { ok: false, reason: "Payments not configured." };

  const res = await fetch(cfBase() + "/orders/" + encodeURIComponent(orderId), {
    headers: {
      "x-api-version": "2023-08-01",
      "x-client-id": appId,
      "x-client-secret": secret,
    },
  });
  if (!res.ok) return { ok: false, reason: "Could not verify payment." };
  const data = await res.json();
  return { ok: data.order_status === "PAID", reason: data.order_status };
}

// --- Re-parse on-page data server-side so the report reflects the real site -

async function fetchSeo(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DigistickSiteCheck/1.0)" },
    });
    const $ = cheerio.load(await res.text());
    const title = $("title").first().text().trim();
    const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
    const imgs = $("img");
    const imgsMissingAlt = imgs.filter((_, el) => !$(el).attr("alt")).length;
    const hasOg = !!$('meta[property="og:title"]').attr("content") && !!$('meta[property="og:image"]').attr("content");
    const checks = [
      { label: "Title tag", ok: !!title && title.length >= 10 && title.length <= 65 },
      { label: "Meta description", ok: !!metaDesc && metaDesc.length >= 50 },
      { label: "Image alt text", ok: imgsMissingAlt === 0 },
      { label: "Open Graph (social)", ok: hasOg },
    ];
    return { checks, meta: { title, metaDesc, imgsMissingAlt, imgCount: imgs.length, hasOg } };
  } catch {
    return null;
  }
}

// --- AI conversion roadmap --------------------------------------------------

async function buildRoadmap(url, seo) {
  const key = process.env.ANTHROPIC_API_KEY;
  const fallback = {
    summary: "Prioritized conversion fixes based on your scan.",
    steps: [
      { title: "Add a compelling title & meta description", impact: "High", detail: "Improves click-through from Google and social shares." },
      { title: "Fix missing image alt text", impact: "Medium", detail: "Helps SEO and accessibility; can lift organic traffic." },
      { title: "Add trust + COD badges near Add to Cart", impact: "High", detail: "Reduces checkout anxiety for Indian shoppers." },
      { title: "Install urgency + sticky mobile cart", impact: "High", detail: "Drives faster purchase decisions on mobile." },
    ],
  };
  if (!key) return fallback;

  const prompt = `You are a senior D2C conversion strategist. A Shopify store at ${url} was scanned.
Detected on-page facts:
- Title: ${seo?.meta?.title || "(missing)"}
- Meta description present: ${!!seo?.meta?.metaDesc}
- Images missing alt: ${seo?.meta?.imgsMissingAlt ?? "?"} of ${seo?.meta?.imgCount ?? "?"}
- Open Graph tags: ${seo?.meta?.hasOg ? "present" : "missing"}

Return ONLY valid JSON (no markdown):
{"summary":"one-line overview","steps":[{"title":"action","impact":"High|Medium|Low","detail":"1 sentence why + how"}]}
Give 5-7 prioritized, specific, conversion-focused steps for THIS store.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return fallback;
  }
}

// --- Handler ---------------------------------------------------------------

export async function POST(req) {
  try {
    const { orderId, url } = await req.json();
    if (!orderId || !url) {
      return Response.json({ error: "Missing order or URL." }, { status: 400 });
    }

    const pay = await verifyPayment(orderId);
    if (!pay.ok) {
      return Response.json(
        { error: `Payment not confirmed (status: ${pay.reason}). If you were charged, contact support.` },
        { status: 402 }
      );
    }

    const seo = await fetchSeo(url);
    const [roadmap] = await Promise.all([buildRoadmap(url, seo)]);
    const snippets = selectSnippets(seo);

    return Response.json({ paid: true, url, roadmap, snippets, generatedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: "Could not generate the premium report." }, { status: 500 });
  }
}
