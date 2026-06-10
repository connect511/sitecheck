import * as cheerio from "cheerio";
import { selectSnippets } from "../../lib/liquidSnippets";

export const runtime = "nodejs";
export const maxDuration = 60;

function cfBase() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

async function verifyPayment(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secret) return { ok: false, reason: "Payments not configured." };
  const res = await fetch(cfBase() + "/orders/" + encodeURIComponent(orderId), {
    headers: { "x-api-version": "2023-08-01", "x-client-id": appId, "x-client-secret": secret },
  });
  if (!res.ok) return { ok: false, reason: "Could not verify payment." };
  const data = await res.json();
  return { ok: data.order_status === "PAID", reason: data.order_status };
}

async function fetchSeo(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DigistickSiteCheck/1.0)" } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

    const title = clean($("title").first().text());
    const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
    const metaKeywords = $('meta[name="keywords"]').attr("content")?.trim() || "";
    const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
    const ogDesc = $('meta[property="og:description"]').attr("content")?.trim() || "";
    const h1 = clean($("h1").first().text());
    const imgs = $("img");
    const missingAltSrcs = imgs.filter((_, el) => !$(el).attr("alt")).map((_, el) => $(el).attr("src")).get().slice(0, 8);
    const hasOg = !!ogTitle && !!$('meta[property="og:image"]').attr("content");

    // ---- Category signals (real page content, not just the title) ----
    const headings = $("h1, h2, h3").map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 25);
    const navLinks = $("nav a, header a").map((_, el) => clean($(el).text())).get().filter((t) => t && t.length < 40).slice(0, 30);
    // Shopify collection/product link slugs are strong signals
    const slugs = $('a[href*="/collections/"], a[href*="/products/"]').map((_, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/\/(collections|products)\/([a-z0-9-]+)/i);
      return m ? m[2].replace(/-/g, " ") : "";
    }).get().filter(Boolean).slice(0, 30);
    // Image filenames often name the product
    const imgNames = imgs.map((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      const m = src.split("?")[0].match(/\/([^\/]+)\.(?:jpg|jpeg|png|webp|avif)$/i);
      return m ? m[1].replace(/[-_]/g, " ").replace(/\d+/g, "").trim() : "";
    }).get().filter((s) => s && s.length > 3).slice(0, 20);
    // Visible body sample (first chunk of real text)
    const bodySample = clean($("body").clone().find("script,style,noscript").remove().end().text()).slice(0, 1200);

    const signals = {
      headings, navLinks, slugs, imgNames, metaKeywords, ogTitle, ogDesc, bodySample,
    };

    return { title, metaDesc, h1, imgCount: imgs.length, missingAlt: missingAltSrcs.length, missingAltSrcs, hasOg, signals };
  } catch { return null; }
}

async function callClaude(prompt, maxTokens = 1500) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

// STEP 1: Detect what the store actually sells from real page signals.
async function detectNiche(url, seo) {
  if (!process.env.ANTHROPIC_API_KEY || !seo?.signals) {
    return { category: null, products: [], audience: null, confidence: "low" };
  }
  const s = seo.signals;
  const prompt = `You are analyzing an e-commerce store to identify what it sells. Use ONLY the evidence below — do not guess from the brand name alone (brand names are often misleading).

URL: ${url}
Title: ${seo.title || "(none)"}
Meta description: ${seo.metaDesc || "(none)"}
Meta keywords: ${s.metaKeywords || "(none)"}
OG title/desc: ${s.ogTitle} ${s.ogDesc}
Headings: ${s.headings.join(" | ").slice(0, 600)}
Nav links: ${s.navLinks.join(", ").slice(0, 400)}
Collection/product slugs: ${s.slugs.join(", ").slice(0, 400)}
Image filenames: ${s.imgNames.join(", ").slice(0, 300)}
Body sample: ${s.bodySample.slice(0, 700)}

Return ONLY valid JSON, no markdown:
{"category":"the specific product category, e.g. 'home decor — wall art, clocks, tables'","products":["3-6 actual product types you found evidence for"],"audience":"likely target buyer","confidence":"high|medium|low"}
Rules: Base every word on the evidence. If signals conflict or are too thin to tell, set category to null and confidence to "low" rather than guessing. NEVER infer a category purely from the brand name.`;
  const out = await callClaude(prompt, 500);
  return out || { category: null, products: [], audience: null, confidence: "low" };
}

// 1) Personalized written fixes — uses the DETECTED niche, never guesses.
async function buildWrittenFixes(url, seo, niche) {
  const fallback = {
    titles: ["Your Brand | Primary Keyword + Benefit", "Buy [Product] Online — [Benefit] | Your Brand", "[Product] for [Audience] | Free Shipping | Your Brand"],
    metaDescription: "Shop quality products crafted for you. Great value, fast delivery, easy returns. Explore the collection and order today.",
    faq: [
      { q: "How long does delivery take?", a: "Orders are dispatched within 24–48 hours and typically arrive in 3–5 business days." },
      { q: "Do you offer Cash on Delivery?", a: "Yes, COD is available across most pin codes at checkout." },
      { q: "What is your return policy?", a: "Easy 7-day returns — if it's not right, send it back hassle-free." },
    ],
    altTexts: ["Product front view on white background", "Close-up showing texture and detail", "Product styled in a real setting"],
  };
  if (!process.env.ANTHROPIC_API_KEY || !seo) return fallback;

  const known = niche?.category && niche.confidence !== "low";
  const nicheBlock = known
    ? `CONFIRMED store category: ${niche.category}
Confirmed products: ${(niche.products || []).join(", ")}
Target audience: ${niche.audience || "general shoppers"}
Write everything specifically for THIS category and these products.`
    : `The store's exact category could NOT be confirmed from the page. Do NOT invent or assume a product type. Write the copy GENERICALLY (use neutral words like "products", "pieces", "items") so nothing is factually wrong. Do not name a category you are unsure of.`;

  const prompt = `You are a senior D2C copywriter writing ready-to-paste fixes for a store.
Store URL: ${url}
Current title: ${seo.title || "(none)"}
Current meta description: ${seo.metaDesc || "(none)"}
Images needing alt text: ${seo.missingAlt}

${nicheBlock}

CRITICAL: Never reference a product type that isn't in the confirmed category above. If unsure, stay generic. Being wrong about what they sell is worse than being generic.

Return ONLY valid JSON, no markdown:
{"titles":["3 SEO title options, each <=60 chars"],
"metaDescription":"one meta description <=155 chars with benefit + CTA",
"faq":[{"q":"question","a":"answer"}] (4 FAQs handling real buying objections for this category),
"altTexts":["${Math.min(seo.missingAlt || 3, 6)} descriptive alt-text suggestions"]}`;
  return (await callClaude(prompt, 1400)) || fallback;
}

