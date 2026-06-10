import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Helpers ---------------------------------------------------------------

function normalizeUrl(input) {
  let u = (input || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    return parsed.href;
  } catch {
    return null;
  }
}

// --- PageSpeed Insights (performance, SEO, accessibility, best practices) --

async function runPageSpeed(url) {
  const key = process.env.PAGESPEED_API_KEY;
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  ["performance", "accessibility", "best-practices", "seo"].forEach((c) =>
    endpoint.searchParams.append("category", c)
  );
  endpoint.searchParams.set("strategy", "mobile");
  if (key) endpoint.searchParams.set("key", key);

  const res = await fetch(endpoint.href);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PageSpeed API error (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};

  const score = (c) => (cats[c]?.score != null ? Math.round(cats[c].score * 100) : null);

  const metric = (id) => audits[id]?.displayValue || null;

  // Pull failing/opportunity audits as concrete issues
  const issues = [];
  for (const [id, a] of Object.entries(audits)) {
    if (a.score != null && a.score < 0.9 && a.title && a.scoreDisplayMode !== "informative") {
      issues.push({
        id,
        title: a.title,
        description: (a.description || "").replace(/\[.*?\]\(.*?\)/g, "").trim(),
        score: a.score,
      });
    }
  }
  issues.sort((x, y) => x.score - y.score);

  return {
    scores: {
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
    },
    metrics: {
      fcp: metric("first-contentful-paint"),
      lcp: metric("largest-contentful-paint"),
      cls: metric("cumulative-layout-shift"),
      tbt: metric("total-blocking-time"),
      speedIndex: metric("speed-index"),
    },
    topIssues: issues.slice(0, 8),
  };
}

// --- On-page SEO / technical parse -----------------------------------------

