// Curated, paste-ready Shopify CRO snippets.
// Each returns { id, title, why, where, code }. Selection is driven by the audit
// so buyers only get snippets relevant to what's actually wrong/missing on their store.

export const SNIPPETS = {
  urgencyScarcity: {
    id: "urgencyScarcity",
    title: "Low-stock urgency bar (product page)",
    why: "Scarcity is one of the highest-ROI CRO levers for D2C. Shows a live-feel stock count that nudges hesitant buyers to act.",
    where: "Paste into your product template (sections/main-product.liquid) just below the price.",
    code: `{%- comment -%} Digistick — Low-stock urgency {%- endcomment -%}
{%- assign qty = product.selected_or_first_available_variant.inventory_quantity -%}
{%- if qty > 0 and qty <= 15 -%}
  <div class="ds-urgency">
    <span class="ds-pulse"></span>
    Hurry — only <strong>{{ qty }}</strong> left in stock!
  </div>
{%- endif -%}
<style>
  .ds-urgency{display:flex;align-items:center;gap:8px;background:#fff4f4;color:#c0392b;
    border:1px solid #f3c2c2;border-radius:8px;padding:10px 14px;font-weight:600;margin:12px 0;font-size:14px}
  .ds-pulse{width:9px;height:9px;border-radius:50%;background:#e74c3c;animation:dspulse 1.2s infinite}
  @keyframes dspulse{0%{box-shadow:0 0 0 0 rgba(231,76,60,.5)}70%{box-shadow:0 0 0 8px rgba(231,76,60,0)}100%{box-shadow:0 0 0 0 rgba(231,76,60,0)}}
</style>`,
  },

  codTrust: {
    id: "codTrust",
    title: "COD + trust badges row (product page)",
    why: "COD assurance and trust badges directly reduce checkout anxiety for Indian D2C shoppers — a top reason for cart abandonment.",
    where: "Paste into sections/main-product.liquid below the Add to Cart button.",
    code: `{%- comment -%} Digistick — COD & trust badges {%- endcomment -%}
<div class="ds-trust">
  <div class="ds-trust-item"><span>💵</span> Cash on Delivery available</div>
  <div class="ds-trust-item"><span>🔁</span> Easy 7-day returns</div>
  <div class="ds-trust-item"><span>🔒</span> 100% secure checkout</div>
  <div class="ds-trust-item"><span>🚚</span> Fast dispatch in 24–48h</div>
</div>
<style>
  .ds-trust{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;
    border:1px solid #eee;border-radius:12px;padding:14px;background:#fafafa}
  .ds-trust-item{display:flex;align-items:center;gap:8px;font-size:13.5px;color:#333;font-weight:500}
  .ds-trust-item span{font-size:17px}
  @media(max-width:480px){.ds-trust{grid-template-columns:1fr}}
</style>`,
  },

  stickyAtc: {
    id: "stickyAtc",
    title: "Sticky Add-to-Cart bar (mobile)",
    why: "On mobile, the buy button scrolls out of view. A sticky bar keeps the primary action always reachable — a proven conversion lift.",
    where: "Paste near the bottom of sections/main-product.liquid.",
    code: `{%- comment -%} Digistick — Sticky mobile ATC {%- endcomment -%}
<div class="ds-sticky-atc">
  <div class="ds-sa-info">
    <span class="ds-sa-title">{{ product.title | truncate: 28 }}</span>
    <span class="ds-sa-price">{{ product.selected_or_first_available_variant.price | money }}</span>
  </div>
  <button class="ds-sa-btn" onclick="document.querySelector('form[action*=\\'/cart/add\\'] [type=submit]').click()">
    Add to cart
  </button>
</div>
<style>
  .ds-sticky-atc{position:fixed;left:0;right:0;bottom:0;z-index:50;display:none;
    align-items:center;justify-content:space-between;gap:12px;background:#fff;
    box-shadow:0 -4px 20px rgba(0,0,0,.12);padding:10px 14px}
  .ds-sa-info{display:flex;flex-direction:column}
  .ds-sa-title{font-size:12px;color:#666}
  .ds-sa-price{font-size:16px;font-weight:700}
  .ds-sa-btn{flex:none;background:#111;color:#fff;border:0;border-radius:8px;
    padding:12px 22px;font-weight:700;font-size:15px}
  @media(max-width:749px){.ds-sticky-atc{display:flex}}
</style>`,
  },

  freeShipBar: {
    id: "freeShipBar",
    title: "Free-shipping progress bar (cart)",
    why: "Telling shoppers how close they are to free shipping is one of the most reliable ways to lift average order value.",
    where: "Paste into sections/cart-drawer.liquid or main-cart.liquid. Set THRESHOLD to your free-shipping amount (in paise).",
    code: `{%- comment -%} Digistick — Free shipping progress {%- endcomment -%}
{%- assign threshold = 99900 -%}
{%- assign remaining = threshold | minus: cart.total_price -%}
<div class="ds-ship">
  {%- if remaining > 0 -%}
    <p>Add <strong>{{ remaining | money }}</strong> more for <strong>FREE shipping</strong> 🚚</p>
  {%- else -%}
    <p>🎉 You’ve unlocked <strong>FREE shipping!</strong></p>
  {%- endif -%}
  <div class="ds-ship-track">
    <div class="ds-ship-fill" style="width:{% if cart.total_price >= threshold %}100{% else %}{{ cart.total_price | times: 100 | divided_by: threshold }}{% endif %}%"></div>
  </div>
</div>
<style>
  .ds-ship{margin:12px 0;font-size:14px}
  .ds-ship-track{height:8px;background:#eee;border-radius:99px;margin-top:8px;overflow:hidden}
  .ds-ship-fill{height:100%;background:linear-gradient(90deg,#34e0c4,#15a88f);border-radius:99px;transition:width .4s}
</style>`,
  },

  reviewsBlock: {
    id: "reviewsBlock",
    title: "Social-proof review highlight (product page)",
    why: "Reviews near the buy button reduce purchase risk. This pulls a star rating + count into a clean, fast-loading block.",
    where: "Paste into sections/main-product.liquid below the title. Replace the static numbers with your review app's metafields if available.",
    code: `{%- comment -%} Digistick — Review highlight {%- endcomment -%}
<div class="ds-reviews">
  <div class="ds-stars">★★★★★</div>
  <span class="ds-rev-text"><strong>4.8</strong> · Loved by <strong>2,400+</strong> happy customers</span>
</div>
<style>
  .ds-reviews{display:flex;align-items:center;gap:10px;margin:8px 0 14px}
  .ds-stars{color:#ffb400;font-size:18px;letter-spacing:2px}
  .ds-rev-text{font-size:14px;color:#444}
</style>`,
  },

  exitOffer: {
    id: "exitOffer",
    title: "Exit-intent discount popup",
    why: "Captures abandoning visitors with a one-time code. Recovers a slice of the ~70% who would otherwise leave with nothing.",
    where: "Paste into theme.liquid just before </body>. Change DS10 to your real discount code.",
    code: `{%- comment -%} Digistick — Exit intent offer {%- endcomment -%}
<div id="ds-exit" class="ds-exit-wrap">
  <div class="ds-exit-card">
    <button class="ds-exit-x" onclick="document.getElementById('ds-exit').style.display='none'">×</button>
    <h3>Wait — here’s 10% off 🎁</h3>
    <p>Use code <strong>DS10</strong> at checkout before you go.</p>
    <button class="ds-exit-cta" onclick="navigator.clipboard.writeText('DS10');this.innerText='Copied!'">Copy code</button>
  </div>
</div>
<style>
  .ds-exit-wrap{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);
    align-items:center;justify-content:center}
  .ds-exit-card{background:#fff;border-radius:16px;padding:32px;max-width:360px;text-align:center;position:relative}
  .ds-exit-card h3{font-size:22px;margin:0 0 8px}
  .ds-exit-x{position:absolute;top:10px;right:14px;border:0;background:none;font-size:24px;cursor:pointer;color:#999}
  .ds-exit-cta{margin-top:14px;background:#111;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-weight:700;cursor:pointer}
</style>
<script>
  (function(){var shown=false;document.addEventListener('mouseout',function(e){
    if(!shown && e.clientY<=0){document.getElementById('ds-exit').style.display='flex';shown=true;}});})();
</script>`,
  },

  ogMeta: {
    id: "ogMeta",
    title: "Open Graph social-preview tags",
    why: "Without OG tags your links show as bare text when shared on WhatsApp, Instagram, or Facebook — killing click-through on every share.",
    where: "Paste into the <head> of theme.liquid (or snippets/meta-tags.liquid).",
    code: `{%- comment -%} Digistick — Open Graph tags {%- endcomment -%}
<meta property="og:type" content="website">
<meta property="og:title" content="{{ page_title | escape }}">
<meta property="og:description" content="{{ page_description | default: shop.description | escape }}">
<meta property="og:url" content="{{ canonical_url }}">
{%- if product -%}
  <meta property="og:image" content="https:{{ product.featured_image | image_url: width: 1200 }}">
{%- else -%}
  <meta property="og:image" content="https:{{ shop.brand.logo | image_url: width: 1200 }}">
{%- endif -%}
<meta name="twitter:card" content="summary_large_image">`,
  },
};

// Decide which snippets a given audit should unlock.
export function selectSnippets(seo) {
  const ids = new Set(["urgencyScarcity", "codTrust", "stickyAtc"]); // always-valuable core
  if (!seo) return [...ids].map((id) => SNIPPETS[id]);

  const failed = (label) =>
    seo.checks?.some((c) => c.label === label && !c.ok);

  if (failed("Open Graph (social)")) ids.add("ogMeta");
  // Cart/AOV + recovery levers are broadly useful for any store
  ids.add("freeShipBar");
  ids.add("reviewsBlock");
  ids.add("exitOffer");

  return [...ids].map((id) => SNIPPETS[id]);
}