// 2) 14-day action plan
async function buildActionPlan(url, failedLabels) {
  const fallback = {
    days: [
      { day: "1–2", task: "Add urgency + COD trust badges to your top product page", why: "Highest-impact, fastest win" },
      { day: "3–4", task: "Paste in the free-shipping bar and sticky mobile cart", why: "Lifts AOV and mobile conversions" },
      { day: "5–6", task: "Rewrite product title + meta description", why: "More clicks from Google" },
      { day: "7–8", task: "Add the FAQ section to handle objections", why: "Reduces hesitation" },
      { day: "9–10", task: "Fix missing image alt text", why: "Recovers organic traffic" },
      { day: "11–12", task: "Add reviews/social proof near the buy button", why: "Builds purchase confidence" },
      { day: "13–14", task: "Re-scan your store and compare scores", why: "Measure the lift, plan next round" },
    ],
  };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  const prompt = `Create a focused 14-day conversion-optimization action plan for a Shopify store at ${url}.
Issues detected: ${failedLabels.join(", ") || "general CRO gaps"}.
Return ONLY valid JSON: {"days":[{"day":"1–2","task":"specific action","why":"one-line reason"}]} with 7 entries covering all 14 days, prioritized highest-impact first, ending with a re-scan.`;
  return (await callClaude(prompt, 900)) || fallback;
}

// 3) Competitor benchmark
function buildBenchmark(scores) {
  const perf = scores?.performance ?? 60, seo = scores?.seo ?? 80, acc = scores?.accessibility ?? 85;
  const yourAvg = Math.round((perf + seo + acc) / 3);
  const topAvg = 92; // typical top-performer band
  return {
    your: yourAvg,
    top: topAvg,
    gap: Math.max(topAvg - yourAvg, 0),
    rows: [
      { metric: "Performance", you: perf, top: 90 },
      { metric: "SEO", you: seo, top: 95 },
      { metric: "Accessibility", you: acc, top: 92 },
    ],
  };
}

// 4) Install-ready Shopify liquid file assembled from selected snippets
function buildInstallFile(snippets, url) {
  const header = `{%- comment -%}
  ============================================================
  DIGISTICK CRO BOOSTER PACK
  Generated for: ${url}
  How to install:
    1. In Shopify admin: Online Store > Themes > ... > Edit code
    2. Snippets > Add a new snippet > name it "ds-cro"
    3. Paste this entire file and Save
    4. Where you want each block, add: {%- render 'ds-cro', block: 'urgency' -%}
       (block names: ${snippets.map((s) => s.id).join(", ")})
  ============================================================
{%- endcomment -%}

{%- assign b = block | default: 'all' -%}
`;
  const blocks = snippets.map((s) => `
{%- if b == '${s.id}' or b == 'all' -%}
  {%- comment -%} ${s.title} — ${s.where} {%- endcomment -%}
${s.code}
{%- endif -%}`).join("\n");
  return header + blocks + "\n";
}

export async function POST(req) {
  try {
    const { orderId, url, preview, audit } = await req.json();
    if (!url) return Response.json({ error: "Missing URL." }, { status: 400 });

    // Allow preview without payment ONLY when explicitly requested by the preview flag (server still never charges)
    if (!preview) {
      if (!orderId) return Response.json({ error: "Missing order." }, { status: 400 });
      const pay = await verifyPayment(orderId);
      if (!pay.ok) return Response.json({ error: `Payment not confirmed (status: ${pay.reason}).` }, { status: 402 });
    }

    const seo = await fetchSeo(url);
    const failedLabels = (audit?.seo?.checks || []).filter((c) => !c.ok).map((c) => c.label);

    // STEP 1: detect the real category first (so copy can't drift to the wrong niche).
    const niche = await detectNiche(url, seo);

    // STEP 2: generate everything constrained to the detected niche.
    const [writtenFixes, actionPlan] = await Promise.all([
      buildWrittenFixes(url, seo, niche),
      buildActionPlan(url, failedLabels),
    ]);
    const snippets = selectSnippets(audit?.seo || (seo ? { checks: [] } : null));
    const benchmark = buildBenchmark(audit?.pagespeed?.scores || null);
    const installFile = buildInstallFile(snippets, url);

    const roadmap = {
      summary: "Your personalized fix-kit: written copy, an install-ready file, a 14-day plan, and how you stack up against top stores.",
      steps: actionPlan.days?.slice(0, 6).map((d) => ({ title: d.task, impact: "High", detail: d.why })) || [],
    };

    return Response.json({
      paid: true, preview: !!preview, url, niche,
      writtenFixes, actionPlan, benchmark, snippets, installFile, roadmap,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: "Could not generate the premium report." }, { status: 500 });
  }
}