async function runOnPageSeo(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DigistickSiteCheck/1.0)" },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
  const h1s = $("h1").map((_, el) => $(el).text().trim()).get();
  const imgs = $("img");
  const imgsMissingAlt = imgs.filter((_, el) => !$(el).attr("alt")).length;
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(" ").length;
  const lowerHtml = html.toLowerCase();

  const checks = [];
  const pass = (label, ok, detail, cat = "seo") => checks.push({ label, ok, detail, cat });

  // ---- SEO & technical ----
  pass("Title tag", !!title && title.length >= 10 && title.length <= 65,
    title ? `“${title}” (${title.length} chars)` : "Missing title tag");
  pass("Meta description", !!metaDesc && metaDesc.length >= 50 && metaDesc.length <= 160,
    metaDesc ? `${metaDesc.length} chars` : "Missing meta description");
  pass("Single H1", h1s.length === 1, `${h1s.length} H1 tag(s) found`);
  pass("Image alt text", imgsMissingAlt === 0,
    `${imgsMissingAlt} of ${imgs.length} images missing alt text`);
  pass("Canonical tag", !!canonical, canonical || "No canonical tag");
  pass("Mobile viewport", !!viewport, viewport || "No viewport meta tag");
  pass("Open Graph (social)", !!ogTitle && !!ogImage,
    ogTitle && ogImage ? "og:title + og:image present" : "Missing OG tags — links won't preview well");
  pass("Structured data (schema)", hasSchema, hasSchema ? "JSON-LD found" : "No schema markup");
  pass("Content depth", wordCount >= 300, `${wordCount} words on page`);

  // ---- CRO & conversion signals (detected from the live HTML) ----
  const has = (...kw) => kw.some((k) => lowerHtml.includes(k));

  const hasUrgency = has("only", "hurry", "selling fast", "left in stock", "limited stock", "almost gone", "low stock");
  pass("Urgency / scarcity", hasUrgency,
    hasUrgency ? "Urgency signals detected" : "No urgency or scarcity cues — buyers feel no reason to act now", "cro");

  const hasTrust = has("cash on delivery", "cod", "secure checkout", "money back", "easy returns", "100% secure", "free returns");
  pass("Trust / COD signals", hasTrust,
    hasTrust ? "Trust signals present" : "No COD / returns / security badges found near buying decision", "cro");

  const hasReviews = has("reviews", "rating", "stars", "testimonial", "★", "verified buyer");
  pass("Reviews / social proof", hasReviews,
    hasReviews ? "Social proof detected" : "No reviews or ratings found — a top driver of purchase confidence", "cro");

  const ctaMatches = (lowerHtml.match(/add to cart|buy now|shop now|order now|add to bag/g) || []).length;
  pass("Clear call-to-action", ctaMatches > 0,
    ctaMatches > 0 ? `${ctaMatches} CTA(s) detected` : "No obvious buy/CTA button text found", "cro");

  const hasOffer = has("free shipping", "discount", "% off", "offer", "coupon", "save ");
  pass("Offer / incentive", hasOffer,
    hasOffer ? "Offer/incentive present" : "No visible offer or incentive to push the sale", "cro");

  const hasFreeShip = has("free shipping", "free delivery");
  pass("Free-shipping signal", hasFreeShip,
    hasFreeShip ? "Free shipping mentioned" : "No free-shipping message — a proven AOV and conversion lever", "cro");

  const hasExitCapture = has("subscribe", "newsletter", "get 10%", "join our", "sign up", "email") ;
  pass("Email / lead capture", hasExitCapture,
    hasExitCapture ? "Capture mechanism detected" : "No email/lead capture — abandoning visitors leave with nothing", "cro");

  const hasVideo = has("<video", "youtube.com/embed", "vimeo");
  pass("Product video / media", hasVideo,
    hasVideo ? "Rich media present" : "No product video — static pages convert lower than rich media", "cro");

  const hasFaq = has("faq", "frequently asked", "questions");
  pass("FAQ / objection handling", hasFaq,
    hasFaq ? "FAQ content found" : "No FAQ section — unanswered objections cost conversions", "cro");

  const hasPayIcons = has("razorpay", "visa", "mastercard", "upi", "paytm", "rupay", "phonepe");
  pass("Payment trust icons", hasPayIcons,
    hasPayIcons ? "Payment options shown" : "No visible payment/UPI trust icons at decision point", "cro");

  return {
    checks,
    meta: { title, metaDesc, h1Count: h1s.length, wordCount, imgsMissingAlt, imgCount: imgs.length, hasOg: !!ogTitle && !!ogImage },
  };
}

// --- Optional AI design / UX critique --------------------------------------

async function runDesignCritique(url, seo) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const prompt = `You are a senior conversion-focused web designer at a marketing agency.
A client's website is at ${url}. Based on this on-page data:
- Title: ${seo.meta.title || "(none)"}
- Meta description present: ${!!seo.meta.metaDesc}
- H1 count: ${seo.meta.h1Count}
- Word count: ${seo.meta.wordCount}

Give a punchy UX/conversion critique. Return ONLY valid JSON, no markdown:
{"verdict":"one-line overall take","wins":["1-3 likely strengths"],"fixes":["3-5 specific, high-impact conversion/UX fixes"]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

// --- Route handler ---------------------------------------------------------

export async function POST(req) {
  try {
    const { url: raw } = await req.json();
    const url = normalizeUrl(raw);
    if (!url) {
      return Response.json({ error: "Please enter a valid website URL." }, { status: 400 });
    }

    const [psResult, seoResult] = await Promise.allSettled([
      runPageSpeed(url),
      runOnPageSeo(url),
    ]);

    const pagespeed = psResult.status === "fulfilled" ? psResult.value : null;
    const seo = seoResult.status === "fulfilled" ? seoResult.value : null;

    let design = null;
    if (seo) design = await runDesignCritique(url, seo).catch(() => null);

    return Response.json({
      url,
      pagespeed,
      pagespeedError: psResult.status === "rejected" ? String(psResult.reason).slice(0, 200) : null,
      seo,
      seoError: seoResult.status === "rejected" ? "Could not fetch the page HTML (site may block bots)." : null,
      design,
      scannedAt: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: "Something went wrong while scanning. Try again." }, { status: 500 });
  }
}
