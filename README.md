# SiteCheck by Digistick

A free website audit tool. Visitors paste a URL and get an instant diagnostic across
**performance, SEO, accessibility, best practices, and conversion/UX** — built as a
lead-generation funnel into Digistick's services.
    
## What it does   

- **Health scores** (Performance / SEO / Accessibility / Best Practices) via Google Lighthouse
- **Core Web Vitals** (LCP, FCP, CLS, TBT, Speed Index)
- **On-page SEO & technical checks** — title, meta description, H1, alt text, canonical,
  viewport, Open Graph, schema, content depth (parsed live from the page HTML)
- **Top fixes** ranked by impact
- **AI UX & conversion read** (optional — needs an Anthropic key)
- **Built-in CTA** routing visitors to a Digistick strategy call

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in keys (both optional)
npm run dev                  # http://localhost:3000
```

It works with **no keys at all** — PageSpeed runs at a low rate limit and the AI section is
hidden. Add keys to unlock full functionality.

## Deploy to Vercel (free, ~3 min)

1. Push this folder to a GitHub repo.
2. Go to vercel.com → **New Project** → import the repo.
3. Under **Environment Variables**, add (optional):
   - `PAGESPEED_API_KEY` — free from Google Cloud (PageSpeed Insights API)
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
4. Click **Deploy**. Done.

To use your own domain (e.g. `audit.digistick.in`): Vercel → Project → Settings → Domains.

## Keys — where to get them

- **PageSpeed (recommended):** https://developers.google.com/speed/docs/insights/v5/get-started
  Without it the tool still works but Google throttles anonymous requests.
- **Anthropic (optional):** https://console.anthropic.com — powers the UX critique. Costs a
  few paise per scan.

## Notes & limits

- Some sites block bots; if HTML can't be fetched, SEO checks are skipped but PageSpeed still runs.
- Lighthouse scans take 10–40s — that's normal, the API is doing a real render.
- All keys live server-side (in API routes) and are never exposed to the browser.

## Funnel idea

Free scan → email gate on the full PDF report → Digistick "we'll fix these" upsell.
This v1 captures no email yet; add a gate before the results render when you're ready.
